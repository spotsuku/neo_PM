-- ============================================================
-- 0069_teams_formation.sql
-- チーム組成 (Team Formation) Phase 1
--   - teams              : 組織内のチーム
--   - team_members       : チームメンバー
--   - theme_applications : team_id + preference_rank を追加
--
-- ルール:
--   R1. 1人はその組織内で 1 チームまで (掛け持ち禁止)
--       → 部分ユニークインデックスで担保
--         (user_id, organization_id) UNIQUE on team_members
--         (解散時は team_members から行が削除されるので活性チームのみ効く)
--   R2. 1チームは複数テーマに応募可 (第X希望)
--       → theme_applications に (team_id, preference_rank) UNIQUE
--         (同一チームが同じテーマに複数応募するのは (team_id, theme_id) で禁止)
--   R3. 個人応募 (1人チーム) も可 (= team を作って自分1人で応募)
--   R4. team_id は nullable (旧応募/個人応募の互換のため)
--
-- 権限:
--   - 組織メンバーは同組織のチームを閲覧可 (RLS)
--   - 自分自身はチームに加入/退会できる (self-join)
--   - team lead + 組織 admin は team 本体 (name/status/description) を編集可
-- ============================================================

-- ─────────────────────────────────────────────────────
-- 1. まずテーブルを両方作る (RLS ポリシーが相互参照するので、
--    テーブルと trigger 関数を先にそろえてから policy をまとめて作る)
-- ─────────────────────────────────────────────────────

create table if not exists teams (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations on delete cascade,
  name               text not null,
  description        text,
  status             text not null default 'active'
                     check (status in ('active','disbanded')),
  member_limit       int,
  created_by         uuid references auth.users on delete set null,
  disbanded_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists teams_org_idx on teams (organization_id, status);
create index if not exists teams_created_by_idx on teams (created_by);

create table if not exists team_members (
  team_id            uuid not null references teams on delete cascade,
  user_id            uuid not null references auth.users on delete cascade,
  organization_id    uuid not null,  -- teams.organization_id と同期 (trigger で埋める)
  role               text not null default 'member'
                     check (role in ('lead','member')),
  joined_at          timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists team_members_user_idx on team_members (user_id);
create index if not exists team_members_org_idx on team_members (organization_id);

-- 1人1チーム per org 制約 (ユニーク: user_id + organization_id)
-- 解散時は下の trigger で team_members から行を消すので、
-- 「解散すればもう一度どこかに入れる」を実現できる。
drop index if exists team_members_one_active_team_per_user_per_org;
create unique index team_members_one_active_team_per_user_per_org
  on team_members (user_id, organization_id);

-- ─────────────────────────────────────────────────────
-- 2. Trigger 関数群 (テーブル依存の順序に注意)
-- ─────────────────────────────────────────────────────

-- teams.updated_at 自動更新
create or replace function public._teams_touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists teams_touch_updated on teams;
create trigger teams_touch_updated
before update on teams
for each row execute function public._teams_touch_updated();

-- team_members INSERT 時に organization_id を teams から自動同期
create or replace function public._team_members_sync_org()
returns trigger
language plpgsql
as $$
declare
  v_org uuid;
  v_status text;
begin
  select organization_id, status into v_org, v_status
    from teams where id = new.team_id;
  if v_org is null then
    raise exception 'team not found: %', new.team_id;
  end if;
  if v_status = 'disbanded' then
    raise exception '解散済みのチームにはメンバーを追加できません';
  end if;
  new.organization_id := v_org;
  return new;
end;
$$;

drop trigger if exists team_members_sync_org on team_members;
create trigger team_members_sync_org
before insert on team_members
for each row execute function public._team_members_sync_org();

-- チームが disbanded になったら team_members を消す (掛け持ちを可能にする)
create or replace function public._teams_cleanup_on_disband()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'disbanded' and old.status <> 'disbanded' then
    delete from team_members where team_id = new.id;
    new.disbanded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists teams_cleanup_on_disband on teams;
create trigger teams_cleanup_on_disband
before update on teams
for each row execute function public._teams_cleanup_on_disband();

-- ─────────────────────────────────────────────────────
-- 3. RLS: 両テーブル ENABLE 後にまとめて policy を作る
-- ─────────────────────────────────────────────────────

alter table teams enable row level security;
alter table team_members enable row level security;

-- teams -----------------------------------------------
-- SELECT: 組織メンバーは組織内チームを全件見える
drop policy if exists "org member reads teams" on teams;
create policy "org member reads teams" on teams
  for select using (public.is_org_member(organization_id));

-- INSERT: 組織メンバーはチームを作成できる (created_by は自分)
drop policy if exists "org member creates team" on teams;
create policy "org member creates team" on teams
  for insert with check (
    public.is_org_member(organization_id)
    and created_by = auth.uid()
  );

-- UPDATE: 組織 admin OR このチームの lead
drop policy if exists "team lead or admin updates team" on teams;
create policy "team lead or admin updates team" on teams
  for update using (
    public.is_org_admin(organization_id)
    or exists (
      select 1 from team_members tm
      where tm.team_id = teams.id
        and tm.user_id = auth.uid()
        and tm.role = 'lead'
    )
  ) with check (
    public.is_org_admin(organization_id)
    or exists (
      select 1 from team_members tm
      where tm.team_id = teams.id
        and tm.user_id = auth.uid()
        and tm.role = 'lead'
    )
  );

-- DELETE: 組織 admin のみ (通常は解散 = status='disbanded' で運用)
drop policy if exists "org admin deletes team" on teams;
create policy "org admin deletes team" on teams
  for delete using (public.is_org_admin(organization_id));

-- team_members ---------------------------------------
-- SELECT: 同組織のメンバー全員が見られる (誰が未所属かを把握するため)
drop policy if exists "org member reads team_members" on team_members;
create policy "org member reads team_members" on team_members
  for select using (public.is_org_member(organization_id));

-- INSERT: 自分をチームに追加 (self-join)
--         (Phase 1 は招待機能なし。lead 招待は Phase 2 で追加予定)
drop policy if exists "self joins team" on team_members;
create policy "self joins team" on team_members
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from teams t
      where t.id = team_id
        and t.status = 'active'
        and public.is_org_member(t.organization_id)
    )
  );

