-- ============================================================
-- 0021_memberships_dedupe_unique.sql
-- 既存環境で memberships の (user_id, organization_id) 重複行が混入していた
-- ケースに対応する。
--   1. 重複を1行に集約 (ロールの優先度 owner > admin > theme_owner > member、
--      同ロールなら最古行を残す)
--   2. unique 制約を明示的に再付与 (create table if not exists で未付与の
--      テーブルが残っているケースを防ぐ)
--
-- 0001_initial.sql の `create table if not exists memberships(..., unique(...))`
-- は、テーブルが既に存在していると unique 制約が追加されないため、
-- 過去のDBでは制約が付いていない可能性がある。
-- ============================================================

-- ── 1. 重複の解消 ────────────────────────────────────
-- 各 (user_id, organization_id) ペアで「最も高い権限」「同権限なら最古」を残す。
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, organization_id
      order by
        case role
          when 'owner'       then 1
          when 'admin'       then 2
          when 'theme_owner' then 3
          when 'member'      then 4
          else 5
        end,
        created_at asc
    ) as rn
  from memberships
)
delete from memberships m
using ranked r
where m.id = r.id and r.rn > 1;

-- ── 2. unique 制約の付与 (なければ) ───────────────────
do $$
declare
  v_name text;
begin
  -- 既に同等の unique 制約があるなら何もしない
  if exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.memberships'::regclass
      and c.contype = 'u'
      and (
        select array_agg(a.attname order by a.attnum)
        from unnest(c.conkey) k
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
      ) @> array['user_id', 'organization_id']
      and (
        select array_length(conkey, 1) from pg_constraint where oid = c.oid
      ) = 2
  ) then
    return;
  end if;

  -- 無ければ付与
  v_name := 'memberships_user_id_organization_id_key';
  execute format(
    'alter table memberships add constraint %I unique (user_id, organization_id)',
    v_name
  );
end $$;
