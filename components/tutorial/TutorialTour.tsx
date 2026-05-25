"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { buildTutorialSteps, type TutorialStep } from "@/lib/tutorialSteps";
import { AppLogo } from "@/components/ui/AppLogo";

interface Props {
  orgSlug: string | null;
  /** 見本 (is_demo) プロジェクトの ID。最終ステップの CTA で開く対象。 */
  demoProjectId: string | null;
  autoOpen: boolean;
  forceOpen?: boolean;
  onClose?: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_PADDING = 8;

export function TutorialTour({
  orgSlug,
  demoProjectId,
  autoOpen,
  forceOpen,
  onClose,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
    }
  }, [forceOpen]);

  const steps: TutorialStep[] = buildTutorialSteps({
    orgSlug,
    demoProjectId,
  });
  const current = steps[step];

  // ターゲット要素の位置を計算してスポットライトを当てる
  useLayoutEffect(() => {
    if (!open || !current?.target) {
      setTargetRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(
        `[data-tour="${current.target}"]`,
      ) as HTMLElement | null;
      if (!el) {
        setTargetRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      // モバイルで hidden になっているデスクトップ用サイドバー等、
      // 非表示 (サイズ 0) のターゲットは「ターゲット無し」扱いにして
      // 中央モーダルにフォールバックする (左上隅に極小スポットが当たるのを防ぐ)。
      if (r.width === 0 && r.height === 0) {
        setTargetRect(null);
        return;
      }
      setTargetRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, current?.target]);

  const markCompleted = async () => {
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
  };

  const close = async () => {
    setOpen(false);
    setSaving(true);
    await markCompleted();
    setSaving(false);
    onClose?.();
    router.refresh();
  };

  // CTA で別ページへ遷移する場合は、完了フラグの書き込みでナビゲーションを
  // ブロックしない (fire-and-forget)。離脱するページの router.refresh() も
  // 行わない (遷移を遅らせるだけで無駄なため)。
  const openVia = (href: string) => {
    setOpen(false);
    void markCompleted();
    onClose?.();
    router.push(href);
  };

  if (!open || !mounted || !current) return null;

  const isLast = step === steps.length - 1;

  // ツールチップ位置の計算
  const tooltipStyle = computeTooltipStyle(targetRect, current.placement);

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI PM ツアー"
      className="fixed inset-0 z-[200]"
    >
      {/* スポットライト付き暗幕 (SVG mask で穴を開ける) */}
      <SpotlightMask rect={targetRect} />

      {/* スポットライト周りの青いハイライト枠 */}
      {targetRect && (
        <div
          className="fixed pointer-events-none animate-pulse"
          style={{
            top: targetRect.top - SPOTLIGHT_PADDING,
            left: targetRect.left - SPOTLIGHT_PADDING,
            width: targetRect.width + SPOTLIGHT_PADDING * 2,
            height: targetRect.height + SPOTLIGHT_PADDING * 2,
            border: "3px solid #38bdf8",
            borderRadius: 14,
            boxShadow:
              "0 0 0 4px rgba(56, 189, 248, 0.25), 0 0 32px rgba(56, 189, 248, 0.55)",
            transition: "all 0.35s cubic-bezier(.16,1,.3,1)",
          }}
          aria-hidden
        />
      )}

      {/* ツールチップ / モーダルカード */}
      <div
        className="fixed w-[min(440px,calc(100vw-32px))] animate-risein"
        style={{
          ...tooltipStyle,
          transition: "all 0.35s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <div
          className="rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background:
              "linear-gradient(145deg, #ffffff 0%, #f3f8ff 60%, #e6f0ff 100%)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
          }}
        >
          {/* 装飾的なグラデバー */}
          <div
            className="h-1.5 w-full"
            style={{
              background:
                "linear-gradient(90deg, #0F8BFF 0%, #16B8E0 50%, #00DDD0 100%)",
            }}
          />

          <div className="p-6 md:p-7">
            {/* ヘッダ */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AppLogo className="h-9 w-9" />
                <span className="text-[12px] font-bold tracking-wide text-[--c-accent-deep]">
                  AI PM ツアー
                </span>
              </div>
              <div className="t-mono text-[11px] font-semibold opacity-70 px-2 py-0.5 rounded-full bg-white">
                {step + 1} / {steps.length}
              </div>
            </div>

            {/* メイン */}
            <div className="mb-5">
              <div
                className="text-4xl mb-2 leading-none"
                aria-hidden
                style={{
                  filter: "drop-shadow(0 4px 10px rgba(15,139,255,0.25))",
                }}
              >
                {current.emoji}
              </div>
              <h2 className="text-[19px] md:text-[21px] font-extrabold mb-2 leading-tight">
                {current.title}
              </h2>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">
                {current.body}
              </p>
            </div>

            {/* CTA */}
            {current.cta && (
              <button
                type="button"
                onClick={() => openVia(current.cta!.href)}
                className="block w-full rounded-lg px-4 py-3 text-sm font-bold text-white hover:opacity-90 mb-4 shadow-lg"
                style={{
                  background:
                    "linear-gradient(135deg, #0F8BFF 0%, #16B8E0 60%, #00DDD0 100%)",
                  boxShadow: "0 8px 24px -6px rgba(15,139,255,.45)",
                }}
              >
                {current.cta.label}
              </button>
            )}

            {/* プログレスドット */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(i)}
                  className="transition-all"
                  style={{
                    width: i === step ? 24 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i === step ? "#0F8BFF" : "rgba(15,139,255,0.25)",
                  }}
                  aria-label={`ステップ ${i + 1}`}
                />
              ))}
            </div>

            {/* フッタ: スキップ / 戻る / 次へ */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="text-[11.5px] underline text-mute hover:text-ink disabled:opacity-50"
              >
                スキップ
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="rounded-md border border-line bg-white px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40 hover:bg-mute/5"
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
                    className="rounded-md px-4 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90"
                    style={{
                      background:
                        "linear-gradient(135deg, #0F8BFF 0%, #16B8E0 100%)",
                    }}
                  >
                    次へ →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/** SVG mask で「ターゲット周辺だけ透明、他は半透明黒」の暗幕を作る。 */
function SpotlightMask({ rect }: { rect: Rect | null }) {
  if (!rect) {
    // ターゲット無し: 単純な半透明黒
    return (
      <div
        className="fixed inset-0"
        style={{ background: "rgba(8, 14, 32, 0.65)" }}
        aria-hidden
      />
    );
  }

  const pad = SPOTLIGHT_PADDING;
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none"
      aria-hidden
      style={{ width: "100vw", height: "100vh" }}
    >
      <defs>
        <mask id="tour-spotlight-mask">
          {/* 全面白 = 表示、黒 = 透過 */}
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={rect.left - pad}
            y={rect.top - pad}
            width={rect.width + pad * 2}
            height={rect.height + pad * 2}
            rx="14"
            ry="14"
            fill="black"
          />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(8, 14, 32, 0.68)"
        mask="url(#tour-spotlight-mask)"
      />
    </svg>
  );
}

