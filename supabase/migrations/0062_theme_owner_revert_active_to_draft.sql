-- ============================================================
-- NEO PM — 公開中テーマを出題者本人が「下書きに戻す」操作を許可
-- ============================================================
-- 0045 の owner UPDATE policy は status ∈ {draft, submitted, changes_requested}
-- のときだけ更新を許可しており、公開中 (active) のテーマは出題者本人でも
-- 触れなかった。管理者は admin policy で可能。
--
-- 「公開中のテーマを編集したい場合に出題者本人も下書きに戻せるように」
-- という運用ニーズに応えるため、active → draft の遷移だけを許可する
-- 追加 policy を入れる。 (active → active や active → closed/archived は
-- 引き続き管理者専用)。
-- ============================================================

drop policy if exists "themes owner reverts active to draft" on public.themes;
create policy "themes owner reverts active to draft" on public.themes
  for update
  using (
    posted_by = auth.uid()
    and status = 'active'
  )
  with check (
    posted_by = auth.uid()
    and status = 'draft'
  );
