-- ============================================================
-- NEO PM — テーマ出題の管理者 (posted_by) を別ユーザに移管する RPC
-- ============================================================
-- 共同編集者 (editor) でも応募の管理 (採点等) はできないため、出題者本人 or
-- 組織管理者が「テーマ管理者を移管」できるようにする。
--
-- 動作:
--   - themes.posted_by を p_new_user_id に変更
--   - 旧 posted_by は theme_collaborators に role='editor' として upsert
--     (編集権はそのまま保持。完全に追い出さない)
--   - p_new_user_id が collaborator として登録されていた場合は削除
--     (出題者本人を collaborator に重複登録しない)
--
-- 権限:
--   - 呼出者は current posted_by か、組織の owner/admin
--   - p_new_user_id は対象組織のメンバーであること
-- ============================================================

create or replace function public.transfer_theme_owner(
  p_theme_id     uuid,
  p_new_user_id  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_poster uuid;
  v_org_id         uuid;
begin
  if p_new_user_id is null then
    raise exception 'p_new_user_id is required';
  end if;

  select posted_by, organization_id
    into v_current_poster, v_org_id
    from themes
   where id = p_theme_id;

  if not found then
    raise exception 'theme_not_found';
  end if;

  if v_current_poster = p_new_user_id then
    raise exception 'already_owner';
  end if;

  -- 呼出者は current poster か 組織 owner/admin
  if v_current_poster <> auth.uid()
     and not exists (
       select 1 from memberships
        where organization_id = v_org_id
          and user_id = auth.uid()
          and role in ('owner','admin')
     )
  then
    raise exception 'permission_denied';
  end if;

  -- 新出題者は対象組織のメンバーであること
  if not exists (
    select 1 from memberships
     where organization_id = v_org_id
       and user_id = p_new_user_id
  ) then
    raise exception 'new_owner_not_member';
  end if;

  -- 1) 新出題者が collaborator として登録されていれば削除
  delete from theme_collaborators
   where theme_id = p_theme_id
     and user_id = p_new_user_id;

  -- 2) themes.posted_by を切り替え
  update themes
     set posted_by = p_new_user_id
   where id = p_theme_id;

  -- 3) 旧出題者を editor の collaborator として残す
  --    (既存の collaborator レコードがあれば role を editor に上書き)
  insert into theme_collaborators (theme_id, user_id, role, added_by)
  values (p_theme_id, v_current_poster, 'editor', p_new_user_id)
  on conflict (theme_id, user_id)
  do update set role = 'editor';
end;
$$;

comment on function public.transfer_theme_owner(uuid, uuid) is
  'テーマ出題の管理者 (posted_by) を移管する。旧出題者は editor の共同編集者として残す。呼出者は current poster か 組織 owner/admin。';
