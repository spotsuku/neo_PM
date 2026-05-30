-- ============================================================
-- NEO PM — テーマ申請フォームの問題定義パートを構造化
-- ============================================================
-- 「問題」と「課題」が混同されがちなため、申請フォームを
--   ビジョン → 現状 → 問題(ギャップ) → 要因 → 取り組むべき課題
-- の流れに分解する。既存 pain (問題) は表記だけ
-- 「問題（ビジョンと現状のギャップ）」に変更し、列名はそのまま。
-- 新しく 4 列を追加するのみ (列追加はノンブロッキング)。

alter table public.themes
  add column if not exists vision text,
  add column if not exists current_state text,
  add column if not exists root_cause text,
  add column if not exists focus_issue text;
