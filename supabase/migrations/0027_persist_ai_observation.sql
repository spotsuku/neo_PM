-- ============================================================
-- NEO PM — Persist AI observation result (additive)
-- ============================================================
-- 旧実装: execution_plans.scores は永続化されるが、AI の観察コメントは
-- PlanObservationCard の local state にしか保持されず、ページ遷移で消える。
-- → 次の評価まで結果を維持できるよう DB に保存する。

alter table execution_plans
  add column if not exists last_observation             text,
  add column if not exists last_observation_values_key text,
  add column if not exists last_observed_at            timestamptz;

comment on column execution_plans.last_observation is
  'Latest AI observation comment string returned by /api/ai/observe-plan';
comment on column execution_plans.last_observation_values_key is
  'Hash/snapshot of (why|who|what|how|...) at the moment of observation. ' ||
  'Used to detect staleness when the plan has been edited since.';
comment on column execution_plans.last_observed_at is
  'Timestamp when the latest AI observation was performed.';
