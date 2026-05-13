-- ============================================================
-- NEO PM v2 — Quests + admin dashboard support (additive)
-- ============================================================
-- 「今週のクエスト」をハードコードから DB 駆動に変更し、組織
-- admin / owner が編集できるようにする。

-- ── quests テーブル ─────────────────────────────
create table if not exists quests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  project_id      uuid references projects on delete cascade,  -- null = 組織共通
  title           text not null,
  description     text,
  emoji           text default '🎯',
  starts_at       date not null default current_date,
  ends_at         date not null,
  status          text not null default 'active'
                  check (status in ('active','paused','archived')),
  created_by      uuid references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists quests_org_idx
  on quests (organization_id, status, ends_at desc);
create index if not exists quests_project_idx
  on quests (project_id);

alter table quests enable row level security;

-- 読み取り: 組織メンバーは見られる
drop policy if exists "org reads quests" on quests;
create policy "org reads quests" on quests
  for select using (public.is_org_member(organization_id));

-- 書き込み: owner / admin のみ
drop policy if exists "org admins write quests" on quests;
create policy "org admins write quests" on quests
  for all using (
    exists (
      select 1 from memberships m
      where m.organization_id = quests.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from memberships m
      where m.organization_id = quests.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- ── quest_items テーブル ────────────────────────
create table if not exists quest_items (
  id            uuid primary key default gen_random_uuid(),
  quest_id      uuid not null references quests on delete cascade,
  label         text not null,
  position      int  not null default 0,
  target_count  int  not null default 1,
  done_count    int  not null default 0,
  auto_target   text check (auto_target in (
                  'manual',
                  'tasks_done',
                  'plan_filled',
                  'diag_filled',
                  'meetings_held'
                )) default 'manual',
  created_at    timestamptz not null default now()
);

create index if not exists quest_items_quest_idx
  on quest_items (quest_id, position);

alter table quest_items enable row level security;

drop policy if exists "org reads quest_items" on quest_items;
create policy "org reads quest_items" on quest_items
  for select using (
    exists (
      select 1 from quests q
      where q.id = quest_items.quest_id
        and public.is_org_member(q.organization_id)
    )
  );

drop policy if exists "org admins write quest_items" on quest_items;
create policy "org admins write quest_items" on quest_items
  for all using (
    exists (
      select 1 from quests q
      join memberships m on m.organization_id = q.organization_id
      where q.id = quest_items.quest_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from quests q
      join memberships m on m.organization_id = q.organization_id
      where q.id = quest_items.quest_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- ── Realtime ────────────────────────────────────
do $$ begin
  begin alter publication supabase_realtime add table quests;       exception when others then null; end;
  begin alter publication supabase_realtime add table quest_items;  exception when others then null; end;
end $$;

-- ── 既存組織にデフォルトクエスト1件を seed ──────────
-- 既にクエストがある組織はスキップ
insert into quests (organization_id, title, emoji, starts_at, ends_at, status)
select o.id,
       '今週のクエスト',
       '🎯',
       date_trunc('week', current_date)::date,
       (date_trunc('week', current_date) + interval '6 days')::date,
       'active'
  from organizations o
 where not exists (
   select 1 from quests q
   where q.organization_id = o.id
     and q.project_id is null
     and q.status = 'active'
 );

-- そのクエストに 3 つの初期アイテムを seed
insert into quest_items (quest_id, label, position, target_count)
select q.id, x.label, x.pos, 1
  from quests q
  cross join (
    values
      ('実行計画の Why を磨き直す', 0),
      ('WBS から完了タスクを 3 件', 1),
      ('診断レポートを記入', 2)
  ) as x(label, pos)
 where q.title = '今週のクエスト'
   and q.project_id is null
   and not exists (
     select 1 from quest_items qi where qi.quest_id = q.id
   );
