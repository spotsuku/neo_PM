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

      {/* メンバー一覧 */}
      <GlassCard className="p-5">
        <h3 className="t-h3 mb-3">
          <span aria-hidden className="mr-2">
            👤
          </span>
          現在のメンバー ({members.length})
        </h3>
        <ul className="flex flex-col gap-1">
          {members.map((m) => (
            <li
              key={m.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent-soft/40"
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-white text-[12px] font-semibold"
                style={{
                  background:
                    "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                }}
              >
                {(m.display_name ?? "?")[0]}
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold truncate">
                  {m.display_name ?? "（名前未設定）"}
                  {m.isMe && (
                    <span className="ml-2 t-cap text-[--c-accent-deep]">
                      （あなた）
                    </span>
                  )}
                </div>
                <div className="t-cap">
                  加入 {new Date(m.created_at).toLocaleDateString("ja-JP")}
                </div>
              </div>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                style={{ background: ROLE_COLOR[m.role] }}
              >
                {ROLE_LABEL[m.role]}
              </span>
            </li>
          ))}
        </ul>
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

      {/* 既存の有効な招待リンク */}
      {invitations.length > 0 && (
        <GlassCard className="p-5">
          <h3 className="t-h3 mb-3">
            <span aria-hidden className="mr-2">
              🔗
            </span>
            有効な招待リンク ({invitations.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {invitations.map((i) => {
              const url = invitationUrl(i.token);
              const expired =
                i.expires_at !== null && new Date(i.expires_at) < new Date();
              return (
                <li
                  key={i.id}
                  className={
                    "rounded-lg border p-3 " +
                    (expired
                      ? "border-line-soft bg-canvas-2 opacity-60"
                      : "border-line bg-white")
                  }
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold truncate">
                        {i.note ?? "（メモなし）"}
                      </div>
                      <div className="t-cap flex items-center gap-2 flex-wrap">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                          style={{ background: ROLE_COLOR[i.role] }}
                        >
                          {ROLE_LABEL[i.role]}
                        </span>
                        <span>
                          発行 {new Date(i.created_at).toLocaleDateString("ja-JP")}
                        </span>
                        {i.expires_at && (
                          <span>
                            期限 {new Date(i.expires_at).toLocaleDateString("ja-JP")}
                          </span>
                        )}
                        {expired && (
                          <span className="rounded-full bg-error/15 px-2 py-0.5 text-[10px] font-bold text-error">
                            期限切れ
                          </span>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => revokeInvite(i.id)}
                        className="rounded-md px-2 py-1 text-[11px] font-semibold text-mute hover:text-error hover:bg-red-50"
                      >
                        🗑 取消
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={url}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 min-w-0 rounded-md border border-line-soft bg-canvas-2 px-2 py-1.5 text-[11px] t-mono"
                    />
                    <button
                      type="button"
                      onClick={() => copyLink(i.id, url)}
                      className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
                    >
                      {copiedId === i.id ? "✓ コピー済" : "コピー"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
