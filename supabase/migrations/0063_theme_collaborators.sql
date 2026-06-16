-- ============================================================
-- NEO PM — テーマの共同編集者 / 閲覧者 (theme_collaborators)
-- ============================================================
-- これまでテーマは出題者本人と組織管理者しか編集できなかった。
-- 同じ組織のメンバーを「共同編集者 (editor)」または「閲覧者 (viewer)」
-- として個別のテーマに紐付けられるようにする。
--
-- 設計:
--   - theme_collaborators (theme_id, user_id, role) で N:M
--   - role: editor (編集可) / viewer (閲覧のみ)
--   - 1人につき 1 テーマ 1 ロール (unique)
--   - 追加/削除は「テーマの出題者本人」または「組織の owner/admin」
--   - editor は status ∈ {draft, submitted, changes_requested} のときだけ
--     UPDATE できる (公開後の編集は出題者本人 or 管理者の専権)
--   - viewer は SELECT のみ
-- ============================================================

create table if not exists public.theme_collaborators (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.themes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor','viewer')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (theme_id, user_id)
);

create index if not exists theme_collaborators_user_idx
  on public.theme_collaborators (user_id);
create index if not exists theme_collaborators_theme_idx
  on public.theme_collaborators (theme_id);

alter table public.theme_collaborators enable row level security;

-- ── ヘルパ: current user は対象テーマで対象ロールの collaborator か?
--    SECURITY DEFINER で RLS 再帰を避ける。
create or replace function public.is_theme_collaborator(
  target_theme uuid,
  target_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from theme_collaborators
    where theme_id = target_theme
      and user_id = auth.uid()
      and role = any (target_roles)
  );
$$;

comment on function public.is_theme_collaborator(uuid, text[]) is
  '対象テーマで current user が target_roles のいずれかの collaborator かを SECURITY DEFINER で判定。RLS 再帰を回避する。';

-- ── theme_collaborators RLS ─────────────────────────────────────

-- SELECT: collaborator 本人 / テーマの出題者 / 組織管理者 が見える
drop policy if exists "theme_collaborators read" on public.theme_collaborators;
create policy "theme_collaborators read" on public.theme_collaborators
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.themes t
      where t.id = theme_collaborators.theme_id
        and (
          t.posted_by = auth.uid()
          or public.is_org_admin(t.organization_id)
        )
    )
  );

-- INSERT/UPDATE/DELETE: テーマの出題者 or 組織管理者
drop policy if exists "theme_collaborators manage" on public.theme_collaborators;
create policy "theme_collaborators manage" on public.theme_collaborators
  for all using (
    exists (
      select 1 from public.themes t
      where t.id = theme_collaborators.theme_id
        and (
          t.posted_by = auth.uid()
          or public.is_org_admin(t.organization_id)
        )
    )
  ) with check (
    exists (
      select 1 from public.themes t
      where t.id = theme_collaborators.theme_id
        and (
          t.posted_by = auth.uid()
          or public.is_org_admin(t.organization_id)
        )
    )
  );

-- ── themes RLS の拡張 (collaborator) ─────────────────────────

-- collaborator (editor/viewer) はテーマを SELECT できる
drop policy if exists "themes collaborator reads" on public.themes;
create policy "themes collaborator reads" on public.themes
  for select using (
    public.is_theme_collaborator(id, array['editor','viewer'])
  );

-- editor collaborator は draft/submitted/changes_requested の状態で UPDATE できる
-- (公開後の編集は出題者本人 or 管理者のみ — 0045 / 0062 を踏襲)
drop policy if exists "themes editor collaborator updates" on public.themes;
create policy "themes editor collaborator updates" on public.themes
  for update
  using (
    public.is_theme_collaborator(id, array['editor'])
    and status in ('draft','submitted','changes_requested')
  )
  with check (
    public.is_theme_collaborator(id, array['editor'])
    and status in ('draft','submitted','changes_requested')
  );
