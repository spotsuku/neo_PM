-- ============================================================
-- 0036_memberships_update_policies.sql
-- memberships テーブルに UPDATE の RLS ポリシーを追加。
--
-- 既存の RLS は SELECT / INSERT / DELETE のみ定義されており、UPDATE は
-- どのポリシーにもマッチしないため Postgres が "0 行更新" で silent fail
-- していた。これが PR #136 の役割変更 (changeRole) と /me の所属・肩書き
-- 編集が DB に反映されない真因。
--
--   - 自分の memberships は自分で更新可 (affiliation / title 用途。
--     UI では自分自身の role は select に出さないため自己昇格は不可)
--   - 同 org の owner/admin は他メンバーの memberships を更新可
--     (対象が owner の場合は変更不可 — owner の降格は別経路で)
-- ============================================================

-- 自分の membership を自分で更新 (affiliation / title 編集用途)
drop policy if exists "user updates own membership" on memberships;
create policy "user updates own membership" on memberships
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- owner / admin が同 org の他メンバー (owner 以外) を更新
drop policy if exists "admins update others memberships" on memberships;
create policy "admins update others memberships" on memberships
  for update
  using (
    user_id <> auth.uid()
    and role <> 'owner'
    and exists (
      select 1 from memberships m2
      where m2.organization_id = memberships.organization_id
        and m2.user_id = auth.uid()
        and m2.role in ('owner', 'admin')
    )
  )
  with check (
    user_id <> auth.uid()
    and exists (
      select 1 from memberships m2
      where m2.organization_id = memberships.organization_id
        and m2.user_id = auth.uid()
        and m2.role in ('owner', 'admin')
    )
  );
