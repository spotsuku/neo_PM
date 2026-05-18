-- ============================================================
-- NEO PM — Demo (シニアタッチ) extra badges + seed data for 10 steps
-- ============================================================
-- 立ち上げの 10 ステップそれぞれに対応するバッジを seed する。
-- 既存 0024 / 0026 で部分的に作られているリソースを補強し、
-- 全 10 ステップが達成された状態にする (見本として綺麗に並ぶように)。

-- ── 1. デモ project の execution_plans を補強 ───────────────
-- - 4P, qualitative_goal を埋める
-- - AI 採点 (scores) と last_observation を完了済みにする (= 初回振り返り)
update execution_plans ep
set
  product = coalesce(nullif(ep.product, ''),
    'パートナー型ロボット Humo (8 週間レンタル) + 月 1 回の家族向けオンライン交流会'),
  price = coalesce(nullif(ep.price, ''),
    '施設利用料に月 3,000 円含む / 協賛企業から月 50 万円 / 自治体補助 50%'),
  place = coalesce(nullif(ep.place, ''),
    '介護施設 3 拠点の共用ラウンジ + 家族向け LINE オープンチャット + 月次レポート'),
  promotion = coalesce(nullif(ep.promotion, ''),
    'ケアマネ向け説明会 (月 1) → 家族向け体験会 → 地元紙取材 → 自治体向け事例集'),
  qualitative_goal = coalesce(nullif(ep.qualitative_goal, ''),
    '高齢者 30 名・スタッフ 8 名・家族 30 組が「Humo がいる現場」と「いない現場」の違いを言葉で語れる状態。'),
  scores = coalesce(ep.scores,
    jsonb_build_object('why', 88, 'who', 82, 'what', 78, 'how', 75)),
  last_observation = coalesce(nullif(ep.last_observation, ''),
    'Why と Who はとても具体的で説得力があります。What は「相手が得る変化」が明確に書けています。How を磨くなら、8 週間の中で誰が・いつ・何を意思決定するか (ガバナンス) を 1 行足すと一段尖ります。'),
  last_observation_values_key = coalesce(ep.last_observation_values_key, 'seed-2026-05'),
  last_observed_at = coalesce(ep.last_observed_at, (current_timestamp - interval '2 days'))
from projects p
where ep.project_id = p.id
  and p.is_demo = true;

-- ── 2. デモ project に会議を 2 件 seed (キックオフ + 定例 1 件) ──
insert into meetings (project_id, title, scheduled_at, duration_min, location, status, agenda)
select p.id, mt.title, mt.scheduled_at, mt.duration_min, mt.location, mt.status::text, mt.agenda
from projects p
cross join (
  values
    ('キックオフ MTG',
     (current_date - interval '12 days')::timestamptz + interval '10 hours',
     90, '施設 A 共用ラウンジ', 'finished',
     E'- プロジェクト Why / Who の共有\n- 8 週間スケジュール確認\n- 各メンバーの役割と業務分担'),
    ('第 1 回 定例 MTG',
     (current_date - interval '5 days')::timestamptz + interval '10 hours',
     60, 'Zoom', 'finished',
     E'- 進捗共有 (チケット消化状況)\n- 現場で出てきた課題と次の一手\n- 来週の優先タスク決定')
) as mt(title, scheduled_at, duration_min, location, status, agenda)
where p.is_demo = true
  and not exists (
    select 1 from meetings m
    where m.project_id = p.id and m.title = mt.title
  );

-- ── 3. デモ project に追加のマイルストーン (合計 5+ に揃える) ──
insert into milestones (project_id, label, date, done)
select p.id, ms.label, ms.date, ms.done
from projects p
cross join (
  values
    ('家族向け体験会 開催',  (current_date + interval '12 days')::date, false),
    ('成果報告会 (自治体)',  (current_date + interval '60 days')::date, false)
) as ms(label, date, done)
where p.is_demo = true
  and not exists (
    select 1 from milestones m
    where m.project_id = p.id and m.label = ms.label
  );

