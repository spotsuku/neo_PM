-- ============================================================
-- NEO PM — 項目単位レビュー (Phase 2)
-- ============================================================
-- 審査画面で「各項目に承認/差し戻し + コメント」を保存する。
-- まずプロジェクト公開審査で使う (target_type='project')。
-- 将来テーマ審査にも使えるよう target_type を持つ汎用テーブルにする。

create table if not exists public.review_decisions (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('project', 'theme')),
  target_id   uuid not null,
  item_key    text not null,
  decision    text not null check (decision in ('approved', 'changes_requested')),
  comment     text,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (target_type, target_id, item_key)
);

create index if not exists review_decisions_target_idx
  on public.review_decisions (target_type, target_id);

alter table public.review_decisions enable row level security;

-- 対象 (project/theme) の所属組織を返すヘルパー
create or replace function public.review_target_org(p_type text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_type = 'project' then public.project_org(p_id)
    when p_type = 'theme'   then (select organization_id from public.themes where id = p_id)
    else null
  end;
$$;

-- SELECT: 組織管理者 / (project の場合) 参加者も見られる (差し戻しコメントの確認用)
drop policy if exists "review_decisions select" on public.review_decisions;
create policy "review_decisions select" on public.review_decisions
  for select using (
    public.is_org_admin(public.review_target_org(target_type, target_id))
    or (target_type = 'project' and public.can_access_project(target_id))
  );

-- 書き込み (承認/差し戻しの保存) は組織管理者のみ
drop policy if exists "review_decisions write" on public.review_decisions;
create policy "review_decisions write" on public.review_decisions
  for all using (
    public.is_org_admin(public.review_target_org(target_type, target_id))
  )
  with check (
    public.is_org_admin(public.review_target_org(target_type, target_id))
  );
