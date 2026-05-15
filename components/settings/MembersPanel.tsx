"use client";

import { useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Database } from "@/lib/types/database";

type Invitation = Database["public"]["Tables"]["invitations"]["Row"];

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "theme_owner";
  affiliation: string | null;
  title: string | null;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
  isMe: boolean;
}

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  myRole: "owner" | "admin" | "member" | "theme_owner";
  members: Member[];
  initialInvitations: Invitation[];
}

const ROLE_LABEL: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  theme_owner: "テーマオーナー",
  member: "メンバー",
};

const ROLE_COLOR: Record<string, string> = {
  owner: "var(--ink)",
  admin: "var(--c-accent)",
  theme_owner: "var(--c-accent-deep)",
  member: "var(--mute)",
};

export function MembersPanel({
  orgSlug,
  orgId,
  myRole,
  members,
  initialInvitations,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations);
  const [newRole, setNewRole] = useState<
    "admin" | "member" | "theme_owner"
  >("member");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canManage = myRole === "owner" || myRole === "admin";

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  const invitationUrl = (token: string) => `${origin}/join/${token}`;

  const createInvite = async () => {
    setError(null);
    setCreating(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("ログインが必要です");
      setCreating(false);
      return;
    }
    const { data, error: err } = await supabase
      .from("invitations")
      .insert({
        organization_id: orgId,
        created_by: user.id,
        role: newRole,
        note: note.trim() || null,
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "招待の作成に失敗しました");
      setCreating(false);
      return;
    }
    setInvitations((prev) => [data, ...prev]);
    setNote("");
    setCreating(false);
  };

  const revokeInvite = async (id: string) => {
    if (!confirm("この招待リンクを取り消しますか？踏まれていないなら無効になります。"))
      return;
    setInvitations((prev) => prev.filter((i) => i.id !== id));
    const { error: err } = await supabase
      .from("invitations")
      .delete()
      .eq("id", id);
    if (err) setError(err.message);
  };

  const copyLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ブラウザに clipboard API が無い場合などのフォールバック
      setError("コピーに失敗しました。URL を手動で選択してコピーしてください。");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* メンバー & 招待 統合リスト */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="t-h3">
            <span aria-hidden className="mr-2">
              👥
            </span>
            メンバー & 招待
          </h3>
          <div className="t-cap flex items-center gap-3">
            <span>
              <span className="text-[--c-accent-deep] font-semibold">
                {members.length}
              </span>{" "}
              参加済
            </span>
            <span>
              <span className="text-warn font-semibold">
                {invitations.length}
              </span>{" "}
              招待中
            </span>
          </div>
        </div>

        {members.length === 0 && invitations.length === 0 ? (
          <p className="t-cap text-center py-6">
            まだメンバーがいません。下の「リンクを発行」または上部の「一括招待」から招待してください。
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {/* 参加済メンバー */}
            {members.map((m) => (
              <li
                key={`m-${m.id}`}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent-soft/40"
              >
                <Avatar text={m.display_name ?? "?"} />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold truncate">
                    {m.display_name ?? "（名前未設定）"}
                    {m.isMe && (
                      <span className="ml-2 t-cap text-[--c-accent-deep]">
                        （あなた）
                      </span>
                    )}
                  </div>
                  <div className="t-cap truncate">
                    {[m.affiliation, m.title].filter(Boolean).join(" ・ ") ||
                      `加入 ${new Date(m.created_at).toLocaleDateString("ja-JP")}`}
                  </div>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: ROLE_COLOR[m.role] }}
                >
                  {ROLE_LABEL[m.role]}
                </span>
                <span className="rounded-full bg-[--c-accent-deep]/10 text-[--c-accent-deep] px-2 py-0.5 text-[10px] font-semibold">
                  ✓ 参加済
                </span>
              </li>
            ))}

            {/* 招待中 (未使用招待) */}
            {invitations.map((i) => {
              const url = invitationUrl(i.token);
              const expired =
                i.expires_at !== null && new Date(i.expires_at) < new Date();
              const displayName =
                i.intended_name ?? i.note ?? i.intended_email ?? "（メモなし）";
              return (
                <li
                  key={`i-${i.id}`}
                  className={
                    "grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-2 " +
                    (expired ? "opacity-60" : "hover:bg-accent-soft/40")
                  }
                >
                  <Avatar text={displayName} muted />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold truncate">
                      {displayName}
                    </div>
                    <div className="t-cap truncate flex items-center gap-2">
                      {i.intended_email && (
                        <span className="t-mono">{i.intended_email}</span>
                      )}
                      {[i.intended_affiliation, i.intended_title]
                        .filter(Boolean)
                        .join(" ・ ") &&
                        ` ・ ${[i.intended_affiliation, i.intended_title].filter(Boolean).join(" ・ ")}`}
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: ROLE_COLOR[i.role] }}
                  >
                    {ROLE_LABEL[i.role]}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                        (expired
                          ? "bg-error/10 text-error"
                          : "bg-warn/15 text-warn")
                      }
                    >
                      {expired ? "期限切れ" : "招待中"}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyLink(i.id, url)}
                      className="rounded-md bg-ink px-2 py-1 text-[10px] font-semibold text-white hover:opacity-90"
                      title={url}
                    >
                      {copiedId === i.id ? "✓ コピー済" : "コピー"}
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => revokeInvite(i.id)}
                        className="rounded-md px-1.5 py-1 text-[10px] text-mute hover:bg-red-50 hover:text-error"
                        aria-label="取消"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>

      {/* 招待リンク発行 */}
      {canManage ? (
        <GlassCard className="p-5">
          <h3 className="t-h3 mb-3">
            <span aria-hidden className="mr-2">
              ✉️
            </span>
            新しい招待リンクを発行
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2 items-end">
            <label className="block">
              <span className="t-label block mb-1">メモ（任意）</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例: 田中さん用 / NEO福岡PJ参加者"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent]"
              />
            </label>
            <label className="block">
              <span className="t-label block mb-1">権限</span>
              <select
                value={newRole}
                onChange={(e) =>
                  setNewRole(
                    e.target.value as "admin" | "member" | "theme_owner",
                  )
                }
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent]"
              >
                <option value="member">メンバー</option>
                <option value="theme_owner">テーマオーナー</option>
                <option value="admin">管理者</option>
              </select>
            </label>
            <button
              type="button"
              onClick={createInvite}
              disabled={creating}
              className="rounded-lg bg-ink px-4 py-2 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "..." : "✦ リンクを発行"}
            </button>
          </div>
          <p className="t-cap mt-2 leading-relaxed">
            ※ 発行されたリンクを Slack や DM で共有してください。受け取った相手は
            ログイン後に自動でこの組織に追加されます。メール送信は使いません。
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="p-4">
          <p className="t-cap text-center">
            🔒 メンバーを招待する権限は owner / admin にあります。
          </p>
        </GlassCard>
      )}

    </div>
  );
}

function Avatar({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <span
      className="grid h-8 w-8 place-items-center rounded-full text-white text-[12px] font-semibold flex-shrink-0"
      style={{
        background: muted
          ? "var(--mute)"
          : "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
      }}
    >
      {(text || "?")[0]}
    </span>
  );
}
