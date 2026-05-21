export function FreeTierBanner() {
  return (
    <div
      className="sticky top-[74px] z-20 px-6 py-2 text-[12px] flex items-center gap-3 flex-wrap border-b border-[var(--c-accent-bright)]"
      style={{
        background:
          "linear-gradient(135deg, var(--c-accent-soft), var(--c-accent-bright))",
        color: "var(--ink)",
        backdropFilter: "blur(8px)",
      }}
    >
      <span className="rounded-full bg-[var(--c-accent)] px-3 py-1 text-[11px] font-semibold text-white whitespace-nowrap">
        無料公開中
      </span>
      <strong>このサービスは無料公開中です。</strong>
      <span className="opacity-70">
        有料化する場合は1ヶ月前に告知いたします。
      </span>
    </div>
  );
}
