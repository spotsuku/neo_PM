-- ============================================================
-- NEO PM — テーマ出題者が自分のテーマの項目別差し戻しコメントを読めるように
-- ============================================================
-- 0051 の review_decisions SELECT ポリシーは「組織管理者」または
-- 「project の参加者」のみ閲覧可で、theme の出題者(posted_by)が自分の
-- テーマへの差し戻しコメント(target_type='theme')を読めなかった。
-- プレビュー上に差し戻しコメントを表示するため、出題者本人の閲覧を許可する。

drop policy if exists "review_decisions select" on public.review_decisions;
create policy "review_decisions select" on public.review_decisions
  for select using (
    public.is_org_admin(public.review_target_org(target_type, target_id))
    or (target_type = 'project' and public.can_access_project(target_id))
    or (
      target_type = 'theme'
      and exists (
        select 1 from public.themes t
        where t.id = review_decisions.target_id
          and t.posted_by = auth.uid()
      )
    )
  );
