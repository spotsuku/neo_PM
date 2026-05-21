-- ============================================================
-- NEO PM — organizations の DELETE ポリシーを追加
-- ============================================================
-- organizations は RLS 有効だが SELECT / INSERT / UPDATE ポリシー
-- しか無く、DELETE ポリシーが存在しなかった。RLS 有効テーブルで
-- ポリシーの無い操作は「エラーなしで0行」になるため、組織設定の
-- 「組織を削除」を実行しても実際には削除されず消えなかった。
-- owner のみ削除可能なポリシーを追加する (UI も owner 限定)。

alter table organizations enable row level security;

drop policy if exists "owners can delete org" on organizations;
create policy "owners can delete org" on organizations
  for delete using (
    exists (select 1 from memberships m
            where m.organization_id = organizations.id
              and m.user_id = auth.uid()
              and m.role = 'owner')
  );
