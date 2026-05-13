-- ============================================================
-- NEO PM v2 — Meetings + Action Items (additive)
-- ============================================================
-- 会議スケジュール / 議事録 / アクションアイテム機能。Phase A-C 用。
-- 既存の v2 スキーマに追加可能。破壊的変更なし。

-- ── meetings ─────────────────────────────────────────────
create table if not exists meetings (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects on delete cascade,
  title         text not null,
  scheduled_at  timestamptz,
  duration_min  int  not null default 60,
  location      text,
  status        text not null default 'scheduled'
                check (status in ('scheduled','in_progress','finished','cancelled')),
  agenda        text,
  minutes       text,
  decisions     text,
  notion_url    text,
  created_by    uuid references auth.users on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists meetings_project_idx
  on meetings (project_id, scheduled_at desc);

alter table meetings enable row level security;

drop policy if exists "org reads meetings" on meetings;
drop policy if exists "org writes meetings" on meetings;
create policy "org reads meetings" on meetings
  for select using (
    exists (
      select 1 from projects p
      where p.id = meetings.project_id
        and public.is_org_member(p.organization_id)
    )
  );
create policy "org writes meetings" on meetings
  for all using (
    exists (
      select 1 from projects p
      where p.id = meetings.project_id
        and public.is_org_member(p.organization_id)
    )
  ) with check (
    exists (
      select 1 from projects p
      where p.id = meetings.project_id
        and public.is_org_member(p.organization_id)
    )
  );

-- ── meeting_participants ─────────────────────────────────
create table if not exists meeting_participants (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references meetings on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  attended     boolean not null default false,
  created_at   timestamptz not null default now(),
  unique(meeting_id, user_id)
);
create index if not exists meeting_participants_meeting_idx
  on meeting_participants (meeting_id);

alter table meeting_participants enable row level security;

drop policy if exists "org reads meeting_participants" on meeting_participants;
drop policy if exists "org writes meeting_participants" on meeting_participants;
create policy "org reads meeting_participants" on meeting_participants
  for select using (
    exists (
      select 1 from meetings m
      join projects p on p.id = m.project_id
      where m.id = meeting_participants.meeting_id
        and public.is_org_member(p.organization_id)
    )
  );
create policy "org writes meeting_participants" on meeting_participants
  for all using (
    exists (
      select 1 from meetings m
      join projects p on p.id = m.project_id
      where m.id = meeting_participants.meeting_id
        and public.is_org_member(p.organization_id)
    )
  ) with check (
    exists (
      select 1 from meetings m
      join projects p on p.id = m.project_id
      where m.id = meeting_participants.meeting_id
        and public.is_org_member(p.organization_id)
    )
  );

-- ── action_items ─────────────────────────────────────────
-- 会議由来でなくても作れるよう meeting_id は nullable
create table if not exists action_items (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects on delete cascade,
  meeting_id        uuid references meetings on delete set null,
  title             text not null,
  detail            text,
  assignee_user_id  uuid references auth.users on delete set null,
  assignee_name     text,
  due_date          date,
  status            text not null default 'open'
                    check (status in ('open','in_progress','done','cancelled')),
  source            text not null default 'manual'
                    check (source in ('manual','ai_extracted','imported')),
  source_task_id    uuid references tasks on delete set null,
  created_by        uuid references auth.users on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists action_items_project_idx
  on action_items (project_id, status);
create index if not exists action_items_meeting_idx
  on action_items (meeting_id);

alter table action_items enable row level security;

drop policy if exists "org reads action_items" on action_items;
drop policy if exists "org writes action_items" on action_items;
create policy "org reads action_items" on action_items
  for select using (
    exists (
      select 1 from projects p
      where p.id = action_items.project_id
        and public.is_org_member(p.organization_id)
    )
  );
create policy "org writes action_items" on action_items
  for all using (
    exists (
      select 1 from projects p
      where p.id = action_items.project_id
        and public.is_org_member(p.organization_id)
    )
  ) with check (
    exists (
      select 1 from projects p
      where p.id = action_items.project_id
        and public.is_org_member(p.organization_id)
    )
  );

-- ── Realtime publication (任意) ───────────────────────────
do $$ begin
  begin alter publication supabase_realtime add table meetings;             exception when others then null; end;
  begin alter publication supabase_realtime add table meeting_participants; exception when others then null; end;
  begin alter publication supabase_realtime add table action_items;         exception when others then null; end;
end $$;
