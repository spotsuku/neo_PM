-- ============================================================
-- NEO PM v2 — Theme Applications (additive)
-- ============================================================
-- テーマ応募フロー:
--   1. テーマ出題者 (organization) がテーマを作成・公開
--   2. 応募者 (組織メンバー、誰でも) が応募ページから内容を見て応募
--   3. 下書き → 応募 → 審査 → 合否
--   4. 合格時に projects テーブルへ新規プロジェクトとして組成
--
-- themes.thumbnail_url を追加。応募ページのカード表示で使う。

-- ── themes に画像 + ロング説明 ──────────────────────
alter table themes
  add column if not exists thumbnail_url   text,
  add column if not exists description_long text;

-- ── theme_applications ────────────────────────────────
create table if not exists theme_applications (
  id                   uuid primary key default gen_random_uuid(),
  theme_id             uuid not null references themes on delete cascade,
  applicant_user_id    uuid not null references auth.users on delete cascade,
  applicant_org_id     uuid references organizations on delete set null,
  team_name            text not null default '',
  proposal             text,
  members              text,
  status               text not null default 'draft'
                       check (status in (
                         'draft','submitted','under_review',
                         'approved','rejected','withdrawn'
                       )),
  submitted_at         timestamptz,
  decided_at           timestamptz,
  decided_by           uuid references auth.users on delete set null,
  decision_note        text,
  created_project_id   uuid references projects on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists theme_apps_theme_idx
  on theme_applications (theme_id, status);
create index if not exists theme_apps_user_idx
  on theme_applications (applicant_user_id);
create index if not exists theme_apps_project_idx
  on theme_applications (created_project_id);

alter table theme_applications enable row level security;

-- ── RLS ─────────────────────────────────────────────
-- 応募者本人は自分の応募を読み書き可
drop policy if exists "applicant reads own application" on theme_applications;
create policy "applicant reads own application" on theme_applications
  for select using (applicant_user_id = auth.uid());

drop policy if exists "applicant writes own application" on theme_applications;
create policy "applicant writes own application" on theme_applications
  for insert with check (applicant_user_id = auth.uid());

drop policy if exists "applicant updates own application" on theme_applications;
create policy "applicant updates own application" on theme_applications
  for update using (applicant_user_id = auth.uid())
  with check (applicant_user_id = auth.uid());

drop policy if exists "applicant deletes own draft" on theme_applications;
create policy "applicant deletes own draft" on theme_applications
  for delete using (
    applicant_user_id = auth.uid()
    and status in ('draft','withdrawn')
  );

-- テーマを所有する組織のメンバーは応募一覧を読める
drop policy if exists "theme org reads applications" on theme_applications;
create policy "theme org reads applications" on theme_applications
  for select using (
    status <> 'draft' and exists (
      select 1 from themes t
      where t.id = theme_applications.theme_id
        and public.is_org_member(t.organization_id)
    )
  );

-- テーマ所有組織の owner / admin は審査として update 可
drop policy if exists "theme org admins update applications" on theme_applications;
create policy "theme org admins update applications" on theme_applications
  for update using (
    exists (
      select 1 from themes t
      join memberships m on m.organization_id = t.organization_id
      where t.id = theme_applications.theme_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from themes t
      join memberships m on m.organization_id = t.organization_id
      where t.id = theme_applications.theme_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- ── Realtime ────────────────────────────────────────
do $$ begin
  begin alter publication supabase_realtime add table theme_applications; exception when others then null; end;
end $$;
