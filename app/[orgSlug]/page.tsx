import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { GlassCard } from "@/components/ui/GlassCard";
import { RingV2 } from "@/components/ui/RingV2";
import { StatusDot } from "@/components/ui/StatusDot";

export default async function RankingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();
  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) {
    return <div className="p-8 text-error">組織が見つかりません</div>;
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("organization_id", org.id)
    .order("progress_pct", { ascending: false });

  const all = projects ?? [];
  const active = all.filter((p) => p.status === "active");
  const others = all.filter((p) => p.status !== "active");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4 lg:gap-5">
      {/* 左カラム: ランキング + ライブラリ */}
      <div className="flex flex-col gap-4 lg:gap-5">
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="t-h2">🏆 プロジェクト進捗ランキング</h2>
              <p className="t-cap">{org.name}</p>
            </div>
            <Link
              href={`/${orgSlug}/projects/new`}
              className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90"
            >
              ＋ 新規プロジェクト
            </Link>
          </div>

          {active.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <div className="text-4xl mb-3">🌱</div>
              <h3 className="t-h3 mb-1">最初のプロジェクトを始めましょう</h3>
              <p className="t-cap mb-5">
                テーマに応募して、若者主導でプロジェクトを立ち上げます。
              </p>
              <Link
                href={`/${orgSlug}/projects/new`}
                className="inline-block rounded-full bg-ink px-5 py-2 text-[12px] font-semibold text-white"
              >
                プロジェクトを作成
              </Link>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {active.map((p, i) => (
                <GlassCard
                  key={p.id}
                  className="p-4 lift cursor-default"
                >
                  <div className="flex items-center gap-4">
                    <RingV2 size={56} value={p.progress_pct} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {i < 3 && (
                          <span className="t-label" aria-hidden>
                            {["🥇", "🥈", "🥉"][i]}
                          </span>
                        )}
                        <h3 className="text-[13px] font-bold truncate">
                          {p.team_name ?? p.name}
                        </h3>
                      </div>
                      <p className="t-cap truncate mb-1">{p.idea_title ?? p.name}</p>
                      <div className="flex items-center gap-3 text-[10px] text-mute">
                        {p.streak_days > 0 && (
                          <span>🔥 {p.streak_days}日連続</span>
                        )}
                        <span>進捗 {p.progress_pct}%</span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </section>

        {others.length > 0 && (
          <section>
            <h3 className="t-label mb-2">プロジェクトライブラリ（{others.length}）</h3>
            <GlassCard className="p-3">
              <ul className="divide-y divide-line-soft">
                {others.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <StatusDot status={p.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium truncate">{p.name}</div>
                      <div className="t-cap truncate">{p.idea_title ?? ""}</div>
                    </div>
                    <span className="t-label">{p.status}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </section>
        )}
      </div>

      {/* 右カラム: テーマ出題の基準 + 今週のクエスト */}
      <aside className="flex flex-col gap-4 lg:gap-5">
        <GlassCard className="p-5">
          <h3 className="t-h3 mb-3">📋 テーマ出題のポイント</h3>
          <ul className="space-y-2 text-[12px] text-mute leading-relaxed">
            <li>① 地域のためのテーマであること</li>
            <li>② 既存サービスは「手段」であって「目的」ではない</li>
            <li>③ 若者が "当事者" として関われる余地があること</li>
          </ul>
        </GlassCard>
        <GlassCard variant="dark" className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold">🎯 今週のクエスト</h3>
            <span className="t-label opacity-70">残り 3日</span>
          </div>
          <div className="space-y-2.5 text-[12px] opacity-90">
            <div className="flex items-center gap-2">
              <span aria-hidden>○</span> 実行計画の Why を磨き直す
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden>○</span> WBS から完了タスクを 3 件
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden>○</span> 診断レポートを記入
            </div>
          </div>
        </GlassCard>
      </aside>
    </div>
  );
}
