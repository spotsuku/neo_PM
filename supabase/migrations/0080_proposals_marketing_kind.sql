-- 0080_proposals_marketing_kind.sql
-- proposals.kind に "marketing" (4P) を追加。
-- AI が実行計画 (Why/Who/What/How) と マーケティング (4P) を別提案として
-- 出せるように、既存の CHECK 制約を拡張する。

alter table proposals
  drop constraint if exists proposals_kind_check;

alter table proposals
  add constraint proposals_kind_check
  check (kind in (
    'execution_plan',
    'marketing',
    'wbs',
    'budget',
    'promo',
    'application',
    'theme',
    'diagnosis'
  ));
