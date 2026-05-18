import { GlassCard } from "@/components/ui/GlassCard";
import { RingV2 } from "@/components/ui/RingV2";

export interface MetricRingProps {
  value: number; // 0-100
  label: string;
  sub?: string;
  chip?: string;
  color?: string;
  /** タグ data-c-fun を付与（祝祭演出のオン/オフ用） */
  fun?: boolean;
}

export function MetricRing({
  value,
  label,
  sub,
  chip,
  color,
  fun = false,
}: MetricRingProps) {
  return (
    <GlassCard
      className="p-4 flex items-center gap-3"
      {...(fun ? { "data-c-fun": "playful" } : {})}
    >
      <RingV2 size={66} stroke={7} value={value} color={color} />
      <div className="flex-1 min-w-0">
        <div className="t-label">{label}</div>
        <div className="text-[15px] font-bold mt-0.5 truncate">
          {sub ?? `${Math.round(value)}%`}
        </div>
        {chip && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-[--c-accent-deep]">
            {chip}
          </span>
        )}
      </div>
    </GlassCard>
  );
}
