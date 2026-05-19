export default function ThemeDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div className="h-5 w-40 bg-mute/10 rounded animate-pulse" />
      <div
        className="rounded-2xl bg-white border border-line-soft animate-pulse"
        style={{ height: 280 }}
      />
      <div
        className="rounded-2xl bg-white border border-line-soft animate-pulse"
        style={{ height: 360 }}
      />
    </div>
  );
}
