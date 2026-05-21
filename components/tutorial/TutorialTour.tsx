"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { buildTutorialSteps, type TutorialStep } from "@/lib/tutorialSteps";
import { AppLogo } from "@/components/ui/AppLogo";

interface Props {
  orgSlug: string | null;
  firstProjectId: string | null;
  /** 初回ログインで自動オープンするか */
  autoOpen: boolean;
  /** ヘルプボタン経由で開いた時など、強制 open */
  forceOpen?: boolean;
  onClose?: () => void;
}

export function TutorialTour({
  orgSlug,
  firstProjectId,
  autoOpen,
  forceOpen,
  onClose,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const steps: TutorialStep[] = buildTutorialSteps({
    orgSlug,
    firstProjectId,
  });

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
    }
  }, [forceOpen]);

  const close = async () => {
    setOpen(false);
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ tutorial_completed_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    setSaving(false);
    onClose?.();
    router.refresh();
  };

  if (!open) return null;

  const current = steps[step];
  if (!current) return null;
  const isLast = step === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI PM ツアー"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.55)" }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-7 md:p-8 shadow-2xl animate-risein">
        {/* ヘッダ: ロゴ + 進捗 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AppLogo className="h-9 w-9" />
            <span className="t-cap font-semibold opacity-80">AI PM ツアー</span>
          </div>
          <div className="t-cap t-mono opacity-70">
            {step + 1} / {steps.length}
          </div>
        </div>

        {/* ステップ本体 */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3" aria-hidden>
            {current.emoji}
          </div>
          <h2 className="text-[20px] md:text-[22px] font-extrabold mb-3">
            {current.title}
          </h2>
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-2">
            {current.body}
          </p>
        </div>

        {/* 推奨アクション CTA */}
        {current.cta && (
          <button
            type="button"
            onClick={async () => {
              await close();
              router.push(current.cta!.href);
            }}
            className="block w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:opacity-90 mb-3"
          >
            {current.cta.label}
          </button>
        )}

        {/* プログレスバー */}
        <div className="h-1 rounded-full bg-line-soft overflow-hidden mb-4">
          <div
            className="h-full rounded-full bg-[--c-accent] transition-all"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* フッタ: スキップ / 戻る / 次へ */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="t-cap underline text-mute hover:text-ink disabled:opacity-50"
          >
            スキップ
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="rounded-md border border-line bg-white px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40"
            >
              ← 戻る
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="rounded-md bg-ink px-4 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "..." : "✓ 完了"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                className="rounded-md bg-ink px-4 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
              >
                次へ →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
