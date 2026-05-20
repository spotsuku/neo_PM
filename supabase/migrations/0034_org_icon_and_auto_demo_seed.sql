-- ============================================================
-- NEO PM — 組織アイコン画像 + 新規組織への自動デモ seed
-- ============================================================
-- 1) organizations.icon_url を追加 (画像 URL を保存)
-- 2) seed_demo_for_org(org_id) 関数: HRC-001 テーマ + 見本シニアタッチ PJT
--    を 1 組織分 seed する (冪等)
-- 3) organizations への INSERT 後トリガで自動実行

-- ── 1. icon_url ───────────────────────────────────────────
alter table organizations
  add column if not exists icon_url text;

comment on column organizations.icon_url is
  'organizations icon as image URL (uploaded via Supabase Storage). 優先して描画され、null の時は emoji 列にフォールバック';

-- ── 2. seed_demo_for_org() ────────────────────────────────
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
end;
$$;

comment on function public.seed_demo_for_org is
  '指定組織に HRC-001 テーマ + 見本シニアタッチ PJT を seed (冪等)';

-- ── 3. トリガ: 新規組織作成時に自動 seed ────────────────
create or replace function public.trg_seed_demo_after_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_demo_for_org(new.id);
  return new;
end;
$$;

drop trigger if exists trg_org_insert_seed_demo on organizations;
create trigger trg_org_insert_seed_demo
  after insert on organizations
  for each row
  execute function public.trg_seed_demo_after_org_insert();

-- ── 4. 既存組織のうち、デモが無いものを backfill ────────
do $$
declare r record;
begin
  for r in
    select o.id from organizations o
    where not exists (
      select 1 from projects p where p.organization_id = o.id and p.is_demo = true
    )
  loop
    perform public.seed_demo_for_org(r.id);
  end loop;
end $$;
