-- ============================================================
-- NEO PM v2 — Invitations (additive migration)
-- ============================================================
-- 既存の v2 スキーマに招待機能を追加。0001 を実行済みの環境で
-- そのまま流せます（破壊的な変更なし）。

-- ── invitations table ─────────────────────────────────────────
create table if not exists invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations on delete cascade,
  created_by      uuid not null references auth.users on delete cascade,
  token           text unique not null default replace(gen_random_uuid()::text, '-', ''),
  role            text not null default 'member'
                  check (role in ('admin','member')),
  note            text,
  expires_at      timestamptz default (now() + interval '14 days'),
  used_at         timestamptz,
  used_by         uuid references auth.users on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists invitations_org_idx   on invitations (organization_id);
create index if not exists invitations_token_idx on invitations (token);

alter table invitations enable row level security;

-- 組織メンバーは招待を一覧/詳細表示できる
drop policy if exists "org members can read invitations" on invitations;
create policy "org members can read invitations" on invitations
  for select using (public.is_org_member(organization_id));

-- owner / admin だけが招待を作成できる
drop policy if exists "owner or admin can insert invitations" on invitations;
create policy "owner or admin can insert invitations" on invitations
  for insert with check (
    exists (
      select 1 from memberships m
      where m.organization_id = invitations.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- owner / admin だけが招待を取り消せる
drop policy if exists "owner or admin can delete invitations" on invitations;
create policy "owner or admin can delete invitations" on invitations
  for delete using (
    exists (
      select 1 from memberships m
      where m.organization_id = invitations.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- ── redeem_invitation RPC ────────────────────────────────────
-- 招待トークンを引数に取り、現在の認証ユーザーをそのまま membership に
-- 追加する。security definer なので RLS をバイパスして安全に処理可能。
-- 戻り値: 加入した組織の id / slug

create or replace function public.redeem_invitation(p_token text)
returns table (org_id uuid, org_slug text, org_name text)
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

  -- すでに同じ組織のメンバーであれば「成功」として扱う
  if not exists (
    select 1 from memberships
    where organization_id = v_inv.organization_id and user_id = auth.uid()
  ) then
    insert into memberships (user_id, organization_id, role)
    values (auth.uid(), v_inv.organization_id, v_inv.role);
  end if;

  update invitations
    set used_at = now(), used_by = auth.uid()
    where id = v_inv.id;

  select slug, name into v_slug, v_name from organizations
   where id = v_inv.organization_id;

  return query select v_inv.organization_id, v_slug, v_name;
end;
$$;

grant execute on function public.redeem_invitation(text) to authenticated;

-- ── peek_invitation RPC (token から組織名だけ返す、未ログインでもOK) ──
create or replace function public.peek_invitation(p_token text)
returns table (org_name text, role text, expired boolean, used boolean)
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
      v_inv.used_at is not null;
end;
$$;

grant execute on function public.peek_invitation(text) to anon, authenticated;
