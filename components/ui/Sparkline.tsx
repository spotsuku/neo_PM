interface SparklineProps {
  arr: number[];
  w?: number;
  h?: number;
  max?: number;
}

export function Sparkline({ arr, w = 60, h = 18, max = 3 }: SparklineProps) {
  if (arr.length < 2) return <svg width={w} height={h} />;
  const pts = arr
    .map((v, i) => `${(i / (arr.length - 1)) * w},${h - (v / max) * h}`)
    .join(" ");
  const last = arr[arr.length - 1];
  return (
    <svg width={w} height={h} aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--c-accent)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle
        cx={w}
        cy={h - (last / max) * h}
        r={2}
        fill="var(--c-accent)"
      />
    </svg>
  );
}
