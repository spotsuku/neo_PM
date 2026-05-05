-- ============================================
-- NEO Project Management Dashboard - Schema
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Projects table
create table if not exists projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  idea_title text,
  summary text,
  goals_qualitative text,
  goals_quantitative text,
  purpose text,
  start_date date,
  end_date date,
  status text default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Team members
create table if not exists team_members (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  role text,
  role_category text check (role_category in ('必須', '任意')),
  email text,
  phone text,
  created_at timestamptz default now()
);

-- WBS Tasks
create table if not exists tasks (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  parent_id uuid references tasks(id) on delete cascade,
  category text,
  title text not null,
  assignee text,
  assistant text,
  status text default '未着手' check (status in ('未着手', '着手中', '完了', '遅延', 'キャンセル')),
  start_date date,
  end_date date,
  due_date date,
  priority text default '中' check (priority in ('高', '中', '低')),
  notes text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Schedule events
create table if not exists schedule_events (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  event_date date,
  start_time time,
  end_time time,
  target_participants text,
  attendance_required text check (attendance_required in ('必須', '任意')),
  purpose text,
  organizer text,
  participants text[],
  meeting_url text,
  is_self_organized boolean default false,
  created_at timestamptz default now()
);

-- Budget plan
create table if not exists budget_items (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  category text check (category in ('revenue', 'cogs', 'expense')),
  item_name text not null,
  amount_best numeric default 0,
  amount_good numeric default 0,
  amount_worst numeric default 0,
  fixed_or_variable text check (fixed_or_variable in ('固定費', '変動費')),
  sort_order int default 0,
  created_at timestamptz default now()
);

-- AI coaching conversations
create table if not exists coaching_sessions (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  session_type text check (session_type in ('wbs_review', 'risk_check', 'progress_coach', 'free_chat')),
  messages jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Meeting minutes
create table if not exists meeting_minutes (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references projects(id) on delete cascade,
  meeting_date date,
  agenda_items jsonb default '[]',
  created_at timestamptz default now()
);

-- RLS Policies
alter table projects enable row level security;
alter table team_members enable row level security;
alter table tasks enable row level security;
alter table schedule_events enable row level security;
alter table budget_items enable row level security;
alter table coaching_sessions enable row level security;
alter table meeting_minutes enable row level security;

-- Allow all for authenticated users (adjust as needed)
create policy "Allow all for authenticated" on projects for all using (true);
create policy "Allow all for authenticated" on team_members for all using (true);
create policy "Allow all for authenticated" on tasks for all using (true);
create policy "Allow all for authenticated" on schedule_events for all using (true);
create policy "Allow all for authenticated" on budget_items for all using (true);
create policy "Allow all for authenticated" on coaching_sessions for all using (true);
create policy "Allow all for authenticated" on meeting_minutes for all using (true);

-- Enable realtime
-- Note: execution_plan / team_info / rdi tables must already exist in your DB.
-- Run these alter statements once in the SQL editor to enable cross-tab live sync.
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table schedule_events;
alter publication supabase_realtime add table budget_items;
do $$ begin
  begin alter publication supabase_realtime add table execution_plan; exception when others then null; end;
  begin alter publication supabase_realtime add table team_info; exception when others then null; end;
  begin alter publication supabase_realtime add table rdi; exception when others then null; end;
end $$;

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at before update on tasks
  for each row execute function update_updated_at();
create trigger projects_updated_at before update on projects
  for each row execute function update_updated_at();
