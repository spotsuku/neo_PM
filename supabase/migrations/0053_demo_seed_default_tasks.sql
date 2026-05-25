-- ============================================================
-- NEO PM — 見本プロジェクト(シニアタッチ)に標準の初期 WBS タスクを入れる
-- ============================================================
-- 0034 で新規組織への自動 seed (seed_demo_for_org) を導入したが、
-- テーマ + プロジェクトのみを seed しており WBS タスクが空だった。
-- → seed_demo_for_org を更新し、見本 PJT に初期タスク 8 件を seed する (冪等)。
-- 既存組織で見本 PJT にタスクが無いものは下部の backfill で補完する。

create or replace function public.seed_demo_for_org(target_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_theme_id uuid;
begin
  -- HRC-001 テーマ (見本) を seed (既存ならスキップ)
  insert into themes (
    organization_id, code, category, title, background,
    who_target, pain, what_uniqueness, what_benefit, expected_outcome,
    implementation_level, post_action, prize, company_name, contact_name,
    deadline, status, thumbnail_url, criteria_region, criteria_means,
    criteria_youth, is_demo
  )
  select
    target_org,
    'HRC-001',
    'new',
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
    'ヒューマンロボットカンパニー',
    '高橋 直人',
    (current_date + interval '60 days')::timestamptz,
    'active',
    'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=1600&q=80',
    true, true, true,
    true
  where not exists (
    select 1 from themes t where t.organization_id = target_org and t.code = 'HRC-001'
  );

  -- theme_id を取得
  select id into v_theme_id from themes
   where organization_id = target_org and code = 'HRC-001' limit 1;

  -- 見本プロジェクトを seed (既存ならスキップ)
  insert into projects (
    organization_id, name, team_name, idea_title, status,
    progress_pct, streak_days, badges, started_at, due_at,
    theme_id, thumbnail_url, is_demo
  )
  select
    target_org,
    '見本: シニアタッチ',
    'シニアタッチ',
    'ヒューマンロボットと拓く、福岡の高齢者ケア新体験',
    'active', 35, 12,
    '{}'::text[],
    (current_date - interval '14 days')::timestamptz,
    (current_date + interval '46 days')::timestamptz,
    v_theme_id,
    'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=1600&q=80',
    true
  where not exists (
    select 1 from projects p where p.organization_id = target_org and p.is_demo = true
  );

  -- 見本プロジェクトに標準の WBS タスクを seed (タイトル単位で冪等)
  insert into tasks (
    project_id, title, owner_name, start_week, span_week,
    start_date, end_date, progress, status, is_milestone, tag
  )
  select p.id, t.title, t.owner_name, t.start_week, t.span_week,
         t.start_date, t.end_date, t.progress, t.status::text, t.is_milestone, t.tag
  from projects p
  cross join (
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
  where p.organization_id = target_org
    and p.is_demo = true
    and not exists (
      select 1 from tasks tk
      where tk.project_id = p.id and tk.title = t.title
    );
end;
$$;

comment on function public.seed_demo_for_org is
  '指定組織に HRC-001 テーマ + 見本シニアタッチ PJT + 初期 WBS タスクを seed (冪等)';

-- ── backfill: 見本 PJT があるがタスクが無い組織を補完 ──────────
do $$
declare r record;
begin
  for r in
    select distinct p.organization_id as org_id
    from projects p
    where p.is_demo = true
      and not exists (select 1 from tasks tk where tk.project_id = p.id)
  loop
    perform public.seed_demo_for_org(r.org_id);
  end loop;
end $$;
