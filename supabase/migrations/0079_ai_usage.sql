-- ============================================================
-- 0079_ai_usage.sql
-- AI (Anthropic) の呼び出しごとに費用を記録する。
-- 各プロジェクト月 ¥1000 の上限を設けて超過をブロックする。
-- ============================================================

create table if not exists ai_usage (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects on delete cascade,
  organization_id  uuid not null references organizations on delete cascade,
  user_id          uuid references auth.users on delete set null,
  endpoint         text not null,      -- 'chat' / 'draft-plan' / 'score-theme' / ...
  model            text not null,      -- 'claude-haiku-4-5-20251001' 等
  input_tokens     int  not null default 0,
  output_tokens    int  not null default 0,
  cost_yen         numeric(10,3) not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists ai_usage_project_time_idx
  on ai_usage (project_id, created_at desc);
create index if not exists ai_usage_org_time_idx
  on ai_usage (organization_id, created_at desc);

alter table ai_usage enable row level security;

-- SELECT: 組織メンバー全員が自組織の使用量を確認可
drop policy if exists "org member reads ai_usage" on ai_usage;
create policy "org member reads ai_usage" on ai_usage
  for select using (public.is_org_member(organization_id));

-- INSERT / UPDATE / DELETE: service-role のみ (Route Handler 経由で計上)
-- (RLS は enable してあるが、通常のクライアントからは INSERT できない = policy 無し)

comment on table ai_usage is
  'AI API 呼び出しの費用記録。project 単位で月次集計 → 上限管理に使う。';
