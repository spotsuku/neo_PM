-- ============================================================
-- 0077_survey_rounds.sql
-- 意識調査の「回」機能。第一回・第二回・第三回... のように期間を設けて
-- 期間内のみ回答を編集可能にする。締切後は集計結果のみ表示。
-- ============================================================

create table if not exists survey_rounds (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations on delete cascade,
  label              text not null,             -- 「第一回」など表示用
  round_number       int  not null default 1,   -- 1, 2, 3... (組織内で連番)
  opens_at           timestamptz not null,
  closes_at          timestamptz not null,
  created_by         uuid references auth.users on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (closes_at > opens_at)
);

create index if not exists survey_rounds_org_idx
  on survey_rounds (organization_id, round_number);
drop index if exists survey_rounds_org_num_uniq;
create unique index survey_rounds_org_num_uniq
  on survey_rounds (organization_id, round_number);

create or replace function public._survey_rounds_touch_updated()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists survey_rounds_touch_updated on survey_rounds;
create trigger survey_rounds_touch_updated
before update on survey_rounds
for each row execute function public._survey_rounds_touch_updated();

alter table survey_rounds enable row level security;

-- SELECT: 組織メンバー全員
drop policy if exists "org member reads survey_rounds" on survey_rounds;
create policy "org member reads survey_rounds" on survey_rounds
  for select using (public.is_org_member(organization_id));

-- INSERT/UPDATE/DELETE: 組織 admin のみ
drop policy if exists "org admin writes survey_rounds" on survey_rounds;
create policy "org admin writes survey_rounds" on survey_rounds
  for insert with check (public.is_org_admin(organization_id));
drop policy if exists "org admin updates survey_rounds" on survey_rounds;
create policy "org admin updates survey_rounds" on survey_rounds
  for update using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
drop policy if exists "org admin deletes survey_rounds" on survey_rounds;
create policy "org admin deletes survey_rounds" on survey_rounds
  for delete using (public.is_org_admin(organization_id));

-- theme_preferences に round 参照を追加
alter table theme_preferences
  add column if not exists survey_round_id uuid references survey_rounds on delete cascade;

create index if not exists theme_prefs_round_idx
  on theme_preferences (survey_round_id, theme_id);

-- unique index を張り直し (round_id 込み)
-- 既存の (user, org, rank) uniq / (user, theme) uniq は round-scoped に変更
drop index if exists theme_prefs_user_rank_uniq;
drop index if exists theme_prefs_user_theme_uniq;

-- 1人 x 1組織 x 1回 x 1希望順位 は 1 テーマまで
create unique index if not exists theme_prefs_user_round_rank_uniq
  on theme_preferences (user_id, organization_id, survey_round_id, preference_rank);

-- 1人 x 1回 x 同じテーマは 1 回まで
create unique index if not exists theme_prefs_user_round_theme_uniq
  on theme_preferences (user_id, survey_round_id, theme_id);

-- INSERT: 期間内のみ + self
drop policy if exists "self writes preferences" on theme_preferences;
create policy "self writes preferences within round" on theme_preferences
  for insert with check (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
    and exists (
      select 1 from themes t
      where t.id = theme_id and t.organization_id = organization_id
    )
    and (
      -- 回未指定 (レガシー) は許容
      survey_round_id is null
      -- または現在の時刻が回の期間内
      or exists (
        select 1 from survey_rounds r
        where r.id = survey_round_id
          and r.organization_id = organization_id
          and now() between r.opens_at and r.closes_at
      )
    )
  );

drop policy if exists "self updates preferences" on theme_preferences;
create policy "self updates preferences within round" on theme_preferences
  for update using (
    user_id = auth.uid()
    and (
      survey_round_id is null
      or exists (
        select 1 from survey_rounds r
        where r.id = survey_round_id
          and r.organization_id = organization_id
          and now() between r.opens_at and r.closes_at
      )
    )
  ) with check (
    user_id = auth.uid()
    and (
      survey_round_id is null
      or exists (
        select 1 from survey_rounds r
        where r.id = survey_round_id
          and r.organization_id = organization_id
          and now() between r.opens_at and r.closes_at
      )
    )
  );

drop policy if exists "self deletes preferences" on theme_preferences;
create policy "self deletes preferences within round" on theme_preferences
  for delete using (
    user_id = auth.uid()
    and (
      survey_round_id is null
      or exists (
        select 1 from survey_rounds r
        where r.id = survey_round_id
          and r.organization_id = organization_id
          and now() between r.opens_at and r.closes_at
      )
    )
  );

do $$ begin
  begin alter publication supabase_realtime add table survey_rounds; exception when others then null; end;
end $$;

comment on table survey_rounds is
  '意識調査の回 (第一回・第二回...)。期間内のみ回答編集可。';
comment on column theme_preferences.survey_round_id is
  '回参照。NULL は旧仕様のレガシー行 (期間チェックなし)。';
