import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import type {
  PostAuthor,
  ProjectLite,
  TimelinePost,
} from "@/components/timeline/TimelineFeed";

type Client = SupabaseClient<Database>;

/**
 * 指定したプロジェクト ID 群のタイムライン投稿 + 著者 + いいね + コメント
 * を1回でロード。RLS が許可した範囲だけ返る。
 */
export async function loadTimeline(
  supabase: Client,
  projectIds: string[],
  limit = 30,
): Promise<{
  posts: TimelinePost[];
  authorsById: Map<string, PostAuthor>;
}> {
  const empty = { posts: [] as TimelinePost[], authorsById: new Map() };
  if (projectIds.length === 0) return empty;

  const { data: rawPosts } = await supabase
    .from("project_posts")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  const posts = rawPosts ?? [];
  if (posts.length === 0) return empty;

  const postIds = posts.map((p) => p.id);

  const [{ data: likes }, { data: comments }, { data: projects }] =
    await Promise.all([
      supabase.from("project_post_likes").select("*").in("post_id", postIds),
      supabase
        .from("project_post_comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("projects")
        .select("id, name, team_name")
        .in("id", projectIds),
    ]);

  // Collect author user_ids
  const authorIds = new Set<string>();
  for (const p of posts) authorIds.add(p.author_user_id);
  for (const c of comments ?? []) authorIds.add(c.author_user_id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", Array.from(authorIds));

  const authorsById = new Map<string, PostAuthor>();
  for (const p of profiles ?? []) {
    authorsById.set(p.id, {
      user_id: p.id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
    });
  }

  const projectsById = new Map<string, ProjectLite>();
  for (const p of projects ?? []) {
    projectsById.set(p.id, {
      id: p.id,
      name: p.name,
      team_name: p.team_name,
    });
  }

  const likesByPost = new Map<string, typeof likes>();
  for (const l of likes ?? []) {
    const arr = likesByPost.get(l.post_id) ?? [];
    arr.push(l);
    likesByPost.set(l.post_id, arr);
  }

  const commentsByPost = new Map<string, typeof comments>();
  for (const c of comments ?? []) {
    const arr = commentsByPost.get(c.post_id) ?? [];
    arr.push(c);
    commentsByPost.set(c.post_id, arr);
  }

  const timelinePosts: TimelinePost[] = posts.map((post) => ({
    post,
    author: authorsById.get(post.author_user_id) ?? null,
    project: projectsById.get(post.project_id) ?? null,
    likes: likesByPost.get(post.id) ?? [],
    comments: (commentsByPost.get(post.id) ?? []).map((c) => ({
      ...c,
      author: authorsById.get(c.author_user_id) ?? null,
    })),
  }));

  return { posts: timelinePosts, authorsById };
}
