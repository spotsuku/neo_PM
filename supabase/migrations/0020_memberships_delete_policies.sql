-- ============================================================
-- 0020_memberships_delete_policies.sql
-- メンバーシップの削除 (脱退 / 強制退会) を可能にする RLS を追加。
--   - 自分の memberships は自分で DELETE 可 (ただし owner は組織を消す前に
--     譲渡が必要なので除外)
--   - 同 org の owner/admin は他人の memberships を DELETE 可 (owner は除く)
-- ============================================================

-- 自分の non-owner membership を自分で削除 (退会)
drop policy if exists "user deletes own non-owner membership" on memberships;
create policy "user deletes own non-owner membership" on memberships
  for delete using (
    user_id = auth.uid() and role <> 'owner'
  );

-- owner / admin は同 org の other メンバーを削除 (ただし owner は除外)
drop policy if exists "admins remove others memberships" on memberships;
create policy "admins remove others memberships" on memberships
  for delete using (
    user_id <> auth.uid()
    and role <> 'owner'
    and exists (
      select 1 from memberships m2
      where m2.organization_id = memberships.organization_id
        and m2.user_id = auth.uid()
        and m2.role in ('owner', 'admin')
    )
  );
