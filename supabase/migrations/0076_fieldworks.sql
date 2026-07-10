-- ============================================================
-- 0076_fieldworks.sql
-- フィールドワーク = テーマオーナーが企画する現地体験。
-- 個人 (組織メンバー) が応募 (= 自動承認、定員内に限る)。
-- 参加者は組織内で可視 (誰が参加予定か全員見える)。
-- ============================================================

create table if not exists fieldworks (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations on delete cascade,
  theme_id               uuid not null references themes on delete cascade,
  title                  text not null,
  owner_name             text,                  -- 表示用のオーナー名 (memberships と別で任意)
  meeting_place          text,                  -- 集合場所 (ランドマーク)
  address                text,                  -- 住所 / アクセス
  meeting_at             timestamptz,           -- 集合日時
  timeline               jsonb not null default '[]'::jsonb,
                                                 -- [{start:'10:00', end:'11:00', activity:'挨拶'}, ...]
  what_you_gain          text,                  -- 得られるもの
  what_to_bring          text,                  -- 持ち物
  dress_code             text,                  -- 服装指定
  rain_plan              text,                  -- 雨天時対応
  cancellation_policy    text,                  -- キャンセルポリシー
  fee_yen                int  not null default 0 check (fee_yen >= 0),
  capacity               int  check (capacity is null or capacity > 0),
  application_deadline   timestamptz,
  thumbnail_url          text,
  status                 text not null default 'draft'
                         check (status in ('draft','published','closed','cancelled')),
  created_by             uuid references auth.users on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists fieldworks_org_idx
  on fieldworks (organization_id, status, meeting_at);
create index if not exists fieldworks_theme_idx on fieldworks (theme_id);
create index if not exists fieldworks_created_by_idx on fieldworks (created_by);

create or replace function public._fieldworks_touch_updated()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists fieldworks_touch_updated on fieldworks;
create trigger fieldworks_touch_updated
before update on fieldworks
for each row execute function public._fieldworks_touch_updated();

alter table fieldworks enable row level security;

-- SELECT: 組織メンバー全員 (draft を含めて見える。UI で下書きは owner に限定表示)
drop policy if exists "org member reads fieldworks" on fieldworks;
create policy "org member reads fieldworks" on fieldworks
  for select using (public.is_org_member(organization_id));

-- INSERT: 組織 admin OR そのテーマの posted_by / theme_owner ロール
drop policy if exists "admin or theme owner creates fieldwork" on fieldworks;
create policy "admin or theme owner creates fieldwork" on fieldworks
  for insert with check (
    created_by = auth.uid()
    and public.is_org_member(organization_id)
    and (
      public.is_org_admin(organization_id)
      or exists (
        select 1 from themes t
        where t.id = theme_id
          and (t.posted_by = auth.uid() or t.organization_id = organization_id)
      )
    )
  );

-- UPDATE: 作成者 OR 組織 admin
drop policy if exists "creator or admin updates fieldwork" on fieldworks;
create policy "creator or admin updates fieldwork" on fieldworks
  for update using (
    created_by = auth.uid() or public.is_org_admin(organization_id)
  ) with check (
    created_by = auth.uid() or public.is_org_admin(organization_id)
  );

-- DELETE: 組織 admin のみ (通常は status='cancelled' 運用)
drop policy if exists "admin deletes fieldwork" on fieldworks;
create policy "admin deletes fieldwork" on fieldworks
  for delete using (public.is_org_admin(organization_id));

-- ── fieldwork_participants ────────────────────────────
create table if not exists fieldwork_participants (
  fieldwork_id           uuid not null references fieldworks on delete cascade,
  user_id                uuid not null references auth.users on delete cascade,
  organization_id        uuid not null,  -- trigger で fieldworks から同期
  motivation             text,           -- 参加理由
  emergency_contact      text,           -- 緊急連絡先
  allergies              text,           -- アレルギー / 食事制限
  transportation         text,           -- 交通手段
  applied_at             timestamptz not null default now(),
  primary key (fieldwork_id, user_id)
);

create index if not exists fieldwork_participants_fw_idx
  on fieldwork_participants (fieldwork_id);
create index if not exists fieldwork_participants_user_idx
  on fieldwork_participants (user_id);
create index if not exists fieldwork_participants_org_idx
  on fieldwork_participants (organization_id);

-- INSERT 時に:
--   1. organization_id を fieldworks から同期
--   2. status='published' チェック
--   3. 締切前チェック
--   4. 定員残チェック (定員があれば)
create or replace function public._fieldwork_participants_before_insert()
returns trigger language plpgsql as $$
declare
  v_org uuid;
  v_status text;
  v_deadline timestamptz;
  v_capacity int;
  v_count int;
begin
  select organization_id, status, application_deadline, capacity
    into v_org, v_status, v_deadline, v_capacity
    from fieldworks
   where id = new.fieldwork_id;
  if v_org is null then
    raise exception 'フィールドワークが見つかりません';
  end if;
  if v_status <> 'published' then
    raise exception 'このフィールドワークは応募受付中ではありません (status=%)', v_status;
  end if;
  if v_deadline is not null and now() > v_deadline then
    raise exception '応募締切を過ぎています';
  end if;
  if v_capacity is not null then
    select count(*) into v_count
      from fieldwork_participants
     where fieldwork_id = new.fieldwork_id;
    if v_count >= v_capacity then
      raise exception '定員に達しました (定員 % 名)', v_capacity;
    end if;
  end if;
  new.organization_id := v_org;
  return new;
end;
$$;

drop trigger if exists fieldwork_participants_before_insert on fieldwork_participants;
create trigger fieldwork_participants_before_insert
before insert on fieldwork_participants
for each row execute function public._fieldwork_participants_before_insert();

alter table fieldwork_participants enable row level security;

-- SELECT: 同組織メンバー全員 (透明化: 誰が参加予定か見える)
drop policy if exists "org member reads participants" on fieldwork_participants;
create policy "org member reads participants" on fieldwork_participants
  for select using (public.is_org_member(organization_id));

-- INSERT: 自分自身のみ (自動承認 = trigger が定員/締切/status をチェック)
drop policy if exists "self applies to fieldwork" on fieldwork_participants;
create policy "self applies to fieldwork" on fieldwork_participants
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from fieldworks f
      where f.id = fieldwork_id
        and public.is_org_member(f.organization_id)
    )
  );

-- DELETE: 自分 (キャンセル) OR フィールドワーク作成者 OR 組織 admin
drop policy if exists "self or owner cancels participant" on fieldwork_participants;
create policy "self or owner cancels participant" on fieldwork_participants
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from fieldworks f
      where f.id = fieldwork_id
        and (f.created_by = auth.uid() or public.is_org_admin(f.organization_id))
    )
  );

-- UPDATE: 自分のみ (motivation 等の編集用)
drop policy if exists "self updates own participation" on fieldwork_participants;
create policy "self updates own participation" on fieldwork_participants
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$ begin
  begin alter publication supabase_realtime add table fieldworks; exception when others then null; end;
  begin alter publication supabase_realtime add table fieldwork_participants; exception when others then null; end;
end $$;

comment on table fieldworks is
  'フィールドワーク (テーマオーナーが企画する現地体験)。テーマに必ず紐付ける。';
comment on table fieldwork_participants is
  'フィールドワーク参加者。自動承認 (定員内に限る)。同組織メンバーに可視。';
