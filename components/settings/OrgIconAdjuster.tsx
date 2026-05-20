"use client";

import { useEffect, useRef, useState } from "react";

import { orgIconImgStyle } from "@/lib/orgIconStyle";

interface Props {
  iconUrl: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  onChange: (next: { zoom: number; offsetX: number; offsetY: number }) => void;
  /** 値が確定 (mouseup / change) したタイミング。DB 永続化はここで。 */
  onCommit?: (next: {
    zoom: number;
    offsetX: number;
    offsetY: number;
  }) => void;
}

const CLAMP = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** 円形プレビューを大きく表示し、ドラッグで位置調整 + スライダーで拡縮。 */
export function OrgIconAdjuster({
  iconUrl,
  zoom,
  offsetX,
  offsetY,
  onChange,
  onCommit,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // ドラッグ開始時のスナップショット
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOX: number;
    startOY: number;
    sizePx: number;
  } | null>(null);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      // 1px の移動 = (1 / sizePx) * 100% in container coords
      const dxPct = ((e.clientX - d.startX) / d.sizePx) * 100;
      const dyPct = ((e.clientY - d.startY) / d.sizePx) * 100;
      const nx = CLAMP(d.startOX + dxPct, -50, 50);
      const ny = CLAMP(d.startOY + dyPct, -50, 50);
      onChange({ zoom, offsetX: nx, offsetY: ny });
    };
    const onUp = () => {
      setDragging(false);
      dragRef.current = null;
      onCommit?.({ zoom, offsetX, offsetY });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, zoom, offsetX, offsetY, onChange, onCommit]);

  const startDrag = (e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOX: offsetX,
      startOY: offsetY,
      sizePx: rect.width,
    };
    setDragging(true);
  };

  return (
    <div>
      <div className="flex items-start gap-4 flex-wrap">
        {/* 円形プレビュー (大) — ドラッグで位置調整 */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            ref={ref}
            onPointerDown={startDrag}
            className={
              "w-40 h-40 rounded-full overflow-hidden bg-mute/10 border border-line shadow-inner relative " +
              (dragging ? "cursor-grabbing" : "cursor-grab")
            }
            title="ドラッグで位置調整"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={iconUrl}
              alt=""
              draggable={false}
              style={orgIconImgStyle({ iconUrl, zoom, offsetX, offsetY })}
            />
          </div>
          <div className="t-cap opacity-70">ドラッグで位置調整</div>
        </div>

        {/* スライダー類 */}
        <div className="flex-1 min-w-[200px] flex flex-col gap-3">
          <label className="block">
            <div className="flex items-center justify-between mb-1">
              <span className="t-label">🔍 ズーム</span>
              <span className="t-mono text-[11px] opacity-70">
                {zoom.toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) =>
                onChange({
                  zoom: Number(e.target.value),
                  offsetX,
                  offsetY,
                })
              }
              onPointerUp={() =>
                onCommit?.({ zoom, offsetX, offsetY })
              }
              className="w-full accent-[--c-accent]"
            />
          </label>

          <label className="block">
            <div className="flex items-center justify-between mb-1">
              <span className="t-label">↔️ 水平</span>
              <span className="t-mono text-[11px] opacity-70">
                {offsetX.toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              step={1}
              value={offsetX}
              onChange={(e) =>
                onChange({
                  zoom,
                  offsetX: Number(e.target.value),
                  offsetY,
                })
              }
              onPointerUp={() =>
                onCommit?.({ zoom, offsetX, offsetY })
              }
              className="w-full accent-[--c-accent]"
            />
          </label>

          <label className="block">
            <div className="flex items-center justify-between mb-1">
              <span className="t-label">↕️ 垂直</span>
              <span className="t-mono text-[11px] opacity-70">
                {offsetY.toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              step={1}
              value={offsetY}
              onChange={(e) =>
                onChange({
                  zoom,
                  offsetX,
                  offsetY: Number(e.target.value),
                })
              }
              onPointerUp={() =>
                onCommit?.({ zoom, offsetX, offsetY })
              }
              className="w-full accent-[--c-accent]"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              onChange({ zoom: 1, offsetX: 0, offsetY: 0 });
              onCommit?.({ zoom: 1, offsetX: 0, offsetY: 0 });
            }}
            className="self-start t-cap underline text-mute hover:text-ink"
          >
            位置・サイズをリセット
          </button>
        </div>
      </div>
    </div>
  );
}
