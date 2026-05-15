-- ============================================================
-- 0022_projects_delete_policy.sql
-- プロジェクト削除を可能にする。
--   - DELETE は owner / admin のみに制限 (誤削除防止)
--   - 既存の "org writes projects" (for all) はそのまま残し、
--     より制限的な DELETE 専用ポリシーを追加するだけでは
--     PERMISSIVE は OR なので意味がない。よって "org writes" を
--     分解して insert/update は org member、delete は owner/admin に分ける。
--
-- 関連テーブル (execution_plans / tasks / chat_messages / proposals /
-- meetings / quests など) は projects への FK が ON DELETE CASCADE
-- なので projects を削除すれば自動的に消える。
-- ============================================================

drop policy if exists "org writes projects" on projects;

drop policy if exists "org members insert projects" on projects;
create policy "org members insert projects" on projects
  for insert with check (public.is_org_member(organization_id));

drop policy if exists "org members update projects" on projects;
create policy "org members update projects" on projects
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "org admins delete projects" on projects;
create policy "org admins delete projects" on projects
  for delete using (
    exists (
      select 1 from memberships m
      where m.organization_id = projects.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );
