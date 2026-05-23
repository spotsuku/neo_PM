-- ============================================================
-- NEO PM — テーマ出題の審査ワークフロー & アクセス厳格化
-- ============================================================
-- 背景: 旧 RLS では themes が is_org_member だけで SELECT / FOR ALL 可能だったため、
--   組織メンバー全員が他人の下書きテーマを閲覧・編集・削除できてしまっていた。
--   テーマ出題を「自分の出題のみ編集」「申請→審査→承認で公開」のワークフローに変更する。
--
-- ステータス遷移:
--   draft (記載中) ─申請→ submitted (審査中)
--     submitted ─承認→ active (応募一覧に公開)
--     submitted ─差し戻し→ changes_requested (コメント付きで差し戻し)
--     changes_requested ─修正→申請→ submitted
--     submitted ─取り下げ→ draft
--   active ─終了→ closed / archived (管理者操作・従来通り)

-- 1) ステータス値の拡張 ---------------------------------------
alter table public.themes drop constraint if exists themes_status_check;
alter table public.themes
  add constraint themes_status_check
  check (status in ('draft','submitted','changes_requested','active','closed','archived'));

-- 2) 審査メタ列 -----------------------------------------------
alter table public.themes
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at  timestamptz,
  add column if not exists reviewed_by  uuid references auth.users(id) on delete set null,
  add column if not exists review_note  text;

-- 3) 組織管理者判定ヘルパー ------------------------------------
create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where organization_id = target_org
      and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

-- 4) RLS 再定義 ------------------------------------------------
-- 旧: 組織メンバー全員が全テーマを read/write 可能 (危険)
drop policy if exists "org reads themes"  on public.themes;
drop policy if exists "org writes themes" on public.themes;

-- SELECT:
--   - 管理者: 全テーマ
--   - 出題者本人(posted_by): 自分のテーマは全ステータス
--   - 一般メンバー: 公開済み(active) / 終了(closed) / アーカイブ(archived) のみ
--     → 下書き・申請中・差し戻し中は本人と管理者しか見えない
drop policy if exists "themes select" on public.themes;
create policy "themes select" on public.themes
  for select using (
    public.is_org_admin(organization_id)
    or posted_by = auth.uid()
    or (
      public.is_org_member(organization_id)
      and status in ('active','closed','archived')
    )
  );

-- INSERT: owner/admin/theme_owner のみ。posted_by は必ず自分。
drop policy if exists "themes insert by posters" on public.themes;
create policy "themes insert by posters" on public.themes
  for insert with check (
    posted_by = auth.uid()
    and exists (
      select 1 from memberships m
      where m.organization_id = themes.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin','theme_owner')
    )
  );

-- UPDATE (出題者本人): 編集可能なのは draft / submitted / changes_requested のみ。
--   active/closed/archived へは遷移できない (= 公開判断は管理者のみ)。
drop policy if exists "themes owner updates own" on public.themes;
create policy "themes owner updates own" on public.themes
  for update
  using (
    posted_by = auth.uid()
    and status in ('draft','submitted','changes_requested')
  )
  with check (
    posted_by = auth.uid()
    and status in ('draft','submitted','changes_requested')
  );

-- UPDATE (管理者): 審査 (承認/差し戻し)・公開/終了など全操作。
drop policy if exists "themes admin updates" on public.themes;
create policy "themes admin updates" on public.themes
  for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- DELETE: 出題者本人 または 管理者。
drop policy if exists "themes delete own or admin" on public.themes;
create policy "themes delete own or admin" on public.themes
  for delete using (
    posted_by = auth.uid()
    or public.is_org_admin(organization_id)
  );
