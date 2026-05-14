-- ============================================================
-- NEO PM v2 — Theme Owner role (additive)
-- ============================================================
-- memberships.role に 'theme_owner' を追加。
-- テーマオーナーは:
--   - ランキングを見られる
--   - テーマ応募ページを見られる
--   - テーマ出題ページで自組織のテーマを作成・編集可
--   - テーマへの応募を審査して合否を出せる
-- ただし以下はアクセス不可:
--   - プロジェクトのダッシュ / WBS / 実行計画 / 収支 / 診断 / 基金 / AI
--   - 管理者ダッシュボード / バッジ管理 / クエスト管理
--   - 組織情報の編集 / メンバー招待

-- ── memberships.role の制約を拡張 ──────────────────
alter table memberships
  drop constraint if exists memberships_role_check;
alter table memberships
  add constraint memberships_role_check
    check (role in ('owner','admin','member','theme_owner'));

-- ── theme_applications の審査権限を theme_owner にも拡張 ──
drop policy if exists "theme org admins update applications" on theme_applications;
create policy "theme org admins update applications" on theme_applications
  for update using (
    exists (
      select 1 from themes t
      join memberships m on m.organization_id = t.organization_id
      where t.id = theme_applications.theme_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin','theme_owner')
    )
  ) with check (
    exists (
      select 1 from themes t
      join memberships m on m.organization_id = t.organization_id
      where t.id = theme_applications.theme_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin','theme_owner')
    )
  );

-- 既存 themes テーブルは「is_org_member なら誰でも write」なので
-- theme_owner も書ける (変更不要)

-- ── 招待の role check 制約にも theme_owner を許可 ────
alter table invitations
  drop constraint if exists invitations_role_check;
alter table invitations
  add constraint invitations_role_check
    check (role in ('admin','member','theme_owner'));