/** ターゲットの位置からツールチップ表示位置を計算 */
function computeTooltipStyle(
  rect: Rect | null,
  placement?: TutorialStep["placement"],
): React.CSSProperties {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 720;
  const card = { w: Math.min(440, vw - 32), h: 360 };

  // center もしくは ターゲット無し → 画面中央
  if (!rect || placement === "center") {
    return {
      top: vh / 2 - card.h / 2,
      left: vw / 2 - card.w / 2,
    };
  }

  const margin = 24;
  const place = placement && placement !== "auto" ? placement : "auto";

  // auto: ターゲットの右側 → 下 → 上 → 左 の順で空きを探す
  const tryPlacements: NonNullable<TutorialStep["placement"]>[] =
    place === "auto"
      ? ["right", "bottom", "top", "left"]
      : [place];

  for (const p of tryPlacements) {
    if (p === "right") {
      const left = rect.left + rect.width + margin;
      if (left + card.w < vw - 8) {
        return {
          top: clamp(rect.top + rect.height / 2 - card.h / 2, 16, vh - card.h - 16),
          left,
        };
      }
    } else if (p === "left") {
      const left = rect.left - card.w - margin;
      if (left > 8) {
        return {
          top: clamp(rect.top + rect.height / 2 - card.h / 2, 16, vh - card.h - 16),
          left,
        };
      }
    } else if (p === "bottom") {
      const top = rect.top + rect.height + margin;
      if (top + card.h < vh - 8) {
        return {
          left: clamp(
            rect.left + rect.width / 2 - card.w / 2,
            16,
            vw - card.w - 16,
          ),
          top,
        };
      }
    } else if (p === "top") {
      const top = rect.top - card.h - margin;
      if (top > 8) {
        return {
          left: clamp(
            rect.left + rect.width / 2 - card.w / 2,
            16,
            vw - card.w - 16,
          ),
          top,
        };
      }
    }
  }

  // どこにも収まらなければ画面中央
  return {
    top: vh / 2 - card.h / 2,
    left: vw / 2 - card.w / 2,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
