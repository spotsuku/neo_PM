-- ============================================================
-- NEO PM — 資金調達 (資本政策 / 株主名簿) ※課金機能・既定OFF
-- ============================================================
-- 組織フラグ fundraising_enabled で有効化する追加(課金)機能。
-- プロジェクト単位で資本政策(Cap-table)と株主名簿を管理する。
-- データはスプレッドシート的な柔軟構造のため JSONB 1ドキュメント/プロジェクト。
--   data = { "rounds": [...], "shareholders": [...] }
-- 計算(シェア/時価総額/SO比率 等)はクライアントで導出し、入力値のみ保存する。

alter table public.organizations
  add column if not exists fundraising_enabled boolean not null default false;

create table if not exists public.cap_tables (
  project_id uuid primary key references public.projects on delete cascade,
  data       jsonb not null default '{"rounds":[],"shareholders":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.cap_tables enable row level security;

-- 財務情報のため、プロジェクトにアクセス可能なメンバー(=プロジェクトメンバー
-- または組織 owner/admin)のみ読み書き可。can_access_project は 0005 で定義。
drop policy if exists "cap_tables access" on public.cap_tables;
create policy "cap_tables access" on public.cap_tables
  for all using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));
