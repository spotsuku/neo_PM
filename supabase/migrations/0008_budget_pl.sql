-- ============================================================
-- NEO PM v2 — Budget PL (3 groups + monthly grid)
-- ============================================================
-- 収支機能を「収入 / 原価 / 販管費」の本格 PL 構造に拡張し、
-- 月次の数字を monthly_amounts (jsonb) で持つようにする。
--
-- monthly_amounts の構造:
-- {
--   "1": { "plan": 1000, "actual": 500 },
--   "2": { "plan": 2000, "actual": 1800 },
--   ...
-- }

-- ── 既存データを新区分にマイグレート ──
-- 旧 'expense' は便宜上「販管費」扱いに（後から再分類可）
update budget_items set kind = 'sga' where kind = 'expense';

-- ── kind の制約を更新（'expense' も互換のために許容しておく）──
alter table budget_items
  drop constraint if exists budget_items_kind_check;
alter table budget_items
  add constraint budget_items_kind_check
    check (kind in ('income', 'cogs', 'sga', 'expense'));

-- ── 旧 plan_jpy / actual_jpy + month を monthly_amounts に流し込む ──
-- すでに monthly_amounts に該当月が入っていたら触らない
update budget_items
   set monthly_amounts = coalesce(monthly_amounts, '{}'::jsonb)
     || jsonb_build_object(
       month::text,
       jsonb_build_object(
         'plan',   coalesce(plan_jpy, 0),
         'actual', coalesce(actual_jpy, 0)
       )
     )
 where month is not null
   and (
     not (coalesce(monthly_amounts, '{}'::jsonb) ? month::text)
     or (plan_jpy > 0 or actual_jpy > 0)
   );
