-- ============================================================
-- NEO PM — プロジェクト公開申請フォーム (テーマ出題と同様の申請方式)
-- ============================================================
-- 公開申請を「プレビュー + フォーム記入」方式にする。申請内容 (公開用に整えた
-- タイトル/概要/Why/Who/問題/What/成果/独自性/画像) を 1つの jsonb 列に保存する。
-- プロジェクトに既に記入があればフォーム初期値として引用する (アプリ側)。
--
-- 形: {
--   image_url, title, summary, why, who, problem, what, outcome, uniqueness
-- }

alter table public.projects
  add column if not exists publish_app jsonb;
