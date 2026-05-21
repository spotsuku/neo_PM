"use client";

import { useState } from "react";

import { TutorialTour } from "./TutorialTour";

interface Props {
  orgSlug: string;
  /** 見本 (is_demo) プロジェクトの ID。最終ステップの CTA で開く対象。 */
  demoProjectId: string | null;
  /** profiles.tutorial_completed_at が NULL なら初回ログインと見なし自動オープン */
  autoOpen: boolean;
}

/**
 * ツアー本体 + ヘルプボタン (?ガイド) を 1 つにまとめた client wrapper。
 * - 初回サインインで自動オープン
 * - ヘルプボタンでいつでも再オープン
 */
export function TutorialHost({ orgSlug, demoProjectId, autoOpen }: Props) {
  const [openCount, setOpenCount] = useState(autoOpen ? 1 : 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenCount((c) => c + 1)}
        className="fixed bottom-4 right-[88px] z-30 grid place-items-center h-10 px-3 rounded-full bg-white border border-line shadow-[0_4px_16px_-6px_rgba(20,30,80,.25)] text-[12px] font-semibold text-ink hover:bg-mute/5"
        title="使い方ガイドを表示"
        aria-label="使い方ガイドを表示"
      >
        ❔ ガイド
      </button>
      <TutorialTour
        key={openCount}
        orgSlug={orgSlug}
        demoProjectId={demoProjectId}
        autoOpen={openCount > 0}
        forceOpen={openCount > 1}
      />
    </>
  );
}
