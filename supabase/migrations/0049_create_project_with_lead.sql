-- ============================================================
-- NEO PM — プロジェクト作成 + 作成者リード登録を一括で行う関数
-- ============================================================
-- 背景: 0048 で projects の SELECT を厳格化 (private は参加者/管理者のみ) した結果、
--   クライアントが「projects を insert → 直後に行を読み戻す (.select())」しようとすると、
--   組織adminでない作成者(テーマオーナー等)はまだ project_memberships が無いため
--   読み戻せず "new row violates row-level security policy" になっていた。
--   作成とリード登録は不可分なので、SECURITY DEFINER 関数で原子的に行う。

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
  -- 作成権限: owner / admin / theme_owner のみ (definer なので明示チェック)
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

  -- 作成者を lead として登録 (本人が private プロジェクトを閲覧/管理できるように)
  insert into project_memberships (project_id, user_id, role)
  values (v_id, auth.uid(), 'lead');

  return v_id;
end;
$$;

grant execute on function public.create_project_with_lead(
  uuid, text, text, text, uuid, timestamptz, timestamptz
) to authenticated;
