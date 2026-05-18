-- ============================================================
-- 0015_theme_posted_by.sql
-- テーマ出題者 (Aさん) を記録し、応募承認時にプロジェクトリーダーとして
-- 自動参加させるための列を追加する。
--   - themes.posted_by に出題したユーザー (auth.uid()) を保存
--   - 既存テーマは null のまま (ApplicationsBoard 側で null チェックする)
-- ============================================================

alter table themes
  add column if not exists posted_by uuid references auth.users(id) on delete set null;

create index if not exists themes_posted_by_idx on themes (posted_by);
