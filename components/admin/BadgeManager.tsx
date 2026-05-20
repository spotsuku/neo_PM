"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { BadgeMedal } from "@/components/dashboard/BadgeMedal";
import { BADGES, PROJECT_LAUNCHED_BADGE } from "@/lib/badges";
import type { Database } from "@/lib/types/database";
import type { ProjectStats } from "@/lib/admin";

type Badge = Database["public"]["Tables"]["badges"]["Row"];
type Award = Database["public"]["Tables"]["badge_awards"]["Row"];

interface Props {
  orgId: string;
  initialBadges: Badge[];
  initialAwards: Award[];
  projects: ProjectStats[];
}

const PRESET_EMOJI = [
  "🏅",
  "🏆",
  "🥇",
  "✦",
  "🌟",
  "🏞",
  "🤝",
  "💴",
  "🚀",
  "🌱",
  "🔥",
  "🎯",
];

const PRESET_COLOR = [
  "#5b8def", // accent
  "#2e5cbf", // accent-deep
  "#0a8754", // ok
  "#b8860b", // warn
  "#c0392b", // error
  "#0a0a0a", // ink
];

export function BadgeManager({
  orgId,
  initialBadges,
  initialAwards,
  projects,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [badges, setBadges] = useState<Badge[]>(initialBadges);
  const [awards, setAwards] = useState<Award[]>(initialAwards);
  const [error, setError] = useState<string | null>(null);

  // 11 system バッジの組織内獲得状況: {badgeId: ProjectStats[]}
  const systemAwardsByBadge = useMemo(() => {
    const m = new Map<string, ProjectStats[]>();
    for (const b of BADGES) m.set(b.id, []);
    for (const p of projects) {
      for (const bid of p.badges ?? []) {
        if (m.has(bid)) m.get(bid)!.push(p);
      }
    }
    return m;
  }, [projects]);

  const revokeSystemBadge = async (badgeId: string, projectId: string) => {
    if (!confirm("このバッジ付与を取り消しますか？")) return;
    const proj = projects.find((p) => p.id === projectId);
    const nextBadges = (proj?.badges ?? []).filter((b) => b !== badgeId);
    const { error: err } = await supabase
      .from("projects")
      .update({ badges: nextBadges })
      .eq("id", projectId);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  };

  const awardsByBadge = useMemo(() => {
    const map = new Map<string, Award[]>();
    for (const a of awards) {
      if (!map.has(a.badge_id)) map.set(a.badge_id, []);
      map.get(a.badge_id)!.push(a);
    }
    return map;
  }, [awards]);

  const createBadge = async () => {
    const next = badges.length;
    const { data, error: err } = await supabase
      .from("badges")
      .insert({
        organization_id: orgId,
        title: "新しいバッジ",
        emoji: "🏅",
        color: "#5b8def",
        position: next,
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "作成に失敗しました");
      return;
    }
    setBadges((prev) => [...prev, data]);
  };

  const updateBadge = async (id: string, patch: Partial<Badge>) => {
    setBadges((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
    const { error: err } = await supabase
      .from("badges")
      .update(patch as never)
      .eq("id", id);
    if (err) setError(err.message);
  };

  const removeBadge = async (id: string) => {
    if (
      !confirm(
        "このバッジを削除しますか？\n各プロジェクトへの付与もすべて取り消されます。",
      )
    )
      return;
    setBadges((prev) => prev.filter((b) => b.id !== id));
    setAwards((prev) => prev.filter((a) => a.badge_id !== id));
    await supabase.from("badges").delete().eq("id", id);
  };

  const awardBadge = async (badgeId: string, projectId: string) => {
    const { data, error: err } = await supabase
      .from("badge_awards")
      .insert({ badge_id: badgeId, project_id: projectId })
      .select()
      .single();
    if (err || !data) {
      if (err?.message.includes("duplicate")) {
        setError("そのプロジェクトには既に付与済みです");
      } else {
        setError(err?.message ?? "付与に失敗しました");
      }
      return;
    }
    setAwards((prev) => [...prev, data]);

    // プロジェクトの badges 文字列配列にも反映（dashboard の表示用、後方互換）
    const badge = badges.find((b) => b.id === badgeId);
    if (badge) {
      const { data: proj } = await supabase
        .from("projects")
        .select("badges")
        .eq("id", projectId)
        .maybeSingle();
      const existing = (proj?.badges ?? []) as string[];
      if (!existing.includes(badge.title)) {
        await supabase
          .from("projects")
          .update({ badges: [...existing, badge.title] })
          .eq("id", projectId);
      }
    }
    // ダッシュボード等の他ページに反映するためキャッシュ無効化
    router.refresh();
  };

  const revokeAward = async (awardId: string) => {
    const award = awards.find((a) => a.id === awardId);
    if (!award) return;
    if (!confirm("この付与を取り消しますか？")) return;
    setAwards((prev) => prev.filter((a) => a.id !== awardId));
    await supabase.from("badge_awards").delete().eq("id", awardId);

    // projects.badges からも除去
    const badge = badges.find((b) => b.id === award.badge_id);
    if (badge) {
      const { data: proj } = await supabase
        .from("projects")
        .select("badges")
        .eq("id", award.project_id)
        .maybeSingle();
      const existing = (proj?.badges ?? []) as string[];
      const next = existing.filter((t) => t !== badge.title);
      if (next.length !== existing.length) {
        await supabase
          .from("projects")
          .update({ badges: next })
          .eq("id", award.project_id);
      }
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* === システムバッジ (立ち上げ 10 ステップ + master) === */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="t-h3">
            <span aria-hidden className="mr-2">
              🏆
            </span>
            システムバッジ (立ち上げ 10 ステップ + 完了)
          </h3>
          <span className="t-cap">{BADGES.length} 種類</span>
        </div>
        <p className="t-cap mb-3 leading-relaxed">
          各プロジェクトの「メンバー」タブで条件を満たすと自動付与されます。組織内の獲得状況を一覧できます。
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {BADGES.map((b) => {
            const awardedProjects = systemAwardsByBadge.get(b.id) ?? [];
            return (
              <div key={b.id} className="flex flex-col">
                <BadgeMedal
                  name={b.name}
                  desc={b.desc}
                  earned={awardedProjects.length > 0}
                  glyph={b.glyph}
                  progress={
                    awardedProjects.length > 0
                      ? undefined
                      : 0
                  }
                />
                <div className="mt-1 text-center">
                  <span className="t-cap">
                    {awardedProjects.length} / {projects.length} PJT
                  </span>
                </div>
                {awardedProjects.length > 0 && (
                  <details className="mt-1 group">
                    <summary className="t-cap underline cursor-pointer text-center">
                      獲得 PJT を見る
                    </summary>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {awardedProjects.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between rounded-md bg-canvas-2 px-2 py-1 text-[11px]"
                        >
                          <span className="truncate flex-1 min-w-0">
                            {p.name}
                          </span>
                          {b.id !== PROJECT_LAUNCHED_BADGE && (
                            <button
                              type="button"
                              onClick={() =>
                                revokeSystemBadge(b.id, p.id)
                              }
                              className="ml-1 text-mute hover:text-error"
                              title="取消"
                              aria-label="取消"
                            >
                              ✕
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* === カスタムバッジ (組織独自) === */}
      <div className="flex items-center justify-between">
        <h3 className="t-h3">
          <span aria-hidden className="mr-2">
            🏅
          </span>
          カスタムバッジ ({badges.length})
        </h3>
        <button
          type="button"
          onClick={createBadge}
          className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
        >
          ＋ バッジを追加
        </button>
      </div>
      <p className="t-cap leading-relaxed">
        システムバッジに加えて、組織独自の目標バッジを定義してチームに付与できます。
      </p>

      {badges.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <div className="text-4xl mb-3">🏅</div>
          <h3 className="t-h3 mb-1">バッジがまだありません</h3>
          <p className="t-cap mb-4 leading-relaxed">
            組織で目指す行動・成果をバッジとして定義し、達成したチームに付与します。
            <br />
            ダッシュボードのバッジコレクションに表示されます。
          </p>
        </GlassCard>
      ) : (
        badges
          .sort((a, b) => a.position - b.position)
          .map((b) => (
            <BadgeCard
              key={b.id}
              badge={b}
              awards={awardsByBadge.get(b.id) ?? []}
              projects={projects}
              onUpdate={(patch) => updateBadge(b.id, patch)}
              onRemove={() => removeBadge(b.id)}
              onAward={(projectId) => awardBadge(b.id, projectId)}
              onRevoke={(awardId) => revokeAward(awardId)}
            />
          ))
      )}
    </div>
  );
}

function BadgeCard({
  badge,
  awards,
  projects,
  onUpdate,
  onRemove,
  onAward,
  onRevoke,
}: {
  badge: Badge;
  awards: Award[];
  projects: ProjectStats[];
  onUpdate: (patch: Partial<Badge>) => void;
  onRemove: () => void;
  onAward: (projectId: string) => void;
  onRevoke: (awardId: string) => void;
}) {
  const [local, setLocal] = useState({
    title: badge.title,
    description: badge.description ?? "",
    criteria_text: badge.criteria_text ?? "",
  });
  const [showAwardSelector, setShowAwardSelector] = useState(false);

  const awardedProjectIds = new Set(awards.map((a) => a.project_id));
  const availableProjects = projects.filter(
    (p) => !awardedProjectIds.has(p.id),
  );

  const commit = (patch: Partial<Badge>) => onUpdate(patch);

  return (
    <GlassCard
      className="p-4"
      style={{ borderLeft: `4px solid ${badge.color ?? "#5b8def"}` }}
    >
      <div className="grid grid-cols-[64px_1fr_auto] gap-3 items-start mb-3">
        {/* バッジプレビュー */}
        <div
          className="grid h-16 w-16 place-items-center rounded-2xl text-white text-2xl font-bold"
          style={{
            background: `linear-gradient(135deg, ${badge.color ?? "#5b8def"}, color-mix(in srgb, ${badge.color ?? "#5b8def"} 65%, #000))`,
          }}
        >
          {badge.emoji ?? "🏅"}
        </div>

        {/* タイトル + 説明 */}
        <div className="min-w-0">
          <input
            type="text"
            value={local.title}
            onChange={(e) => setLocal((s) => ({ ...s, title: e.target.value }))}
            onBlur={() =>
              local.title !== badge.title && commit({ title: local.title })
            }
            className="w-full rounded-md border border-line bg-white px-2 py-1 text-[14px] font-bold outline-none focus:border-[--c-accent] mb-1.5"
          />
          <input
            type="text"
            value={local.description}
            onChange={(e) =>
              setLocal((s) => ({ ...s, description: e.target.value }))
            }
            onBlur={() =>
              local.description !== (badge.description ?? "") &&
              commit({ description: local.description || null })
            }
            placeholder="バッジの目的（短い説明）"
            className="w-full rounded-md border border-line bg-white px-2 py-1 text-[12px] outline-none focus:border-[--c-accent] mb-1.5"
          />
          <input
            type="text"
            value={local.criteria_text}
            onChange={(e) =>
              setLocal((s) => ({ ...s, criteria_text: e.target.value }))
            }
            onBlur={() =>
              local.criteria_text !== (badge.criteria_text ?? "") &&
              commit({ criteria_text: local.criteria_text || null })
            }
            placeholder="獲得条件（例: 現場へ3回以上訪問）"
            className="w-full rounded-md border border-line bg-white px-2 py-1 text-[11.5px] outline-none focus:border-[--c-accent]"
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="rounded-md bg-red-50 px-2 py-1 text-[10.5px] font-semibold text-error hover:bg-red-100"
        >
          🗑 削除
        </button>
      </div>

      {/* 絵文字 + 色のクイック選択 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <span className="t-label block mb-1">絵文字</span>
          <div className="flex flex-wrap gap-1">
            {PRESET_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => commit({ emoji: e })}
                className={
                  "grid h-7 w-7 place-items-center rounded-md text-[14px] transition " +
                  (badge.emoji === e
                    ? "bg-ink text-white"
                    : "bg-white border border-line hover:border-[--c-accent]")
                }
              >
                {e}
              </button>
            ))}
            <input
              type="text"
              value={badge.emoji ?? ""}
              onChange={(e) =>
                commit({ emoji: e.target.value.slice(0, 4) || null })
              }
              className="w-16 rounded-md border border-line bg-white px-1 py-1 text-center text-[14px] outline-none focus:border-[--c-accent]"
              placeholder="任意"
            />
          </div>
        </div>
        <div>
          <span className="t-label block mb-1">色</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLOR.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => commit({ color: c })}
                className={
                  "h-7 w-7 rounded-md transition " +
                  (badge.color === c
                    ? "ring-2 ring-[--c-accent] ring-offset-2"
                    : "")
                }
                style={{ background: c }}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              value={badge.color ?? "#5b8def"}
              onChange={(e) => commit({ color: e.target.value })}
              className="h-7 w-12 rounded-md border border-line cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 付与情報 */}
      <div className="rounded-lg bg-canvas-2 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="t-label">
            付与済みプロジェクト ({awards.length})
          </span>
          {availableProjects.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAwardSelector((v) => !v)}
              className="rounded-md bg-ink px-2.5 py-1 text-[10.5px] font-semibold text-white hover:opacity-90"
            >
              {showAwardSelector ? "✕ 閉じる" : "＋ 付与"}
            </button>
          )}
        </div>

        {showAwardSelector && (
          <div className="mb-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {availableProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onAward(p.id);
                  setShowAwardSelector(false);
                }}
                className="rounded-md bg-white border border-line px-2.5 py-1.5 text-[11.5px] text-left hover:bg-accent-soft hover:border-[--c-accent]"
              >
                <div className="font-semibold truncate">{p.name}</div>
                <div className="t-cap truncate">
                  {p.team_name ?? p.status}
                </div>
              </button>
            ))}
            {availableProjects.length === 0 && (
              <div className="t-cap col-span-2 text-center py-2">
                付与可能なプロジェクトがありません
              </div>
            )}
          </div>
        )}

        {awards.length === 0 ? (
          <p className="t-cap leading-relaxed">
            まだ誰にも付与されていません。「＋ 付与」から始めましょう。
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {awards.map((a) => {
              const proj = projects.find((p) => p.id === a.project_id);
              return (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold shadow-[0_1px_0_var(--line-soft)]"
                  style={{ color: badge.color ?? "#5b8def" }}
                >
                  <span aria-hidden>{badge.emoji ?? "🏅"}</span>
                  <span className="text-ink">
                    {proj?.name ?? "（削除済み）"}
                  </span>
                  <span className="t-cap">
                    {new Date(a.awarded_at).toLocaleDateString("ja-JP")}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRevoke(a.id)}
                    className="text-mute hover:text-error ml-1"
                    aria-label="取消"
                    title="取消"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
