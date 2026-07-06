-- ============================================================
-- 0074_theme_preferences.sql
-- 出題テーマに対する「事前意識調査」。個人が第1〜第5希望を登録する。
-- チーム組成前の関心マッチング用途。
--
-- ルール:
--   - 1人が同じ組織内で同じ preference_rank を複数登録不可
--     (第1希望は1つだけ、第2希望も1つだけ)
--   - 1人が同じテーマを複数の希望順位で登録するのも不可
--   - preference_rank は 1..5 のみ
--   - 組織メンバー全員が誰の希望かも含めて見える (関心マッチングのため)
--     ※匿名にしたければ後で列追加 or 別テーブル化
-- ============================================================

create table if not exists theme_preferences (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users on delete cascade,
  organization_id    uuid not null references organizations on delete cascade,
  theme_id           uuid not null references themes on delete cascade,
  preference_rank    int  not null check (preference_rank between 1 and 5),
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists theme_prefs_org_theme_idx
  on theme_preferences (organization_id, theme_id);
create index if not exists theme_prefs_user_idx
  on theme_preferences (user_id, organization_id);

-- 1人 x 1組織 x 1希望順位 は 1 テーマまで
drop index if exists theme_prefs_user_rank_uniq;
create unique index theme_prefs_user_rank_uniq
  on theme_preferences (user_id, organization_id, preference_rank);

-- 1人 x 同じテーマは 1 回まで (第1希望と第3希望に同じテーマは不可)
drop index if exists theme_prefs_user_theme_uniq;
create unique index theme_prefs_user_theme_uniq
  on theme_preferences (user_id, theme_id);

-- updated_at trigger
create or replace function public._theme_prefs_touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists theme_prefs_touch_updated on theme_preferences;
create trigger theme_prefs_touch_updated
before update on theme_preferences
for each row execute function public._theme_prefs_touch_updated();

alter table theme_preferences enable row level security;

-- SELECT: 組織メンバー全員が見える
drop policy if exists "org member reads preferences" on theme_preferences;
create policy "org member reads preferences" on theme_preferences
  for select using (public.is_org_member(organization_id));

-- INSERT: 自分自身のみ (user_id = auth.uid())
drop policy if exists "self writes preferences" on theme_preferences;
create policy "self writes preferences" on theme_preferences
  for insert with check (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
    and exists (
      select 1 from themes t
      where t.id = theme_id and t.organization_id = organization_id
    )
  );

-- UPDATE: 自分自身のみ
drop policy if exists "self updates preferences" on theme_preferences;
create policy "self updates preferences" on theme_preferences
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE: 自分自身のみ
drop policy if exists "self deletes preferences" on theme_preferences;
create policy "self deletes preferences" on theme_preferences
  for delete using (user_id = auth.uid());

-- Realtime
do $$ begin
  begin alter publication supabase_realtime add table theme_preferences; exception when others then null; end;
end $$;

comment on table theme_preferences is
  '個人によるテーマ事前意識調査。第1〜第5希望を組織内テーマから登録する。';
