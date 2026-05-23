import { GlassCard } from "@/components/ui/GlassCard";

/**
 * 情報量が多くスマホ表示に向かない画面 (WBS / 収支 / 資金調達 など) 用のラッパー。
 * - モバイル (<md): 「PCでご覧ください」案内を表示し、本体は描画しない
 * - デスクトップ (md以上): children (本体) をそのまま表示
 * CSS のブレークポイントだけで出し分けるため SSR でもチラつかない。
 */
export function DesktopOnly({
  tabLabel,
  children,
}: {
  tabLabel: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <GlassCard className="md:hidden p-8 grid place-items-center text-center">
        <div className="max-w-sm">
          <div className="text-5xl mb-3">🖥️</div>
          <h2 className="t-h2 mb-2">PCでご覧ください</h2>
          <p className="t-cap leading-relaxed">
            「{tabLabel}」は情報量が多いため、スマートフォンでは表示していません。
            パソコンの大きい画面でご利用ください。
          </p>
          <p className="t-cap mt-3 opacity-80">
            ダッシュボードなど他のページはスマホでもご覧いただけます。
          </p>
        </div>
      </GlassCard>
      <div className="hidden md:block">{children}</div>
    </>
  );
}
