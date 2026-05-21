-- ============================================================
-- NEO PM — 組織削除を SECURITY DEFINER RPC に集約
-- ============================================================
-- これまで組織削除はクライアントから
--   delete from organizations where id = ... returning id
-- を直接叩いていたが、以下が絡んで不安定だった:
--   1. RLS の DELETE ポリシー有無で「エラー無し0行(サイレント失敗)」
--   2. `.select()` の RETURNING は SELECT ポリシー(is_org_member)で
--      フィルタされるが、削除と同時に memberships も cascade 削除される
--      ため、実際は成功でも RETURNING が空になり「失敗」と誤検知
--   3. これらの組み合わせで 400 等の不安定な応答
--
-- owner 検証 + 削除をサーバ側の SECURITY DEFINER 関数に集約し、
-- 明示的に boolean を返すことで、上記すべてを解消する。
-- (関数は定義者権限で動くため RLS の DELETE ポリシーに依存しない。
--  cascade は従来どおり DB の外部キーで処理される)

create or replace function public.delete_organization(p_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
begin
  select exists (
    select 1 from memberships m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  ) into is_owner;

  if not is_owner then
    raise exception 'not authorized to delete this organization'
      using errcode = '42501';
  end if;

  delete from organizations where id = p_org_id;
  return true;
end;
$$;

revoke all on function public.delete_organization(uuid) from public;
grant execute on function public.delete_organization(uuid) to authenticated;
