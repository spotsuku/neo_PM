-- ============================================================
-- NEO PM — tasks に「実ユーザ担当者」と跨ぎ突合キー(email)を追加
-- ============================================================
-- これまで担当者は owner_name (自由テキスト) のみで、実ユーザに
-- 紐づいていなかった。別アプリ(ワークスペース)とタスクを一元化する
-- ため、担当者を実ユーザ(auth.users)に紐づける。
--
-- ・assignee_user_id: PM 内部の実ユーザ参照
-- ・assignee_email  : 2アプリを跨いで同一人物を突合する canonical キー
--                     (両アプリとも Google ログイン = 同一メール)
--
-- email は profiles に持たせない。profiles は「認証済みなら全員 SELECT 可」
-- のため、列追加すると全ユーザのメールが誰でも読めてしまう。代わりに
-- assignee_user_id から auth.users.email を SECURITY DEFINER トリガーで
-- 自動補完し、email をサーバ側に閉じたまま跨ぎキーを埋める。
-- owner_name は表示用に残す (後方互換)。

alter table public.tasks
  add column if not exists assignee_user_id uuid references auth.users on delete set null,
  add column if not exists assignee_email   text;

create index if not exists tasks_assignee_email_idx on public.tasks (lower(assignee_email));
create index if not exists tasks_assignee_user_idx  on public.tasks (assignee_user_id);

-- ── assignee_user_id → auth.users.email を自動補完 ──────────
create or replace function public.tasks_fill_assignee_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.assignee_user_id is null then
    new.assignee_email := null;
  else
    select lower(u.email) into new.assignee_email
    from auth.users u
    where u.id = new.assignee_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_fill_assignee_email on public.tasks;
create trigger trg_tasks_fill_assignee_email
  before insert or update of assignee_user_id on public.tasks
  for each row execute function public.tasks_fill_assignee_email();

-- ── 既存タスクの best-effort backfill ───────────────────────
-- owner_name が、同じプロジェクトのメンバー表示名と「一意に」一致する
-- 場合のみ assignee_user_id を設定する。同名が複数いる場合は曖昧なので
-- 設定しない (誤紐付け防止)。設定された行はトリガーで email も埋まる。
with candidates as (
  select pm.project_id, p.display_name, p.id as user_id
  from public.project_memberships pm
  join public.profiles p on p.id = pm.user_id
  where p.display_name is not null and p.display_name <> ''
),
unique_match as (
  select project_id, display_name, max(user_id) as user_id
  from candidates
  group by project_id, display_name
  having count(*) = 1
)
update public.tasks t
   set assignee_user_id = um.user_id
  from unique_match um
 where t.assignee_user_id is null
   and t.owner_name is not null
   and t.project_id = um.project_id
   and t.owner_name = um.display_name;
