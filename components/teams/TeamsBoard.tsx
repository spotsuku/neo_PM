"use client";

import { useMemo, useState } from "react";
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

type Team = {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  members: TeamMember[];
  applications: TeamApplication[];
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
  myTeamId: string | null;
  myTeamRole: "lead" | "member" | null;
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
  myTeamId,
  myTeamRole,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const stats = useMemo(() => {
    const total = orgMembers.length;
    const affiliated = total - unaffiliated.length;
    return { total, affiliated, unaffiliated: unaffiliated.length };
  }, [orgMembers.length, unaffiliated.length]);

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
        setBusy(false);
        setError(
          `チームは作成しましたが、あなたの加入に失敗: ${joinErr.message}`,
        );
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

      {/* 新規作成モーダル (インライン) */}
      {creating && (
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
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] " +
                                (m.role === "lead"
                                  ? "bg-[--c-accent]/15 text-[--c-accent-deep] font-semibold"
                                  : "bg-mute/10 text-ink-2")
                              }
                              title={m.role === "lead" ? "リーダー" : "メンバー"}
                            >
                              {m.role === "lead" && (
                                <span aria-hidden>👑</span>
                              )}
                              {m.display_name ?? "名前未設定"}
                            </span>
                          ))
                      )}
                    </div>

                    {/* 応募 */}
                    {t.applications.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-mute">
                          応募中テーマ
                        </div>
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
                      </div>
                    )}

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
          <GlassCard className="p-4">
            <ul className="flex flex-wrap gap-1.5">
              {unaffiliated.map((m) => (
                <li
                  key={m.user_id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-mute/10 px-3 py-1 text-[12px]"
                  title={
                    [m.affiliation, m.title].filter(Boolean).join(" / ") ||
                    undefined
                  }
                >
                  {m.display_name ?? "名前未設定"}
                  {m.user_id === currentUserId && (
                    <span
                      className="text-[9.5px] font-bold text-[--c-accent-deep]"
                      aria-label="自分"
                    >
                      YOU
                    </span>
                  )}
                </li>
              ))}
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
