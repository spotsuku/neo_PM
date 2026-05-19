-- ============================================================
-- NEO PM — execution_plans に schedule + budget_plan + idea_summary を追加
-- ============================================================
-- 応募フォームの構造化フィールド (proposal_summary, plan_*, schedule, budget_plan)
-- を採択時に execution_plans に コピーして、ダッシュボード / 実行計画タブに
-- 即時反映できるようにする。

alter table execution_plans
  add column if not exists schedule       text,
  add column if not exists budget_plan    text,
  add column if not exists idea_summary   text;

comment on column execution_plans.schedule is
  '実証計画 (いつ・どこで・何をするか) を自由テキストで保存';
comment on column execution_plans.budget_plan is
  '収支計画 (月次・半年以上) を自由テキストで保存';
comment on column execution_plans.idea_summary is
  '提案概要 (1-2 段落の 30 秒ピッチ)。応募時の proposal_summary をコピー。';
