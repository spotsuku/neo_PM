-- ============================================================
-- NEO PM v2 — Project-level memberships + access control
-- ============================================================
-- 組織内アクセス制御の導入。これまでは「組織メンバー = 全プロジェクト
-- にアクセス可」だったが、本マイグレーション以降は:
--   - 組織 owner / admin: 全プロジェクトにアクセス可
--   - 組織 member: プロジェクトメンバーに登録された PJ のみ
--   - 全員: ランキングページ（projects テーブルの SELECT）は可
--
-- 既存の v2 スキーマに追加可能。破壊的変更はテーブル削除ではなく
-- 一部 RLS ポリシーの差し替え。

-- ── project_memberships table ──────────────────────────────
create table if not exists project_memberships (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  role        text not null default 'member' check (role in ('lead','member')),
  created_at  timestamptz not null default now(),
  unique(project_id, user_id)
);

create index if not exists project_memberships_project_idx
  on project_memberships(project_id);
create index if not exists project_memberships_user_idx
  on project_memberships(user_id);

alter table project_memberships enable row level security;

-- ── Helper functions ──────────────────────────────────────
-- 現在のユーザーがプロジェクトにアクセス可能か?
--   = 組織 owner/admin OR project_memberships に登録あり
create or replace function public.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from projects p
    join memberships m on m.organization_id = p.organization_id
    where p.id = p_project_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  ) or exists (
    select 1 from project_memberships
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

-- 現在のユーザーがプロジェクトを「管理」できるか?
--   = 組織 owner/admin OR project lead
create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from projects p
    join memberships m on m.organization_id = p.organization_id
    where p.id = p_project_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  ) or exists (
    select 1 from project_memberships
    where project_id = p_project_id
      and user_id = auth.uid()
      and role = 'lead'
  );
$$;

grant execute on function public.can_access_project(uuid) to authenticated;
grant execute on function public.can_manage_project(uuid) to authenticated;

-- ── project_memberships の RLS ────────────────────────────
drop policy if exists "proj members readable" on project_memberships;
create policy "proj members readable" on project_memberships
  for select using (public.can_access_project(project_id));

drop policy if exists "proj managers insert" on project_memberships;
create policy "proj managers insert" on project_memberships
  for insert with check (public.can_manage_project(project_id));

drop policy if exists "proj managers update" on project_memberships;
create policy "proj managers update" on project_memberships
  for update using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

drop policy if exists "proj managers delete" on project_memberships;
create policy "proj managers delete" on project_memberships
  for delete using (public.can_manage_project(project_id));

-- ── Trigger: 新規プロジェクト作成者を自動で lead に追加 ──
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    insert into project_memberships (project_id, user_id, role)
    values (new.id, auth.uid(), 'lead')
    on conflict (project_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_project_created on projects;
create trigger on_project_created
  after insert on projects
  for each row execute function public.handle_new_project();

-- ── 既存プロジェクトの後方互換: 組織オーナーを project lead として登録 ──
-- 既存データをいきなり「全員見えなくする」と運用が止まるので、各組織の
-- owner を全プロジェクトの lead として登録する。これでオーナーは
-- 引き続き全プロジェクトを見られる（admin/owner 自動許可と二重で安全）。
insert into project_memberships (project_id, user_id, role)
select p.id, m.user_id, 'lead'
from projects p
join memberships m on m.organization_id = p.organization_id
where m.role = 'owner'
on conflict (project_id, user_id) do nothing;

-- ── 詳細テーブルの RLS をプロジェクトアクセス制御に差し替え ──
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'execution_plans','milestones','tasks','budget_items',
      'diagnosis_entries','fund_applications','events',
      'proposals','chat_messages','field_history'
    ])
  loop
    execute format('drop policy if exists "org reads %1$I" on %1$I;', t);
    execute format('drop policy if exists "org writes %1$I" on %1$I;', t);
    execute format('drop policy if exists "proj access reads %1$I" on %1$I;', t);
    execute format('drop policy if exists "proj access writes %1$I" on %1$I;', t);
    execute format(
      'create policy "proj access reads %1$I" on %1$I for select using (public.can_access_project(project_id));',
      t
    );
    execute format(
      'create policy "proj access writes %1$I" on %1$I for all using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));',
      t
    );
  end loop;
end $$;

-- kpis: plan -> project 経由
drop policy if exists "org reads kpis" on kpis;
drop policy if exists "org writes kpis" on kpis;
drop policy if exists "proj access reads kpis" on kpis;
drop policy if exists "proj access writes kpis" on kpis;
create policy "proj access reads kpis" on kpis
  for select using (
    exists (
      select 1 from execution_plans ep
      where ep.id = kpis.plan_id
        and public.can_access_project(ep.project_id)
    )
  );
create policy "proj access writes kpis" on kpis
  for all using (
    exists (
      select 1 from execution_plans ep
      where ep.id = kpis.plan_id
        and public.can_access_project(ep.project_id)
    )
  ) with check (
    exists (
      select 1 from execution_plans ep
      where ep.id = kpis.plan_id
        and public.can_access_project(ep.project_id)
    )
  );

-- projects テーブルの RLS は SELECT を組織メンバー全員に開いたまま
-- （ランキング表示用）、UPDATE / DELETE はプロジェクトアクセス権者のみ。
drop policy if exists "org writes projects" on projects;
drop policy if exists "org admins or proj members update projects" on projects;
drop policy if exists "org members insert projects" on projects;
drop policy if exists "org admins delete projects" on projects;

create policy "org members insert projects" on projects
  for insert with check (public.is_org_member(organization_id));

create policy "proj access updates projects" on projects
  for update using (public.can_access_project(id))
  with check (public.can_access_project(id));

create policy "org admins delete projects" on projects
  for delete using (
    exists (
      select 1 from memberships m
      where m.organization_id = projects.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- ── RPC: 現在ユーザーが見られるプロジェクト ID 一覧 ──
create or replace function public.accessible_project_ids(p_org_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- org admin/owner ならその組織の全プロジェクト
  select p.id
  from projects p
  where p.organization_id = p_org_id
    and exists (
      select 1 from memberships m
      where m.organization_id = p_org_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  union
  -- それ以外は project_memberships に登録されているもの
  select p.id
  from projects p
  join project_memberships pm on pm.project_id = p.id
  where p.organization_id = p_org_id
    and pm.user_id = auth.uid();
$$;

grant execute on function public.accessible_project_ids(uuid) to authenticated;
