-- ============================================================
-- 0018_bulk_invitations.sql
-- 100名規模の一括招待 + 名前/所属/肩書きの事前登録に対応する。
--
-- 設計:
--   - invitations に intended_email / intended_name / intended_affiliation /
--     intended_title を追加。管理者が事前に「誰宛か」と「プロフィール初期値」
--     を入れておく。
--   - memberships に affiliation / title を追加。各組織でメンバーごとの所属
--     肩書きを保持する。
--   - redeem_invitation を更新:
--       * intended_email が指定されていれば auth.email() と照合 (一致しない
--         場合は raise exception 'email_mismatch')
--       * memberships INSERT 時に affiliation / title を埋める
--       * profiles.display_name が空なら intended_name で埋める
--   - peek_invitation を更新: intended_email / intended_name も返す
-- ============================================================

-- ── invitations 列追加 ────────────────────────────────
alter table invitations
  add column if not exists intended_email      text,
  add column if not exists intended_name       text,
  add column if not exists intended_affiliation text,
  add column if not exists intended_title      text;

create index if not exists invitations_intended_email_idx
  on invitations (lower(intended_email))
  where intended_email is not null;

-- ── memberships 列追加 ────────────────────────────────
alter table memberships
  add column if not exists affiliation text,
  add column if not exists title       text;

-- ── redeem_invitation を更新 (戻り型は変えないので OR REPLACE 可) ────
create or replace function public.redeem_invitation(p_token text)
returns table (org_id uuid, org_slug text, org_name text, project_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_inv invitations%rowtype;
  v_email text;
  v_slug text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select * into v_inv from invitations
  where token = p_token
  limit 1;

  if not found then
    raise exception 'invalid_token';
  end if;

  if v_inv.used_at is not null then
    raise exception 'already_used';
  end if;

  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'expired';
  end if;

  -- intended_email が指定されているなら現在のサインインメールと照合
  if v_inv.intended_email is not null and v_inv.intended_email <> '' then
    select email into v_email from auth.users where id = auth.uid();
    if v_email is null or lower(v_email) <> lower(v_inv.intended_email) then
      raise exception 'email_mismatch';
    end if;
  end if;

  -- 組織 memberships への登録 (既存ならスキップ、無ければ affiliation/title 込みで)
  if not exists (
    select 1 from memberships
    where organization_id = v_inv.organization_id and user_id = auth.uid()
  ) then
    insert into memberships (
      user_id, organization_id, role, affiliation, title
    )
    values (
      auth.uid(),
      v_inv.organization_id,
      v_inv.role,
      v_inv.intended_affiliation,
      v_inv.intended_title
    );
  end if;

  -- プロジェクト指定なら project_memberships へも登録
  if v_inv.target_project_id is not null then
    if not exists (
      select 1 from project_memberships
      where project_id = v_inv.target_project_id and user_id = auth.uid()
    ) then
      insert into project_memberships (
        project_id, user_id, role, title
      )
      values (
        v_inv.target_project_id,
        auth.uid(),
        coalesce(v_inv.target_project_role, 'member'),
        v_inv.intended_title
      );
    end if;
  end if;

  -- profiles.display_name が空なら intended_name で埋める
  if v_inv.intended_name is not null and v_inv.intended_name <> '' then
    update profiles
       set display_name = coalesce(nullif(display_name, ''), v_inv.intended_name)
     where id = auth.uid();
  end if;

  update invitations
    set used_at = now(), used_by = auth.uid()
    where id = v_inv.id;

  select slug, name into v_slug, v_name from organizations
   where id = v_inv.organization_id;

  return query select
    v_inv.organization_id, v_slug, v_name, v_inv.target_project_id;
end;
$$;

grant execute on function public.redeem_invitation(text) to authenticated;

-- ── peek_invitation を更新 (戻り型変更のため drop が必要) ────────
drop function if exists public.peek_invitation(text);
create or replace function public.peek_invitation(p_token text)
returns table (
  org_name text,
  role text,
  expired boolean,
  used boolean,
  project_name text,
  project_role text,
  intended_email text,
  intended_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv invitations%rowtype;
begin
  select * into v_inv from invitations
  where token = p_token
  limit 1;
  if not found then
    raise exception 'invalid_token';
  end if;
  return query
    select
      (select name from organizations where id = v_inv.organization_id),
      v_inv.role,
      v_inv.expires_at is not null and v_inv.expires_at < now(),
      v_inv.used_at is not null,
      case
        when v_inv.target_project_id is null then null
        else (select name from projects where id = v_inv.target_project_id)
      end,
      v_inv.target_project_role,
      v_inv.intended_email,
      v_inv.intended_name;
end;
$$;

grant execute on function public.peek_invitation(text) to anon, authenticated;
