import { GlassCard } from "@/components/ui/GlassCard";

export function StubScreen({
  title,
  emoji,
  description,
}: {
  title: string;
  emoji: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="t-h2">
          <span aria-hidden className="mr-2">
            {emoji}
          </span>
          {title}
        </h1>
        <p className="t-cap mt-1">{description}</p>
      </header>
      <GlassCard className="p-10 text-center">
        <div className="text-4xl mb-4">🚧</div>
        <h2 className="t-h3 mb-1">この画面はもうすぐ来ます</h2>
        <p className="t-cap">
          handoff 仕様に沿って実装中です。次のステップで実装します。
        </p>
      </GlassCard>
    </div>
  );
}
