-- ============================================================
-- 0037_profiles_tutorial.sql
-- profiles に tutorial_completed_at を追加して、初回ログインの
-- オンボーディングツアーを「完了 / スキップしたか」を記録する。
--
-- NULL → まだ完了していない (= 次のログイン時にツアーを開く)
-- non-NULL → 完了済みのタイムスタンプ
-- ============================================================

alter table public.profiles
  add column if not exists tutorial_completed_at timestamptz;

comment on column public.profiles.tutorial_completed_at is
  '初回オンボーディングツアーを完了 / スキップしたタイムスタンプ。NULL の間は次回サインインでツアーを自動表示する。';
