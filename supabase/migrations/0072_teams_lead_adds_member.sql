-- ============================================================
-- 0072_teams_lead_adds_member.sql
-- 現状の INSERT ポリシーは self-join のみ (user_id = auth.uid())。
-- リーダーが未所属メンバーを直接追加できるように拡張する。
--
--   ・追加できる: そのチームの lead OR 組織 admin
--   ・追加される側 (user_id) は同組織のメンバーであること
--   ・active team のみ (解散済チームには追加不可)
-- ============================================================

drop policy if exists "self joins team" on team_members;

create policy "self or lead adds member" on team_members
  for insert with check (
    exists (
      select 1 from teams t
      where t.id = team_id
        and t.status = 'active'
        and public.is_org_member(t.organization_id)
    )
    and (
      -- 自分で加入
      user_id = auth.uid()
      -- または、追加する人が同チームの lead / 組織 admin で、
      -- 追加される人 (user_id) が同組織のメンバー
      or (
        exists (
          select 1 from memberships m
          join teams t on t.id = team_id
          where m.user_id = user_id
            and m.organization_id = t.organization_id
        )
        and (
          exists (
            select 1 from team_members tm
            where tm.team_id = team_members.team_id
              and tm.user_id = auth.uid()
              and tm.role = 'lead'
          )
          or exists (
            select 1 from teams t2
            where t2.id = team_id
              and public.is_org_admin(t2.organization_id)
          )
        )
      )
    )
  );
