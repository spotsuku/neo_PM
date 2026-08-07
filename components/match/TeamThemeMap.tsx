"use client";

import Link from "next/link";
import { useMemo } from "react";

import { GlassCard } from "@/components/ui/GlassCard";

type Member = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Theme = {
  id: string;
  code: string | null;
  title: string;
  posted_by: string | null;
  totalInterest: number;
  byRank: {
    rank1: string[];
    rank2: string[];
    rank3to5: string[];
  };
  appliedTeams: {
    team_id: string;
    status: string;
    preference_rank: number | null;
  }[];
};

type Team = {
  id: string;
  name: string;
  members: string[];
  applications: {
    id: string;
    theme_id: string;
    status: string;
    preference_rank: number | null;
  }[];
};

type Unaffiliated = Member & {
  top_prefs: { theme_id: string; rank: number }[];
};

type Round = {
  id: string;
  label: string;
  round_number: number;
  opens_at: string;
  closes_at: string;
};

interface Props {
  orgSlug: string;
  currentUserId: string;
  myTeamId: string | null;
  themes: Theme[];
  teams: Team[];
  orgMembers: Member[];
  unaffiliated: Unaffiliated[];
  rounds: Round[];
  selectedRound: Round | null;
}

/** ユーザー名の 1 文字目を安定的な色に */
function initialOf(name: string | null): string {
  const t = (name ?? "").trim();
  if (!t) return "?";
  return Array.from(t)[0]!.toUpperCase();
}
function colorOf(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 60% 55%)`;
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "approved" || status === "applied"
      ? "✓ 応募済"
      : status === "draft" || status === "firstReview"
        ? "準備中"
        : status === "rejected"
          ? "却下"
          : status;
  const cls =
    status === "approved" || status === "applied"
      ? "bg-emerald-100 text-emerald-700"
      : status === "rejected"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-800";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  );
}

function Avatar({
  member,
  isMe,
  isUnaffiliated,
  size = 20,
}: {
  member: Member | null;
  isMe?: boolean;
  isUnaffiliated?: boolean;
  size?: number;
}) {
  if (!member) return null;
  const bg = colorOf(member.user_id);
  const initial = initialOf(member.display_name);
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-[11px] leading-none border " +
        (isMe
          ? "bg-[--c-accent-soft] border-[--c-accent] font-semibold text-ink"
          : isUnaffiliated
            ? "bg-amber-50 border-amber-400 text-amber-800"
            : "bg-white border-line-soft text-ink")
      }
      title={member.display_name ?? "(名前未設定)"}
    >
      {member.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.avatar_url}
          alt=""
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          aria-hidden
          className="grid place-items-center rounded-full text-white font-bold"
          style={{
            width: size,
            height: size,
            background: bg,
            fontSize: Math.max(9, size * 0.5),
          }}
        >
          {initial}
        </span>
      )}
      <span className="truncate max-w-[7em]">
        {member.display_name ?? "(名無し)"}
      </span>
      {isUnaffiliated && (
        <span aria-hidden className="text-[10px]">
          🔍
        </span>
      )}
      {isMe && (
        <span className="rounded-full bg-[--c-accent] text-white px-1.5 py-0.5 text-[8.5px] font-bold ml-0.5">
          あなた
        </span>
      )}
    </span>
  );
}

/** 円形ミニアバターだけを重ねて並べる (チーム表示用) */
function MembersMini({
  memberIds,
  membersById,
  max = 4,
}: {
  memberIds: string[];
  membersById: Map<string, Member>;
  max?: number;
}) {
  const shown = memberIds.slice(0, max);
  const rest = memberIds.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((uid, i) => {
        const m = membersById.get(uid);
        const initial = initialOf(m?.display_name ?? null);
        return (
          <span
            key={uid}
            className="grid place-items-center rounded-full text-white font-bold"
            style={{
              width: 22,
              height: 22,
              fontSize: 10,
              background: colorOf(uid),
              border: "2px solid var(--surface, #fff)",
              marginLeft: i === 0 ? 0 : -6,
            }}
            title={m?.display_name ?? undefined}
          >
            {m?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.avatar_url}
                alt=""
                className="rounded-full object-cover"
                style={{ width: 20, height: 20 }}
              />
            ) : (
              initial
            )}
          </span>
        );
      })}
      {rest > 0 && (
        <span
          className="grid place-items-center rounded-full bg-mute/20 text-mute font-bold text-[9.5px]"
          style={{
            width: 22,
            height: 22,
            border: "2px solid var(--surface, #fff)",
            marginLeft: -6,
          }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

export function TeamThemeMap({
  orgSlug,
  currentUserId,
  myTeamId,
  themes,
  teams,
  orgMembers,
  unaffiliated,
  rounds,
  selectedRound,
}: Props) {
  const membersById = useMemo(
    () => new Map(orgMembers.map((m) => [m.user_id, m])),
    [orgMembers],
  );
  const teamsById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams],
  );
  const themesById = useMemo(
    () => new Map(themes.map((t) => [t.id, t])),
    [themes],
  );
  const unaffiliatedIds = useMemo(
    () => new Set(unaffiliated.map((u) => u.user_id)),
    [unaffiliated],
  );

  // KPI
  const totalMembers = orgMembers.length;
  const affiliated = totalMembers - unaffiliated.length;
  const affiliatedRatio =
    totalMembers > 0 ? Math.round((affiliated / totalMembers) * 100) : 0;
  const totalApplied = teams.filter(
    (t) =>
      t.applications.filter((a) => a.status === "approved" || a.status === "applied")
        .length > 0,
  ).length;
  const totalForming = teams.length - totalApplied;

  return (
    <div className="flex flex-col gap-5">
      {/* ヘッダ */}
      <div className="flex items-baseline flex-wrap gap-3">
        <h1 className="text-[20px] font-extrabold tracking-tight">
          🎯 テーマ × チーム マップ
        </h1>
        <p className="t-cap">
          意識調査 (第1〜第5希望) から見つかる仲間 → チーム組成 → テーマ応募 の全体像
        </p>
      </div>

      {/* 意識調査 回セレクタ */}
      {rounds.length > 0 && (
        <GlassCard className="p-3 flex items-center gap-3 flex-wrap">
          <span className="t-label whitespace-nowrap">🗳️ 意識調査</span>
          <div className="flex flex-wrap gap-1.5">
            {rounds.map((r) => {
              const active = selectedRound?.id === r.id;
              const isOpen =
                new Date(r.opens_at) <= new Date() &&
                new Date() <= new Date(r.closes_at);
              return (
                <Link
                  key={r.id}
                  href={`/${orgSlug}/match?round=${r.id}`}
                  className={
                    "rounded-full border px-3 py-1 text-[12px] font-semibold transition " +
                    (active
                      ? "bg-ink text-white border-ink"
                      : "bg-white text-ink border-line hover:border-[--c-accent]")
                  }
                >
                  {r.label}
                  {isOpen && (
                    <span
                      className={
                        "ml-1.5 text-[9.5px] font-bold rounded-full px-1.5 py-0.5 " +
                        (active
                          ? "bg-white/20 text-white"
                          : "bg-emerald-100 text-emerald-700")
                      }
                    >
                      開催中
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          {selectedRound && (
            <span className="t-cap ml-auto tabular-nums">
              集計対象: {new Date(selectedRound.opens_at).toLocaleDateString("ja-JP")}
              {" 〜 "}
              {new Date(selectedRound.closes_at).toLocaleDateString("ja-JP")}
            </span>
          )}
        </GlassCard>
      )}
      {rounds.length === 0 && (
        <GlassCard className="p-3 t-cap">
          🗳️ 意識調査の「回」がまだ設定されていません。設定ページから登録すると
          回別に集計できるようになります。
        </GlassCard>
      )}

      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard className="p-4 flex flex-col gap-1">
          <span className="t-label">総メンバー</span>
          <span className="font-mono text-[24px] font-extrabold leading-none tabular-nums">
            {totalMembers}
            <span className="text-[12px] text-mute font-medium ml-1">人</span>
          </span>
        </GlassCard>
        <GlassCard className="p-4 flex flex-col gap-1">
          <span className="t-label">チーム所属済</span>
          <span
            className="font-mono text-[24px] font-extrabold leading-none tabular-nums text-emerald-600"
          >
            {affiliated}
            <span className="text-[12px] text-mute font-medium ml-1">
              / {totalMembers}人 · {affiliatedRatio}%
            </span>
          </span>
          <div className="w-full h-1 rounded-full bg-mute/15 overflow-hidden mt-1.5">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${affiliatedRatio}%` }}
            />
          </div>
        </GlassCard>
        <GlassCard className="p-4 flex flex-col gap-1">
          <span className="t-label">未所属</span>
          <span className="font-mono text-[24px] font-extrabold leading-none tabular-nums text-amber-700">
            {unaffiliated.length}
            <span className="text-[12px] text-mute font-medium ml-1">人</span>
          </span>
        </GlassCard>
        <GlassCard className="p-4 flex flex-col gap-1">
          <span className="t-label">組成済チーム</span>
          <span className="font-mono text-[24px] font-extrabold leading-none tabular-nums">
            {teams.length}
            <span className="text-[12px] text-mute font-medium ml-1">チーム</span>
          </span>
          <span className="t-cap">
            応募済 <strong className="text-emerald-600 font-mono">{totalApplied}</strong> ・
            準備中 <strong className="text-amber-700 font-mono">{totalForming}</strong>
          </span>
        </GlassCard>
      </div>

      {/* Main grid: themes + aside */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
        {/* テーマカード縦リスト */}
        <section className="flex flex-col gap-3">
          <h2 className="t-label px-1">
            テーマ一覧 (希望登録の多い順)
          </h2>
          {themes.length === 0 ? (
            <GlassCard className="p-8 text-center t-cap">
              公開中のテーマがまだありません
            </GlassCard>
          ) : (
            themes.map((t) => {
              const noTeamGap =
                t.totalInterest > 0 && t.appliedTeams.length === 0;
              const unaffInThisTheme = [
                ...t.byRank.rank1,
                ...t.byRank.rank2,
                ...t.byRank.rank3to5,
              ].filter((uid) => unaffiliatedIds.has(uid));
              return (
                <GlassCard
                  key={t.id}
                  className="p-4"
                  style={
                    noTeamGap
                      ? {
                          borderColor: "#e11d48",
                          boxShadow: "0 0 0 1px #e11d48",
                        }
                      : undefined
                  }
                >
                  {/* ヘッダ */}
                  <div className="flex items-start gap-3 mb-3 flex-wrap">
                    {t.code && (
                      <span
                        className="rounded-md border px-2 py-0.5 text-[10px] font-mono"
                        style={
                          noTeamGap
                            ? {
                                background: "#ffe4e6",
                                borderColor: "#e11d48",
                                color: "#be123c",
                              }
                            : {
                                background: "var(--c-glass, #fbfcfe)",
                                borderColor: "var(--line-soft, #eef2f7)",
                                color: "var(--ink-2, #475569)",
                              }
                        }
                      >
                        {t.code}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-[15px] leading-snug">
                        {t.title}
                      </div>
                      {noTeamGap && (
                        <div
                          className="text-[11.5px] mt-1 font-semibold"
                          style={{ color: "#be123c" }}
                        >
                          ⚠ 希望者 {t.totalInterest} 人いますが、まだチームが組成されていません
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <span className="rounded-full border border-line-soft bg-white px-2 py-0.5 text-[11.5px] whitespace-nowrap tabular-nums">
                        <strong>{t.totalInterest}</strong>
                        <span className="text-mute"> 人 希望</span>
                      </span>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11.5px] whitespace-nowrap tabular-nums"
                        style={
                          noTeamGap
                            ? {
                                background: "#ffe4e6",
                                borderColor: "#e11d48",
                                color: "#be123c",
                              }
                            : {
                                background: "white",
                                borderColor: "var(--line-soft, #eef2f7)",
                              }
                        }
                      >
                        <strong>{t.appliedTeams.length}</strong>
                        <span className="text-mute"> チーム</span>
                      </span>
                    </div>
                  </div>

                  {/* Preference rows */}
                  <PrefRow
                    rank={1}
                    label="第1希望"
                    memberIds={t.byRank.rank1}
                    membersById={membersById}
                    unaffiliatedIds={unaffiliatedIds}
                    currentUserId={currentUserId}
                  />
                  <PrefRow
                    rank={2}
                    label="第2希望"
                    memberIds={t.byRank.rank2}
                    membersById={membersById}
                    unaffiliatedIds={unaffiliatedIds}
                    currentUserId={currentUserId}
                  />
                  <PrefRow
                    rank={3}
                    label="第3〜5希望"
                    memberIds={t.byRank.rank3to5}
                    membersById={membersById}
                    unaffiliatedIds={unaffiliatedIds}
                    currentUserId={currentUserId}
                  />

                  {/* 応募中チーム */}
                  {t.appliedTeams.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-line-soft">
                      <div className="text-[11.5px] text-mute font-semibold mb-2">
                        🏁 このテーマに応募中のチーム
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {t.appliedTeams.map((at) => {
                          const team = teamsById.get(at.team_id);
                          if (!team) return null;
                          return (
                            <Link
                              key={at.team_id}
                              href={`/${orgSlug}/teams`}
                              className="inline-flex items-center gap-2 rounded-lg border border-line-soft bg-white px-2.5 py-1.5 hover:border-[--c-accent]"
                            >
                              <MembersMini
                                memberIds={team.members}
                                membersById={membersById}
                                max={4}
                              />
                              <span className="text-[11.5px] font-bold">
                                {team.name}
                              </span>
                              <StatusBadge status={at.status} />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* CTA: 未所属の希望者に声をかけてチーム組成へ */}
                  {unaffInThisTheme.length > 0 && !myTeamId && (
                    <div className="mt-3 pt-3 border-t border-line-soft">
                      <Link
                        href={`/${orgSlug}/teams`}
                        className="block text-center rounded-lg bg-ink text-white px-3 py-2 text-[12px] font-semibold hover:opacity-90"
                      >
                        👥 このテーマに興味のある未所属 {unaffInThisTheme.length} 人と組む
                      </Link>
                    </div>
                  )}
                </GlassCard>
              );
            })
          )}
          <p className="t-cap px-1">
            🔍 マーク = チーム未所属メンバー ・ 赤枠 = 希望者はいるがチーム未組成 (ギャップ)
          </p>
        </section>

        {/* サイド: 未所属 + チーム */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 self-start">
          <GlassCard className="p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="t-h3">🤝 チーム未所属メンバー</h2>
              <span className="rounded-full border border-line-soft bg-white px-2 py-0.5 text-[11.5px] font-mono tabular-nums">
                {unaffiliated.length} 人
              </span>
            </div>
            <p className="t-cap mb-2">
              希望テーマから誘って組成できます
            </p>
            {unaffiliated.length === 0 ? (
              <p className="t-cap text-center py-4">🎉 全員がチームに所属済です</p>
            ) : (
              <div className="flex flex-col">
                {unaffiliated.slice(0, 10).map((u) => (
                  <div
                    key={u.user_id}
                    className="grid grid-cols-[36px_1fr_auto] gap-2.5 items-center py-2 border-t border-dashed border-line-soft first:border-t-0"
                  >
                    <span
                      className="grid place-items-center rounded-full text-white font-bold"
                      style={{
                        width: 32,
                        height: 32,
                        fontSize: 11,
                        background: colorOf(u.user_id),
                      }}
                    >
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatar_url}
                          alt=""
                          className="rounded-full object-cover"
                          style={{ width: 32, height: 32 }}
                        />
                      ) : (
                        initialOf(u.display_name)
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold truncate">
                        {u.display_name ?? "(名前未設定)"}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {u.top_prefs.slice(0, 3).map((p) => {
                          const theme = themesById.get(p.theme_id);
                          return (
                            <span
                              key={p.theme_id}
                              className="inline-flex items-center gap-0.5 rounded border border-line-soft bg-white px-1.5 py-0.5 text-[9.5px]"
                              title={theme?.title ?? undefined}
                            >
                              <strong
                                className="text-[--c-accent-deep]"
                                style={{ color: "#1d4ed8" }}
                              >
                                {p.rank}
                              </strong>
                              <span className="font-mono text-mute">
                                {theme?.code ?? "???"}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <Link
                      href={`/${orgSlug}/teams`}
                      className="rounded-md bg-[--c-accent] text-white text-[10.5px] font-semibold px-2.5 py-1"
                      style={{ background: "#2563eb" }}
                    >
                      誘う
                    </Link>
                  </div>
                ))}
                {unaffiliated.length > 10 && (
                  <Link
                    href={`/${orgSlug}/teams`}
                    className="t-cap text-center pt-2 underline"
                  >
                    + 他 {unaffiliated.length - 10} 名 → 全員を見る
                  </Link>
                )}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="t-h3">🏁 組成済チーム</h2>
              <span className="rounded-full border border-line-soft bg-white px-2 py-0.5 text-[11.5px] font-mono tabular-nums">
                {teams.length} チーム
              </span>
            </div>
            {teams.length === 0 ? (
              <p className="t-cap text-center py-4">
                まだ組成されていません
              </p>
            ) : (
              <div className="flex flex-col">
                {teams.slice(0, 8).map((t) => {
                  const app = t.applications.find(
                    (a) => a.status === "approved" || a.status === "applied",
                  );
                  const forming = !app;
                  const target = app
                    ? themesById.get(app.theme_id)
                    : null;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 py-2 border-t border-dashed border-line-soft first:border-t-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[12px] font-bold truncate">
                          {t.name}
                        </span>
                        <MembersMini
                          memberIds={t.members}
                          membersById={membersById}
                          max={4}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px] text-mute">
                        {target ? (
                          <span className="font-mono text-[--c-accent-deep]" style={{ color: "#1d4ed8" }}>
                            {target.code ?? "?"}
                          </span>
                        ) : (
                          <span className="text-mute">未応募</span>
                        )}
                        {forming ? (
                          <StatusBadge status="draft" />
                        ) : (
                          <StatusBadge status={app!.status} />
                        )}
                      </div>
                    </div>
                  );
                })}
                {teams.length > 8 && (
                  <Link
                    href={`/${orgSlug}/teams`}
                    className="t-cap text-center pt-2 underline"
                  >
                    + 他 {teams.length - 8} チーム → 全チームを見る
                  </Link>
                )}
              </div>
            )}
          </GlassCard>
        </aside>
      </div>
    </div>
  );
}

function PrefRow({
  rank,
  label,
  memberIds,
  membersById,
  unaffiliatedIds,
  currentUserId,
}: {
  rank: 1 | 2 | 3;
  label: string;
  memberIds: string[];
  membersById: Map<string, Member>;
  unaffiliatedIds: Set<string>;
  currentUserId: string;
}) {
  if (memberIds.length === 0) return null;
  const badgeStyle: React.CSSProperties =
    rank === 1
      ? { background: "#1d4ed8", color: "#fff" }
      : rank === 2
        ? { background: "#2563eb", color: "#fff" }
        : { background: "#2563eb", color: "#fff", opacity: 0.55 };
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 items-center py-2 border-t border-dashed border-line-soft first:border-t-0">
      <span className="inline-flex items-center gap-2 text-[11.5px] text-mute">
        <span
          className="w-5 h-5 rounded-md grid place-items-center font-mono font-bold text-[11px]"
          style={badgeStyle}
        >
          {rank}
        </span>
        <span>
          {label} ({memberIds.length})
        </span>
      </span>
      <div className="flex flex-wrap gap-1.5 items-center">
        {memberIds.slice(0, 10).map((uid) => {
          const m = membersById.get(uid);
          if (!m) return null;
          return (
            <Avatar
              key={uid}
              member={m}
              isMe={uid === currentUserId}
              isUnaffiliated={unaffiliatedIds.has(uid)}
            />
          );
        })}
        {memberIds.length > 10 && (
          <span className="text-[11px] text-mute font-mono tabular-nums px-1.5">
            + {memberIds.length - 10} 名
          </span>
        )}
      </div>
    </div>
  );
}
