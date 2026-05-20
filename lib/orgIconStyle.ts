import type { CSSProperties } from "react";

export interface OrgIconTransform {
  iconUrl?: string | null;
  zoom?: number | null;
  offsetX?: number | null; // -50 〜 50 (％)
  offsetY?: number | null;
}

/** clamp して安全な値に丸める */
function norm(t: OrgIconTransform) {
  const zoom = Math.max(1, Math.min(3, Number(t.zoom ?? 1) || 1));
  const x = Math.max(-50, Math.min(50, Number(t.offsetX ?? 0) || 0));
  const y = Math.max(-50, Math.min(50, Number(t.offsetY ?? 0) || 0));
  return { zoom, x, y };
}

/** 画像 (icon_url) を持つ org の <img> 要素に当てる style。
 *  object-fit:cover で常にコンテナを覆い、object-position と scale で
 *  ユーザが調整した位置・倍率を反映する。 */
export function orgIconImgStyle(t: OrgIconTransform): CSSProperties {
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

/** 画像がない場合のグラデーション用 style (背景) */
export const ORG_ICON_FALLBACK_BG = {
  background:
    "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
} satisfies CSSProperties;
