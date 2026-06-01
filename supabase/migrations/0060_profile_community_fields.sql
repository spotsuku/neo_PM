-- ============================================================
-- NEO PM — community プロフィール同期用のカラム追加
-- ============================================================
-- community ポータルでログインしたユーザーの「肩書き / キャッチコピー /
-- 自己紹介」を AI PM の profiles に保存できるようにする。
-- 既存 display_name / avatar_url は変更なし。
-- ログイン時に毎回上書きする運用 (UPSERT)。

alter table public.profiles
  add column if not exists title text,
  add column if not exists catchphrase text,
  add column if not exists bio text;
