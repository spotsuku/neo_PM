"use client";

import { type ProjMember } from "@/components/projects/ProjectMembersPanel";
import { GlassCard } from "@/components/ui/GlassCard";

interface Props {
  members: ProjMember[];
}

/** メンバー情報 (読み取り中心) ビュー。
 *  カード形式で アバター + 表示名 + ロール + 役職 + 責任 + 業務内容 を見せる。
 *  編集は「メンバー追加」タブの ProjectMembersPanel から。 */
export function MemberInfoPanel({ members }: Props) {
  if (members.length === 0) {
    return (
      <GlassCard className="p-10 text-center">
        <div className="text-5xl mb-3">👥</div>
        <h3 className="t-h3 mb-1">まだメンバーがいません</h3>
        <p className="t-cap leading-relaxed">
          「メンバー追加」タブから組織メンバーをこのプロジェクトに招待してください。
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {members.map((m) => {
        const registered =
          !!m.title?.trim() &&
          !!m.responsibility?.trim() &&
          !!m.work_description?.trim();
        return (
          <GlassCard
            key={m.id}
            className="p-4"
            style={{
              borderLeft:
                "4px solid " +
                (m.role === "lead" ? "var(--ink)" : "var(--c-accent)"),
            }}
          >
            <div className="flex items-start gap-3 mb-3">
              <span
                className="grid h-14 w-14 place-items-center rounded-full text-white text-[18px] font-bold flex-shrink-0"
                style={{
                  background: m.avatar_url
                    ? `url(${m.avatar_url}) center / cover`
                    : m.role === "lead"
                      ? "linear-gradient(135deg, var(--ink), #1f2937)"
                      : "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                }}
                aria-hidden
              >
                {!m.avatar_url && ((m.display_name ?? "?")[0] ?? "?")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-[14px] font-extrabold text-ink truncate">
                    {m.display_name ?? "（名前未設定）"}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{
                      background:
                        m.role === "lead" ? "var(--ink)" : "var(--c-accent)",
                    }}
                  >
                    {m.role === "lead" ? "リード" : "メンバー"}
                  </span>
                  {registered ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-ok/15 px-1.5 py-px text-[10px] font-bold text-[var(--ok)]">
                      ✓ 登録完了
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-warn/15 px-1.5 py-px text-[10px] font-bold text-[var(--warn)]">
                      ⏳ 未登録
                    </span>
                  )}
                </div>
                <div className="text-[12.5px] font-semibold text-ink-2 truncate">
                  🎖 {m.title?.trim() || "（役職未設定）"}
                </div>
                <div className="t-cap mt-0.5">
                  加入 {new Date(m.created_at).toLocaleDateString("ja-JP")}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="rounded-md bg-white border border-line-soft px-3 py-2">
                <div className="t-label mb-1">🎯 責任範囲</div>
                <p className="text-[12px] leading-relaxed text-ink-2 whitespace-pre-wrap">
                  {m.responsibility?.trim() || (
                    <span className="text-mute">未記入</span>
                  )}
                </p>
              </div>
              <div className="rounded-md bg-white border border-line-soft px-3 py-2">
                <div className="t-label mb-1">🛠 業務内容</div>
                <p className="text-[12px] leading-relaxed text-ink-2 whitespace-pre-wrap">
                  {m.work_description?.trim() || (
                    <span className="text-mute">未記入</span>
                  )}
                </p>
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
