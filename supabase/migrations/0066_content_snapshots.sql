-- ============================================================
-- NEO PM — テーマ / プロジェクトのコンテンツ自動スナップショット
-- ============================================================
-- ワークショップ等で入力したテーマ内容が消失する事故に対応するため、
-- 「スプレッドシートの版履歴」のような時刻指定復元を提供する。
--
-- 設計:
--   - 単一テーブル content_snapshots に target_type で theme / project を分離
--   - 各 target ごとに、編集時刻ごとに jsonb スナップショットを保存
--   - 復元 RPC は snapshot_id だけ受け取り、target_id はその行から読む
--     → ユーザ入力で別 ID を渡せないため、別テーマへの誤復元が
--       「構造的に」発生しない
--   - 復元前に「現在の状態」を before_restore として再スナップ
--     → やっぱり戻したい時に即戻せる
-- ============================================================

create table if not exists public.content_snapshots (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('theme','project')),
  target_id   uuid not null,
  snapshot    jsonb not null,
  taken_at    timestamptz not null default now(),
  taken_by    uuid references auth.users(id) on delete set null,
  source      text not null default 'autosave'
              check (source in ('autosave','manual','before_restore'))
);

create index if not exists content_snapshots_target_idx
  on public.content_snapshots (target_type, target_id, taken_at desc);

alter table public.content_snapshots enable row level security;

-- ── 可視性ヘルパー ──────────────────────────────────
-- 対象テーマのスナップショットを見て/作っていい人:
--   - テーマの出題者
--   - 同 org の owner/admin
--   - editor または viewer の共同編集者
create or replace function public.can_view_theme_snapshots(p_theme_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from themes t
    where t.id = p_theme_id
      and (
        t.posted_by = auth.uid()
        or public.is_org_admin(t.organization_id)
        or public.is_theme_collaborator(t.id, array['editor','viewer'])
      )
  );
$$;

-- 編集 (= 復元) していい人 (viewer は閲覧のみで復元は不可):
create or replace function public.can_restore_theme_snapshots(p_theme_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from themes t
    where t.id = p_theme_id
      and (
        t.posted_by = auth.uid()
        or public.is_org_admin(t.organization_id)
        or public.is_theme_collaborator(t.id, array['editor'])
      )
  );
$$;

-- ── RLS ─────────────────────────────────────────────
drop policy if exists "content_snapshots select" on public.content_snapshots;
create policy "content_snapshots select" on public.content_snapshots
  for select using (
    case target_type
      when 'theme' then public.can_view_theme_snapshots(target_id)
      else false
    end
  );

drop policy if exists "content_snapshots insert" on public.content_snapshots;
create policy "content_snapshots insert" on public.content_snapshots
  for insert with check (
    case target_type
      when 'theme' then public.can_restore_theme_snapshots(target_id)
      else false
    end
  );

-- UPDATE / DELETE は禁止 (履歴は不変)
drop policy if exists "content_snapshots no update" on public.content_snapshots;
drop policy if exists "content_snapshots no delete" on public.content_snapshots;

-- ============================================================
-- テーマ用 RPC
-- ============================================================

-- ユーザ編集可能なテーマカラムだけを抽出して jsonb で返す。
-- ここに無いカラムは復元時にも touch しないので、別テーマや system 列を
-- 誤って書き換える事故を防げる。
create or replace function public._theme_editable_jsonb(p_theme_id uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title',                t.title,
    'code',                 t.code,
    'category',             t.category,
    'vision',               t.vision,
    'current_state',        t.current_state,
    'pain',                 t.pain,
    'root_cause',           t.root_cause,
    'focus_issue',          t.focus_issue,
    'background',           t.background,
    'who_target',           t.who_target,
    'what_benefit',         t.what_benefit,
    'what_uniqueness',      t.what_uniqueness,
    'how_hypothesis',       t.how_hypothesis,
    'expected_outcome',     t.expected_outcome,
    'internal_challenges',  t.internal_challenges,
    'theme_candidates',     t.theme_candidates,
    'implementation_level', t.implementation_level,
    'resource_people',      t.resource_people,
    'resource_place',       t.resource_place,
    'resource_budget',      t.resource_budget,
    'resource_data',        t.resource_data,
    'resource_other',       t.resource_other,
    'post_action',          t.post_action,
    'description_long',     t.description_long,
    'thumbnail_url',        t.thumbnail_url,
    'thumbnail_zoom',       t.thumbnail_zoom,
    'thumbnail_offset_x',   t.thumbnail_offset_x,
    'thumbnail_offset_y',   t.thumbnail_offset_y,
    'criteria_region',      t.criteria_region,
    'criteria_means',       t.criteria_means,
    'criteria_youth',       t.criteria_youth,
    'company_name',         t.company_name,
    'contact_name',         t.contact_name,
    'deadline',             t.deadline,
    'prize',                t.prize
  )
  from themes t
  where t.id = p_theme_id;
