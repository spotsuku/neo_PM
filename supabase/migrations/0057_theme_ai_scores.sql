-- ============================================================
-- NEO PM — テーマ出題の AI 採点結果を保存
-- ============================================================
-- テーマ公開審査で、テキスト11項目を AI が 0〜100 (5点刻み) で採点する。
-- 申請ゲート (出題者の自己チェック: 全項目70点以上) と
-- 審査画面 (管理者の補助表示) の双方で参照する。
--
-- ai_scores の形:
--   {
--     "items": { "<item_key>": { "score": <0-100>, "comment": "<改善コメント>" }, ... },
--     "summary": "<全体総評>",
--     "threshold": 70,
--     "scored_at": "<ISO8601>"
--   }
-- 列追加のみ。行レベルの可視性は既存の themes RLS をそのまま継承する。

alter table public.themes
  add column if not exists ai_scores jsonb,
  add column if not exists ai_scored_at timestamptz;
