"use client";

import { useEffect, useRef, useState } from "react";

import { themeThumbImgStyle } from "@/lib/themeThumbStyle";

interface BaseProps {
  thumbnailUrl: string | null;
  zoom: number | null;
  offsetX: number | null;
  offsetY: number | null;
}

interface EditMode {
  uploading?: boolean;
  /** ファイルを受け取って Storage アップロード + URL 保存する。 */
  onPickFile: (file: File) => void;
  /** ドラッグ確定時 (mouseup) に呼ばれる。次の zoom/offset を渡す。 */
  onCommitTransform: (next: {
    zoom: number;
    offsetX: number;
    offsetY: number;
  }) => void;
  /** 画像を外す (URL を null に)。 */
  onClear: () => void;
}

interface Props extends BaseProps {
  /** 編集モード。指定するとクリックでアップロード + ドラッグで位置調整できる。 */
  editable?: EditMode;
}

const CLAMP = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** テーマの 16:9 サムネ画像。読み取り専用 (応募者向け) と
 *  編集可能 (テーマ出題者向け) の両方で使う。
 *  - 画像なし & editable: クリックでアップロード
 *  - 画像あり & editable: ドラッグで位置調整 + ズームスライダー
 *  - editable 未指定: そのまま表示するだけ */
export function ThemeThumbnail({
  thumbnailUrl,
  zoom,
  offsetX,
  offsetY,
  editable,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [localZoom, setLocalZoom] = useState<number>(Number(zoom ?? 1));
  const [localX, setLocalX] = useState<number>(Number(offsetX ?? 0));
  const [localY, setLocalY] = useState<number>(Number(offsetY ?? 0));
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOX: number;
    startOY: number;
    sizePx: number;
  } | null>(null);

  // 親側の値が変わったら同期 (デバウンス保存からの戻りなど)
  useEffect(() => setLocalZoom(Number(zoom ?? 1)), [zoom]);
  useEffect(() => setLocalX(Number(offsetX ?? 0)), [offsetX]);
  useEffect(() => setLocalY(Number(offsetY ?? 0)), [offsetY]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dxPct = ((e.clientX - d.startX) / d.sizePx) * 100;
      const dyPct = ((e.clientY - d.startY) / d.sizePx) * 100;
      setLocalX(CLAMP(d.startOX + dxPct, -50, 50));
      setLocalY(CLAMP(d.startOY + dyPct, -50, 50));
    };
    const onUp = () => {
      setDragging(false);
      dragRef.current = null;
      editable?.onCommitTransform({
        zoom: localZoom,
        offsetX: localX,
        offsetY: localY,
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, localZoom, localX, localY, editable]);

  const startDrag = (e: React.PointerEvent) => {
    if (!editable || !thumbnailUrl) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOX: localX,
      startOY: localY,
      sizePx: rect.width,
    };
    setDragging(true);
  };

  const openPicker = () => {
    if (!editable) return;
    fileRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && editable) editable.onPickFile(f);
    e.target.value = "";
  };

  const frameStyle: React.CSSProperties = thumbnailUrl
    ? { background: "#f1f5f9" }
    : {
        background:
          "linear-gradient(135deg, var(--c-accent-soft), var(--c-accent-bright))",
      };

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={frameRef}
        onPointerDown={startDrag}
        onClick={editable && !thumbnailUrl ? openPicker : undefined}
        className={
          "relative aspect-[16/9] max-h-[280px] overflow-hidden flex items-center justify-center text-6xl group " +
          (editable
            ? thumbnailUrl
              ? dragging
                ? "cursor-grabbing"
                : "cursor-grab"
              : "cursor-pointer"
            : "")
        }
        style={frameStyle}
        title={
          editable
            ? thumbnailUrl
              ? "ドラッグで位置調整 / 画像を変更するには右下のボタン"
              : "クリックで画像をアップロード"
            : undefined
        }
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            draggable={false}
            style={themeThumbImgStyle({
              thumbnailUrl,
              zoom: localZoom,
              offsetX: localX,
              offsetY: localY,
            })}
          />
        ) : (
          <span aria-hidden>📣</span>
        )}

        {editable && !thumbnailUrl && (
          <span className="absolute inset-0 grid place-items-center pointer-events-none">
            <span className="rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-bold text-ink shadow-md">
              📷 クリックして画像を追加
            </span>
          </span>
        )}

        {editable && thumbnailUrl && (
          <>
            <span className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition pointer-events-none bg-ink/10">
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11.5px] font-bold text-ink shadow-md">
                ✋ ドラッグで位置調整
              </span>
            </span>
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openPicker();
                }}
                disabled={editable.uploading}
                className="rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-bold text-ink shadow hover:bg-white disabled:opacity-50"
                title="画像を差し替え"
              >
                {editable.uploading ? "⏳ 中…" : "📷 差し替え"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  editable.onClear();
                }}
                disabled={editable.uploading}
                className="rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-bold text-mute shadow hover:text-error disabled:opacity-50"
                title="画像を外す"
              >
                🗑
              </button>
            </div>
          </>
        )}

        {editable && (
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="hidden"
          />
        )}
      </div>

      {editable && thumbnailUrl && (
        <div className="flex items-center gap-3 px-1">
          <span className="t-label whitespace-nowrap">🔍 ズーム</span>
          <input
            type="range"
            min={0.3}
            max={3}
            step={0.05}
            value={localZoom}
            onChange={(e) => setLocalZoom(Number(e.target.value))}
            onPointerUp={() =>
              editable.onCommitTransform({
                zoom: localZoom,
                offsetX: localX,
                offsetY: localY,
              })
            }
            className="flex-1 accent-[--c-accent]"
          />
          <span className="t-mono text-[11px] opacity-70 w-12 text-right">
            {localZoom.toFixed(2)}×
          </span>
          <button
            type="button"
            onClick={() => {
              setLocalZoom(1);
              setLocalX(0);
              setLocalY(0);
              editable.onCommitTransform({ zoom: 1, offsetX: 0, offsetY: 0 });
            }}
            className="t-cap underline text-mute hover:text-ink whitespace-nowrap"
          >
            リセット
          </button>
        </div>
      )}
    </div>
  );
}
