-- ============================================================
-- 0083_team_considering_themes.sql
-- チームが「応募検討中」として選んでいるテーマの一覧。
-- 未定 (0件) も許容する = 検討テーマ無しはこのテーブルの行が無い状態。
--
-- 応募 (theme_applications) とは別レイヤ:
--   - team_considering_themes = 「候補として保存している (まだ応募していない)」
--   - theme_applications        = 「実際に応募した」
-- 応募すると theme_applications に行ができるが、それとは独立に候補リストは残る。
-- ============================================================

create table if not exists team_considering_themes (
  team_id      uuid not null references teams on delete cascade,
  theme_id     uuid not null references themes on delete cascade,
  added_by     uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  primary key (team_id, theme_id)
);

create index if not exists team_considering_themes_team_idx
  on team_considering_themes (team_id);
create index if not exists team_considering_themes_theme_idx
  on team_considering_themes (theme_id);

alter table team_considering_themes enable row level security;

-- SELECT: 組織メンバー全員が読める (team → org 経由)
drop policy if exists "org member reads team_considering_themes"
  on team_considering_themes;
create policy "org member reads team_considering_themes"
  on team_considering_themes
  for select using (
    exists (
      select 1 from teams t
      where t.id = team_considering_themes.team_id
        and public.is_org_member(t.organization_id)
    )
  );

-- INSERT/DELETE: チームメンバーまたは org admin
drop policy if exists "team member writes team_considering_themes"
  on team_considering_themes;
create policy "team member writes team_considering_themes"
  on team_considering_themes
  for insert with check (
    exists (
      select 1 from teams t
      where t.id = team_considering_themes.team_id
        and (
          public.is_org_admin(t.organization_id)
          or exists (
            select 1 from team_members tm
            where tm.team_id = t.id
              and tm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "team member deletes team_considering_themes"
  on team_considering_themes;
create policy "team member deletes team_considering_themes"
  on team_considering_themes
  for delete using (
    exists (
      select 1 from teams t
      where t.id = team_considering_themes.team_id
        and (
          public.is_org_admin(t.organization_id)
          or exists (
            select 1 from team_members tm
            where tm.team_id = t.id
              and tm.user_id = auth.uid()
          )
        )
    )
  );

-- Realtime
do $$ begin
  begin alter publication supabase_realtime add table team_considering_themes;
    exception when others then null;
  end;
end $$;

comment on table team_considering_themes is
  'チームが応募検討中のテーマ (候補リスト)。0 件 = 未定。';
