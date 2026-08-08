-- ============================================================
-- NEO PM — memberships UPDATE ポリシーを再発行 (owner ⊇ admin 保証)
-- ============================================================
-- staging で owner ロールのユーザーが他メンバーの role を変更できない
-- 事象の報告があった。0036 で owner/admin の両方を許可する形にしたが、
-- 何らかの理由で staging の policy が古い (admin のみ) 状態になっている
-- 可能性があるため、ここで明示的に drop & create し直す。
--
-- 仕様 (0036 の意図を維持):
--   - 自分の membership は自分で update 可 (affiliation / title 用)
--   - owner / admin は同 org の他メンバーの membership を update 可
--     ただし対象が owner の場合は不可 (owner 降格は別フロー想定)
--
-- 念のため使用前ヘルパ public.is_org_role(target_org, roles[]) も追加。
-- 直接 subquery (memberships m2 ...) は SELECT RLS の再帰を踏むため、
-- SECURITY DEFINER 関数経由でチェックする方が安全。
-- ============================================================

create or replace function public.is_org_role(target_org uuid, target_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where organization_id = target_org
      and user_id = auth.uid()
      and role = any (target_roles)
  );
$$;

comment on function public.is_org_role(uuid, text[]) is
  '対象 org における current user のロールが target_roles のいずれかに一致するかを SECURITY DEFINER で判定。RLS 再帰を回避する。';

-- 既存 UPDATE policy をすべて剥がして再発行
drop policy if exists "user updates own membership" on memberships;
drop policy if exists "admins update others memberships" on memberships;

-- (a) 自分の membership は自分で update 可
create policy "user updates own membership" on memberships
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- (b) owner / admin は同 org の他メンバーを update 可 (対象が owner は不可)
create policy "owner or admin updates others memberships" on memberships
  for update
  using (
    user_id <> auth.uid()
    and role <> 'owner'
    and public.is_org_role(memberships.organization_id, array['owner','admin'])
  )
  with check (
    user_id <> auth.uid()
    and public.is_org_role(memberships.organization_id, array['owner','admin'])
  );
