-- ============================================================
-- 0078_theme_owner_updates_active.sql
-- 出題者本人が「公開中 (active)」「承認済み (approved)」のテーマを
-- 直接編集できるようにする (誤字修正などの軽微な更新用途)。
--
-- 元の 0045 の policy は draft/submitted/changes_requested のみ許可だったが、
-- 実運用で公開後の軽微な修正 (会社名の誤字など) を出題者側でできないと
-- 都度管理者を呼ぶ必要があり運用負荷が高かった。
--
-- 大きな変更は「📝 下書きに戻して編集」→ 再申請の従来フローを併用可。
-- ============================================================

drop policy if exists "themes owner updates own" on public.themes;
create policy "themes owner updates own" on public.themes
  for update
  using (
    posted_by = auth.uid()
    and status in (
      'draft','submitted','changes_requested','approved','active'
    )
  )
  with check (
    posted_by = auth.uid()
    and status in (
      'draft','submitted','changes_requested','approved','active'
    )
  );
