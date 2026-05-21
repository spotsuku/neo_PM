-- ============================================================
-- 0038_auto_join_demo_project.sql
-- 組織に新規参加した membership に対して、その組織の見本プロジェクト
-- (projects.is_demo = true) へ自動的に project_memberships (role=member)
-- を追加する。
--
-- これにより:
--   - 招待リンク経由で参加したメンバー / テーマオーナーが、見本プロジェクトの
--     タブ (ホーム / ダッシュ / 会議 / WBS 等) を最初から閲覧できる
--   - 既存組織にも backfill で適用される
--
-- owner / admin は is_org_member で全プロジェクトにアクセスできるので
-- project_memberships への明示登録は本トリガでは不要 (重複追加もスキップ)
-- ============================================================

-- ── 1. trigger 関数: memberships INSERT 後に発火
create or replace function public.add_to_demo_projects_on_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into project_memberships (project_id, user_id, role)
  select p.id, new.user_id, 'member'
  from projects p
  where p.organization_id = new.organization_id
    and p.is_demo = true
    and not exists (
      select 1 from project_memberships pm
      where pm.project_id = p.id and pm.user_id = new.user_id
    );
  return new;
end;
$$;

comment on function public.add_to_demo_projects_on_membership is
  'memberships INSERT 後に発火。同 org の is_demo プロジェクトへ自動的に member として登録する。重複時はスキップ。';

-- ── 2. trigger 登録
drop trigger if exists trg_add_to_demo_on_membership on memberships;
create trigger trg_add_to_demo_on_membership
  after insert on memberships
  for each row execute function public.add_to_demo_projects_on_membership();

-- ── 3. 既存メンバーへの backfill
--    既に memberships が貼られているユーザで、対応する見本プロジェクトに
--    project_memberships が無いものを一括で member 追加
insert into project_memberships (project_id, user_id, role)
select p.id, m.user_id, 'member'
from memberships m
join projects p on p.organization_id = m.organization_id
where p.is_demo = true
  and not exists (
    select 1 from project_memberships pm
    where pm.project_id = p.id and pm.user_id = m.user_id
  );
