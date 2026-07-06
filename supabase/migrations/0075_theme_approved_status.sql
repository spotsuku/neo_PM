-- ============================================================
-- 0075_theme_approved_status.sql
-- テーマの「承認」と「公開」を 2 ステップに分離する。
--
-- 旧ステータス:
--   draft → submitted → active (= 承認 = 公開)
--
-- 新ステータス:
--   draft → submitted → approved (=承認済 非公開) → active (=公開中)
--
-- - 管理者は「承認」して approved にする (応募者にはまだ見えない)
-- - 出題者は自分の判断で「公開」ボタンを押して active にする
-- - approved 状態で出題者が編集したければ下書きに戻すこともできる
-- ============================================================

alter table public.themes drop constraint if exists themes_status_check;
alter table public.themes
  add constraint themes_status_check
  check (status in (
    'draft','submitted','changes_requested',
    'approved','active','closed','archived'
  ));

-- 応募者に見えるのは 'active' のみ (既存 RLS の想定は変わらないが、
-- 応募一覧 SELECT で status='active' を条件に絞っている前提)。
-- SELECT ポリシーは既存の is_org_member 等がそのまま働く。

comment on constraint themes_status_check on public.themes is
  'ステータス値: draft/submitted/changes_requested/approved(承認済・非公開)/active(公開中)/closed/archived';
