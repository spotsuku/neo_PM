import { GlassCard } from "@/components/ui/GlassCard";
import type { OrgSummary } from "@/lib/admin";

export function OrgSummaryCards({
  summary,
  stalledCount,
}: {
  summary: OrgSummary;
  stalledCount: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card
        label="プロジェクト"
        value={`${summary.projectsActive}/${summary.projectsTotal}`}
        sub={`active / 全体`}
        badge={
          stalledCount > 0
            ? { text: `停滞 ${stalledCount}`, color: "var(--warn)" }
            : undefined
        }
      />
      <Card
        label="メンバー"
        value={String(summary.membersTotal)}
        sub={
          summary.membersInactive > 0
            ? `非アクティブ ${summary.membersInactive}名`
            : "全員アクティブ"
        }
      />
      <Card
        label="今月の活動"
        value={String(summary.updates30d)}
        sub="タスク更新数 (30日)"
        accent
      />
      <Card
        label="AI 利用"
        value={String(summary.aiMessages30d)}
        sub="メッセージ (30日)"
        accent
      />
      <Card
        label="今月の会議"
        value={String(summary.meetingsThisMonth)}
        sub={
          summary.pendingInvitations > 0
            ? `招待リンク残 ${summary.pendingInvitations}`
            : "—"
        }
      />
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  accent = false,
  badge,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  badge?: { text: string; color: string };
}) {
  return (
    <GlassCard className="p-4 relative">
      <div className="t-label mb-1">{label}</div>
      <div
        className="t-big"
        style={{
          fontSize: 22,
          color: accent ? "var(--c-accent-deep)" : "var(--ink)",
        }}
      >
        {value}
      </div>
      <div className="t-cap mt-1">{sub}</div>
      {badge && (
        <span
          className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ background: badge.color }}
        >
          ⚠ {badge.text}
        </span>
      )}
    </GlassCard>
  );
}
