-- ============================================================
-- NEO PM — テーマサムネ画像の位置・拡縮調整
-- ============================================================
-- これまで themes.thumbnail_url は URL を直接入力させていたが、
-- UI を「プレビューをクリックしてアップロード + フレーム内でドラッグ位置調整」
-- に切り替える。組織アイコン (orgIconStyle) と同じ方式で
-- object-position と transform:scale を使うため、3 列を追加する。
--   - thumbnail_zoom: 0.3 〜 3.0 (デフォルト 1.0)
--   - thumbnail_offset_x: -50 〜 50 (デフォルト 0、% 単位)
--   - thumbnail_offset_y: -50 〜 50 (デフォルト 0、% 単位)
-- すべて nullable / デフォルト付きなので既存行は無影響。

alter table public.themes
  add column if not exists thumbnail_zoom numeric default 1,
  add column if not exists thumbnail_offset_x numeric default 0,
  add column if not exists thumbnail_offset_y numeric default 0;
