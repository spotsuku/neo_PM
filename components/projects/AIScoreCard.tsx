"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { RingV2 } from "@/components/ui/RingV2";
import { HexRadarLabeled } from "@/components/ui/HexRadarLabeled";
import type { ProjectScore } from "@/lib/projectScore";

interface Props {
  score: ProjectScore;
  /** ヘッダーを省略してコンパクトに使う (ダッシュボード hero など) */
  compact?: boolean;
}

const RATING_COLOR: Record<ProjectScore["rating"], string> = {
  "A+": "#0a8754",
  A: "#10b981",
  B: "#5b8def",
  C: "#f59e0b",
  D: "#ef476f",
};

export function AIScoreCard({ score, compact }: Props) {
  if (compact) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <RingV2
            size={88}
            stroke={9}
            value={score.total}
            showValue
            color={RATING_COLOR[score.rating]}
          />
          <span
            className="absolute -top-1 -right-2 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-md"
            style={{ background: RATING_COLOR[score.rating] }}
          >
            {score.rating}
          </span>
        </div>
        <div className="t-cap mt-1.5 font-semibold text-ink">
          ✦ AI 総合評価
        </div>
      </div>
    );
  }

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="relative shrink-0">
          <RingV2
            size={92}
            stroke={9}
            value={score.total}
            showValue
            color={RATING_COLOR[score.rating]}
          />
          <span
            className="absolute -top-1 -right-2 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white shadow-md"
            style={{ background: RATING_COLOR[score.rating] }}
          >
            {score.rating}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="t-h3">
            <span aria-hidden className="mr-2">
              ✦
            </span>
            AI 総合評価
          </h3>
          <p className="t-cap leading-relaxed mt-1">
            計画 / チーム / 実行 / アクティビティ / 振り返り / KPI の 6 次元で評価。
            各軸 0〜100 点満点の平均が総合点です。
          </p>
        </div>
      </div>

      {/* 6 角形レーダー */}
      <div className="grid place-items-center mb-4">
        <HexRadarLabeled
          size={340}
          max={100}
          data={score.dimensions.map((d) => ({
            label: d.label,
            value: d.score,
            emo: d.emo,
          }))}
        />
      </div>

      {/* 各次元の説明 + AI コメント */}
      <ul className="flex flex-col gap-2">
        {score.dimensions.map((d) => (
          <li
            key={d.key}
            className="rounded-lg bg-white border border-line-soft p-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <span aria-hidden>{d.emo}</span>
              <span className="text-[12.5px] font-bold flex-1 min-w-0 truncate">
                {d.label}
              </span>
              <span
                className="text-[14px] font-extrabold"
                style={{
                  color:
                    d.score >= 75
                      ? "var(--ok)"
                      : d.score >= 40
                        ? "var(--c-accent)"
                        : "var(--mute)",
                }}
              >
                {d.score}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-line-soft overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${d.score}%`,
                  background:
                    d.score >= 75
                      ? "var(--ok)"
                      : "linear-gradient(90deg, var(--c-accent), var(--c-accent-deep))",
                }}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-2 items-start">
              <p className="t-cap leading-snug">
                <span className="font-semibold text-ink-2">評価軸: </span>
                {d.desc}
              </p>
              <p className="t-cap leading-snug">
                <span className="font-semibold text-ink-2">現状: </span>
                {d.detail}
              </p>
            </div>
            <div className="mt-2 rounded-md bg-accent-soft/40 px-2.5 py-1.5">
              <p className="text-[11.5px] leading-relaxed text-ink-2">
                <span className="font-bold text-ink">✦ AI コメント: </span>
                {d.comment}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
