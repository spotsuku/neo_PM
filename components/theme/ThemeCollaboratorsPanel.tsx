"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

export interface CollaboratorRow {
  id: string;
  user_id: string;
  role: "editor" | "viewer";
  display_name: string | null;
  avatar_url: string | null;
}

export interface OrgMemberOption {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  themeId: string;
  posterUserId: string | null;
  /** 出題者本人または組織管理者なら編集可 */
  canManage: boolean;
  initialCollaborators: CollaboratorRow[];
  /** 候補: 同じ組織のメンバー (出題者 + 既存 collaborator は除外して渡してもよい) */
  orgMembers: OrgMemberOption[];
}

const ROLE_LABEL: Record<string, string> = {
  editor: "共同編集者",
  viewer: "閲覧者",
};

const ROLE_HINT: Record<string, string> = {
  editor: "テーマ内容を編集できます",
  viewer: "閲覧のみ。編集はできません",
};

function Avatar({ text, url }: { text: string; url: string | null }) {
  const initial = (text || "?")[0]?.toUpperCase() ?? "?";
  return (
    <div
      className="grid h-7 w-7 place-items-center rounded-full text-white text-[12px] font-bold overflow-hidden ring-1 ring-white shadow-sm"
      style={{
        background: url
          ? `url(${url}) center / cover`
          : "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
      }}
    >
      {!url && initial}
    </div>
  );
}

