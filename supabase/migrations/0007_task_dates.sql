-- ============================================================
-- NEO PM v2 — Day-level task dates (additive)
-- ============================================================
-- tasks に start_date / end_date を追加し、これまで使っていた
-- start_week / span_week から backfill する。WBS は日単位で
-- 期間を扱えるようになるが、既存ロジックを壊さないよう
-- start_week / span_week 列は残す（参照は今後フェードアウト）。

alter table tasks
  add column if not exists start_date date,
  add column if not exists end_date   date;

create index if not exists tasks_start_date_idx on tasks (start_date);
create index if not exists tasks_end_date_idx   on tasks (end_date);

-- Backfill: 既存タスクの start_week / span_week を
-- projects.started_at から日付に変換して入れる
update tasks t
   set start_date = (
         coalesce(p.started_at, t.created_at)::date
         + (coalesce(t.start_week, 0) * 7)
       ),
       end_date = (
         coalesce(p.started_at, t.created_at)::date
         + (coalesce(t.start_week, 0) * 7)
         + greatest(coalesce(t.span_week, 1), 1) * 7
         - 1
       )
  from projects p
 where t.project_id = p.id
   and t.start_date is null;
