-- ============================================================
-- NEO PM — Demo (シニアタッチ) full seed: members + tasks + badges + launch
-- ============================================================
-- 0024 で is_demo=true プロジェクトを作り、execution_plans / milestones を seed した。
-- 本マイグレーションでは更に
--   ・members (org の owner / admin を lead として参加、3 フィールド全部記入)
--   ・tasks (WBS の中身)
--   ・projects.started_at  (= 立ち上げ済み扱い)
--   ・projects.badges     (= "team_formed" を付与)
-- を seed する。すべて冪等。

-- ── 1. メンバーを seed (org の owner / admin を lead として登録) ──────
insert into project_memberships (
  project_id, user_id, role, title, responsibility, work_description
)
select distinct on (p.id)
  p.id,
  m.user_id,
  'lead'::text,
  'プロジェクトリード',
  '・チーム全体のディレクションと意思決定\n・主催企業 / 介護施設 / 家族向けの窓口\n・週次の進捗を Why / Who / What / How と照らし合わせる',
  '・毎週水 10:00 の定例ファシリ\n・月 2 回の現場入り (施設 A / B)\n・成果ログを Notion にまとめ、企業窓口へ月次レポート'
from projects p
join memberships m on m.organization_id = p.organization_id
where p.is_demo = true
  and m.role in ('owner', 'admin')
  and not exists (
    select 1 from project_memberships pm
    where pm.project_id = p.id and pm.user_id = m.user_id
  )
order by
  p.id,
  case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,
  m.created_at;

-- ── 2. タスク (WBS) を seed ────────────────────────────────
-- 5 件くらい現実的な run-up タスクを入れる。
insert into tasks (
  project_id, title, owner_name, start_week, span_week,
  start_date, end_date, progress, status, is_milestone, tag
)
select p.id, t.title, t.owner_name, t.start_week, t.span_week,
       t.start_date, t.end_date, t.progress, t.status::text, t.is_milestone, t.tag
from projects p
cross join (
  values
    -- (title, owner_name, start_week, span_week, start_date, end_date, progress, status, is_milestone, tag)
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
where p.is_demo = true
  and not exists (
    select 1 from tasks tk
    where tk.project_id = p.id and tk.title = t.title
  );

-- ── 3. プロジェクトを「立ち上げ済み」に: started_at + badges に team_formed を追加 ──
update projects
set
  started_at = coalesce(started_at, (current_date - interval '14 days')::timestamptz),
  badges = (
    case
      when badges is null then array['team_formed']::text[]
      when not ('team_formed' = any(badges)) then array_append(badges, 'team_formed')
      else badges
    end
  ),
  status = 'active'
where is_demo = true;

-- ── 4. KPI を 2 件 seed (定量目標があるとダッシュが映える) ───────
insert into kpis (plan_id, label, target, progress)
select ep.id, k.label, k.target, k.progress
from execution_plans ep
join projects p on p.id = ep.project_id
cross join (
  values
    ('利用者の会話量 (週平均)', '+30% (実施前比)', 18),
    ('スタッフのケア時間 (1 日)', '+45 分 / 人', 25)
) as k(label, target, progress)
where p.is_demo = true
  and not exists (
    select 1 from kpis ki where ki.plan_id = ep.id and ki.label = k.label
  );
