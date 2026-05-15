export default function OrgLoading() {
  return (
    <div className="px-6 py-6 md:px-7 md:py-7 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-4 lg:gap-5">
        {/* ヘッダーカード */}
        <div
          className="glass animate-pulse rounded-2xl p-5"
          style={{ height: 76 }}
        />
        {/* 本体カード×3 */}
        <div
          className="glass animate-pulse rounded-2xl p-5"
          style={{ height: 220 }}
        />
        <div
          className="glass animate-pulse rounded-2xl p-5"
          style={{ height: 360 }}
        />
      </div>
    </div>
  );
}
