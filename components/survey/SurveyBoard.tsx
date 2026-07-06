"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

type Theme = {
  id: string;
  title: string;
  description: string | null;
};

type Preference = {
  id: string;
  user_id: string;
  theme_id: string;
  preference_rank: number;
  display_name: string;
  is_me: boolean;
};

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  currentUserId: string;
  themes: Theme[];
  preferences: Preference[];
  memberCount: number;
}

// 希望順位ごとの色 (第1: 濃 → 第5: 薄)
const RANK_COLORS: Record<number, string> = {
  1: "#ef4444", // red-500  第1希望 (最重要)
  2: "#f97316", // orange-500
  3: "#eab308", // yellow-500
  4: "#22c55e", // green-500
  5: "#3b82f6", // blue-500
};

const RANK_LABEL: Record<number, string> = {
  1: "第1希望",
  2: "第2希望",
  3: "第3希望",
  4: "第4希望",
  5: "第5希望",
};

// 加重スコア (第1=5pt, ..., 第5=1pt)
function rankToScore(rank: number): number {
  return Math.max(0, 6 - rank);
}

export function SurveyBoard({
  orgId,
  orgName,
  currentUserId,
  themes,
  preferences,
  memberCount,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 自分の希望 (rank -> theme_id)
  const myChoices = useMemo(() => {
    const map: Record<number, string | null> = {
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
    };
    for (const p of preferences) {
      if (p.is_me) map[p.preference_rank] = p.theme_id;
    }
    return map;
  }, [preferences]);

  // テーマ別集計 (rank ごとの人数 + 参加者)
  const stats = useMemo(() => {
    const byTheme: Record<
      string,
      { rank: number; users: { user_id: string; display_name: string; is_me: boolean }[] }[]
    > = {};
    for (const t of themes) byTheme[t.id] = [1, 2, 3, 4, 5].map((r) => ({ rank: r, users: [] }));
    for (const p of preferences) {
      const bucket = byTheme[p.theme_id]?.find((b) => b.rank === p.preference_rank);
      if (bucket) {
        bucket.users.push({
          user_id: p.user_id,
          display_name: p.display_name,
          is_me: p.is_me,
        });
      }
    }
    return byTheme;
  }, [themes, preferences]);

  // 加重スコア順に並べたテーマ
  const rankedThemes = useMemo(() => {
    return themes
      .map((t) => {
        const s = stats[t.id] ?? [];
        const total = s.reduce((acc, b) => acc + b.users.length, 0);
        const score = s.reduce(
          (acc, b) => acc + rankToScore(b.rank) * b.users.length,
          0,
        );
        return { theme: t, buckets: s, total, score };
      })
      .sort((a, b) => b.score - a.score || b.total - a.total);
  }, [themes, stats]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const rt of rankedThemes) if (rt.total > m) m = rt.total;
    return Math.max(m, 1);
  }, [rankedThemes]);

  const respondedUserCount = useMemo(() => {
    return new Set(preferences.map((p) => p.user_id)).size;
  }, [preferences]);

  const myPickCount = Object.values(myChoices).filter(Boolean).length;

  // 選択済テーマは他の rank で選べない (UI 側で除外)
  const takenThemeIds = new Set(
    Object.entries(myChoices)
      .filter(([, v]) => v)
      .map(([, v]) => v as string),
  );

  const saveChoice = async (rank: number, themeId: string | null) => {
    setBusy(true);
    setError(null);

    const currentThemeId = myChoices[rank];
    const existingPref = preferences.find(
      (p) => p.is_me && p.preference_rank === rank,
    );

    try {
      if (!themeId) {
        // クリア = DELETE
        if (existingPref) {
          const { error: err } = await supabase
            .from("theme_preferences")
            .delete()
            .eq("id", existingPref.id);
          if (err) throw err;
        }
      } else if (existingPref) {
        // 差し替え = UPDATE
        if (currentThemeId !== themeId) {
          const { error: err } = await supabase
            .from("theme_preferences")
            .update({ theme_id: themeId } as never)
            .eq("id", existingPref.id);
          if (err) throw err;
        }
      } else {
        // 新規 = INSERT
        const { error: err } = await supabase
          .from("theme_preferences")
          .insert({
            user_id: currentUserId,
            organization_id: orgId,
            theme_id: themeId,
            preference_rank: rank,
          } as never);
        if (err) throw err;
      }
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存に失敗しました";
      // ユニーク制約でユーザに分かりやすい文言に置換
      if (msg.includes("theme_prefs_user_theme_uniq")) {
        setError("このテーマは既に別の希望順位で選択されています。");
      } else if (msg.includes("theme_prefs_user_rank_uniq")) {
        setError("既に同じ希望順位にテーマが登録されています。ページを再読込してください。");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Header */}
      <GlassCard className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white text-xl"
            style={{
              background: "linear-gradient(135deg, #ef4444, #eab308)",
            }}
            aria-hidden
          >
            🗳️
          </span>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold tracking-tight">
              テーマ意識調査
            </h1>
            <p className="t-cap">
              {orgName} ・ あなたは第1〜第5希望を選べます (回答: {respondedUserCount}/{memberCount || "?"} 名)
            </p>
          </div>
        </div>
        <span
          className={
            "rounded-full px-3 py-1.5 text-[11.5px] font-semibold " +
            (myPickCount === 5
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800")
          }
        >
          あなたの回答: {myPickCount}/5
        </span>
      </GlassCard>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {themes.length === 0 ? (
        <GlassCard className="p-8 text-center flex flex-col gap-2">
          <span aria-hidden className="text-2xl">
            📭
          </span>
          <p className="text-[13px] text-mute">
            この組織にはまだ公開中のテーマがありません。
          </p>
        </GlassCard>
      ) : (
        <>
          {/* 自分の希望入力 */}
          <MyChoiceSection
            themes={themes}
            myChoices={myChoices}
            takenThemeIds={takenThemeIds}
            busy={busy}
            onChange={saveChoice}
          />

          {/* 集計結果 */}
          <AggregateSection
            themes={themes}
            rankedThemes={rankedThemes}
            maxCount={maxCount}
            respondedUserCount={respondedUserCount}
          />
        </>
      )}
    </div>
  );
}

function MyChoiceSection({
  themes,
  myChoices,
  takenThemeIds,
  busy,
  onChange,
}: {
  themes: Theme[];
  myChoices: Record<number, string | null>;
  takenThemeIds: Set<string>;
  busy: boolean;
  onChange: (rank: number, themeId: string | null) => void;
}) {
  return (
    <GlassCard className="p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span aria-hidden>👤</span>
        <h2 className="text-[15px] font-extrabold">あなたの希望</h2>
        <span className="t-cap">
          第1〜第5希望まで選んでください (同じテーマは複数の希望に指定できません)
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((rank) => {
          const current = myChoices[rank];
          return (
            <li key={rank} className="flex items-center gap-3 flex-wrap">
              <span
                className="inline-flex items-center justify-center flex-shrink-0 rounded-full text-white text-[11px] font-bold w-16 py-1.5"
                style={{ background: RANK_COLORS[rank] }}
              >
                {RANK_LABEL[rank]}
              </span>
              <select
                value={current ?? ""}
                disabled={busy}
                onChange={(e) => onChange(rank, e.target.value || null)}
                className="flex-1 min-w-[220px] rounded-md border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-[--c-accent] disabled:opacity-50"
              >
                <option value="">— 未選択 —</option>
                {themes.map((t) => {
                  const isTakenByOther =
                    takenThemeIds.has(t.id) && current !== t.id;
                  return (
                    <option key={t.id} value={t.id} disabled={isTakenByOther}>
                      {t.title}
                      {isTakenByOther ? " (他の希望に選択済)" : ""}
                    </option>
                  );
                })}
              </select>
              {current && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onChange(rank, null)}
                  className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)] disabled:opacity-50"
                >
                  クリア
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}

function AggregateSection({
  rankedThemes,
  maxCount,
  respondedUserCount,
}: {
  themes: Theme[];
  rankedThemes: {
    theme: Theme;
    buckets: {
      rank: number;
      users: { user_id: string; display_name: string; is_me: boolean }[];
    }[];
    total: number;
    score: number;
  }[];
  maxCount: number;
  respondedUserCount: number;
}) {
  return (
    <GlassCard className="p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span aria-hidden>📊</span>
        <h2 className="text-[15px] font-extrabold">
          みんなの意識調査結果 ({respondedUserCount} 名が回答)
        </h2>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1 text-[10.5px] text-ink-2"
            >
              <span
                className="inline-block w-3 h-3 rounded"
                style={{ background: RANK_COLORS[r] }}
                aria-hidden
              />
              {RANK_LABEL[r]}
            </span>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {rankedThemes.map((rt) => (
          <li key={rt.theme.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h3 className="text-[13.5px] font-bold truncate">
                {rt.theme.title}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-mute flex-shrink-0">
                <span>{rt.total} 票</span>
                <span className="text-ink-2 font-bold">
                  加重{rt.score}pt
                </span>
              </div>
            </div>
            {/* 積み上げ棒 */}
            <div
              className="flex h-6 rounded-md overflow-hidden bg-mute/10"
              title={`合計 ${rt.total} 票`}
              style={{ width: `${(rt.total / maxCount) * 100}%`, minWidth: rt.total > 0 ? "3%" : "0" }}
            >
              {rt.buckets.map((b) => {
                if (b.users.length === 0) return null;
                const pct = (b.users.length / rt.total) * 100;
                return (
                  <div
                    key={b.rank}
                    className="flex items-center justify-center text-white text-[10px] font-bold overflow-hidden"
                    style={{
                      width: `${pct}%`,
                      background: RANK_COLORS[b.rank],
                    }}
                    title={`${RANK_LABEL[b.rank]}: ${b.users
                      .map((u) => u.display_name)
                      .join(", ")}`}
                  >
                    {b.users.length}
                  </div>
                );
              })}
            </div>
            {/* 参加者チップ (rank 順) */}
            <div className="flex flex-wrap gap-1">
              {rt.buckets.flatMap((b) =>
                b.users.map((u) => (
                  <span
                    key={`${b.rank}-${u.user_id}`}
                    className={
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] " +
                      (u.is_me
                        ? "bg-ink text-white font-semibold"
                        : "bg-mute/10 text-ink-2")
                    }
                    title={RANK_LABEL[b.rank]}
                    style={{
                      borderLeft: `3px solid ${RANK_COLORS[b.rank]}`,
                    }}
                  >
                    <span aria-hidden className="text-[9px]">
                      第{b.rank}
                    </span>
                    {u.display_name}
                    {u.is_me && (
                      <span className="text-[8.5px] opacity-80">YOU</span>
                    )}
                  </span>
                )),
              )}
              {rt.total === 0 && (
                <span className="t-cap italic">まだ誰も選んでいません</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
