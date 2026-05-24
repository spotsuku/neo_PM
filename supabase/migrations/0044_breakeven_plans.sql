-- ============================================================
-- NEO PM — 黒字化モデル (フェーズ別・月次積み上げ) ※収支タブ内
-- ============================================================
-- 各プロジェクトの「最小単位の黒字化モデル」をフェーズ(=各ラウンドの事業計画)
-- 単位で持つ。単価×数量(月次成長)−変動費−固定費 を月ごとに積み上げ、黒字化月を
-- 自動算出する。スプレッドシート的な柔軟構造のため JSONB 1ドキュメント/プロジェクト。
--   data = { "phases": [...], "revenues": [...], "fixed": [...] }

create table if not exists public.breakeven_plans (
  project_id uuid primary key references public.projects on delete cascade,
  data       jsonb not null default '{"phases":[],"revenues":[],"fixed":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.breakeven_plans enable row level security;

drop policy if exists "breakeven access" on public.breakeven_plans;
create policy "breakeven access" on public.breakeven_plans
  for all using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));