export function ThemeCollaboratorsPanel({
  themeId,
  posterUserId,
  canManage,
  initialCollaborators,
  orgMembers,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [collaborators, setCollaborators] = useState<CollaboratorRow[]>(
    initialCollaborators,
  );
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<"editor" | "viewer">(
    "editor",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 候補から除外する user_id (出題者本人 + 既存 collaborator)
  const excludeIds = useMemo(() => {
    const s = new Set<string>(collaborators.map((c) => c.user_id));
    if (posterUserId) s.add(posterUserId);
    return s;
  }, [collaborators, posterUserId]);
  const availableMembers = useMemo(
    () => orgMembers.filter((m) => !excludeIds.has(m.user_id)),
    [orgMembers, excludeIds],
  );

  const add = async () => {
    if (!selectedUserId) {
      setError("追加するメンバーを選んでください");
      return;
    }
    setBusy(true);
    setError(null);
    const target = availableMembers.find((m) => m.user_id === selectedUserId);
    const { data, error: err } = await supabase
      .from("theme_collaborators")
      .insert({
        theme_id: themeId,
        user_id: selectedUserId,
        role: selectedRole,
      })
      .select("id")
      .single();
    setBusy(false);
    if (err || !data) {
      setError(
        err?.message ??
          "追加に失敗しました (権限が無いか、既に追加されている可能性があります)",
      );
      return;
    }
    setCollaborators((prev) => [
      ...prev,
      {
        id: data.id,
        user_id: selectedUserId,
        role: selectedRole,
        display_name: target?.display_name ?? null,
        avatar_url: target?.avatar_url ?? null,
      },
    ]);
    setSelectedUserId("");
    router.refresh();
  };

  const changeRole = async (
    rowId: string,
    nextRole: "editor" | "viewer",
  ) => {
    setError(null);
    const prev = collaborators;
    setCollaborators((cs) =>
      cs.map((c) => (c.id === rowId ? { ...c, role: nextRole } : c)),
    );
    const { error: err } = await supabase
      .from("theme_collaborators")
      .update({ role: nextRole })
      .eq("id", rowId);
    if (err) {
      setCollaborators(prev);
      setError(`権限の変更に失敗しました: ${err.message}`);
      return;
    }
    router.refresh();
  };

  const remove = async (rowId: string, name: string | null) => {
    if (
      !window.confirm(
        `${name ?? "このメンバー"} を共同編集者から外しますか？`,
      )
    )
      return;
    setError(null);
    const prev = collaborators;
    setCollaborators((cs) => cs.filter((c) => c.id !== rowId));
    const { error: err } = await supabase
      .from("theme_collaborators")
      .delete()
      .eq("id", rowId);
    if (err) {
      setCollaborators(prev);
      setError(`削除に失敗しました: ${err.message}`);
      return;
    }
    router.refresh();
  };

  // テーマ管理者 (posted_by) をこの collaborator に移管。
  // 共同編集者は応募の管理 (採点等) ができないため、別の人に管理者を渡したい
  // ケース用。実行すると posted_by が切替り、旧出題者は editor として残る。
  const transferOwner = async (toUserId: string, toName: string | null) => {
    if (
      !window.confirm(
        `${toName ?? "このメンバー"} をこのテーマの管理者にしますか？\n\n` +
          `・テーマの応募管理や採点はそのメンバーが行えるようになります\n` +
          `・現在の管理者 (あなた) は共同編集者として残ります\n\n` +
          `続行しますか？`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("transfer_theme_owner", {
      p_theme_id: themeId,
      p_new_user_id: toUserId,
    });
    setBusy(false);
    if (err) {
      const msg =
        err.message.includes("permission_denied")
          ? "管理者を移管する権限がありません (出題者本人または組織管理者のみ可)"
          : err.message.includes("already_owner")
            ? "このメンバーは既にこのテーマの管理者です"
            : err.message.includes("new_owner_not_member")
              ? "対象メンバーがこの組織に所属していません"
              : err.message.includes("theme_not_found")
                ? "テーマが見つかりません"
                : `移管に失敗しました: ${err.message}`;
      setError(msg);
      return;
    }
    // server から最新状態を取り直す
    router.refresh();
  };

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="t-h3">
          <span aria-hidden className="mr-2">
            🤝
          </span>
          共同編集者 / 閲覧者
        </h3>
        <span className="t-cap">
          <span className="text-[--c-accent-deep] font-semibold">
            {collaborators.length}
          </span>{" "}
          人
        </span>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {/* 追加 UI */}
      {canManage && (
        <div className="rounded-lg border border-line-soft bg-mute/5 p-3 mb-3">
          <div className="t-label mb-2">＋ メンバーを追加</div>
          {availableMembers.length === 0 ? (
            <div className="t-cap opacity-70">
              追加できるメンバーがいません。先に組織にメンバーを招待してください。
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={busy}
                className="flex-1 min-w-[180px] rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[--c-accent] disabled:opacity-50"
              >
                <option value="">メンバーを選択…</option>
                {availableMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name ?? "（名前未設定）"}
                  </option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(e) =>
                  setSelectedRole(e.target.value as "editor" | "viewer")
                }
                disabled={busy}
                className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[--c-accent] disabled:opacity-50"
              >
                <option value="editor">共同編集者</option>
                <option value="viewer">閲覧者</option>
              </select>
              <button
                type="button"
                onClick={add}
                disabled={busy || !selectedUserId}
                className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "..." : "追加"}
              </button>
            </div>
          )}
          <p className="t-cap mt-2 opacity-70 leading-relaxed">
            候補に出てこない人は、先に <strong>組織のメンバー</strong> として招待してください。
          </p>
        </div>
      )}

      {/* リスト */}
      {collaborators.length === 0 ? (
        <p className="t-cap opacity-70 py-3">
          まだ共同編集者や閲覧者はいません。
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {collaborators.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 rounded-lg px-2 py-2 hover:bg-accent-soft/40"
            >
              <Avatar text={c.display_name ?? "?"} url={c.avatar_url} />
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold truncate">
                  {c.display_name ?? "（名前未設定）"}
                </div>
                <div className="t-cap truncate opacity-70">
                  {ROLE_HINT[c.role]}
                </div>
              </div>
              {canManage ? (
                <select
                  value={c.role}
                  onChange={(e) =>
                    changeRole(c.id, e.target.value as "editor" | "viewer")
                  }
                  className="rounded-full border border-line bg-white px-2 py-0.5 text-[10.5px] font-bold outline-none focus:border-[--c-accent] cursor-pointer"
                  title="権限を変更"
                >
                  <option value="editor">共同編集者</option>
                  <option value="viewer">閲覧者</option>
                </select>
              ) : (
                <span className="rounded-full bg-[--c-accent-deep]/10 text-[--c-accent-deep] px-2 py-0.5 text-[10px] font-bold">
                  {ROLE_LABEL[c.role]}
                </span>
              )}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => transferOwner(c.user_id, c.display_name)}
                  disabled={busy}
                  className="rounded-full bg-white border border-line px-2 py-0.5 text-[10.5px] font-bold text-mute hover:text-ink hover:border-[--c-accent] disabled:opacity-50 whitespace-nowrap"
                  title="このメンバーをテーマ管理者にする (応募管理・採点ができるようになります)"
                >
                  👑 管理者にする
                </button>
              ) : (
                <span />
              )}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => remove(c.id, c.display_name)}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-mute hover:bg-red-50 hover:text-error"
                  title="外す"
                >
                  ✕
                </button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
