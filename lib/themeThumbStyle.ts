import type { CSSProperties } from "react";

export interface ThemeThumbTransform {
  thumbnailUrl?: string | null;
  zoom?: number | null;
  offsetX?: number | null;
  offsetY?: number | null;
}

function norm(t: ThemeThumbTransform) {
  const zoom = Math.max(0.3, Math.min(3, Number(t.zoom ?? 1) || 1));
  const x = Math.max(-50, Math.min(50, Number(t.offsetX ?? 0) || 0));
  const y = Math.max(-50, Math.min(50, Number(t.offsetY ?? 0) || 0));
  return { zoom, x, y };
}

/** テーマサムネ <img> 要素に当てる style。
 *  object-fit:cover でコンテナを覆い、object-position と scale で
 *  ユーザが調整した位置・倍率を反映する。 */
export function themeThumbImgStyle(t: ThemeThumbTransform): CSSProperties {
  const { zoom, x, y } = norm(t);
  const px = 50 + x;
  const py = 50 + y;
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${px}% ${py}%`,
    transform: `scale(${zoom})`,
    transformOrigin: `${px}% ${py}%`,
    display: "block",
    userSelect: "none",
    pointerEvents: "none",
  };
}
