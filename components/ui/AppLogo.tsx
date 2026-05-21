/**
 * AI PM のサービスロゴ。
 *
 * - 元画像は public/logo.png (1:1 正方形)
 * - app/icon.png は同じ画像でファビコンとして配信
 * - サイズはコンテナ側で className の w/h を指定する
 */
export function AppLogo({
  className,
  ariaLabel = "AI PM",
}: {
  className?: string;
  ariaLabel?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt={ariaLabel}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
