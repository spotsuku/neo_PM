-- ============================================================
-- 0016_project_invitations_and_kickoff.sql
-- 採択チーム + 出題者で PJT を起動する UX のための拡張。
--   1. invitations にプロジェクト指定の列を追加 (target_project_id, target_project_role)
--   2. redeem_invitation RPC を更新し、target_project_id が指定されていれば
--      組織 memberships に加えて project_memberships にも自動登録
--   3. peek_invitation RPC を更新し、組織名に加えてプロジェクト名も返す
--   4. theme_applications.project_started_at を追加し、PJT スタート済みかどうかを判定
-- ============================================================

-- ── invitations 列の追加 ──────────────────────────────
alter table invitations
  add column if not exists target_project_id uuid references projects(id) on delete cascade,
  add column if not exists target_project_role text
    check (target_project_role in ('lead','member'));

create index if not exists invitations_target_project_idx
  on invitations (target_project_id) where target_project_id is not null;

-- ── theme_applications にスタート日時 ─────────────────
alter table theme_applications
  add column if not exists project_started_at timestamptz;

-- ── redeem_invitation: project_memberships も登録 ─────
-- 既存関数を一旦 DROP (戻り値型が変わるので create or replace 不可)
drop function if exists public.redeem_invitation(text);
create or replace function public.redeem_invitation(p_token text)
returns table (org_id uuid, org_slug text, org_name text, project_id uuid)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_inv invitations%rowtype;
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

  -- 組織 memberships への登録 (既存ならスキップ)
  if not exists (
    select 1 from memberships
    where organization_id = v_inv.organization_id and user_id = auth.uid()
  ) then
    insert into memberships (user_id, organization_id, role)
    values (auth.uid(), v_inv.organization_id, v_inv.role);
  end if;

  -- プロジェクト指定なら project_memberships へも登録
  if v_inv.target_project_id is not null then
    if not exists (
      select 1 from project_memberships
      where project_id = v_inv.target_project_id and user_id = auth.uid()
    ) then
      insert into project_memberships (project_id, user_id, role)
      values (
        v_inv.target_project_id,
        auth.uid(),
        coalesce(v_inv.target_project_role, 'member')
      );
    end if;
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

-- ── peek_invitation: プロジェクト名も返す ─────────────
drop function if exists public.peek_invitation(text);
create or replace function public.peek_invitation(p_token text)
returns table (
  org_name text,
  role text,
  expired boolean,
  used boolean,
  project_name text,
  project_role text
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
      v_inv.target_project_role;
end;
$$;

grant execute on function public.peek_invitation(text) to anon, authenticated;
