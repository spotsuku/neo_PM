-- ============================================================
-- NEO PM — プロジェクト新規作成を「管理者 / テーマオーナー」のみに制限
-- ============================================================
-- これまで INSERT は「組織メンバーなら誰でも」可能だった (is_org_member)。
-- 一般メンバーが勝手にプロジェクトを作れてしまうため、
-- owner / admin / theme_owner だけが作成できるように変更する。
-- (UPDATE / SELECT / DELETE は従来どおり)

drop policy if exists "org members insert projects" on projects;
drop policy if exists "org admins/theme owners insert projects" on projects;

create policy "org admins/theme owners insert projects" on projects
  for insert with check (
    exists (
      select 1 from memberships m
      where m.organization_id = projects.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin', 'theme_owner')
    )
  );
