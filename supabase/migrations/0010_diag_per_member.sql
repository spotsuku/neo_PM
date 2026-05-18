-- ============================================================
-- NEO PM v2 — Diagnosis per-member (additive)
-- ============================================================
-- 診断レポートを「プロジェクト × 週」単位から
-- 「プロジェクト × メンバー × 日付」単位に変更。
-- 既存のエントリーは保護したまま user_id を nullable で追加し、
-- entry_date には既存 week_start をコピーする。

alter table diagnosis_entries
  add column if not exists user_id   uuid references auth.users on delete set null,
  add column if not exists entry_date date;

-- 既存データの entry_date を week_start から backfill
update diagnosis_entries
   set entry_date = coalesce(entry_date, week_start, created_at::date);

-- entry_date は今後必須にしたい（既存にも入ったので NOT NULL 化可）
alter table diagnosis_entries
  alter column entry_date set default current_date;

-- week_start は今後オプショナル（互換のために残すが NOT NULL を外す）
alter table diagnosis_entries
  alter column week_start drop not null;

-- インデックス
create index if not exists diag_user_idx
  on diagnosis_entries (project_id, user_id, entry_date desc);
create index if not exists diag_date_idx
  on diagnosis_entries (project_id, entry_date desc);
