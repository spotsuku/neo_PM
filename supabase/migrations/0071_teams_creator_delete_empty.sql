-- ============================================================
-- 0071_teams_creator_delete_empty.sql
-- チーム作成直後にメンバー追加失敗 (掛け持ち禁止で弾かれた等) が起きた場合、
-- クライアントから孤立チームを巻き戻し削除する必要がある。
-- しかし DELETE の RLS は組織 admin のみ許可されており、一般メンバーは削除できない。
--
-- そこで「メンバー0人 かつ 自分が created_by」のチームに限り
-- creator による DELETE を許可する。孤立チーム掃除用の narrow policy。
-- ============================================================

drop policy if exists "creator deletes empty own team" on teams;
create policy "creator deletes empty own team" on teams
  for delete using (
    created_by = auth.uid()
    and not exists (
      select 1 from team_members tm where tm.team_id = teams.id
    )
  );