$$;

-- スナップショット作成。直前 60 秒以内のスナップショットが既にあれば
-- 重複防止でスキップ。 source は 'autosave' or 'manual' or 'before_restore'。
create or replace function public.snapshot_theme(
  p_theme_id uuid,
  p_source   text default 'autosave'
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
  if not public.can_view_theme_snapshots(p_theme_id) then
    raise exception 'permission_denied';
  end if;

  v_content := public._theme_editable_jsonb(p_theme_id);
  if v_content is null then
    raise exception 'theme_not_found';
  end if;

  -- before_restore / manual は重複防止しない。autosave のみ 60 秒ガード。
  if p_source = 'autosave' then
    select count(*) into v_recent_count
      from content_snapshots
     where target_type = 'theme'
       and target_id   = p_theme_id
       and source      = 'autosave'
       and taken_at > now() - interval '60 seconds';
    if v_recent_count > 0 then
      return null;
    end if;
  end if;

  insert into content_snapshots (target_type, target_id, snapshot, taken_by, source)
  values ('theme', p_theme_id, v_content, auth.uid(), p_source)
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.snapshot_theme(uuid, text) is
  'テーマの編集可能カラムをスナップショット保存。autosave は直近60秒内に既にあればスキップ。';

-- スナップショット復元。
-- 引数は snapshot_id のみ。target_id はスナップショット行から読むため、
-- 別テーマへの誤復元は構造的に起きない。
-- 復元前に現在状態を before_restore として再スナップする。
create or replace function public.restore_theme_snapshot(
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
begin
  select target_type, target_id, snapshot
    into v_target_type, v_target_id, v_snapshot
    from content_snapshots
   where id = p_snapshot_id;

  if v_target_type is null then
    raise exception 'snapshot_not_found';
  end if;
  if v_target_type <> 'theme' then
    raise exception 'wrong_target_type';
  end if;

  if not public.can_restore_theme_snapshots(v_target_id) then
    raise exception 'permission_denied';
  end if;

  -- 復元前の現状を保存 (やっぱり戻したい用)
  perform public.snapshot_theme(v_target_id, 'before_restore');

  -- ※ jsonb の値はキャストで型に戻す。snapshot に無いキーは
  --   coalesce で現在値を残す (= 未知の新カラムは触らない)
  update themes
     set
       title                = coalesce(v_snapshot->>'title', title),
       code                 = v_snapshot->>'code',
       category             = nullif(v_snapshot->>'category','')::text,
       vision               = v_snapshot->>'vision',
       current_state        = v_snapshot->>'current_state',
       pain                 = v_snapshot->>'pain',
       root_cause           = v_snapshot->>'root_cause',
       focus_issue          = v_snapshot->>'focus_issue',
       background           = v_snapshot->>'background',
       who_target           = v_snapshot->>'who_target',
       what_benefit         = v_snapshot->>'what_benefit',
       what_uniqueness      = v_snapshot->>'what_uniqueness',
       how_hypothesis       = v_snapshot->>'how_hypothesis',
       expected_outcome     = v_snapshot->>'expected_outcome',
       internal_challenges  = v_snapshot->>'internal_challenges',
       theme_candidates     = v_snapshot->>'theme_candidates',
       implementation_level = nullif(v_snapshot->>'implementation_level','')::text,
       resource_people      = v_snapshot->>'resource_people',
       resource_place       = v_snapshot->>'resource_place',
       resource_budget      = v_snapshot->>'resource_budget',
       resource_data        = v_snapshot->>'resource_data',
       resource_other       = v_snapshot->>'resource_other',
       post_action          = v_snapshot->>'post_action',
       description_long     = v_snapshot->>'description_long',
       thumbnail_url        = v_snapshot->>'thumbnail_url',
       thumbnail_zoom       = nullif(v_snapshot->>'thumbnail_zoom','')::numeric,
       thumbnail_offset_x   = nullif(v_snapshot->>'thumbnail_offset_x','')::numeric,
       thumbnail_offset_y   = nullif(v_snapshot->>'thumbnail_offset_y','')::numeric,
       criteria_region      = coalesce((v_snapshot->>'criteria_region')::boolean, criteria_region),
       criteria_means       = coalesce((v_snapshot->>'criteria_means')::boolean,  criteria_means),
       criteria_youth       = coalesce((v_snapshot->>'criteria_youth')::boolean,  criteria_youth),
       company_name         = v_snapshot->>'company_name',
       contact_name         = v_snapshot->>'contact_name',
       deadline             = nullif(v_snapshot->>'deadline','')::timestamptz,
       prize                = v_snapshot->>'prize'
   where id = v_target_id;
end;
$$;

comment on function public.restore_theme_snapshot(uuid) is
  'snapshot_id を指定してテーマを復元。target_id はスナップショット行から取るため、別テーマへの誤復元は不可能。復元前に before_restore スナップを自動で取る。';
