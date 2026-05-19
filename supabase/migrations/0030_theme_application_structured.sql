-- ============================================================
-- NEO PM — Theme application: structured fields (additive)
-- ============================================================
-- 旧仕様は proposal (free text) 1 つだったが、応募で評価したい項目を
-- 構造化したい。
--   - 提案概要 (proposal_summary)
--   - メンバー構成 (members は既存)
--   - 実行計画: Why / Who (target) / What (value) / How
--   - どこで (場所)
--   - 実行スケジュール
--   - 収支計画

alter table theme_applications
  add column if not exists proposal_summary text,
  add column if not exists plan_why         text,
  add column if not exists plan_who         text,
  add column if not exists plan_what        text,
  add column if not exists plan_how         text,
  add column if not exists plan_where       text,
  add column if not exists schedule         text,
  add column if not exists budget_plan      text;

comment on column theme_applications.proposal_summary is
  '提案の 1-2 段落の概要 (旧 proposal を引き継ぎつつ、より短く)';
comment on column theme_applications.plan_why is
  'なぜ取り組むのか / 自分たちが取り組む意義';
comment on column theme_applications.plan_who is
  '誰に届けるか / ターゲット';
comment on column theme_applications.plan_what is
  '何を提供するか / 提供価値';
comment on column theme_applications.plan_how is
  'どうやって実現するか / 具体的なアクション';
comment on column theme_applications.plan_where is
  'どこで実施するか / 場所 / 流通チャネル';
comment on column theme_applications.schedule is
  '実行スケジュール (時期・マイルストーン・WBS の粗い計画)';
comment on column theme_applications.budget_plan is
  '収支計画 (収入見込み・支出・必要資金)';

-- 旧 proposal は引き続き互換のため残す。
