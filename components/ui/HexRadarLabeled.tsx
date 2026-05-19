interface Vertex {
  label: string;
  value: number; // 0..max
  emo?: string;
}

interface Props {
  data: Vertex[];
  size?: number;
  max?: number;
}

/** ラベル付きの六角形 (n 角形) レーダーチャート。
 *  各頂点に絵文字 + ラベル + 値を出す。
 *  ラベルが画面外に切れないよう、viewBox にパディングを追加し、
 *  頂点の x 位置に応じて text-anchor を変える。 */
export function HexRadarLabeled({ data, size = 320, max = 100 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * 0.6;
  const labelRadius = (size / 2) * 0.88;
  const n = data.length || 1;
  // ラベル用パディング (上下左右に余白を確保)
  const padX = 64;
  const padY = 36;

  const point = (i: number, v: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (Math.max(0, Math.min(max, v)) / max) * radius;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
  };
  const labelPoint = (i: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [
      cx + Math.cos(angle) * labelRadius,
      cy + Math.sin(angle) * labelRadius,
    ] as const;
  };

  // 頂点の x が中心より左 → text-anchor:end、右 → start、ほぼ中央 → middle
  const anchorFor = (x: number): "start" | "middle" | "end" => {
    const dx = x - cx;
    if (dx < -8) return "end";
    if (dx > 8) return "start";
    return "middle";
  };

  const levels = [1, 2, 3];

  return (
    <svg
      width={size + padX * 2}
      height={size + padY * 2}
      viewBox={`${-padX} ${-padY} ${size + padX * 2} ${size + padY * 2}`}
      style={{ overflow: "visible" }}
      role="img"
      aria-label="6 次元レーダーチャート"
    >
      {/* レベルリング */}
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
      {/* 軸 */}
      {Array.from({ length: n }).map((_, i) => {
        const [x, y] = point(i, max);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="rgba(150,170,200,.2)"
            strokeWidth={1}
          />
        );
      })}
      {/* 現在の多角形 */}
      <polygon
        points={data.map((d, i) => point(i, d.value).join(",")).join(" ")}
        fill="rgba(91,141,239,.18)"
        stroke="var(--c-accent)"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {/* 頂点ドット */}
      {data.map((d, i) => {
        const [x, y] = point(i, d.value);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={4}
            fill="#0a0a0a"
            stroke="#fff"
            strokeWidth={2}
          />
        );
      })}
      {/* 頂点ラベル */}
      {data.map((d, i) => {
        const [x, y] = labelPoint(i);
        const anchor = anchorFor(x);
        // y が中心より上の場合は label を上に、下なら下に少しズラす
        const isAbove = y < cy - 8;
        return (
          <g key={`l-${i}`}>
            <text
              x={x}
              y={isAbove ? y - 6 : y - 4}
              textAnchor={anchor}
              fontSize="13"
              fontWeight="bold"
              fill="var(--ink)"
            >
              {d.emo ? `${d.emo} ` : ""}
              {d.label}
            </text>
            <text
              x={x}
              y={isAbove ? y + 10 : y + 12}
              textAnchor={anchor}
              fontSize="11"
              fontWeight="700"
              fill="var(--c-accent-deep)"
            >
              {Math.round(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
