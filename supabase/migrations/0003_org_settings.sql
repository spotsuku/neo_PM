-- ============================================================
-- NEO PM v2 — Organization settings (additive)
-- ============================================================
-- 組織情報の追加カラム。0001 / 0002 を実行済みの環境にそのまま流せます。

alter table organizations
  add column if not exists description text,
  add column if not exists emoji       text;

-- 既存組織はデフォルト ✦ をセット（NULL のまま残しても可）
update organizations set emoji = '✦' where emoji is null;

-- 名前と説明文の長さ制約（緩めに）
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_name_len'
  ) then
    alter table organizations
      add constraint organizations_name_len check (length(name) between 1 and 80);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_description_len'
  ) then
    alter table organizations
      add constraint organizations_description_len
        check (description is null or length(description) <= 500);
  end if;
end $$;
