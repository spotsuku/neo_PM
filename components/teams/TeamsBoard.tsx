"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

type OrgMember = {
  user_id: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
  affiliation: string | null;
  title: string | null;
};

type TeamMember = {
  user_id: string;
  role: "lead" | "member";
  display_name: string | null;
  avatar_url: string | null;
};

type TeamApplication = {
  id: string;
  theme_id: string;
  theme_title: string;
  preference_rank: number | null;
  status: string;
};

type PendingInvite = {
  id: string;
  invited_user_id: string;
  display_name: string | null;
};

type Team = {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  members: TeamMember[];
  applications: TeamApplication[];
  pendingInvites: PendingInvite[];
};

type InboxInvite = {
  id: string;
  team_id: string;
  team_name: string;
  invited_by_name: string;
  created_at: string;
};

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  currentUserId: string;
  isAdmin: boolean;
  teams: Team[];
  orgMembers: OrgMember[];
  unaffiliated: OrgMember[];
  /** 自分のチームが招待中のユーザ ID (未所属欄で「招待済」ラベルを出すため) */
  pendingInvitedUserIds: string[];
  myTeamId: string | null;
  myTeamRole: "lead" | "member" | null;
  /** 自分宛ての pending 招待 */
  myInbox: InboxInvite[];
}

// 頭文字を安全に取り出す (絵文字 / 日本語 / null に耐性)
function initialOf(name: string | null): string {
  const t = (name ?? "").trim();
  if (!t) return "?";
  return Array.from(t)[0]!.toUpperCase();
}

