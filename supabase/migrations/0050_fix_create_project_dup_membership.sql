-- ============================================================
-- NEO PM — create_project_with_lead の重複登録を修正
-- ============================================================
-- 既存の on_project_created トリガー (0005) が projects 作成時に作成者を
-- 自動で lead 登録するため、0049 の関数が同じ行をもう一度 insert すると
-- "duplicate key ... project_memberships_project_id_user_id_key" になっていた。
-- membership 挿入を冪等 (on conflict do nothing) にする。
-- (トリガーが入れた後でも重複せず、万一トリガーが無い環境でも lead は確実に付く)

create or replace function public.create_project_with_lead(
  p_org     uuid,
  p_name    text,
  p_team    text default null,
  p_idea    text default null,
  p_theme   uuid default null,
  p_started timestamptz default null,
  p_due     timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from memberships m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'theme_owner')
  ) then
    raise exception 'not authorized to create project in this organization';
  end if;

  insert into projects (
    organization_id, name, team_name, idea_title,
    theme_id, started_at, due_at, status, visibility
  ) values (
    p_org, p_name, nullif(p_team, ''), nullif(p_idea, ''),
    p_theme, p_started, p_due, 'active', 'private'
  )
  returning id into v_id;

  -- 作成者を lead 登録。on_project_created トリガーが既に入れている場合は何もしない。
  insert into project_memberships (project_id, user_id, role)
  values (v_id, auth.uid(), 'lead')
  on conflict (project_id, user_id) do nothing;

  return v_id;
end;
$$;
