-- ============================================================
-- NEO PM v2 — Initial schema (multi-org + Supabase Auth)
-- ============================================================
-- Idempotent: 安全に再実行できます。v1 のテーブルが残っている
-- 場合でも、最初に drop してから v2 を作り直します。
--
-- ⚠️  WARNING: 既存の v1 データは全て削除されます。
--    v1 のコードは legacy/v1-vanilla ブランチに保管されています。
--    必要なら Supabase 側の v1 データも事前にエクスポートしてください。

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── 0. v1 テーブルの完全リセット ──────────────────────────────
-- 既存の v1 スキーマと v2 を衝突させないため、関連テーブルを drop
-- してから作り直します。auth.users / auth.* には触れません。

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists field_history    cascade;
drop table if exists chat_messages    cascade;
drop table if exists proposals        cascade;
drop table if exists events           cascade;
drop table if exists fund_applications cascade;
drop table if exists diagnosis_entries cascade;
drop table if exists budget_items     cascade;
drop table if exists tasks            cascade;
drop table if exists milestones       cascade;
drop table if exists kpis             cascade;
drop table if exists execution_plans  cascade;
drop table if exists projects         cascade;
drop table if exists themes           cascade;
drop table if exists memberships      cascade;
drop table if exists organizations    cascade;
drop table if exists profiles         cascade;

drop function if exists public.handle_new_user()        cascade;
drop function if exists public.is_org_member(uuid)      cascade;
drop function if exists public.project_org(uuid)        cascade;

-- v1 由来の publication 登録を解除（テーブル drop と同時に消えるはずだが念のため）
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- ここで table を一覧除外する必要はありません。drop cascade で消えています。
    null;
  end if;
end $$;

-- ── 1. Organizations & Memberships ────────────────────────────
create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists memberships (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  organization_id uuid not null references organizations on delete cascade,
  role            text not null default 'member'
                  check (role in ('owner','admin','member')),
  created_at      timestamptz not null default now(),
  unique(user_id, organization_id)
);

create index if not exists memberships_user_idx on memberships (user_id);
create index if not exists memberships_org_idx  on memberships (organization_id);

-- ── 2. Profiles (Supabase Auth 1:1) ──────────────────────────
create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

-- ── 3. Auto-create profile + personal org on signup ──────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_org_id   uuid;
  base_name    text;
  base_slug    text;
  suffix       text;
