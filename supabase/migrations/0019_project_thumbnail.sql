-- ============================================================
-- 0019_project_thumbnail.sql
-- projects にサムネ画像 URL を追加。ホームのプロジェクト一覧で
-- カード型表示するために使う。
--   - テーマから生成されたプロジェクトは theme.thumbnail_url を
--     コピーして初期値にする。
--   - 手動編集 UI は後追いで追加。
-- ============================================================

alter table projects
  add column if not exists thumbnail_url text;

-- 既存プロジェクトでテーマ由来のものに thumbnail を backfill
update projects p
   set thumbnail_url = t.thumbnail_url
  from themes t
 where p.theme_id = t.id
   and p.thumbnail_url is null
   and t.thumbnail_url is not null;
