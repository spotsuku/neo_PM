"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

interface Props {
  orgId: string;
  orgSlug: string;
}

/** ヘッダー右に出すコンペ機能の追加導線。
 *  - 有料アドオン扱いとして UI を整える
 *  - 現在はプレビュー版として 1 クリックで有効化できる
 *    (将来 Stripe などの決済を挟む拡張ポイントを残しておく) */
export function CompetitionUpgradeChip({ orgId, orgSlug }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const enable = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("organizations")
      .update({ competition_enabled: true })
      .eq("id", orgId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOpen(false);
    router.refresh();
    void orgSlug;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(91,141,239,.35)] hover:opacity-90 transition"
        style={{
          background:
            "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
        }}
        title="テーマ出題・応募 (コンペ) 機能を組織に追加"
      >
        <span aria-hidden>🎯</span>
        <span>コンペ機能を追加</span>
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] grid place-items-center px-4 py-6 overflow-y-auto"
          onClick={() => setOpen(false)}
          style={{ background: "rgba(15,23,42,0.55)" }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white border border-line-soft shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-3">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="grid h-14 w-14 place-items-center rounded-2xl text-white text-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                  }}
                >
                  🎯
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-[--c-accent-deep] mb-0.5">
                    有料アドオン
                  </div>
                  <h3 className="text-[18px] font-extrabold tracking-tight">
                    コンペティション機能
                  </h3>
                  <p className="t-cap mt-0.5">
                    テーマ出題 → 応募 → 採択 → プロジェクト組成 の流れを組織内で完結
                  </p>
                </div>
              </div>

              <ul className="rounded-xl bg-canvas-2/40 p-3 flex flex-col gap-1.5 text-[12.5px] leading-relaxed">
                <li>📣 <strong>テーマ出題</strong>: 課題を構造化して募集</li>
                <li>📨 <strong>応募管理</strong>: 提案概要 / Why / Who / What / How / 実証 / 収支</li>
                <li>🎉 <strong>採択 → 自動でプロジェクト組成</strong>: 応募内容が実行計画に転記</li>
                <li>🏆 <strong>ホストの可視性</strong>: 募集 → 採択までの動きが可視化</li>
              </ul>

              <div className="rounded-xl border border-line bg-white mt-3 p-3">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="t-label">スタンダードプラン</span>
                  <span className="text-[10px] font-bold text-[--c-accent-deep] rounded-full bg-accent-soft px-2 py-0.5">
                    プレビュー期間は無料
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[24px] font-extrabold tracking-tight">
                    ¥30,000
                  </span>
                  <span className="t-cap">/ 月 (税抜)</span>
                </div>
                <p className="t-cap mt-1.5 leading-relaxed">
                  プレビュー期間中は無料で有効化できます。正式リリース後に
                  自動で課金へ移行することはなく、有料化前に必ず確認のご連絡をいたします。
                </p>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700 mt-3">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-line-soft">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-white border border-line px-4 py-2 text-[12.5px] font-medium text-mute"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={enable}
                disabled={busy}
                className="rounded-lg bg-ink px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "有効化中…" : "✦ 無料で有効化する"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
