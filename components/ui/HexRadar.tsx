interface HexRadarProps {
  data: { k: string; v: number }[]; // v: 0..max
  size?: number;
  max?: number;
}

export function HexRadar({ data, size = 260, max = 3 }: HexRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * 0.78;
  const n = data.length || 1;

  const point = (i: number, v: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (Math.max(0, Math.min(max, v)) / max) * radius;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
  };

  const levels = [1, 2, 3];
  return (
    <svg width={size} height={size} aria-hidden>
      {/* Level rings (hexagonal-ish polygon at each level) */}
      {levels.map((lv) => (
        <polygon
          key={lv}
          points={Array.from({ length: n })
            .map((_, i) => point(i, (lv / 3) * max).join(","))
            .join(" ")}
          fill="none"
          stroke="rgba(150,170,200,.25)"
          strokeWidth={1}
        />
      ))}
      {/* Axes */}
      {Array.from({ length: n }).map((_, i) => {
        const [x, y] = point(i, max);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="rgba(150,170,200,.18)"
            strokeWidth={1}
          />
        );
      })}
      {/* Current polygon */}
      <polygon
        points={data.map((d, i) => point(i, d.v).join(",")).join(" ")}
        fill="rgba(91,141,239,.12)"
        stroke="var(--c-accent)"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {/* Vertex dots */}
      {data.map((d, i) => {
        const [x, y] = point(i, d.v);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={3.5}
            fill="#0a0a0a"
            stroke="#fff"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}