begin
  -- Profile
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  -- Personal org
  base_name := coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1),
    'team'
  );
  base_slug := lower(regexp_replace(base_name, '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'team'; end if;
  suffix := substr(md5(new.id::text), 1, 4);

  insert into public.organizations (name, slug)
  values (base_name || ' のチーム', base_slug || '-' || suffix)
  returning id into new_org_id;

  insert into public.memberships (user_id, organization_id, role)
  values (new.id, new_org_id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 4. Core project tables (scoped by organization_id) ────────
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  name            text not null,
  team_name       text,
  idea_title      text,
  status          text not null default 'active'
                  check (status in ('active','paused','completed','archived')),
  progress_pct    int not null default 0,
  streak_days     int not null default 0,
  badges          text[] not null default '{}',
  started_at      timestamptz,
  due_at          timestamptz,
  theme_id        uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists projects_org_idx on projects (organization_id, status, updated_at desc);

create table if not exists themes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  code            text,
  category        text check (category in ('new','renewal')),
  title           text not null,
  background      text,
  who_target      text,
  pain            text,
  what_uniqueness text,
  what_benefit    text,
  how_hypothesis  text,
  expected_outcome     text,
  internal_challenges  text,
  theme_candidates     text,
  implementation_level text check (implementation_level in ('poc','impl')),
  resource_people  text,
  resource_place   text,
  resource_budget  text,
  resource_data    text,
  resource_other   text,
  post_action      text,
  criteria_region  boolean not null default false,
  criteria_means   boolean not null default false,
  criteria_youth   boolean not null default false,
  company_name     text,
  contact_name     text,
  status           text not null default 'draft'
                   check (status in ('draft','active','closed','archived')),
  deadline         timestamptz,
  prize            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists themes_org_idx on themes (organization_id, status, created_at desc);

alter table projects
  add constraint projects_theme_fk
    foreign key (theme_id) references themes(id) on delete set null;

create table if not exists execution_plans (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade unique,
  why         text default '',
  who         text default '',
  what        text default '',
  how         text default '',
  product     text default '',
  price       text default '',
  place       text default '',
  promotion   text default '',
  qualitative_goal text default '',
  scores      jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists kpis (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references execution_plans on delete cascade,
  label      text not null,
  target     text,
  progress   int not null default 0,
  due_date   date,
  unit       text,
  created_at timestamptz not null default now()
);

create table if not exists milestones (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  label      text not null,
  date       date,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  parent_id   uuid references tasks on delete cascade,
  title       text not null,
  owner_name  text,
  start_week  int,
  span_week   int,
  progress    int not null default 0,
  status      text not null default 'todo'
              check (status in ('todo','doing','review','done')),
  is_milestone boolean not null default false,
  tag         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_project_idx on tasks (project_id, status);

create table if not exists budget_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  kind        text not null check (kind in ('income','expense')),
  category    text,
  name        text not null,
  plan_jpy    bigint not null default 0,
  actual_jpy  bigint not null default 0,
  is_pending  boolean not null default false,
  month       int,
  monthly_amounts jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists diagnosis_entries (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects on delete cascade,
  week_start   date not null,
  scores       jsonb not null default '{}',
  total_comment text,
  item_comments jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists fund_applications (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  round       int not null default 1,
  status      text not null default 'draft'
              check (status in ('draft','firstReview','secondReview','approved','rejected')),
  amount_jpy  bigint not null default 0,
  reason      text,
  purposes    jsonb,
  attachments text[],
  submitted_at timestamptz,
  decided_at  timestamptz,
  ai_hints    jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  date        date,
  time        text,
  label       text not null,
  kind        text,
  created_at  timestamptz not null default now()
);

create table if not exists proposals (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  kind        text not null
              check (kind in ('execution_plan','wbs','budget','promo','application','theme','diagnosis')),
  status      text not null default 'pending'
              check (status in ('pending','approved','rejected')),
  summary     text not null,
  diff        jsonb not null,
  reasoning   text,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references auth.users
);
create index if not exists proposals_idx on proposals (project_id, status);

create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  role        text not null check (role in ('user','assistant','system')),
  content     text,
  raw_content text,
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_idx on chat_messages (project_id, created_at);

create table if not exists field_history (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  table_name  text not null,
  field_name  text not null,
  value       text,
  changed_by  text not null default 'user',
  changed_at  timestamptz not null default now()
);
create index if not exists field_history_idx on field_history
  (project_id, table_name, field_name, changed_at desc);

-- ── 5. RLS ───────────────────────────────────────────────────
alter table organizations  enable row level security;
alter table memberships    enable row level security;
alter table profiles       enable row level security;
alter table projects       enable row level security;
alter table themes         enable row level security;
alter table execution_plans enable row level security;
alter table kpis           enable row level security;
alter table milestones     enable row level security;
alter table tasks          enable row level security;
alter table budget_items   enable row level security;
alter table diagnosis_entries enable row level security;
alter table fund_applications enable row level security;
alter table events         enable row level security;
alter table proposals      enable row level security;
alter table chat_messages  enable row level security;
alter table field_history  enable row level security;

-- Helper: is the current user a member of the org?
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where organization_id = target_org and user_id = auth.uid()
  );
$$;

-- Helper: org id of a project
create or replace function public.project_org(target_project uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from projects where id = target_project
$$;

-- organizations: members can read their own org; only owners/admins can update
create policy "org members can read" on organizations
  for select using (public.is_org_member(id));
create policy "any authed user can insert org" on organizations
  for insert with check (auth.uid() is not null);
create policy "owners can update org" on organizations
  for update using (
    exists (select 1 from memberships m
            where m.organization_id = organizations.id
              and m.user_id = auth.uid()
              and m.role in ('owner','admin'))
  );

-- memberships: user can read their own memberships; org admins can manage
create policy "user reads own memberships" on memberships
  for select using (user_id = auth.uid() or public.is_org_member(organization_id));
create policy "user inserts own membership" on memberships
  for insert with check (user_id = auth.uid());

-- profiles: everyone authed can read; users edit their own
create policy "authed reads profiles" on profiles
  for select using (auth.uid() is not null);
create policy "user updates own profile" on profiles
  for update using (id = auth.uid());

-- project-scoped tables (same template)
create policy "org reads projects" on projects
  for select using (public.is_org_member(organization_id));
create policy "org writes projects" on projects
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "org reads themes" on themes
  for select using (public.is_org_member(organization_id));
create policy "org writes themes" on themes
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- per-project tables: rely on project_org()
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
    execute format(
      'create policy "org reads %1$I" on %1$I for select using (public.is_org_member(public.project_org(project_id)));',
      t
    );
    execute format(
      'create policy "org writes %1$I" on %1$I for all using (public.is_org_member(public.project_org(project_id))) with check (public.is_org_member(public.project_org(project_id)));',
      t
    );
  end loop;
end $$;

-- kpis: nested via plan
create policy "org reads kpis" on kpis
  for select using (
    exists (select 1 from execution_plans ep
            join projects p on p.id = ep.project_id
            where ep.id = kpis.plan_id and public.is_org_member(p.organization_id))
  );
create policy "org writes kpis" on kpis
  for all using (
    exists (select 1 from execution_plans ep
            join projects p on p.id = ep.project_id
            where ep.id = kpis.plan_id and public.is_org_member(p.organization_id))
  ) with check (
    exists (select 1 from execution_plans ep
            join projects p on p.id = ep.project_id
            where ep.id = kpis.plan_id and public.is_org_member(p.organization_id))
  );

-- ── 6. Realtime publication ──────────────────────────────────
do $$ begin
  begin alter publication supabase_realtime add table projects;        exception when others then null; end;
  begin alter publication supabase_realtime add table tasks;           exception when others then null; end;
  begin alter publication supabase_realtime add table milestones;      exception when others then null; end;
  begin alter publication supabase_realtime add table budget_items;    exception when others then null; end;
  begin alter publication supabase_realtime add table execution_plans; exception when others then null; end;
  begin alter publication supabase_realtime add table proposals;       exception when others then null; end;
  begin alter publication supabase_realtime add table chat_messages;   exception when others then null; end;
end $$;
