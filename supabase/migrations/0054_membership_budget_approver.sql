-- ============================================================
-- NEO PM — プロジェクトに「予算決裁者」を持たせる
-- ============================================================
-- 「チーム完成」バッジの条件に『予算決裁者の明確化』を加えるため、
-- project_memberships に is_budget_approver フラグを追加する。
-- プロジェクトごとに高々 1 名 (部分一意インデックスで担保)。

alter table project_memberships
  add column if not exists is_budget_approver boolean not null default false;

comment on column project_memberships.is_budget_approver is
  'このメンバーがプロジェクトの予算決裁者か。プロジェクト内で高々1名。';

-- プロジェクトごとに予算決裁者は 1 名まで
create unique index if not exists project_memberships_one_budget_approver
  on project_memberships (project_id)
  where is_budget_approver;
