-- ============================================================
-- NEO PM — Project member responsibility fields (additive)
-- ============================================================
-- プロジェクトメンバーが「役職 / 責任 / 業務内容」を登録できるようにする。
-- 既存の title カラム = 役職。新規追加 = responsibility (責任) + work_description (業務内容)。
-- 全員がこの 3 つを記入すると「チーム完成バッジ」を獲得し、プロジェクトを
-- 立ち上げる UI が解放される。

alter table project_memberships
  add column if not exists responsibility   text,
  add column if not exists work_description text;

comment on column project_memberships.title is
  '役職 / ロール名 (例: PdM, デザイナー)';
comment on column project_memberships.responsibility is
  '責任範囲 (例: 顧客インタビューの設計と実施)';
comment on column project_memberships.work_description is
  '具体的な業務内容 (例: 週次で 3 件のヒアリングをして要約をチームに共有)';
