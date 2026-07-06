-- ============================================================
-- 0073_team_invitations.sql
-- チームメンバー追加を「招待 → 承認」フローに変更する。
--   - リーダー / 組織 admin が招待を作成 (pending)
--   - 招待された本人が「受ける / 断る」で応答
--   - 受けた瞬間に team_members へ追加される (RPC で atomically)
--
-- 0072 で追加した「lead が直接追加」ポリシーは巻き戻し。
-- team_members の INSERT は self-join か RPC 経由 (SECURITY DEFINER) のみ。
-- ============================================================

-- ── 0072 の直接追加ポリシーを巻き戻し ─────────────
drop policy if exists "self or lead adds member" on team_members;

create policy "self joins team" on team_members
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from teams t
      where t.id = team_id
        and t.status = 'active'
        and public.is_org_member(t.organization_id)
    )
  );

-- ── team_invitations テーブル ───────────────────────
create table if not exists team_invitations (
  id                 uuid primary key default gen_random_uuid(),
  team_id            uuid not null references teams on delete cascade,
  invited_user_id    uuid not null references auth.users on delete cascade,
  invited_by         uuid not null references auth.users on delete cascade,
  status             text not null default 'pending'
                     check (status in ('pending','accepted','declined','cancelled')),
  message            text,
  created_at         timestamptz not null default now(),
  responded_at       timestamptz
);

create index if not exists team_invitations_team_idx on team_invitations (team_id, status);
create index if not exists team_invitations_user_idx on team_invitations (invited_user_id, status);

-- 同一 (team, user) で pending は 1 件のみ
drop index if exists team_invitations_unique_pending;
create unique index team_invitations_unique_pending
  on team_invitations (team_id, invited_user_id)
  where status = 'pending';

alter table team_invitations enable row level security;

-- SELECT: 招待された本人 / 招待者 / チームメンバー / 組織 admin
drop policy if exists "invited or team member reads invitation" on team_invitations;
create policy "invited or team member reads invitation" on team_invitations
  for select using (
    invited_user_id = auth.uid()
    or invited_by = auth.uid()
    or exists (
      select 1 from team_members tm
      where tm.team_id = team_invitations.team_id
        and tm.user_id = auth.uid()
    )
    or exists (
      select 1 from teams t
      where t.id = team_invitations.team_id
        and public.is_org_admin(t.organization_id)
    )
  );

-- INSERT: チーム lead or 組織 admin が招待を作成
drop policy if exists "lead or admin creates invitation" on team_invitations;
create policy "lead or admin creates invitation" on team_invitations
  for insert with check (
    invited_by = auth.uid()
    and exists (
      select 1 from teams t
      where t.id = team_id and t.status = 'active'
    )
    and exists (
      -- 招待される人は同組織のメンバー
      select 1 from memberships m
      join teams t on t.id = team_id
      where m.user_id = invited_user_id
        and m.organization_id = t.organization_id
    )
    and (
      -- 招待する側は lead or org admin
      exists (
        select 1 from team_members tm
        where tm.team_id = team_invitations.team_id
          and tm.user_id = auth.uid()
          and tm.role = 'lead'
      )
      or exists (
        select 1 from teams t
        where t.id = team_id
          and public.is_org_admin(t.organization_id)
      )
    )
  );

-- UPDATE: 招待された本人 (accept/decline) / 招待者 (cancel) / 組織 admin
drop policy if exists "invited responds or invitor cancels" on team_invitations;
create policy "invited responds or invitor cancels" on team_invitations
  for update using (
    invited_user_id = auth.uid()
    or invited_by = auth.uid()
    or exists (
      select 1 from teams t
      where t.id = team_invitations.team_id
        and public.is_org_admin(t.organization_id)
    )
  ) with check (
    invited_user_id = auth.uid()
    or invited_by = auth.uid()
    or exists (
      select 1 from teams t
      where t.id = team_invitations.team_id
        and public.is_org_admin(t.organization_id)
    )
  );

-- ── 承認 RPC (SECURITY DEFINER) ─────────────────────
-- pending 招待を accepted にしつつ team_members に加入。
-- 掛け持ちで unique 違反したらロールバック。
create or replace function public.accept_team_invitation(inv_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_user_id uuid;
  v_status text;
  v_team_status text;
  v_org uuid;
begin
  select ti.team_id, ti.invited_user_id, ti.status, t.status, t.organization_id
    into v_team_id, v_user_id, v_status, v_team_status, v_org
    from team_invitations ti
    join teams t on t.id = ti.team_id
   where ti.id = inv_id;

  if v_user_id is null then
    raise exception '招待が見つかりません';
  end if;
  if v_user_id <> auth.uid() then
    raise exception 'この招待は自分宛ではありません';
  end if;
  if v_status <> 'pending' then
    raise exception '既に応答済みの招待です';
  end if;
  if v_team_status <> 'active' then
    raise exception 'チームは解散されています';
  end if;

  -- team_members へ (SECURITY DEFINER なので RLS バイパス)
  -- unique 制約 (1人1チーム per org) 違反時は raise でロールバック
  insert into team_members (team_id, user_id, role, organization_id)
  values (v_team_id, v_user_id, 'member', v_org);

  update team_invitations
     set status = 'accepted', responded_at = now()
   where id = inv_id;
end;
$$;

grant execute on function public.accept_team_invitation(uuid) to authenticated;

-- ── Realtime ────────────────────────────────────────
do $$ begin
  begin alter publication supabase_realtime add table team_invitations; exception when others then null; end;
end $$;

comment on table team_invitations is
  'チーム招待。lead / org admin が作成、招待された本人が accept/decline。';
