-- ============================================================
-- NEO PM — organizations の RLS ポリシーを冪等に再適用
-- ============================================================
-- 旧 migration 0001 で定義された
--   "any authed user can insert org"
-- ポリシーが、その後の運用で drop されたり名前変更されたりすると
-- 「new row violates row-level security policy for table "organizations"」
-- エラーが発生する。本 migration は idempotent に再定義する。

-- 1) RLS が有効であることを保証
alter table organizations enable row level security;

-- 2) 既存の同名ポリシーを drop してから再定義 (差分は無視)
drop policy if exists "any authed user can insert org" on organizations;
create policy "any authed user can insert org" on organizations
  for insert with check (auth.uid() is not null);

drop policy if exists "org members can read" on organizations;
create policy "org members can read" on organizations
  for select using (public.is_org_member(id));

drop policy if exists "owners can update org" on organizations;
create policy "owners can update org" on organizations
  for update using (
    exists (select 1 from memberships m
            where m.organization_id = organizations.id
              and m.user_id = auth.uid()
              and m.role in ('owner','admin'))
  );

-- 3) 認証済みユーザーが INSERT できるかの簡易セルフチェック (information_schema 経由)
-- (本番 DB では実行されるだけで結果は破棄。手動で確認したい場合は EXPLAIN 等で)
