-- ============================================================
-- 0024_demo_flags_and_demo_project.sql
-- 「見本」フラグを themes / projects に追加し、ホームに見本プロジェクト
-- (ヒューマンロボットカンパニーから採択された想定) を全組織に挿入する。
--
--   1. themes.is_demo / projects.is_demo の boolean (default false)
--   2. 既存の 'HRC-001' テーマを is_demo=true に backfill
--   3. 全組織に見本プロジェクトを1つ挿入 (既にあればスキップ)
--      - team_name: 「シニアタッチ」(架空)
--      - idea_title: HRC のタイトル
--      - is_demo: true, status: active
--      - thumbnail: テーマと同じ
-- ============================================================

-- ── 1. フラグ列の追加 ────────────────────────────────
alter table themes
  add column if not exists is_demo boolean not null default false;
alter table projects
  add column if not exists is_demo boolean not null default false;

-- ── 2. 既存の HRC-001 テーマを is_demo=true に ─────────
update themes set is_demo = true where code = 'HRC-001';

-- ── 3. 見本プロジェクトを全組織に挿入 ───────────────
-- 既存の見本プロジェクト (is_demo=true) があればスキップ
insert into projects (
  organization_id,
  name,
  team_name,
  idea_title,
  status,
  progress_pct,
  streak_days,
  badges,
  started_at,
  due_at,
  theme_id,
  thumbnail_url,
  is_demo
)
select
  o.id,
  '見本: シニアタッチ',
  'シニアタッチ',
  'ヒューマンロボットと拓く、福岡の高齢者ケア新体験',
  'active',
  35,
  12,
  '{}'::text[],
  (current_date - interval '14 days')::timestamptz,
  (current_date + interval '46 days')::timestamptz,
  (select id from themes where organization_id = o.id and code = 'HRC-001' limit 1),
  'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=1600&q=80',
  true
from organizations o
where not exists (
  select 1 from projects p
  where p.organization_id = o.id and p.is_demo = true
);

-- ── 4. 見本プロジェクトの実行計画も seed ────────────
insert into execution_plans (
  project_id, why, who, what, how, qualitative_goal
)
select
  p.id,
  '福岡県の高齢者と介護スタッフが、テクノロジーで「人とのつながり」を取り戻せる未来を作りたいから。介護人材不足は社会課題だが、その解は単なる効率化ではなく「人が人らしく在れる時間」を生み出すことだと信じる。',
  '福岡市内3つの介護施設の利用者 (70代以上、要介護1〜2) と、現場スタッフ 8 名。利用者の家族 (40代〜60代) も対象。',
  '介護現場における利用者の孤独感の軽減、スタッフのケアに割ける時間の増加、家族との安心感のあるつながり。',
  'パートナー型ロボット Humo を 8 週間運用。導入前後でのスタッフ業務時間・会話量・家族満足度を計測。週次でメンタリング、月2回は現場入り。',
  '8 週間の実証で「Humo がいる現場 / いない現場」の差を定量・定性ともに見える化し、PoC 第2フェーズへの移行を確実にする。'
from projects p
where p.is_demo = true
  and not exists (
    select 1 from execution_plans ep where ep.project_id = p.id
  );

-- ── 5. 見本プロジェクトにマイルストーンを seed ──────
insert into milestones (project_id, label, date, done)
select p.id, 'キックオフ', (current_date - interval '14 days')::date, true
from projects p
where p.is_demo = true
  and not exists (
    select 1 from milestones m
    where m.project_id = p.id and m.label = 'キックオフ'
  );
insert into milestones (project_id, label, date, done)
select p.id, '施設マッチング完了', (current_date - interval '7 days')::date, true
from projects p
where p.is_demo = true
  and not exists (
    select 1 from milestones m
    where m.project_id = p.id and m.label = '施設マッチング完了'
  );
insert into milestones (project_id, label, date, done)
select p.id, 'Humo 設置・初期計測', (current_date + interval '5 days')::date, false
from projects p
where p.is_demo = true
  and not exists (
    select 1 from milestones m
    where m.project_id = p.id and m.label = 'Humo 設置・初期計測'
  );
insert into milestones (project_id, label, date, done)
select p.id, '中間レビュー', (current_date + interval '21 days')::date, false
from projects p
where p.is_demo = true
  and not exists (
    select 1 from milestones m
    where m.project_id = p.id and m.label = '中間レビュー'
  );
insert into milestones (project_id, label, date, done)
select p.id, '本番レポート提出', (current_date + interval '46 days')::date, false
from projects p
where p.is_demo = true
  and not exists (
    select 1 from milestones m
    where m.project_id = p.id and m.label = '本番レポート提出'
  );
