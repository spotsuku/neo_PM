"use client";

interface BadgeMedalProps {
  name: string;
  desc?: string;
  earned: boolean;
  date?: string | null; // 獲得日 (YYYY/MM)
  progress?: number; // 0..1
  glyph?: GlyphName;
}

type GlyphName =
  | "users"
  | "mic"
  | "heart-pulse"
  | "link"
  | "yen"
  | "trophy"
  | "spark";

/** デザイン handoff (badge_handoff README の §5) のメダル風バッジを React に
 *  ベタ書きで再現したコンポーネント。Tailwind では表現できない多重 inset
 *  shadow は inline style で。 */
export function BadgeMedal({
  name,
  desc,
  earned,
  date,
  progress,
  glyph = "trophy",
}: BadgeMedalProps) {
  return (
    <div
      className="relative flex flex-col items-center text-center gap-2 px-3 pt-4 pb-3 rounded-[18px] border overflow-hidden transition-transform hover:-translate-y-0.5"
      style={
        earned
          ? {
              background:
                "linear-gradient(180deg, #fffaee 0%, #ffffff 75%)",
              borderColor: "#f1d99e",
            }
          : {
              background: "#f7f8fc",
              borderColor: "var(--line)",
              backgroundImage:
                "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 60%), repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(155,163,189,0.05) 8px, rgba(155,163,189,0.05) 16px)",
            }
      }
      title={desc}
    >
      {earned && (
        <>
          {/* gold corner fold */}
          <div
            className="absolute top-0 right-0 pointer-events-none"
            style={{
              width: 42,
              height: 42,
              background:
                "linear-gradient(225deg, #c99540 50%, transparent 50%)",
              opacity: 0.18,
            }}
            aria-hidden
          />
          {/* stamp */}
          <span
            className="absolute top-2 right-2 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider"
            style={{
              background: "rgba(255,255,255,0.85)",
              border: "1px solid #f1d99e",
              color: "#a26818",
            }}
          >
            ✓ 獲得
          </span>
        </>
      )}

      <Medal earned={earned} glyph={glyph} />

      <div
        className="text-[12px] font-extrabold leading-tight"
        style={{ color: earned ? "var(--ink)" : "var(--mute)" }}
      >
        {name}
      </div>
      {desc && (
        <div
          className="text-[10px] leading-snug px-1 line-clamp-2"
          style={{ color: earned ? "#7a5a2c" : "var(--mute)" }}
        >
          {desc}
        </div>
      )}

      {earned ? (
        date && (
          <div
            className="text-[10px] t-mono mt-auto"
            style={{ color: "#a26818" }}
          >
            {date} 達成
          </div>
        )
      ) : typeof progress === "number" ? (
        <>
          <div className="w-[70%] h-[3px] rounded-full bg-line-soft overflow-hidden mt-auto">
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                background: "linear-gradient(90deg, #cbd5e1, #94a3b8)",
              }}
            />
          </div>
          <div className="text-[10px] t-mono text-mute">
            {Math.round(progress * 100)}%
          </div>
        </>
      ) : null}
    </div>
  );
}

function Medal({ earned, glyph }: { earned: boolean; glyph: GlyphName }) {
  return (
    <div
      className="relative grid place-items-center w-16 h-16 rounded-full"
      style={
        earned
          ? {
              background:
                "radial-gradient(circle at 32% 26%, #fff1c0 0%, #f5cb6b 38%, #c08732 82%)",
              boxShadow:
                "inset 0 0 0 1.5px #8a5a1c, inset 0 2px 3px rgba(255,255,255,.6), inset 0 -3px 6px rgba(0,0,0,.18), 0 6px 14px rgba(15,23,42,.10)",
            }
          : {
              background:
                "linear-gradient(180deg, #f0f3fa 0%, #d8dde8 100%)",
              boxShadow:
                "inset 0 0 0 1.5px #c1cad9, inset 0 2px 3px rgba(255,255,255,.6), inset 0 -2px 4px rgba(15,23,42,.06)",
            }
      }
    >
      {/* highlight */}
      <span
        className="absolute pointer-events-none"
        style={{
          top: 5,
          left: 12,
          width: 22,
          height: 10,
          background:
            "linear-gradient(180deg, rgba(255,255,255,.75), rgba(255,255,255,0))",
          borderRadius: "50%",
          transform: "rotate(-20deg)",
          filter: "blur(0.5px)",
          opacity: earned ? 1 : 0.4,
        }}
        aria-hidden
      />
      <Glyph
        name={glyph}
        color={earned ? "#6b3f10" : "#9aa3bd"}
      />
    </div>
  );
}

function Glyph({ name, color }: { name: GlyphName; color: string }) {
  const common = {
    width: 30,
    height: 30,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { filter: "drop-shadow(0 1px 0 rgba(255,255,255,.55))" },
  };
  switch (name) {
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M2.8 19c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6" />
          <circle cx="17" cy="6.5" r="2.4" />
          <path d="M14.6 13.4c.7-.3 1.6-.5 2.4-.5 2.9 0 5.2 2.2 5.2 5" />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="8.5" y1="22" x2="15.5" y2="22" />
        </svg>
      );
    case "heart-pulse":
      return (
        <svg {...common}>
          <path d="M20.5 8.6c0 6.4-8.5 11-8.5 11S3.5 15 3.5 8.6a4 4 0 0 1 7.5-2 4 4 0 0 1 9.5 2z" />
          <path d="M3.8 11.2h2.7l1.9-2.7 2.4 5.8 1.9-3.4h7.5" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M9.5 13.5a4.5 4.5 0 0 0 6.4 0l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
          <path d="M14.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.6 2.6a4.5 4.5 0 0 0 6.4 6.4l1-1" />
        </svg>
      );
    case "yen":
      return (
        <svg {...common}>
          <path d="M7 5l5 7 5-7" />
          <line x1="6" y1="13.5" x2="18" y2="13.5" />
          <line x1="6" y1="16.8" x2="18" y2="16.8" />
          <line x1="12" y1="12" x2="12" y2="20" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="M3 12h18" />
          <path d="M5.6 5.6l12.8 12.8" />
          <path d="M18.4 5.6L5.6 18.4" />
        </svg>
      );
    case "trophy":
    default:
      return (
        <svg {...common}>
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
          <path d="M5 4H3a2 2 0 0 0 0 4h2" />
          <path d="M19 4h2a2 2 0 0 1 0 4h-2" />
          <path d="M9 14h6v3H9z" />
          <path d="M8 17h8v3H8z" />
        </svg>
      );
  }
}

/** バッジ名からアイコンを推定 (handoff の表 §5 を踏襲) */
export function glyphFromBadgeName(name: string): GlyphName {
  if (name.includes("チーム") || name.includes("結成")) return "users";
  if (name.includes("MTG") || name.includes("初回")) return "mic";
  if (name.includes("現場") || name.includes("実践")) return "heart-pulse";
  if (name.includes("パートナー") || name.includes("提携")) return "link";
  if (name.includes("売上") || name.includes("受注") || name.includes("収益"))
    return "yen";
  return "trophy";
}
