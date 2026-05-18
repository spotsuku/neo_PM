interface RingV2Props {
  size?: number;
  stroke?: number;
  value: number; // 0-100
  color?: string;
  track?: string;
  label?: string;
  showValue?: boolean;
}

export function RingV2({
  size = 72,
  stroke = 7,
  value,
  color = "var(--c-accent)",
  track = "rgba(150,170,200,.18)",
  label,
  showValue = true,
}: RingV2Props) {
  const safeValue = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashoffset = c * (1 - safeValue / 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashoffset}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="t-big"
            style={{ fontSize: size / 4 }}
          >
            {Math.round(safeValue)}
          </div>
          {label && (
            <div className="t-cap" style={{ fontSize: Math.max(size / 9, 8) }}>
              {label}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
