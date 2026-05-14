-- ============================================================
-- 0017_org_competition_mode.sql
-- 組織にコンペ運営機能 (テーマ出題 + 応募) の on/off フラグを追加。
-- 通常は PM SaaS としてプロジェクト管理だけを使い、希望する組織だけ
-- コンペ機能を有効化する。
--
--   - default false (新規組織は PM のみ)
--   - 既存組織が「コンペを既に運営している」かどうかは themes 行で判別する
--     ことができるので、既存組織については「themes が1件以上ある場合は true」
--     を初期値として backfill する。
-- ============================================================

alter table organizations
  add column if not exists competition_enabled boolean not null default false;

-- 既存組織で themes 行を持つものは competition_enabled = true で初期化
update organizations o
   set competition_enabled = true
 where exists (
   select 1 from themes t where t.organization_id = o.id
 )
   and competition_enabled = false;
