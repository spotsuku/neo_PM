-- ============================================================
-- NEO PM v2 — Badges + Badge Awards (additive)
-- ============================================================
-- 組織レベルでバッジを定義し、各プロジェクトに付与できる仕組み。
-- これまでハードコード+空表示だったダッシュボードの「バッジコレ
-- クション」を本物のデータで動かす。

-- ── badges (定義) ───────────────────────────────────
create table if not exists badges (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  title           text not null,
  emoji           text default '🏅',
  color           text default '#5b8def',
  description     text,
  criteria_text   text,
  position        int  not null default 0,
  created_by      uuid references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists badges_org_idx on badges (organization_id, position);

alter table badges enable row level security;

drop policy if exists "org reads badges" on badges;
create policy "org reads badges" on badges
  for select using (public.is_org_member(organization_id));

drop policy if exists "org admins write badges" on badges;
create policy "org admins write badges" on badges
  for all using (
    exists (
      select 1 from memberships m
      where m.organization_id = badges.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from memberships m
      where m.organization_id = badges.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- ── badge_awards (プロジェクトへの付与) ────────────────
create table if not exists badge_awards (
  id           uuid primary key default gen_random_uuid(),
  badge_id     uuid not null references badges on delete cascade,
  project_id   uuid not null references projects on delete cascade,
  awarded_by   uuid references auth.users on delete set null,
  awarded_at   timestamptz not null default now(),
  note         text,
  unique(badge_id, project_id)
);

create index if not exists badge_awards_project_idx on badge_awards (project_id);
create index if not exists badge_awards_badge_idx   on badge_awards (badge_id);

alter table badge_awards enable row level security;

-- 読み取り: 該当バッジの組織メンバー全員
drop policy if exists "org reads badge_awards" on badge_awards;
create policy "org reads badge_awards" on badge_awards
  for select using (
    exists (
      select 1 from badges b
      where b.id = badge_awards.badge_id
        and public.is_org_member(b.organization_id)
    )
  );

-- 書き込み: 組織 owner / admin のみ
drop policy if exists "org admins write badge_awards" on badge_awards;
create policy "org admins write badge_awards" on badge_awards
  for all using (
    exists (
      select 1 from badges b
      join memberships m on m.organization_id = b.organization_id
      where b.id = badge_awards.badge_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from badges b
      join memberships m on m.organization_id = b.organization_id
      where b.id = badge_awards.badge_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- ── Realtime ────────────────────────────────────────
do $$ begin
  begin alter publication supabase_realtime add table badges;       exception when others then null; end;
  begin alter publication supabase_realtime add table badge_awards; exception when others then null; end;
end $$;

-- ── 既存組織にデフォルトバッジを seed ────────────────
insert into badges (organization_id, title, emoji, color, criteria_text, description, position)
select o.id, x.title, x.emoji, x.color, x.criteria, x.description, x.pos
  from organizations o
  cross join (
    values
      ('現場主義',     '🏞', '#5b8def', '実際に現場へ足を運び、当事者と直接接点を持っている',
       'プロジェクトを現場ベースで進めているチームに付与',                       0),
      ('共創力',       '🤝', '#2e5cbf', '他者の力を借り、共に成果を生んでいる',
       '組織外の協力者を巻き込んでプロジェクトを推進しているチームに付与',       1),
      ('初期売上達成', '💴', '#0a8754', '初めての対価が発生',
       'プロジェクトを通じて初の収入が発生したチームに付与',                     2),
      ('MVP 伴走',     '✦',  '#0a0a0a', '今期もっとも貢献',
       '伴走者として組織全体に最も貢献したチームに付与（年に1回）',              3)
  ) as x(title, emoji, color, criteria, description, pos)
 where not exists (
   select 1 from badges b where b.organization_id = o.id
 );
