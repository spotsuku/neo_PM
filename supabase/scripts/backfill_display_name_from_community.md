# display_name の community 実名バックフィル (一度きりの運用作業)

`profiles.display_name` にメールのローカルパートが入っているユーザ
(サインアップトリガーの旧既定値) を、community_dashboard 側の実名で埋める。

**自分で名前を設定した人は対象外**。`display_name` が
「自分のメールのローカルパート」と完全一致する行だけを更新する。

対象件数 (2026-08-02 時点): 128 名中 **77 名**。自分で設定済み 51 名は非対象。

> 注意: staging と本番は同じ DB (`rcyvdzhbzsfiayetwooh` / pm_board) を共有している。
> この作業は即座に本番へ反映される。

---

## 事前: マイグレーション 0081 を適用

`supabase/migrations/0081_no_email_default_display_name.sql` を pm_board に適用する。
以降の新規ユーザはメール由来の表示名にならない。

---

## STEP 1 — community_dashboard の SQL Editor で実行 (読み取りのみ)

プロジェクト: `ghxdhsnqhsybmghfqyfd` (community_dashboard)

```sql
select
  'update public.profiles p set display_name = v.name from auth.users u, (values '
  || string_agg(format('(%L,%L)', lower(trim(email)), trim(name)), ', ')
  || ') as v(email, name) where u.id = p.id and lower(u.email) = v.email '
  || 'and p.display_name is not null '
  || 'and lower(trim(p.display_name)) = lower(split_part(u.email, ''@'', 1));'
  as sql_to_run
from public.users
where email is not null
  and trim(coalesce(name, '')) <> '';
```

結果セルの値 (完成した UPDATE 文) をコピーする。

---

## STEP 2 — pm_board の SQL Editor で件数を確認 (ドライラン)

プロジェクト: `rcyvdzhbzsfiayetwooh` (pm_board)

STEP 1 でコピーした文の `update public.profiles p set display_name = v.name`
の部分を `select count(*) as will_update` に、`from auth.users u,` を
`from public.profiles p, auth.users u,` に置き換えると件数だけ確認できる。

面倒なら省略可 (STEP 3 の WHERE 条件が十分に絞られているため)。

---

## STEP 3 — pm_board の SQL Editor で実行 (更新)

STEP 1 でコピーした UPDATE 文をそのまま貼り付けて実行する。

---

## STEP 4 — 結果確認

```sql
select
  count(*) as total,
  count(*) filter (where p.display_name is null) as name_null,
  count(*) filter (
    where p.display_name is not null
      and lower(trim(p.display_name)) = lower(split_part(u.email, '@', 1))
  ) as still_email_like
from public.profiles p
join auth.users u on u.id = p.id;
```

`still_email_like` が 0 に近づいていれば成功。残るのは community 側に
アカウントが無い / 名前が空のユーザ。

---

## 残った「メールのまま」の行を「名前未設定」にする (任意)

community に居ないユーザのメール露出も止めたい場合のみ実行する。

```sql
update public.profiles p
set display_name = null
from auth.users u
where u.id = p.id
  and p.display_name is not null
  and lower(trim(p.display_name)) = lower(split_part(u.email, '@', 1));
```

---

## アバターについて

community の `iconUrl` は 1 時間で失効する署名付き URL のため、SQL で一括コピー
できない。アバターは各ユーザが community 経由でログインしたタイミングで
`app/api/auth/community/callback/route.ts` の `rehostAvatar()` が自前ストレージへ
再ホストする。バックフィルは不要。
