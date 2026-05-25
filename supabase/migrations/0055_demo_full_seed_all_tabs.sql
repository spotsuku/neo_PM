-- ============================================================
-- NEO PM — 見本シニアタッチを「全タブ標準で埋まった」状態に seed
-- ============================================================
-- seed_demo_for_org を全面更新 (0053 を置き換え)。見本プロジェクトに
--   実行計画(4P含む)/AI採点80点/KPI/マイルストーン/会議+定例/
--   収支(明細+黒字化モデル)/基金申請/振り返り/メンバー詳細+予算決裁者/
--   立ち上げ済みフラグ+全バッジ
-- を冪等に seed する。末尾で既存の全デモ組織を backfill。
-- 前提: 0025〜0054 が適用済みであること。

create or replace function public.seed_demo_for_org(target_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_theme_id   uuid;
  v_project_id uuid;
  v_plan_id    uuid;
begin
  -- ── テーマ (HRC-001) ───────────────────────────────────
  insert into themes (
    organization_id, code, category, title, background,
    who_target, pain, what_uniqueness, what_benefit, expected_outcome,
    implementation_level, post_action, prize, company_name, contact_name,
    deadline, status, thumbnail_url, criteria_region, criteria_means,
    criteria_youth, is_demo
  )
  select
    target_org, 'HRC-001', 'new',
    'ヒューマンロボットと拓く、福岡の高齢者ケア新体験',
    '福岡県では高齢化率が30%に近づき、介護スタッフ不足が深刻化しています。当社はパートナー型ロボット「Humo (ヒューモ)」を開発しており、現場での「人とロボットの自然な共生」を実証したいと考えています。',
    '地域の介護施設・高齢者デイサービス事業者、現場の介護スタッフ、そしてそこに通う70代以上の利用者',
    '介護現場の人手不足が常態化し、スタッフ1人あたりの担当人数が増加。利用者との会話やレクリエーションに割ける時間が減り、現場の疲弊と利用者満足度の低下が同時に進んでいる。',
    'パートナー型ロボット Humo は単なる介護補助ではなく、利用者の表情・声・生活リズムを学習して "話し相手になる" 設計。介護スタッフを置き換えるのではなく「現場で愛されるチームの一員」を目指している。',
    '介護スタッフは事務作業と会話補助から解放され、ケアの本質に集中。利用者は孤独感が軽減され、家族はオンラインで Humo 越しに様子を確認できる。',
    '実証実験 3 施設 × 8 週間で、会話量・ケア時間・家族満足度を定量計測。Humo の改良点を見つけ、本格展開のロードマップを描く。',
    'poc',
    '採択チームには Humo 実機 3 台の貸与 + 開発チームのメンタリング + 施設マッチング支援を提供。',
    E'実証実験 + PoC 報酬最大 80 万円\nHumo 実機 3 台の貸与、Humo 開発チームのメンタリング (週1)、施設マッチング支援、現場入りの旅費 (月2回まで実費精算)。',
    'ヒューマンロボットカンパニー', '高橋 直人',
    (current_date + interval '60 days')::timestamptz, 'active',
    'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=1600&q=80',
    true, true, true, true
  where not exists (
    select 1 from themes t where t.organization_id = target_org and t.code = 'HRC-001'
  );

  select id into v_theme_id from themes
   where organization_id = target_org and code = 'HRC-001' limit 1;

  -- ── プロジェクト (見本) ────────────────────────────────
  insert into projects (
    organization_id, name, team_name, idea_title, status,
    progress_pct, streak_days, badges, started_at, due_at,
    theme_id, thumbnail_url, is_demo
  )
  select
    target_org, '見本: シニアタッチ', 'シニアタッチ',
    'ヒューマンロボットと拓く、福岡の高齢者ケア新体験',
    'active', 45, 12, '{}'::text[],
    (current_date - interval '14 days')::timestamptz,
    (current_date + interval '46 days')::timestamptz,
    v_theme_id,
    'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=1600&q=80',
    true
  where not exists (
    select 1 from projects p where p.organization_id = target_org and p.is_demo = true
  );

  select id into v_project_id from projects
   where organization_id = target_org and is_demo = true limit 1;

  if v_project_id is null then
    return;
  end if;

  -- ── 立ち上げ済み + 全バッジ ────────────────────────────
  update projects
     set started_at = coalesce(started_at, (current_date - interval '14 days')::timestamptz),
         status     = 'active',
         progress_pct = greatest(progress_pct, 45),
         badges = array[
           'kickoff_done','team_formed','recurring_meeting','goals_set',
           'why_polished','fourp_filled','first_retro','milestones_set',
           'wbs_set','budget_set','project_launched'
         ]::text[]
   where id = v_project_id;

  -- ── WBS タスク (8件) ───────────────────────────────────
  insert into tasks (
    project_id, title, owner_name, start_week, span_week,
    start_date, end_date, progress, status, is_milestone, tag
  )
  select v_project_id, t.title, t.owner_name, t.start_week, t.span_week,
         t.start_date, t.end_date, t.progress, t.status::text, t.is_milestone, t.tag
  from (
    values
      ('① 介護施設 3 箇所のヒアリング設計',  'リサーチ',  0, 1,
         (current_date - interval '14 days')::date, (current_date - interval '10 days')::date,
         100, 'done',  false, '現場'),
      ('② スタッフ業務観察 (1 日 × 3 施設)', 'リサーチ',  1, 2,
         (current_date - interval '9 days')::date,  (current_date - interval '2 days')::date,
         90, 'review', false, '現場'),
      ('③ Humo 設置 (施設 A)',               'エンジニア', 3, 1,
         (current_date + interval '5 days')::date,  (current_date + interval '7 days')::date,
         30, 'doing',  false, '現場'),
      ('④ 家族向け説明資料 (slide deck)',    'デザイナー', 3, 1,
         (current_date + interval '3 days')::date,  (current_date + interval '9 days')::date,
         40, 'doing',  false, '資料'),
      ('⑤ ケアマネ向け勉強会',              'PdM',       5, 1,
         (current_date + interval '20 days')::date, (current_date + interval '22 days')::date,
         0,  'todo',   false, '広報'),
      ('⑥ 8 週間の効果計測 (会話量 / ケア時間)', 'リサーチ', 4, 6,
         (current_date + interval '10 days')::date, (current_date + interval '52 days')::date,
         0,  'todo',   false, '現場'),
      ('⑦ 中間レビュー (主催企業 + 自治体)',   'リード',    8, 1,
         (current_date + interval '21 days')::date, (current_date + interval '21 days')::date,
         0,  'todo',   true,  '連携'),
      ('⑧ 本番レポート提出',                  'リード',   12, 1,
         (current_date + interval '46 days')::date, (current_date + interval '46 days')::date,
         0,  'todo',   true,  '申請')
  ) as t(title, owner_name, start_week, span_week, start_date, end_date, progress, status, is_milestone, tag)
  where not exists (
    select 1 from tasks tk where tk.project_id = v_project_id and tk.title = t.title
  );

  -- ── マイルストーン (5件) ───────────────────────────────
  insert into milestones (project_id, label, date, done)
  select v_project_id, m.label, m.date, m.done
  from (
    values
      ('キックオフ',          (current_date - interval '14 days')::date, true),
      ('施設マッチング完了',  (current_date - interval '7 days')::date,  true),
      ('Humo 設置・初期計測', (current_date + interval '5 days')::date,  false),
      ('中間レビュー',        (current_date + interval '21 days')::date, false),
      ('本番レポート提出',    (current_date + interval '46 days')::date, false)
  ) as m(label, date, done)
  where not exists (
    select 1 from milestones ms where ms.project_id = v_project_id and ms.label = m.label
  );

  -- ── 実行計画 (Why/Who/What/How + 4P + 目標 + AI採点80点) ──
  insert into execution_plans (
    project_id, why, who, what, how,
    product, price, place, promotion, qualitative_goal,
    scores, last_observation, last_observed_at
  )
  select
    v_project_id,
    '福岡県の高齢者と介護スタッフが、テクノロジーで「人とのつながり」を取り戻せる未来を作りたいから。介護人材不足は社会課題だが、その解は単なる効率化ではなく「人が人らしく在れる時間」を生み出すことだと信じる。',
    '福岡市内3つの介護施設の利用者 (70代以上、要介護1〜2) と、現場スタッフ 8 名。利用者の家族 (40代〜60代) も対象。',
    '介護現場における利用者の孤独感の軽減、スタッフのケアに割ける時間の増加、家族との安心感のあるつながり。',
    'パートナー型ロボット Humo を 8 週間運用。導入前後でのスタッフ業務時間・会話量・家族満足度を計測。週次でメンタリング、月2回は現場入り。',
    'パートナー型ケアロボット Humo 本体と、表情・音声から自然な会話を生成する対話エンジン、家族向けの見守りアプリをセットで提供。',
    '施設向けに 1 台あたり月額 5 万円のサブスク。実証期間中の初期費用は無償。買い切り型の見守り機器 (約30万円) より導入障壁を下げる。',
    '介護施設・デイサービスへ直接導入。自治体の福祉課・地域包括支援センター経由のチャネルも開拓し、紹介で面を広げる。',
    '実証施設の事例を動画化し、介護事業者向け展示会と自治体セミナーで紹介。利用者・家族のリアルな声を SNS とオウンドメディアで継続発信。',
    '8 週間の実証で「Humo がいる現場 / いない現場」の差を定量・定性ともに見える化し、PoC 第2フェーズへの移行を確実にする。',
    '{"why":85,"who":82,"what":80,"how":83,"product":82,"price":80,"place":81,"promotion":83}'::jsonb,
    E'Why と Who がよく握れていて、現場のリアルな課題に根ざした強い計画です。What を「相手が得る変化」で語れているのも◎。\n次の一手として、Price の価格根拠を競合比較でもう一段具体化し、Promotion の獲得チャネルごとの初月見込みを数字にすると、収支モデルとの接続が一段と説得力を増します。',
    (current_date - interval '2 days')::timestamptz
  where not exists (
    select 1 from execution_plans ep where ep.project_id = v_project_id
  );

  select id into v_plan_id from execution_plans
   where project_id = v_project_id limit 1;

  -- ── KPI (3件) ──────────────────────────────────────────
  insert into kpis (plan_id, label, target, progress, unit)
  select v_plan_id, k.label, k.target, k.progress, k.unit
  from (
    values
      ('利用者の会話量 (週平均)',     '+30% (実施前比)', 45, '%'),
      ('スタッフのケア時間 (1日/人)', '+45 分',          40, '分'),
      ('家族満足度 (アンケート)',     '4.5 / 5.0',       60, 'pt')
  ) as k(label, target, progress, unit)
  where v_plan_id is not null
    and not exists (
      select 1 from kpis ki where ki.plan_id = v_plan_id and ki.label = k.label
    );

  -- ── 会議 (キックオフ・実施済み) ────────────────────────
  insert into meetings (
    project_id, title, scheduled_at, duration_min, location,
    status, agenda, minutes, decisions
  )
  select
    v_project_id, 'キックオフ MTG',
    (current_date - interval '14 days')::timestamptz + interval '10 hours',
    60, 'Zoom', 'finished',
    E'- 自己紹介 / 役割確認\n- Why/Who/What/How のすり合わせ\n- 8週間の実証スケジュール確認\n- 次アクションの割り当て',
    E'チーム全員で Why を再確認。施設A/B/Cの担当を決定。Humo の設置は3週目を目標に。家族向け説明資料はデザイナーが先行着手。',
    E'・実証は3施設×8週間で確定\n・週次定例は毎週水10:00 (Zoom)\n・予算決裁はリードが担当'
  where not exists (
    select 1 from meetings mt where mt.project_id = v_project_id and mt.title = 'キックオフ MTG'
  );

  -- ── 定例会議ルール (毎週水 10:00) ──────────────────────
  insert into meeting_recurrences (
    project_id, title, interval, day_of_week, start_time, duration_min,
    location, agenda_template, starts_on, active
  )
  select v_project_id, '週次 定例 MTG', 'weekly', 3, '10:00:00'::time, 60,
         'Zoom', E'- 進捗共有\n- 課題の棚卸し\n- 来週の優先タスク',
         (current_date - interval '12 days')::date, true
  where not exists (
    select 1 from meeting_recurrences mr
    where mr.project_id = v_project_id and mr.title = '週次 定例 MTG'
  );

  -- ── 収支: 明細 (収入/原価/販管費、6ヶ月) ───────────────
  insert into budget_items (project_id, kind, category, name, plan_jpy, monthly_amounts)
  select v_project_id, b.kind, b.category, b.name, b.plan_jpy, b.monthly::jsonb
  from (
    values
      ('income', '売上',   'Humo 月額利用料', 1400000,
        '{"1":{"plan":150000,"actual":150000},"2":{"plan":150000,"actual":150000},"3":{"plan":200000,"actual":0},"4":{"plan":250000,"actual":0},"5":{"plan":300000,"actual":0},"6":{"plan":350000,"actual":0}}'),
      ('income', '報酬',   'PoC 報酬 (主催企業)', 800000,
        '{"2":{"plan":400000,"actual":400000},"6":{"plan":400000,"actual":0}}'),
      ('cogs',   '原価',   '通信・保守・サポート', 270000,
        '{"1":{"plan":45000,"actual":45000},"2":{"plan":45000,"actual":45000},"3":{"plan":45000,"actual":0},"4":{"plan":45000,"actual":0},"5":{"plan":45000,"actual":0},"6":{"plan":45000,"actual":0}}'),
      ('sga',    '人件費', '人件費 (チーム)', 1200000,
        '{"1":{"plan":200000,"actual":200000},"2":{"plan":200000,"actual":200000},"3":{"plan":200000,"actual":0},"4":{"plan":200000,"actual":0},"5":{"plan":200000,"actual":0},"6":{"plan":200000,"actual":0}}'),
      ('sga',    'その他', 'オフィス・ツール費', 300000,
        '{"1":{"plan":50000,"actual":50000},"2":{"plan":50000,"actual":50000},"3":{"plan":50000,"actual":0},"4":{"plan":50000,"actual":0},"5":{"plan":50000,"actual":0},"6":{"plan":50000,"actual":0}}')
  ) as b(kind, category, name, plan_jpy, monthly)
  where not exists (
    select 1 from budget_items bi where bi.project_id = v_project_id and bi.name = b.name
  );

  -- ── 収支: 黒字化モデル ─────────────────────────────────
  insert into breakeven_plans (project_id, data)
  values (
    v_project_id,
    '{
      "phases": [
        {"id":"ph1","name":"検証","months":3,"goal":"PoCで会話量とケア時間の改善を検証","gate":"3施設で定量改善を確認しPoC第2フェーズへ"},
        {"id":"ph2","name":"拡大","months":6,"goal":"提供施設を増やし運用を安定化","gate":"10施設・単月黒字化の目処"}
      ],
      "revenues": [
        {"id":"r1","name":"Humo 月額利用料","unitPrice":50000,"unitVarCost":15000,
         "byPhase":{"ph1":{"startQty":3},"ph2":{"startQty":10}},
         "priceNote":"1台あたり月額5万円のサブスク","costNote":"通信・保守・サポートで1台あたり1.5万円","qtyNote":"導入施設数=台数。検証3台→拡大10台"}
      ],
      "fixed": [
        {"id":"f1","name":"人件費","byPhase":{"ph1":200000,"ph2":600000}},
        {"id":"f2","name":"開発・サーバ","byPhase":{"ph1":100000,"ph2":150000}}
      ],
      "oneoff": [
        {"id":"o1","name":"初期開発・機材","byPhase":{"ph1":1500000,"ph2":0}}
      ]
    }'::jsonb
  )
  on conflict (project_id) do nothing;

  -- ── 基金申請 (1件・一次審査中) ─────────────────────────
  insert into fund_applications (
    project_id, round, status, amount_jpy, reason, purposes, submitted_at
  )
  select
    v_project_id, 1, 'firstReview', 800000,
    'PoC 第1フェーズ(3施設×8週間)の実証費用。Humo 設置・現場入り・効果計測にかかる費用を申請します。',
    '[{"label":"機材・設置費","amount":300000},{"label":"現場入り旅費(月2回)","amount":200000},{"label":"効果計測・分析","amount":200000},{"label":"家族向け資料制作","amount":100000}]'::jsonb,
    (current_date - interval '5 days')::timestamptz
  where not exists (
    select 1 from fund_applications fa where fa.project_id = v_project_id and fa.round = 1
  );

  -- ── 振り返り (メンバー全員分) ──────────────────────────
  insert into diagnosis_entries (project_id, user_id, entry_date, scores, total_comment)
  select pm.project_id, pm.user_id, current_date,
         '{"vision":3,"share":2.5,"leader":2.5,"decision":2,"comm":3,"trust":3,"feedback":2,"growth":2.5,"speed":2,"outcome":2,"user":3,"iter":2.5,"habit":2,"joy":3}'::jsonb,
         'チームでまず Why を握り、現場入りでリアルな課題を持ち帰れているのが強み。スピードと iteration はもう一段磨ける。'
  from project_memberships pm
  where pm.project_id = v_project_id
    and not exists (
      select 1 from diagnosis_entries de
      where de.project_id = pm.project_id and de.user_id = pm.user_id
    );

  -- ── メンバー詳細を補完 (役職/責任/業務内容) ────────────
  update project_memberships
     set title = coalesce(nullif(trim(title), ''), 'プロジェクトリード'),
         responsibility = coalesce(nullif(trim(responsibility), ''),
           E'・チーム全体のディレクションと意思決定\n・主催企業 / 介護施設 / 家族向けの窓口\n・週次の進捗を Why / Who / What / How と照らし合わせる'),
         work_description = coalesce(nullif(trim(work_description), ''),
           E'・毎週水 10:00 の定例ファシリ\n・月 2 回の現場入り (施設 A / B)\n・成果ログをまとめ企業窓口へ月次レポート')
   where project_id = v_project_id;

  -- ── 予算決裁者を 1 名指定 (未指定なら最先任のリード) ───
  update project_memberships
     set is_budget_approver = true
   where id = (
     select id from project_memberships
      where project_id = v_project_id
      order by (role = 'lead') desc, created_at asc
      limit 1
   )
   and not exists (
     select 1 from project_memberships
      where project_id = v_project_id and is_budget_approver
   );
end;
$$;

comment on function public.seed_demo_for_org is
  '指定組織に見本(シニアタッチ)を全タブ標準データ付きで seed (冪等)';

-- ── backfill: 既存の全デモ組織を埋め直す ──────────────────
do $$
declare r record;
begin
  for r in select distinct organization_id as org_id from projects where is_demo = true
  loop
    perform public.seed_demo_for_org(r.org_id);
  end loop;
end $$;
