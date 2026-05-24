-- ============================================================
-- NEO PM — プロジェクトの公開フロー (Phase 1)
-- ============================================================
-- プロジェクトを作成しても、ホーム(一覧/ランキング)に出すには
-- 「公開申請 → 管理者の審査 → 承認」が必要。コンペ(テーマ応募)承認で
-- 作られたプロジェクトは作成時に自動で公開済みにする(アプリ側で設定)。
--
-- visibility:
--   private   … 既定。参加者と管理者しか見られない (ホーム非掲載)
--   submitted … 公開申請中 (審査待ち)。参加者と管理者のみ閲覧
--   published … 公開済み。組織メンバー全員がホーム/ダッシュを閲覧可

alter table public.projects
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'submitted', 'published')),
  add column if not exists publish_submitted_at timestamptz,
  add column if not exists publish_reviewed_at  timestamptz,
  add column if not exists publish_reviewed_by  uuid references auth.users(id) on delete set null,
  add column if not exists publish_note         text;

-- 既存プロジェクトはこれまでホームに出ていたため、後方互換で公開済みにする。
-- (新規作成のみ default 'private' で申請が必要)
update public.projects set visibility = 'published' where visibility = 'private';

-- ── SELECT RLS を更新 ────────────────────────────────
-- published は組織メンバー全員が閲覧可。
-- private / submitted は「参加者(プロジェクトメンバー) または 組織管理者」のみ。
--   → can_access_project(id) = 組織 owner/admin OR project_membership
drop policy if exists "org reads projects" on public.projects;
create policy "org reads projects" on public.projects
  for select using (
    public.is_org_member(organization_id)
    and (
      visibility = 'published'
      or public.can_access_project(id)
    )
  );

-- ── 作成者が「最初の lead」として自分を登録できるようにする ──────────
-- 上記 SELECT 厳格化により、private プロジェクトは can_access_project が true の
-- 人しか見られない。作成直後はまだ lead が居ないため、テーマオーナー(組織admin
-- ではない作成者)は自分の作ったプロジェクトすら見られなくなる。
-- そこで「まだメンバーが居ないプロジェクトに、本人が lead として参加する」
-- 初回ブートストラップだけを許可する (以降は従来の can_manage_project 管理)。
drop policy if exists "creator bootstraps first lead" on public.project_memberships;
create policy "creator bootstraps first lead" on public.project_memberships
  for insert with check (
    user_id = auth.uid()
    and role = 'lead'
    and public.is_org_member(public.project_org(project_id))
    and not exists (
      select 1 from public.project_memberships pm
      where pm.project_id = project_memberships.project_id
    )
  );