// 名前 → HSL 色に決定的マッピング (アイコン背景色を安定させる)
function colorOf(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 55% 55%)`;
}

// 小さな丸アイコン (アバター画像 or イニシャル)
function AvatarBubble({
  name,
  url,
  size = 20,
  ring,
}: {
  name: string | null;
  url?: string | null;
  size?: number;
  ring?: string;
}) {
  const seed = name ?? "?";
  const styleBase: React.CSSProperties = {
    width: size,
    height: size,
    boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
  };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="flex-shrink-0 rounded-full object-cover"
        style={styleBase}
      />
    );
  }
  return (
    <span
      className="flex-shrink-0 grid place-items-center rounded-full text-white font-bold"
      style={{
        ...styleBase,
        background: colorOf(seed),
        fontSize: Math.max(9, size * 0.5),
      }}
      aria-hidden
    >
      {initialOf(name)}
    </span>
  );
}

const APP_STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  submitted: "申請中",
  under_review: "審査中",
  approved: "採択",
  rejected: "不採択",
  withdrawn: "取り下げ",
};

const APP_STATUS_COLOR: Record<string, string> = {
  draft: "bg-mute/15 text-mute",
  submitted: "bg-[--c-accent]/12 text-[--c-accent-deep]",
  under_review: "bg-[--c-accent]/12 text-[--c-accent-deep]",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-mute/15 text-mute",
};

export function TeamsBoard({
  orgSlug,
  orgId,
  orgName,
  currentUserId,
  isAdmin,
  teams,
  orgMembers,
  unaffiliated,
  pendingInvitedUserIds,
  myTeamId,
  myTeamRole,
  myInbox,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [unaffiliatedQuery, setUnaffiliatedQuery] = useState("");

  const stats = useMemo(() => {
    const total = orgMembers.length;
    const affiliated = total - unaffiliated.length;
    return { total, affiliated, unaffiliated: unaffiliated.length };
  }, [orgMembers.length, unaffiliated.length]);

  // 既に所属中になったらフォームを自動で閉じる (作成成功後や別タブでの加入対策)
  useEffect(() => {
    if (myTeamId && creating) {
      setCreating(false);
      setNewName("");
      setNewDesc("");
    }
  }, [myTeamId, creating]);

  const createTeam = async () => {
    const name = newName.trim();
    if (!name) {
      setError("チーム名を入力してください");
      return;
    }
    if (myTeamId) {
      setError(
        "既に別のチームに所属しています。掛け持ちはできません。先に現在のチームを抜けてから作成してください。",
      );
      return;
    }
    setBusy(true);
    setError(null);
    const { data: team, error: insErr } = await supabase
      .from("teams")
      .insert({
        organization_id: orgId,
        name,
        description: newDesc.trim() || null,
        created_by: currentUserId,
      } as never)
      .select()
      .single();
    if (insErr) {
      setBusy(false);
      setError(`チーム作成に失敗: ${insErr.message}`);
      return;
    }

    // 自分を lead として team_members に追加
    if (team) {
      const { error: joinErr } = await supabase
        .from("team_members")
        .insert({
          team_id: team.id,
          user_id: currentUserId,
          role: "lead",
        } as never);
      if (joinErr) {
        // 孤立チームを削除 (org admin なら消せる。member なら残るが lead 不在なので UI 上「解散」誘導)
        await supabase.from("teams").delete().eq("id", team.id);
        setBusy(false);
        const msg = joinErr.message.includes("one_active_team_per_user_per_org")
          ? "既に別のチームに所属しています。掛け持ちはできません。先に現在のチームを抜けてから作成してください。"
          : `あなたの加入に失敗: ${joinErr.message}`;
        setError(msg);
        router.refresh();
        return;
      }
    }
    setCreating(false);
    setNewName("");
    setNewDesc("");
    setBusy(false);
    router.refresh();
  };

  const joinTeam = async (teamId: string) => {
    if (myTeamId) {
      setError(
        "既に別のチームに所属しています。掛け持ちはできません。先に今のチームを抜けてください。",
      );
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("team_members")
      .insert({
        team_id: teamId,
        user_id: currentUserId,
        role: "member",
      } as never);
    setBusy(false);
    if (err) {
      setError(`加入に失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  const leaveTeam = async (teamId: string) => {
    if (
      !confirm(
        "このチームを抜けますか?\nチームに紐付いた応募からもあなたが外れます。",
      )
    )
      return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", currentUserId);
    setBusy(false);
    if (err) {
      setError(`退会に失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  // lead / 組織 admin が未所属メンバーに招待を送る
  const inviteToMyTeam = async (userId: string, displayName: string) => {
    if (!myTeamId) {
      setError("先に自分のチームを作成してください。");
      return;
    }
    if (myTeamRole !== "lead" && !isAdmin) {
      setError("招待送信はチームリーダーまたは組織管理者のみ可能です。");
      return;
    }
    if (!confirm(`${displayName} さんに招待を送りますか?`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("team_invitations")
      .insert({
        team_id: myTeamId,
        invited_user_id: userId,
        invited_by: currentUserId,
      } as never);
    setBusy(false);
    if (err) {
      const msg = err.message.includes("unique_pending")
        ? `${displayName} さんには既に招待中です。相手の返答をお待ちください。`
        : `招待送信に失敗: ${err.message}`;
      setError(msg);
      return;
    }
    router.refresh();
  };

  // 自分宛て招待の受諾 (RPC 経由で atomically team_members に加入)
  const acceptInvite = async (invId: string, teamName: string) => {
    if (myTeamId) {
      if (
        !confirm(
          `既に別のチームに所属しています。この招待を受けると現在のチームは自動で外れます...ではなく、まず現在のチームを抜けてください。招待は保留のまま残ります。`,
        )
      )
        return;
      setError(
        "既に別のチームに所属しています。先に「チームを抜ける」を押してから招待を受けてください。",
      );
      return;
    }
    if (!confirm(`「${teamName}」からの招待を受けますか?`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("accept_team_invitation", {
      inv_id: invId,
    });
    setBusy(false);
    if (err) {
      setError(`承認に失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  const declineInvite = async (invId: string, teamName: string) => {
    if (!confirm(`「${teamName}」からの招待を辞退しますか?`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("team_invitations")
      .update({ status: "declined", responded_at: new Date().toISOString() } as never)
      .eq("id", invId);
    setBusy(false);
    if (err) {
      setError(`辞退処理に失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  const cancelInvite = async (invId: string, displayName: string) => {
    if (!confirm(`${displayName} さんへの招待を取り消しますか?`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("team_invitations")
      .update({ status: "cancelled", responded_at: new Date().toISOString() } as never)
      .eq("id", invId);
    setBusy(false);
    if (err) {
      setError(`取り消しに失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  const disbandTeam = async (teamId: string, teamName: string) => {
    if (
      !confirm(
        `「${teamName}」を解散しますか?\n\nこのチームに紐付いた応募は無効になります。この操作は元に戻せません。`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("teams")
      .update({ status: "disbanded" } as never)
      .eq("id", teamId);
    setBusy(false);
    if (err) {
      setError(`解散に失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Header */}
      <GlassCard className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white text-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
            }}
            aria-hidden
          >
            👥
          </span>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold tracking-tight">
              チーム組成
            </h1>
            <p className="t-cap">
              {orgName} ・ メンバー {stats.total} 名 (所属 {stats.affiliated} /
              未所属 {stats.unaffiliated})
            </p>
          </div>
        </div>
        {!myTeamId ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90"
          >
            ＋ 新しいチームを作る
          </button>
        ) : (
          <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 text-[11.5px] font-semibold">
            所属中 ({myTeamRole === "lead" ? "リーダー" : "メンバー"})
          </span>
        )}
      </GlassCard>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 自分宛て招待 (受信箱) */}
      {myInbox.length > 0 && (
        <GlassCard className="p-4 flex flex-col gap-3 border-2 border-[--c-accent]/40">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-lg">
              🎉
            </span>
            <h2 className="text-[14px] font-extrabold">
              あなたに届いた招待 ({myInbox.length})
            </h2>
          </div>
          <ul className="flex flex-col gap-2">
            {myInbox.map((iv) => (
              <li
                key={iv.id}
                className="flex items-center justify-between gap-3 rounded-md bg-[--c-accent]/5 px-3 py-2 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">
                    {iv.team_name}
                  </div>
                  <div className="t-cap">
                    {iv.invited_by_name} さんからの招待
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => acceptInvite(iv.id, iv.team_name)}
                    className="rounded-full bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    受ける
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => declineInvite(iv.id, iv.team_name)}
                    className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)] disabled:opacity-50"
                  >
                    辞退
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* 統計 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="組織メンバー"
          value={stats.total}
          color="var(--c-accent)"
        />
        <StatCard
          label="チーム所属済"
          value={stats.affiliated}
          total={stats.total}
          color="var(--ok)"
        />
        <StatCard
          label="未所属"
          value={stats.unaffiliated}
          total={stats.total}
          color={stats.unaffiliated > 0 ? "var(--error)" : "var(--ok)"}
        />
      </div>

      {/* 新規作成モーダル (インライン) — 既に所属中なら描画しない */}
      {creating && !myTeamId && (
        <GlassCard className="p-5 flex flex-col gap-3">
          <h2 className="text-[15px] font-extrabold">新しいチームを作る</h2>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="font-semibold">チーム名 *</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例: にんげんOS チーム"
              className="rounded-md border border-line px-3 py-2 outline-none focus:border-[--c-accent]"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="font-semibold">紹介文 (任意)</span>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
              placeholder="どんなチーム？ 探しているスキル・関心テーマなど"
              className="rounded-md border border-line px-3 py-2 outline-none focus:border-[--c-accent] resize-y"
            />
          </label>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCreating(false);
                setNewName("");
                setNewDesc("");
                setError(null);
              }}
              className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={busy || !newName.trim()}
              onClick={createTeam}
              className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "作成中…" : "作成してリーダーになる"}
            </button>
          </div>
        </GlassCard>
      )}

      {/* チーム一覧 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-extrabold text-mute uppercase tracking-wider">
          チーム ({teams.length})
        </h2>
        {teams.length === 0 ? (
          <GlassCard className="p-6 text-center text-mute text-[13px]">
            まだチームはありません。最初のチームを作りましょう。
          </GlassCard>
        ) : (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {teams.map((t) => {
              const iAmMember = t.members.some(
                (m) => m.user_id === currentUserId,
              );
              const iAmLead = t.members.some(
                (m) => m.user_id === currentUserId && m.role === "lead",
              );
              const canDisband = iAmLead || isAdmin;
              return (
                <li key={t.id}>
                  <GlassCard className="p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-extrabold truncate">
                          {t.name}
                        </h3>
                        {t.description && (
                          <p className="t-cap mt-0.5 line-clamp-2">
                            {t.description}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-mute/10 text-mute text-[10.5px] px-2 py-0.5 flex-shrink-0">
                        {t.members.length}人
                      </span>
                    </div>

                    {/* メンバー */}
                    <div className="flex flex-wrap gap-1.5">
                      {t.members.length === 0 ? (
                        <span className="t-cap italic text-mute">
                          メンバー未登録
                        </span>
                      ) : (
                        t.members
                          .slice()
                          .sort((a, b) =>
                            a.role === b.role
                              ? 0
                              : a.role === "lead"
                                ? -1
                                : 1,
                          )
                          .map((m) => (
                            <span
                              key={m.user_id}
                              className={
                                "inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-2 py-0.5 text-[11.5px] " +
                                (m.role === "lead"
                                  ? "bg-[--c-accent]/15 text-[--c-accent-deep] font-semibold"
                                  : "bg-mute/10 text-ink-2")
                              }
                              title={m.role === "lead" ? "リーダー" : "メンバー"}
                            >
                              <AvatarBubble
                                name={m.display_name}
                                url={m.avatar_url}
                                size={22}
                                ring={
                                  m.role === "lead" ? "var(--c-accent)" : undefined
                                }
                              />
                              <span className="flex items-center gap-1">
                                {m.role === "lead" && <span aria-hidden>👑</span>}
                                {m.display_name ?? "名前未設定"}
                              </span>
                            </span>
                          ))
                      )}
                    </div>

                    {/* 招待中 (pending) — チームメンバー / lead / admin から見える */}
                    {t.pendingInvites.length > 0 && (iAmMember || isAdmin) && (
                      <div className="flex flex-col gap-1">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-mute">
                          招待中 ({t.pendingInvites.length})
                        </div>
                        <ul className="flex flex-wrap gap-1">
                          {t.pendingInvites.map((iv) => (
                            <li
                              key={iv.id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 text-[11px]"
                              title="返答待ち"
                            >
                              <span aria-hidden>⏳</span>
                              <span>{iv.display_name ?? "名前未設定"}</span>
                              {(iAmLead || isAdmin) && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    cancelInvite(
                                      iv.id,
                                      iv.display_name ?? "この人",
                                    )
                                  }
                                  className="text-[10px] text-amber-800/70 hover:text-red-700 disabled:opacity-50"
                                  title="招待を取り消す"
                                >
                                  ×
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 応募 */}
                    <div className="flex flex-col gap-1">
                      <div className="text-[10.5px] font-bold uppercase tracking-wider text-mute">
                        応募中テーマ ({t.applications.length})
                      </div>
                      {t.applications.length === 0 ? (
                        <div className="rounded-md bg-mute/5 px-2 py-2 text-[11.5px] text-mute">
                          まだテーマに応募していません。
                          {iAmMember && (
                            <a
                              href={`/${orgSlug}/themes`}
                              className="ml-1 underline hover:text-ink"
                            >
                              テーマに応募する →
                            </a>
                          )}
                        </div>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {t.applications.map((a) => (
                            <li
                              key={a.id}
                              className="flex items-center justify-between gap-2 rounded-md bg-mute/5 px-2 py-1 text-[11.5px]"
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                {a.preference_rank && (
                                  <span
                                    className="inline-flex flex-shrink-0 items-center rounded-full bg-ink text-white text-[9.5px] font-bold px-1.5 py-0.5"
                                    aria-label={`第${a.preference_rank}希望`}
                                  >
                                    第{a.preference_rank}
                                  </span>
                                )}
                                <span className="truncate">{a.theme_title}</span>
                              </span>
                              <span
                                className={
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 " +
                                  (APP_STATUS_COLOR[a.status] ??
                                    "bg-mute/10 text-mute")
                                }
                              >
                                {APP_STATUS_LABEL[a.status] ?? a.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-auto flex items-center gap-2 flex-wrap pt-1">
                      {!iAmMember && !myTeamId && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => joinTeam(t.id)}
                          className="rounded-full bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          このチームに加入
                        </button>
                      )}
                      {iAmMember && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => leaveTeam(t.id)}
                          className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
                        >
                          チームを抜ける
                        </button>
                      )}
                      {canDisband && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => disbandTeam(t.id, t.name)}
                          className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-red-600 hover:bg-red-50 shadow-[0_1px_0_var(--line-soft)]"
                        >
                          解散
                        </button>
                      )}
                      <a
                        href={`/${orgSlug}/themes`}
                        className="ml-auto rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
                      >
                        テーマに応募 →
                      </a>
                    </div>
                  </GlassCard>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 未所属メンバー */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-extrabold text-mute uppercase tracking-wider">
          未所属メンバー ({unaffiliated.length})
        </h2>
        {unaffiliated.length === 0 ? (
          <GlassCard className="p-6 text-center text-emerald-700 text-[13px]">
            ✨ 全員がどこかのチームに所属しています
          </GlassCard>
        ) : (
          <GlassCard className="p-4 flex flex-col gap-3">
            {(myTeamRole === "lead" || isAdmin) && myTeamId && (
              <p className="t-cap">
                💡 名前をクリックすると自分のチームに招待を送れます (相手の承認が必要)
              </p>
            )}
            {/* 検索 + 五十音順 */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={unaffiliatedQuery}
                onChange={(e) => setUnaffiliatedQuery(e.target.value)}
                placeholder="🔍 メンバーを検索 (名前・所属)"
                className="flex-1 min-w-[220px] rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[--c-accent]"
              />
              <span className="t-cap">
                {(() => {
                  const q = unaffiliatedQuery.trim().toLowerCase();
                  const shown = q
                    ? unaffiliated.filter(
                        (m) =>
                          (m.display_name ?? "").toLowerCase().includes(q) ||
                          (m.affiliation ?? "").toLowerCase().includes(q) ||
                          (m.title ?? "").toLowerCase().includes(q),
                      ).length
                    : unaffiliated.length;
                  return q
                    ? `${shown}/${unaffiliated.length} 件`
                    : `五十音順・${unaffiliated.length} 名`;
                })()}
              </span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {unaffiliated
                .slice()
                .sort((a, b) =>
                  (a.display_name ?? "").localeCompare(
                    b.display_name ?? "",
                    "ja",
                  ),
                )
                .filter((m) => {
                  const q = unaffiliatedQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (m.display_name ?? "").toLowerCase().includes(q) ||
                    (m.affiliation ?? "").toLowerCase().includes(q) ||
                    (m.title ?? "").toLowerCase().includes(q)
                  );
                })
                .map((m) => {
                const alreadyInvited = pendingInvitedUserIds.includes(m.user_id);
                const canInvite =
                  (myTeamRole === "lead" || isAdmin) &&
                  myTeamId !== null &&
                  m.user_id !== currentUserId &&
                  !alreadyInvited;
                const label = m.display_name ?? "名前未設定";
                return (
                  <li key={m.user_id}>
                    {canInvite ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => inviteToMyTeam(m.user_id, label)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white border border-line hover:border-[--c-accent] hover:bg-[--c-accent]/5 pl-0.5 pr-3 py-0.5 text-[12px] transition disabled:opacity-50"
                        title={
                          [m.affiliation, m.title].filter(Boolean).join(" / ") ||
                          `${label} に招待を送る`
                        }
                      >
                        <AvatarBubble
                          name={m.display_name}
                          url={m.avatar_url}
                          size={22}
                        />
                        <span className="text-[10px] text-[--c-accent-deep]">✉️</span>
                        {label}
                      </button>
                    ) : (
                      <span
                        className={
                          "inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-3 py-0.5 text-[12px] " +
                          (alreadyInvited
                            ? "bg-amber-50 text-amber-800"
                            : "bg-mute/10")
                        }
                        title={
                          [m.affiliation, m.title].filter(Boolean).join(" / ") ||
                          undefined
                        }
                      >
                        <AvatarBubble
                          name={m.display_name}
                          url={m.avatar_url}
                          size={22}
                        />
                        {alreadyInvited && <span aria-hidden>⏳</span>}
                        {label}
                        {m.user_id === currentUserId && (
                          <span
                            className="text-[9.5px] font-bold text-[--c-accent-deep]"
                            aria-label="自分"
                          >
                            YOU
                          </span>
                        )}
                        {alreadyInvited && (
                          <span className="text-[9.5px] font-bold">招待中</span>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total?: number;
  color: string;
}) {
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <GlassCard className="p-4">
      <div className="t-label mb-1">{label}</div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="t-big" style={{ fontSize: 26 }}>
          {value}
        </span>
        {total !== undefined && <span className="t-cap">/ {total}</span>}
      </div>
      {pct !== null && (
        <div className="h-1.5 rounded-full bg-line-soft overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      )}
    </GlassCard>
  );
}
