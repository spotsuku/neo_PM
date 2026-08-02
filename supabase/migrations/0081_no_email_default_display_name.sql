-- ── サインアップ時の既定表示名からメールアドレスを排除する ──────────
--
-- これまで handle_new_user() は display_name を
--   coalesce(metadata.name, metadata.full_name, split_part(email, '@', 1))
-- で初期化していたため、メールリンク/OTP でサインアップしたユーザは
-- 「メールのローカルパート」が表示名として保存されていた。
-- その結果、チーム一覧などで他メンバーにメールアドレス相当の文字列が
-- 見えてしまっていた (例: 0820shimba, a-kuboyama)。
--
-- 表示名が本人由来でない場合は NULL のままにし、UI 側で「名前未設定」に
-- フォールバックさせる。community 連携ログイン時に実名で上書きされる。
-- 個人組織名も同様にメール由来の名前を使わない。

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_org_id   uuid;
  real_name    text;
  base_name    text;
  base_slug    text;
  suffix       text;
begin
  -- 本人由来の名前のみ採用する (メールのローカルパートは使わない)
  real_name := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data ->> 'name',
        new.raw_user_meta_data ->> 'full_name',
        ''
      )
    ),
    ''
  );

  -- Profile (名前が無ければ NULL のまま = UI 側で「名前未設定」表示)
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    real_name,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  -- Personal org (名前が無ければ汎用名。メールは使わない)
  base_name := coalesce(real_name, 'わたし');
  base_slug := lower(regexp_replace(base_name, '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'team'; end if;
  suffix := substr(md5(new.id::text), 1, 4);

  insert into public.organizations (name, slug)
  values (base_name || ' のチーム', base_slug || '-' || suffix)
  returning id into new_org_id;

  insert into public.memberships (user_id, organization_id, role)
  values (new.id, new_org_id, 'owner');

  return new;
end;
$$;

-- 既存データ (display_name にメールのローカルパートが入っている行) の補正は
-- community 側の実名バックフィルと合わせて別途行う。ここではトリガーのみ変更。
