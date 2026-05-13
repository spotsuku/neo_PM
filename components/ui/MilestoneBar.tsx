export interface MilestoneBarItem {
  id: string;
  label: string;
  date: string | null;
  done: boolean;
}

interface Props {
  items: MilestoneBarItem[];
}

export function MilestoneBar({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="t-cap py-4 text-center">
        マイルストーンが未設定です
      </p>
    );
  }

  // 進行中 = 最初の未完了
  const firstPendingIdx = items.findIndex((m) => !m.done);
  const completedCount = items.filter((m) => m.done).length;
  const progressPct = Math.min(
    100,
    Math.max(0, (completedCount / Math.max(items.length - 1, 1)) * 100),
  );

  return (
    <div className="relative pt-3 pb-1">
      {/* base track */}
      <div className="absolute left-3 right-3 top-[28px] h-[3px] rounded-full bg-line-soft" />
      {/* progress fill */}
      <div
        className="absolute left-3 top-[28px] h-[3px] rounded-full"
        style={{
          width: `calc((100% - 24px) * ${progressPct / 100})`,
          background:
            "linear-gradient(90deg, var(--ink), var(--c-accent))",
        }}
      />
      <div className="relative flex items-start justify-between gap-2">
        {items.map((m, i) => {
          const isDone = m.done;
          const isCurrent = i === firstPendingIdx;
          return (
            <div
              key={m.id}
              className="flex-1 min-w-0 flex flex-col items-center"
            >
              <div
                className="relative grid place-items-center rounded-full"
                style={{
                  width: isCurrent ? 22 : 14,
                  height: isCurrent ? 22 : 14,
                  background: isDone
                    ? "var(--ink)"
                    : isCurrent
                      ? "var(--c-accent)"
                      : "var(--canvas)",
                  border: isCurrent
                    ? "3px solid var(--c-accent-soft)"
                    : isDone
                      ? "2px solid var(--ink)"
                      : "2px solid var(--line)",
                  boxShadow: isCurrent
                    ? "0 0 0 4px rgba(91,141,239,.18)"
                    : "none",
                  marginTop: isCurrent ? 0 : 4,
                }}
              >
                {isDone && (
                  <span
                    aria-hidden
                    className="text-white text-[8px] font-bold"
                  >
                    ✓
                  </span>
                )}
              </div>
              <div className="mt-2 text-center">
                <div
                  className={
                    "text-[10.5px] leading-tight truncate max-w-[88px] " +
                    (isCurrent ? "font-bold" : "font-medium text-mute")
                  }
                >
                  {m.label}
                </div>
                {m.date && (
                  <div className="t-mono opacity-70">
                    {m.date.slice(5).replace("-", "/")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
