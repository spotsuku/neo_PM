-- ============================================================
-- NEO PM — Recurring meeting setup table + retrospective seed
-- ============================================================
-- 1) meeting_recurrences: 「毎週水 10:00」「隔週」「毎月」などの定例ルールを 1 行で保持
-- 2) meetings.recurrence_id を追加し、ルールから派生した会議が紐付けられるように
-- 3) シニアタッチ (is_demo) に 1 件の定例ルール + メンバー全員の振り返り (diagnosis_entries) を seed

-- ── 1. meeting_recurrences ─────────────────────────────────
create table if not exists meeting_recurrences (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects on delete cascade,
  title           text not null,
  interval        text not null
                  check (interval in ('weekly', 'biweekly', 'monthly')),
  day_of_week     int  check (day_of_week is null or (day_of_week between 0 and 6)),
  day_of_month    int  check (day_of_month is null or (day_of_month between 1 and 31)),
  start_time      time not null,
  duration_min    int  not null default 60,
  location        text,
  agenda_template text,
  starts_on       date not null default current_date,
  ends_on         date,
  active          boolean not null default true,
  created_by      uuid references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists meeting_recurrences_project_idx
  on meeting_recurrences (project_id, active);

-- ── 2. meetings.recurrence_id (occurrence link) ─────────────
alter table meetings
  add column if not exists recurrence_id uuid
    references meeting_recurrences on delete set null,
  add column if not exists occurrence_date date;
create index if not exists meetings_recurrence_idx
  on meetings (recurrence_id, occurrence_date);

-- ── 3. RLS ─────────────────────────────────────────────────
alter table meeting_recurrences enable row level security;

drop policy if exists "org reads meeting_recurrences" on meeting_recurrences;
drop policy if exists "org writes meeting_recurrences" on meeting_recurrences;
create policy "org reads meeting_recurrences" on meeting_recurrences
  for select using (
    exists (
      select 1 from projects p
      where p.id = meeting_recurrences.project_id
        and public.is_org_member(p.organization_id)
    )
  );
create policy "org writes meeting_recurrences" on meeting_recurrences
  for all using (
    exists (
      select 1 from projects p
      where p.id = meeting_recurrences.project_id
        and public.is_org_member(p.organization_id)
    )
  ) with check (
    exists (
      select 1 from projects p
      where p.id = meeting_recurrences.project_id
        and public.is_org_member(p.organization_id)
    )
  );

do $$ begin
  begin alter publication supabase_realtime add table meeting_recurrences;
    exception when others then null;
  end;
end $$;

-- ── 4. シニアタッチに定例ルール seed (毎週水 10:00) ─────────
insert into meeting_recurrences (
  project_id, title, interval, day_of_week, start_time, duration_min,
  location, agenda_template, starts_on, active
)
select p.id, '週次 定例 MTG', 'weekly', 3, '10:00:00'::time, 60,
       'Zoom',
       E'- 進捗共有\n- 課題の棚卸し\n- 来週の優先タスク',
       (current_date - interval '12 days')::date, true
from projects p
where p.is_demo = true
  and not exists (
    select 1 from meeting_recurrences mr
    where mr.project_id = p.id and mr.title = '週次 定例 MTG'
  );

-- ── 5. シニアタッチのメンバー全員に振り返り (diagnosis_entries) seed ──
-- 14 項目の team eval scores の参考値 (全部 2.5 / 3 を埋める)
insert into diagnosis_entries (
  project_id, user_id, entry_date, scores, total_comment
)
select pm.project_id, pm.user_id, current_date,
       '{
         "vision": 3, "share": 2.5, "leader": 2.5, "decision": 2,
         "comm": 3, "trust": 3, "feedback": 2, "growth": 2.5,
         "speed": 2, "outcome": 2, "user": 3, "iter": 2.5,
         "habit": 2, "joy": 3
       }'::jsonb,
       'チームでまず Why を握り、現場入りでリアルな課題を持ち帰れているのが強み。スピードと iteration はもう一段磨ける。'
from project_memberships pm
join projects p on p.id = pm.project_id
where p.is_demo = true
  and not exists (
    select 1 from diagnosis_entries de
    where de.project_id = pm.project_id
      and de.user_id = pm.user_id
  );
