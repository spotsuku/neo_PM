/**
 * AI PM のサービスロゴ (SVG)。
 *
 * - ファビコン (app/icon.svg) と視覚的に同一。
 * - サイズはコンテナ側で width/height を指定する。
 */
export function AppLogo({
  className,
  ariaLabel = "AI PM",
}: {
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <defs>
        <linearGradient id="aipmg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0F8BFF" />
          <stop offset="50%" stopColor="#16B8E0" />
          <stop offset="100%" stopColor="#00DDD0" />
        </linearGradient>
      </defs>
      <rect
        x="8"
        y="8"
        width="240"
        height="240"
        rx="40"
        ry="40"
        fill="white"
        stroke="url(#aipmg)"
        strokeWidth="4"
      />
      <path
        d="M 70 198 A 78 78 0 1 1 186 198"
        fill="none"
        stroke="url(#aipmg)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <text
        x="128"
        y="160"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
        fontSize="76"
        fontWeight="700"
        letterSpacing="-2"
        fill="url(#aipmg)"
      >
        AI
      </text>
      <text
        x="178"
        y="218"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
        fontSize="32"
        fontWeight="700"
        fill="url(#aipmg)"
      >
        PM
      </text>
    </svg>
  );
}
