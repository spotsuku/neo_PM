-- ============================================================
-- 0070_teams_backfill.sql
-- 既存の theme_applications.team_name テキストから teams / team_members を生成し
-- theme_applications.team_id を埋める backfill。
--
-- 方針:
--   1. 応募者 (applicant_user_id) がまだどのチームにも所属していない場合、
--      その応募の team_name を name として teams 行を作る。
--      名前が空 or 既存のチームと同名 (かつ同 org) の場合は
--      「〇〇のチーム」を fallback にする。
--   2. 作った/見つけた team に applicant_user_id を lead として team_members に追加。
--   3. 応募の team_id を埋める。preference_rank は 1 で埋める (旧応募は 1 テーマ想定)。
--
--   注意: 0069 の trigger によって
--     - team_members INSERT 時に organization_id が自動で入る
--     - 同一 user が同 org で active team を複数持てない (部分ユニークで担保)
--   のため、既に別チームに所属している応募者は「そのチーム」に紐付ける方針とする。
-- ============================================================

do $$
declare
  r record;
  v_team_id uuid;
  v_org uuid;
  v_name text;
  v_existing_team_id uuid;
begin
  for r in
    select ta.id            as app_id,
           ta.theme_id,
           ta.applicant_user_id as user_id,
           ta.team_name,
           t.organization_id
      from theme_applications ta
      join themes t on t.id = ta.theme_id
     where ta.team_id is null
       and ta.applicant_user_id is not null
     order by ta.created_at asc
  loop
    v_org := r.organization_id;

    -- 1. この user が既にこの org でチームに入っているか?
    select tm.team_id into v_existing_team_id
      from team_members tm
     where tm.user_id = r.user_id
       and tm.organization_id = v_org
     limit 1;

    if v_existing_team_id is not null then
      v_team_id := v_existing_team_id;
    else
      -- 2. name を決める
      v_name := coalesce(nullif(btrim(r.team_name), ''), '応募チーム');
      -- 同名衝突を避けるため、必要なら user_id 短縮を付ける
      if exists (
        select 1 from teams
         where organization_id = v_org
           and status = 'active'
           and name = v_name
      ) then
        v_name := v_name || ' #' || substr(r.user_id::text, 1, 4);
      end if;

      insert into teams (organization_id, name, created_by)
      values (v_org, v_name, r.user_id)
      returning id into v_team_id;

      -- 3. 作成者を lead として追加
      -- (organization_id は trigger が同期する)
      insert into team_members (team_id, user_id, role, organization_id)
      values (v_team_id, r.user_id, 'lead', v_org);
    end if;

    -- 4. 応募の team_id / preference_rank を埋める
    update theme_applications
       set team_id = v_team_id,
           preference_rank = coalesce(preference_rank, 1)
     where id = r.app_id;
  end loop;
end $$;
