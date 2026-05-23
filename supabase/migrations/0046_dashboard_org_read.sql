-- ============================================================
-- NEO PM — 未参加メンバーにもダッシュボードを見せる (読み取り専用)
-- ============================================================
-- 「自分が所属していないプロジェクトでもダッシュは見られる」ようにする。
--
-- 方針:
--   ・ダッシュに「そのまま表示している」進捗データ
--       milestones / tasks / events / project_memberships
--     は組織メンバーへ SELECT を開放 (読み取りのみ)。
--   ・AI総合評価 / KPI は「ダッシュに出ている数値」だけを見せ、
--     実行計画の本文や KPI の内訳などの "詳細" はメンバー限定のまま。
--     → execution_plans / kpis / diagnosis_entries はテーブルごと開放せず、
--       ダッシュのスコア算出に必要な数値だけを SECURITY DEFINER 関数
--       project_dashboard_score_inputs() 経由で返す。
--
--   書き込み (INSERT/UPDATE/DELETE) は従来の can_access_project ポリシー
--   (= 参加者 or 組織admin) が引き続きガードするため、未参加メンバーは閲覧専用。
--   budget_items / fund_applications / proposals / chat_messages /
--   field_history / project_posts(タイムライン) は非公開のまま。

-- ── 進捗系テーブル: 組織メンバーに SELECT 開放 (project_id を直接持つ) ──
do $$
declare t text;
begin
  for t in select unnest(array['milestones','tasks','events']) loop
    execute format('drop policy if exists "org members read %1$I for dashboard" on %1$I;', t);
    execute format(
      'create policy "org members read %1$I for dashboard" on %1$I for select using (public.is_org_member(public.project_org(project_id)));',
      t
    );
  end loop;
end $$;

drop policy if exists "org members read project_memberships for dashboard" on project_memberships;
create policy "org members read project_memberships for dashboard" on project_memberships
  for select using (public.is_org_member(public.project_org(project_id)));

-- ── AI評価/KPI の "数値だけ" を返す関数 (詳細は漏らさない) ──
-- 返り値 jsonb:
--   { "scores": {why,who,what,how,...}, "kpi_progress": number[], "retro_user_ids": uuid[] }
-- 組織メンバーなら未参加でも呼べる (それ以外は null)。
-- 実行計画の本文 (why/who/what/how のテキスト) や KPI 名などは一切返さない。
create or replace function public.project_dashboard_score_inputs(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_plan_id uuid;
  v_scores jsonb;
  v_kpi jsonb;
  v_retro jsonb;
begin
  v_org := public.project_org(p_project_id);
  if v_org is null or not public.is_org_member(v_org) then
    return null;
  end if;

  select ep.id, ep.scores
    into v_plan_id, v_scores
    from execution_plans ep
   where ep.project_id = p_project_id
   limit 1;

  select coalesce(jsonb_agg(coalesce(k.progress, 0)), '[]'::jsonb)
    into v_kpi
    from kpis k
   where v_plan_id is not null and k.plan_id = v_plan_id;

  select coalesce(jsonb_agg(distinct de.user_id), '[]'::jsonb)
    into v_retro
    from diagnosis_entries de
   where de.project_id = p_project_id
     and de.user_id is not null;

  return jsonb_build_object(
    'scores', coalesce(v_scores, '{}'::jsonb),
    'kpi_progress', coalesce(v_kpi, '[]'::jsonb),
    'retro_user_ids', coalesce(v_retro, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.project_dashboard_score_inputs(uuid) to authenticated;
