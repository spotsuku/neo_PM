-- ============================================================
-- NEO PM — theme_collaborators の RLS を SECURITY DEFINER ヘルパに置き換え
-- ============================================================
-- 0063 で `for all using (exists (select 1 from themes t ...))` の形で
-- 書いたが、INSERT 時に
--   ERROR: new row violates row-level security policy for table "theme_collaborators"
-- が出る報告。EXISTS サブクエリの RLS 連鎖や FOR ALL の WITH CHECK 評価
-- 周りで暗黙の不整合があるため、判定を SECURITY DEFINER のヘルパー関数
-- public.can_manage_theme(theme_id) に閉じ込めて、policy を SELECT / INSERT /
-- UPDATE / DELETE に分けて定義し直す。
-- ============================================================

create or replace function public.can_manage_theme(target_theme uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from themes t
    where t.id = target_theme
      and (
        t.posted_by = auth.uid()
        or exists (
          select 1 from memberships m
          where m.organization_id = t.organization_id
            and m.user_id = auth.uid()
            and m.role in ('owner','admin')
        )
      )
  );
$$;

comment on function public.can_manage_theme(uuid) is
  '対象テーマの出題者本人または組織の owner/admin かを SECURITY DEFINER で判定。theme_collaborators の管理ポリシーで参照する。';

-- ── 旧 policy を全部剥がす ──────────────────────────
drop policy if exists "theme_collaborators read"   on public.theme_collaborators;
drop policy if exists "theme_collaborators manage" on public.theme_collaborators;
-- 念のため: 0063 で作った可能性のある他の名前も
drop policy if exists "theme_collaborators select" on public.theme_collaborators;
drop policy if exists "theme_collaborators insert" on public.theme_collaborators;
drop policy if exists "theme_collaborators update" on public.theme_collaborators;
drop policy if exists "theme_collaborators delete" on public.theme_collaborators;

-- ── 個別に再定義 ────────────────────────────────────

-- SELECT: 本人 (user_id=auth.uid) / 出題者 / 組織管理者
create policy "theme_collaborators select" on public.theme_collaborators
  for select using (
    user_id = auth.uid()
    or public.can_manage_theme(theme_id)
  );

-- INSERT: 出題者 or 組織管理者
create policy "theme_collaborators insert" on public.theme_collaborators
  for insert with check (
    public.can_manage_theme(theme_id)
  );

-- UPDATE: 同上
create policy "theme_collaborators update" on public.theme_collaborators
  for update
  using (public.can_manage_theme(theme_id))
  with check (public.can_manage_theme(theme_id));

-- DELETE: 同上
create policy "theme_collaborators delete" on public.theme_collaborators
  for delete using (public.can_manage_theme(theme_id));
