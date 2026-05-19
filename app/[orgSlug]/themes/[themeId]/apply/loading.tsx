export default function ApplyLoading() {
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div className="h-5 w-40 bg-mute/10 rounded animate-pulse" />
      <div className="h-8 w-3/4 bg-mute/10 rounded animate-pulse" />
      <div
        className="rounded-2xl bg-white border border-line-soft animate-pulse"
        style={{ height: 480 }}
      />
    </div>
  );
}
