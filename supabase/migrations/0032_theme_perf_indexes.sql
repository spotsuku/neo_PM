-- ============================================================
-- NEO PM — Theme application: 索引の最適化 + organizations.slug 索引
-- ============================================================
-- theme 詳細ページ (20 秒以上かかる問題) の改善:
-- 1) (theme_id, applicant_user_id) 複合インデックス — 自分の応募の有無判定が高速化
-- 2) themes(organization_id) — テーマ一覧の RLS 評価が早くなる
-- 3) organizations(slug) UNIQUE は既に PK 由来で速いがダブルチェック

create index if not exists theme_apps_theme_applicant_idx
  on theme_applications (theme_id, applicant_user_id);

create index if not exists themes_org_idx
  on themes (organization_id, status);

-- 念のため: org slug ルックアップで full scan が起きないように
-- (organizations.slug は元から unique なら自動で index があるが冪等保険)
create unique index if not exists organizations_slug_idx
  on organizations (slug);
