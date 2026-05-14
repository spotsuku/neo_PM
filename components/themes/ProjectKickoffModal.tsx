"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Application = Database["public"]["Tables"]["theme_applications"]["Row"];
type Invitation = Database["public"]["Tables"]["invitations"]["Row"];

interface Props {
  orgSlug: string;
  orgId: string;
  app: Application;
  applicantName: string | null;
  themeOwnerName: string | null;
  onClose: () => void;
  onStarted: (app: Application) => void;
}

export function ProjectKickoffModal({
  orgSlug,
  orgId,
  app,
  applicantName,
  themeOwnerName,
  onClose,
  onStarted,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [note, setNote] = useState("");
  const [newRole, setNewRole] = useState<"member" | "lead">("member");
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // 既存招待を読み込む
  useEffect(() => {
    if (!app.created_project_id) return;
    let cancelled = false;
    setLoadingInvites(true);
    supabase
      .from("invitations")
      .select("*")
      .eq("target_project_id", app.created_project_id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setInvites((data ?? []) as Invitation[]);
      })
      .then(() => {
        if (!cancelled) setLoadingInvites(false);
      });
    return () => {
      cancelled = true;
    };
  }, [app.created_project_id, supabase]);

  const createInvite = async () => {
    if (!app.created_project_id) return;
    setCreating(true);
    setError(null);
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
        role: "member",
        target_project_id: app.created_project_id,
        target_project_role: newRole,
        note: note.trim() || null,
      })
      .select()
      .single();
    setCreating(false);
    if (err || !data) {
      setError(err?.message ?? "招待の発行に失敗しました");
      return;
    }
    setInvites((prev) => [data as Invitation, ...prev]);
    setNote("");
    setNewRole("member");
  };

  const revokeInvite = async (id: string) => {
    if (!confirm("この招待リンクを取り消しますか？")) return;
    setInvites((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("invitations").delete().eq("id", id);
  };

  const copyLink = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("コピーに失敗しました。URLを手動で選択してください。");
    }
  };

  const startProject = async () => {
    setStarting(true);
    setError(null);
    const startedAt = new Date().toISOString();
    const { data, error: err } = await supabase
      .from("theme_applications")
      .update({ project_started_at: startedAt })
      .eq("id", app.id)
      .select()
      .single();
    if (err || !data) {
      setStarting(false);
      setError(err?.message ?? "PJTスタートに失敗しました");
      return;
    }
    onStarted(data as Application);
    onClose();
    if (app.created_project_id) {
      router.push(`/${orgSlug}/dashboard?p=${app.created_project_id}`);
      router.refresh();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4 py-8 bg-black/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-2xl rounded-2xl p-6 animate-risein"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[20px] font-extrabold tracking-tight mb-1">
              <span aria-hidden className="mr-2">
                🚀
              </span>
              PJTスタート
            </h2>
            <p className="t-cap">
              採択チーム「{app.team_name || "（未設定）"}」と一緒にプロジェクトを正式に起動します。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-mute hover:bg-mute/10"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 mb-3">
            {error}
          </div>
        )}

        {/* セクション 1: 既に参加するメンバー */}
        <section className="mb-4">
          <div className="t-label mb-2">👥 リーダーとして既に参加</div>
          <ul className="flex flex-col gap-1.5">
            <ParticipantRow
              role="lead"
              label={`${themeOwnerName ?? "あなた"} (出題者)`}
              note="プロジェクトリーダー / 自動追加"
            />
            <ParticipantRow
              role="lead"
              label={`${applicantName ?? app.team_name ?? "応募者"} (応募代表)`}
              note="プロジェクトリーダー / 自動追加"
            />
          </ul>
        </section>

        {/* セクション 2: メンバー招待 */}
        <section className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="t-label">📨 採択チームのメンバーを招待</div>
          </div>
          {app.members && (
            <p className="t-cap mb-2 leading-relaxed">
              応募書類に挙がっていたメンバー:{" "}
              <span className="text-ink-2">{app.members}</span>
            </p>
          )}

          <div className="rounded-lg border border-line-soft bg-canvas-2 p-3 mb-3">
            <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-end mb-2">
              <label className="block">
                <span className="t-label block mb-1">招待メモ (任意)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例: 山田さん用 / デザイン担当"
                  className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
                />
              </label>
              <label className="block">
                <span className="t-label block mb-1">役割</span>
                <select
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value as "member" | "lead")
                  }
                  className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
                >
                  <option value="member">メンバー</option>
                  <option value="lead">リーダー</option>
                </select>
              </label>
              <button
                type="button"
                onClick={createInvite}
                disabled={creating}
                className="rounded-md bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "..." : "リンク発行"}
              </button>
            </div>
            <p className="t-cap leading-relaxed">
              発行したリンクをチームメンバーに送ると、本人がサインインしてプロジェクトに参加できます。リンクは14日間有効。
            </p>
          </div>

          {/* 発行済みリンク */}
          {loadingInvites ? (
            <p className="t-cap">読み込み中…</p>
          ) : invites.length === 0 ? (
            <p className="t-cap text-center py-2">
              まだ招待リンクはありません
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {invites.map((inv) => {
                const url = `${origin}/join/${inv.token}`;
                const used = inv.used_at !== null;
                return (
                  <li
                    key={inv.id}
                    className="rounded-md bg-white border border-line-soft p-2.5 flex items-center gap-2 text-[12px]"
                  >
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap"
                      style={{
                        background: used ? "var(--mute)" : "var(--c-accent)",
                      }}
                    >
                      {used ? "✓ 使用済" : "未使用"}
                    </span>
                    <span className="t-mono text-[10.5px] text-mute truncate flex-1">
                      {url}
                    </span>
                    {inv.target_project_role && (
                      <span className="t-cap whitespace-nowrap">
                        {inv.target_project_role === "lead"
                          ? "リーダー"
                          : "メンバー"}
                      </span>
                    )}
                    {!used && (
                      <button
                        type="button"
                        onClick={() => copyLink(inv.id, url)}
                        className="rounded-md px-2 py-1 bg-accent-soft text-[--c-accent-deep] text-[10.5px] font-semibold whitespace-nowrap"
                      >
                        {copiedId === inv.id ? "✓ コピー済" : "コピー"}
                      </button>
                    )}
                    {!used && (
                      <button
                        type="button"
                        onClick={() => revokeInvite(inv.id)}
                        className="rounded-md px-1.5 py-1 text-mute hover:bg-red-50 hover:text-error"
                        aria-label="削除"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* セクション 3: 起動ボタン */}
        <section className="border-t border-line-soft pt-4 flex items-center justify-between gap-2 flex-wrap">
          <p className="t-cap">
            「PJTを正式にスタートする」を押すと、ダッシュボードに移動し、応募代表者と出題者でプロジェクトが進められるようになります。
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white border border-line px-4 py-2 text-[12px] font-medium text-mute"
            >
              あとで
            </button>
            <button
              type="button"
              onClick={startProject}
              disabled={starting}
              className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {starting ? "..." : "✦ PJTを正式にスタートする"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ParticipantRow({
  role,
  label,
  note,
}: {
  role: "lead" | "member";
  label: string;
  note: string;
}) {
  return (
    <li className="rounded-md bg-white border border-line-soft px-3 py-2 flex items-center gap-2 text-[12.5px]">
      <span
        className="grid h-6 w-6 place-items-center rounded-full text-white text-[10px] font-bold"
        style={{
          background:
            role === "lead"
              ? "var(--c-accent-deep)"
              : "var(--mute)",
        }}
      >
        {role === "lead" ? "L" : "M"}
      </span>
      <span className="font-semibold flex-1 truncate">{label}</span>
      <span className="t-cap">{note}</span>
    </li>
  );
}
