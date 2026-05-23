-- ============================================================
-- NEO PM — 未参加メンバーにもダッシュボードを見せる (読み取り専用)
-- ============================================================
-- 「自分が所属していないプロジェクトでもダッシュは見られる」ようにする。
-- ダッシュボードが表示する進捗系データ + AI総合評価 / KPI の算出に必要な
-- テーブルの SELECT を、組織メンバー全員に開放する (読み取りのみ)。
--
-- 書き込み (INSERT/UPDATE/DELETE) は従来の can_access_project ポリシー
-- (= 参加者 or 組織admin) が引き続きガードするため、未参加メンバーは
-- 閲覧専用。
--
-- 開放するテーブル:
--   milestones / tasks / events / project_memberships
--   execution_plans (AI評価のスコア) / kpis (KPI進捗) / diagnosis_entries (ふりかえり集計)
-- ※ budget_items / fund_applications / proposals / chat_messages /
--   field_history / project_posts(タイムライン) などは対象外 = 非公開のまま。
--   → 収支・基金・タイムライン・提案・チャットは参加者しか閲覧できない。

-- project_id を直接持つテーブル
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'milestones','tasks','events',
      'execution_plans','diagnosis_entries'
    ])
  loop
    execute format('drop policy if exists "org members read %1$I for dashboard" on %1$I;', t);
    execute format(
      'create policy "org members read %1$I for dashboard" on %1$I for select using (public.is_org_member(public.project_org(project_id)));',
      t
    );
  end loop;
end $$;

-- project_memberships (チーム一覧)
drop policy if exists "org members read project_memberships for dashboard" on project_memberships;
create policy "org members read project_memberships for dashboard" on project_memberships
  for select using (public.is_org_member(public.project_org(project_id)));

-- kpis: plan -> project 経由
drop policy if exists "org members read kpis for dashboard" on kpis;
create policy "org members read kpis for dashboard" on kpis
  for select using (
    exists (
      select 1 from execution_plans ep
      where ep.id = kpis.plan_id
        and public.is_org_member(public.project_org(ep.project_id))
    )
  );
