-- ============================================================
-- NEO PM v2 — Project Timeline + Members title (additive)
-- ============================================================
-- プロジェクトのダッシュボードにメンバー紹介とタイムラインを
-- 追加するためのスキーマ。
--   - project_memberships に title (肩書き) を追加
--   - project_posts: タイムラインの投稿 (画像 + 本文)
--   - project_post_likes: いいね
--   - project_post_comments: コメント
--
-- アクセスは can_access_project に基づく（既存のプロジェクト権限）

-- ── project_memberships.title ────────────────────────
alter table project_memberships
  add column if not exists title text;

-- ── project_posts ────────────────────────────────────
create table if not exists project_posts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects on delete cascade,
  author_user_id  uuid not null references auth.users on delete cascade,
  content         text not null,
  image_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists project_posts_project_idx
  on project_posts (project_id, created_at desc);

alter table project_posts enable row level security;

drop policy if exists "proj access reads posts" on project_posts;
create policy "proj access reads posts" on project_posts
  for select using (public.can_access_project(project_id));

drop policy if exists "proj members insert posts" on project_posts;
create policy "proj members insert posts" on project_posts
  for insert with check (
    public.can_access_project(project_id)
    and author_user_id = auth.uid()
  );

drop policy if exists "author updates own post" on project_posts;
create policy "author updates own post" on project_posts
  for update using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

drop policy if exists "author deletes own post" on project_posts;
create policy "author deletes own post" on project_posts
  for delete using (
    author_user_id = auth.uid() or public.can_manage_project(project_id)
  );

-- ── project_post_likes ───────────────────────────────
create table if not exists project_post_likes (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references project_posts on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  unique(post_id, user_id)
);

create index if not exists project_post_likes_post_idx
  on project_post_likes (post_id);

alter table project_post_likes enable row level security;

drop policy if exists "proj access reads likes" on project_post_likes;
create policy "proj access reads likes" on project_post_likes
  for select using (
    exists (
      select 1 from project_posts p
      where p.id = project_post_likes.post_id
        and public.can_access_project(p.project_id)
    )
  );

drop policy if exists "user inserts own like" on project_post_likes;
create policy "user inserts own like" on project_post_likes
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from project_posts p
      where p.id = project_post_likes.post_id
        and public.can_access_project(p.project_id)
    )
  );

drop policy if exists "user deletes own like" on project_post_likes;
create policy "user deletes own like" on project_post_likes
  for delete using (user_id = auth.uid());

-- ── project_post_comments ────────────────────────────
create table if not exists project_post_comments (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null references project_posts on delete cascade,
  author_user_id  uuid not null references auth.users on delete cascade,
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists project_post_comments_post_idx
  on project_post_comments (post_id, created_at);

alter table project_post_comments enable row level security;

drop policy if exists "proj access reads comments" on project_post_comments;
create policy "proj access reads comments" on project_post_comments
  for select using (
    exists (
      select 1 from project_posts p
      where p.id = project_post_comments.post_id
        and public.can_access_project(p.project_id)
    )
  );

drop policy if exists "proj members insert comments" on project_post_comments;
create policy "proj members insert comments" on project_post_comments
  for insert with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from project_posts p
      where p.id = project_post_comments.post_id
        and public.can_access_project(p.project_id)
    )
  );

drop policy if exists "author deletes own comment" on project_post_comments;
create policy "author deletes own comment" on project_post_comments
  for delete using (
    author_user_id = auth.uid() or exists (
      select 1 from project_posts p
      where p.id = project_post_comments.post_id
        and public.can_manage_project(p.project_id)
    )
  );

-- ── Realtime ────────────────────────────────────────
do $$ begin
  begin alter publication supabase_realtime add table project_posts;         exception when others then null; end;
  begin alter publication supabase_realtime add table project_post_likes;    exception when others then null; end;
  begin alter publication supabase_realtime add table project_post_comments; exception when others then null; end;
end $$;

-- ── Storage bucket (画像投稿用) ────────────────────────
-- パブリックバケットを作成。プロジェクト ID 配下に投稿者ユーザー ID で
-- パスを切る運用想定（クライアント側で path を組み立て）。
insert into storage.buckets (id, name, public)
values ('project-posts', 'project-posts', true)
on conflict (id) do nothing;

-- 認証済みユーザーは bucket にアップロード可
drop policy if exists "authed upload project-posts" on storage.objects;
create policy "authed upload project-posts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-posts');

drop policy if exists "anyone reads project-posts" on storage.objects;
create policy "anyone reads project-posts" on storage.objects
  for select using (bucket_id = 'project-posts');

drop policy if exists "uploader deletes own object" on storage.objects;
create policy "uploader deletes own object" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-posts' and owner = auth.uid());
