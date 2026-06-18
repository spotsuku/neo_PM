-- ============================================================
-- NEO PM — is_theme_collaborator を SECURITY DEFINER → INVOKER に修正
-- ============================================================
-- 報告: 管理者を別ユーザに移管した後、元管理者 (= editor collaborator) が
-- /[orgSlug]/theme で対象テーマを見れない、という不具合。
--
-- 原因:
-- 0063 で作った is_theme_collaborator は SECURITY DEFINER だが、Supabase
-- の現状の挙動で、SECURITY DEFINER の関数内から auth.uid() を呼ぶと、
-- 呼び出し元のセッション GUC (request.jwt.claims) が伝播せず null が
-- 返るケースがある。結果、関数が常に false を返し、themes 「collaborator
-- reads」policy が collaborator に対しても SELECT を許可しない。
--
-- 切り分け:
-- - 直接 `exists(select 1 from theme_collaborators where ...)` は true
-- - `is_theme_collaborator(...)` は false
-- 関数の中の auth.uid() だけが broken。
--
-- 修正:
-- SECURITY DEFINER → SECURITY INVOKER に変更。INVOKER なら呼び出し元の
-- セッションで auth.uid() が解決される。
-- RLS 再帰の心配は無し: 関数は theme_collaborators を
-- `user_id = auth.uid()` でだけ参照するため、自分の行は SELECT policy
-- 「user_id = auth.uid() OR ...」の前半で短絡的に通る。
-- ============================================================

create or replace function public.is_theme_collaborator(
  target_theme uuid,
  target_roles text[]
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from theme_collaborators
    where theme_id = target_theme
      and user_id = auth.uid()
      and role = any (target_roles)
  );
$$;

comment on function public.is_theme_collaborator(uuid, text[]) is
  '対象テーマで current user が target_roles のいずれかの collaborator かを判定。SECURITY INVOKER (呼び出し元 session で auth.uid() を解決するため)。';
