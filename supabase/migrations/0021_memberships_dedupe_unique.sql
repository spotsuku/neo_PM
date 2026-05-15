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
-- 制約の存在判定は array operator の型差 (name[] vs text[]) で
-- 失敗しやすいので、ALTER を試みて duplicate_table/object を握りつぶす
-- 方針に倒す。
do $$
begin
  alter table memberships
    add constraint memberships_user_id_organization_id_key
    unique (user_id, organization_id);
exception
  when duplicate_table or duplicate_object then
    null;  -- 既に同等の unique 制約が存在する場合は何もしない
end $$;