-- ── 4. デモ project に追加 WBS タスクを足して 10 件以上にする ──
insert into tasks (
  project_id, title, owner_name, start_week, span_week,
  start_date, end_date, progress, status, is_milestone, tag
)
select p.id, t.title, t.owner_name, t.start_week, t.span_week,
       t.start_date, t.end_date, t.progress, t.status::text, t.is_milestone, t.tag
from projects p
cross join (
  values
    ('家族満足度アンケート設計', 'リサーチ', 6, 1,
       (current_date + interval '14 days')::date, (current_date + interval '18 days')::date,
       0, 'todo', false, '現場'),
    ('スタッフ向けトレーニング (2 回)', 'PdM', 4, 2,
       (current_date + interval '7 days')::date, (current_date + interval '21 days')::date,
       0, 'todo', false, '現場'),
    ('協賛企業 月次レポート v1', 'リード', 7, 1,
       (current_date + interval '25 days')::date, (current_date + interval '28 days')::date,
       0, 'todo', false, '連携'),
    ('施設 B 設置', 'エンジニア', 5, 1,
       (current_date + interval '14 days')::date, (current_date + interval '16 days')::date,
       0, 'todo', false, '現場')
) as t(title, owner_name, start_week, span_week, start_date, end_date, progress, status, is_milestone, tag)
where p.is_demo = true
  and not exists (
    select 1 from tasks tk where tk.project_id = p.id and tk.title = t.title
  );

-- ── 5. デモ project に半年分 (6 ヶ月) の収支アイテム seed ──────
-- budget_items.month は YYYYMM 表記 (例: 202605) を想定して順に 6 ヶ月分。
insert into budget_items (project_id, kind, category, name, plan_jpy, actual_jpy, month, is_pending)
select p.id, b.kind::text, b.category, b.name, b.plan_jpy, b.actual_jpy, b.month, b.is_pending
from projects p
cross join (
  values
    -- 月 1
    ('income',  '協賛',     '協賛企業 A 月額',         500000, 0, 202605, false),
    ('expense', '機材',     'Humo 月額レンタル',       150000, 0, 202605, false),
    ('expense', '人件費',   'リード謝礼',              100000, 0, 202605, false),
    -- 月 2
    ('income',  '協賛',     '協賛企業 A 月額',         500000, 0, 202606, false),
    ('expense', '機材',     'Humo 月額レンタル',       150000, 0, 202606, false),
    ('expense', '人件費',   'リード謝礼',              100000, 0, 202606, false),
    -- 月 3
    ('income',  '協賛',     '協賛企業 A 月額',         500000, 0, 202607, false),
    ('expense', '機材',     'Humo 月額レンタル',       150000, 0, 202607, false),
    -- 月 4
    ('income',  '補助金',   '自治体補助金 上半期',     800000, 0, 202608, true),
    ('expense', '機材',     'Humo 月額レンタル',       150000, 0, 202608, false),
    -- 月 5
    ('income',  '協賛',     '協賛企業 A 月額',         500000, 0, 202609, false),
    ('expense', '人件費',   '研修講師',                 80000, 0, 202609, false),
    -- 月 6
    ('income',  '協賛',     '協賛企業 A 月額',         500000, 0, 202610, false),
    ('expense', '広報',     '事例集 印刷',              60000, 0, 202610, false)
) as b(kind, category, name, plan_jpy, actual_jpy, month, is_pending)
where p.is_demo = true
  and not exists (
    select 1 from budget_items bi
    where bi.project_id = p.id and bi.month = b.month and bi.name = b.name
  );

-- ── 6. projects.badges に 10 + master の全バッジを seed ──────
update projects
set badges = (
  select array(
    select distinct unnest(
      coalesce(badges, ARRAY[]::text[]) ||
      ARRAY[
        'kickoff_done',
        'team_formed',
        'recurring_meeting',
        'goals_set',
        'why_polished',
        'fourp_filled',
        'first_retro',
        'milestones_set',
        'wbs_set',
        'budget_set',
        'project_launched'
      ]::text[]
    )
  )
)
where is_demo = true;
