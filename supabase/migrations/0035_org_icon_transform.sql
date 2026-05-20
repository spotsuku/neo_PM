-- 0035 organizations の icon 画像をユーザが拡縮/移動できるよう、
-- ズーム倍率と XY オフセット (％) を保持する。
-- 既存組織は zoom=1, offset=0,0 (= 中央フィット)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS icon_zoom numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS icon_offset_x numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icon_offset_y numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.organizations.icon_zoom IS 'icon_url の表示倍率 (1.0 = cover-fit, 1.0〜3.0 推奨)';
COMMENT ON COLUMN public.organizations.icon_offset_x IS 'icon_url の水平オフセット (-50 〜 50, ％)';
COMMENT ON COLUMN public.organizations.icon_offset_y IS 'icon_url の垂直オフセット (-50 〜 50, ％)';
