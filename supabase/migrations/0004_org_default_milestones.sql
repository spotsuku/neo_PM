-- ============================================================
-- NEO PM v2 — Organization default milestones (additive)
-- ============================================================
-- 新規プロジェクト作成時にウィザードへ初期投入されるマイルストーン
-- 雛形を組織ごとに持たせる。ウィザードで編集して作成すると、その
-- 編集結果が次回以降のデフォルトになる。

alter table organizations
  add column if not exists default_milestones jsonb;

comment on column organizations.default_milestones is
  'Array of { label: string, weekOffset: number }. Used as the seed list when creating a new project. If null, the app falls back to the hardcoded defaults.';