-- DELETE: 自分自身が抜ける / チーム lead / 組織 admin
drop policy if exists "self or lead or admin removes member" on team_members;
create policy "self or lead or admin removes member" on team_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from team_members tm
      where tm.team_id = team_members.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'lead'
    )
    or public.is_org_admin(organization_id)
  );

-- UPDATE: role 変更 (lead 移譲) は lead 本人か組織 admin
drop policy if exists "lead or admin updates member role" on team_members;
create policy "lead or admin updates member role" on team_members
  for update using (
    public.is_org_admin(organization_id)
    or exists (
      select 1 from team_members tm
      where tm.team_id = team_members.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'lead'
    )
  ) with check (
    public.is_org_admin(organization_id)
    or exists (
      select 1 from team_members tm
      where tm.team_id = team_members.team_id
        and tm.user_id = auth.uid()
        and tm.role = 'lead'
    )
  );

-- ─────────────────────────────────────────────────────
-- 4. theme_applications 拡張
-- ─────────────────────────────────────────────────────

alter table theme_applications
  add column if not exists team_id         uuid references teams on delete set null,
  add column if not exists preference_rank int check (preference_rank between 1 and 5);

create index if not exists theme_apps_team_idx
  on theme_applications (team_id);

-- 同一チームが同じテーマに 2 回応募するのは禁止
drop index if exists theme_apps_team_theme_uniq;
create unique index theme_apps_team_theme_uniq
  on theme_applications (team_id, theme_id)
  where team_id is not null;

-- 同一チーム内で同じ preference_rank を重複させない
drop index if exists theme_apps_team_rank_uniq;
create unique index theme_apps_team_rank_uniq
  on theme_applications (team_id, preference_rank)
  where team_id is not null and preference_rank is not null;

-- ─────────────────────────────────────────────────────
-- 5. Realtime + コメント
-- ─────────────────────────────────────────────────────

do $$ begin
  begin alter publication supabase_realtime add table teams; exception when others then null; end;
  begin alter publication supabase_realtime add table team_members; exception when others then null; end;
end $$;

comment on table teams is
  'テーマ応募のためのチーム。1組織内で1人1チームまで。掛け持ち禁止。';
comment on table team_members is
  'チームメンバー。organization_id は teams から自動同期される冗長列。';
comment on column theme_applications.team_id is
  '応募したチーム。NULL は旧応募 (個人) を意味する。';
comment on column theme_applications.preference_rank is
  '第何希望か (1-5)。1 が第一希望。';
