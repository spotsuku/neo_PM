-- ============================================================
-- NEO PM — プロジェクト用のコンテンツスナップショット (v2)
-- ============================================================
-- 0066 でテーマ用に作った content_snapshots テーブルを、project にも
-- 拡張する。テーマと同じく:
--   - 編集成功時に自動スナップショット (60秒間隔で間引き)
--   - 復元は snapshot_id だけ受け取り、target_id はスナップ行から読む
--     (他プロジェクト/テーマへの誤復元は構造的に不可能)
--   - 復元前に before_restore で現状を退避
--
-- 対象データ:
--   - projects (name / team_name / idea_title / thumbnail_url /
--               started_at / due_at)
--   - execution_plans (why / who / what / how / product / price / place /
--                      promotion / qualitative_goal / schedule /
--                      budget_plan / idea_summary / last_observation)
--
-- 編集権限 (= スナップ作成 / 復元):
--   - プロジェクトメンバー (project_memberships に登録)
--   - 組織管理者 (owner / admin)
-- ============================================================

-- ── 可視性ヘルパー ──────────────────────────────────
create or replace function public.can_view_project_snapshots(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from projects p
    where p.id = p_project_id
      and (
        exists (
          select 1 from project_memberships pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
        or public.is_org_admin(p.organization_id)
      )
  );
$$;

-- 復元権限 (= 可視性と同じで OK。読み書きする人が復元できる)
create or replace function public.can_restore_project_snapshots(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.can_view_project_snapshots(p_project_id);
$$;

-- ── content_snapshots RLS を project にも対応 ─────────
-- 既存 policy を作り直して 'project' 分岐を加える
drop policy if exists "content_snapshots select" on public.content_snapshots;
create policy "content_snapshots select" on public.content_snapshots
  for select using (
    case target_type
      when 'theme'   then public.can_view_theme_snapshots(target_id)
      when 'project' then public.can_view_project_snapshots(target_id)
      else false
    end
  );

drop policy if exists "content_snapshots insert" on public.content_snapshots;
create policy "content_snapshots insert" on public.content_snapshots
  for insert with check (
    case target_type
      when 'theme'   then public.can_restore_theme_snapshots(target_id)
      when 'project' then public.can_restore_project_snapshots(target_id)
      else false
    end
  );

-- ── プロジェクト編集可能カラム抽出 ────────────────────
-- jsonb の構造:
--   { "project": {...}, "execution_plan": {...} }
create or replace function public._project_editable_jsonb(p_project_id uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'project', jsonb_build_object(
      'name',          p.name,
      'team_name',     p.team_name,
      'idea_title',    p.idea_title,
      'thumbnail_url', p.thumbnail_url,
      'started_at',    p.started_at,
      'due_at',        p.due_at
    ),
    'execution_plan', coalesce(
      (select jsonb_build_object(
         'why',              ep.why,
         'who',              ep.who,
         'what',             ep.what,
         'how',              ep.how,
         'product',          ep.product,
         'price',            ep.price,
         'place',            ep.place,
         'promotion',        ep.promotion,
         'qualitative_goal', ep.qualitative_goal,
         'schedule',         ep.schedule,
         'budget_plan',      ep.budget_plan,
         'idea_summary',     ep.idea_summary,
         'last_observation', ep.last_observation
       )
       from execution_plans ep
       where ep.project_id = p.id),
      '{}'::jsonb
    )
  )
  from projects p
  where p.id = p_project_id;
$$;

-- ── スナップショット作成 ─────────────────────────────
create or replace function public.snapshot_project(
  p_project_id uuid,
  p_source     text default 'autosave'
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_recent_count int;
  v_content jsonb;
begin
  if not public.can_view_project_snapshots(p_project_id) then
    raise exception 'permission_denied';
  end if;

  v_content := public._project_editable_jsonb(p_project_id);
  if v_content is null then
    raise exception 'project_not_found';
  end if;

  if p_source = 'autosave' then
    select count(*) into v_recent_count
      from content_snapshots
     where target_type = 'project'
       and target_id   = p_project_id
       and source      = 'autosave'
       and taken_at > now() - interval '60 seconds';
    if v_recent_count > 0 then
      return null;
    end if;
  end if;

  insert into content_snapshots (target_type, target_id, snapshot, taken_by, source)
  values ('project', p_project_id, v_content, auth.uid(), p_source)
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.snapshot_project(uuid, text) is
  'プロジェクトの編集可能カラムをスナップショット保存。autosave は直近60秒内に既にあればスキップ。';

-- ── スナップショット復元 ─────────────────────────────
-- 引数は snapshot_id のみ。target_id はスナップショット行から読むため、
-- 別プロジェクトへの誤復元は構造的に起きない。
create or replace function public.restore_project_snapshot(
  p_snapshot_id uuid
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_target_type text;
  v_target_id   uuid;
  v_snapshot    jsonb;
  v_proj        jsonb;
  v_ep          jsonb;
begin
  select target_type, target_id, snapshot
    into v_target_type, v_target_id, v_snapshot
    from content_snapshots
   where id = p_snapshot_id;

  if v_target_type is null then
    raise exception 'snapshot_not_found';
  end if;
  if v_target_type <> 'project' then
    raise exception 'wrong_target_type';
  end if;

  if not public.can_restore_project_snapshots(v_target_id) then
    raise exception 'permission_denied';
  end if;

  -- 復元前の現状を保存 (戻し直し用)
  perform public.snapshot_project(v_target_id, 'before_restore');

  v_proj := v_snapshot->'project';
  v_ep   := v_snapshot->'execution_plan';

  -- projects (name は coalesce で空文字回避)
  if v_proj is not null then
    update projects
       set
         name          = coalesce(v_proj->>'name', name),
         team_name     = v_proj->>'team_name',
         idea_title    = v_proj->>'idea_title',
         thumbnail_url = v_proj->>'thumbnail_url',
         started_at    = nullif(v_proj->>'started_at','')::timestamptz,
         due_at        = nullif(v_proj->>'due_at','')::timestamptz
     where id = v_target_id;
  end if;

  -- execution_plans (空文字でも更新したいので coalesce しない)
  if v_ep is not null and v_ep <> '{}'::jsonb then
    update execution_plans
       set
         why              = coalesce(v_ep->>'why', why),
         who              = coalesce(v_ep->>'who', who),
         what             = coalesce(v_ep->>'what', what),
         how              = coalesce(v_ep->>'how', how),
         product          = coalesce(v_ep->>'product', product),
         price            = coalesce(v_ep->>'price', price),
         place            = coalesce(v_ep->>'place', place),
         promotion        = coalesce(v_ep->>'promotion', promotion),
         qualitative_goal = coalesce(v_ep->>'qualitative_goal', qualitative_goal),
         schedule         = v_ep->>'schedule',
         budget_plan      = v_ep->>'budget_plan',
         idea_summary     = v_ep->>'idea_summary',
         last_observation = v_ep->>'last_observation'
     where project_id = v_target_id;
  end if;
end;
$$;

comment on function public.restore_project_snapshot(uuid) is
  'snapshot_id を指定してプロジェクトを復元。target_id はスナップショット行から取るため、別プロジェクトへの誤復元は不可能。復元前に before_restore スナップを自動で取る。';
