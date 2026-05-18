"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Database } from "@/lib/types/database";

type Post = Database["public"]["Tables"]["project_posts"]["Row"];
type Like = Database["public"]["Tables"]["project_post_likes"]["Row"];
type Comment = Database["public"]["Tables"]["project_post_comments"]["Row"];

export interface PostAuthor {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface ProjectLite {
  id: string;
  name: string;
  team_name?: string | null;
  emoji?: string | null;
}

export interface TimelinePost {
  post: Post;
  author: PostAuthor | null;
  project: ProjectLite | null;
  likes: Like[];
  comments: (Comment & { author?: PostAuthor | null })[];
}

interface Props {
  orgSlug: string;
  currentUserId: string | null;
  posts: TimelinePost[];
  authorsById: Map<string, PostAuthor>;
  /** 投稿可能なプロジェクト一覧。1つだけなら自動選択、0 なら投稿欄を出さない */
  composeProjects: ProjectLite[];
  /** 全プロジェクト横断モード: ヘッダーに「プロジェクト全体のタイムライン」と表示 */
  crossProject?: boolean;
  /** 投稿後のリフレッシュ用 */
  onChanged?: () => void;
}

export function TimelineFeed({
  orgSlug,
  currentUserId,
  posts,
  authorsById,
  composeProjects,
  crossProject = false,
  onChanged,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [local, setLocal] = useState<TimelinePost[]>(posts);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setLocal(posts), [posts]);

  const toggleLike = async (post: Post) => {
    if (!currentUserId) return;
    const cur = local.find((p) => p.post.id === post.id);
    if (!cur) return;
    const liked = cur.likes.some((l) => l.user_id === currentUserId);
    if (liked) {
      // optimistic remove
      setLocal((prev) =>
        prev.map((p) =>
          p.post.id === post.id
            ? {
                ...p,
                likes: p.likes.filter((l) => l.user_id !== currentUserId),
              }
            : p,
        ),
      );
      const { error: err } = await supabase
        .from("project_post_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", currentUserId);
      if (err) setError(err.message);
    } else {
      const optimistic: Like = {
        id: `temp-${Date.now()}`,
        post_id: post.id,
        user_id: currentUserId,
        created_at: new Date().toISOString(),
      };
      setLocal((prev) =>
        prev.map((p) =>
          p.post.id === post.id ? { ...p, likes: [...p.likes, optimistic] } : p,
        ),
      );
      const { data, error: err } = await supabase
        .from("project_post_likes")
        .insert({ post_id: post.id, user_id: currentUserId })
        .select()
        .single();
      if (err) setError(err.message);
      if (data) {
        setLocal((prev) =>
          prev.map((p) =>
            p.post.id === post.id
              ? {
                  ...p,
                  likes: p.likes.map((l) =>
                    l.id === optimistic.id ? data : l,
                  ),
                }
              : p,
          ),
        );
      }
    }
  };

  const addComment = async (post: Post, content: string) => {
    if (!currentUserId || !content.trim()) return;
    const { data, error: err } = await supabase
      .from("project_post_comments")
      .insert({
        post_id: post.id,
        author_user_id: currentUserId,
        content: content.trim(),
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "コメントの追加に失敗しました");
      return;
    }
    const author = authorsById.get(currentUserId) ?? null;
    setLocal((prev) =>
      prev.map((p) =>
        p.post.id === post.id
          ? { ...p, comments: [...p.comments, { ...data, author }] }
          : p,
      ),
    );
  };

  const deletePost = async (postId: string) => {
    if (!window.confirm("この投稿を削除しますか？")) return;
    const { error: err } = await supabase
      .from("project_posts")
      .delete()
      .eq("id", postId);
    if (err) {
      setError(err.message);
      return;
    }
    setLocal((prev) => prev.filter((p) => p.post.id !== postId));
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {composeProjects.length > 0 && currentUserId && (
        <PostComposer
          currentUserId={currentUserId}
          projects={composeProjects}
          onPosted={() => onChanged?.()}
        />
      )}

      {local.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="t-h3 mb-1">
            {crossProject
              ? "まだ投稿がありません"
              : "このプロジェクトに投稿がありません"}
          </h3>
          <p className="t-cap">
            最初の投稿で活動を共有しましょう。画像も貼れます。
          </p>
        </GlassCard>
      ) : (
        local.map((tp) => (
          <PostCard
            key={tp.post.id}
            tp={tp}
            currentUserId={currentUserId}
            orgSlug={orgSlug}
            crossProject={crossProject}
            authorsById={authorsById}
            onToggleLike={() => toggleLike(tp.post)}
            onComment={(c) => addComment(tp.post, c)}
            onDelete={() => deletePost(tp.post.id)}
          />
        ))
      )}
    </div>
  );
}

function PostComposer({
  currentUserId,
  projects,
  onPosted,
}: {
  currentUserId: string;
  projects: ProjectLite[];
  onPosted?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const uploadImage = async (file: File) => {
    setError(null);
    if (!projectId) {
      setError("先にプロジェクトを選んでください");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filename = `${projectId}/${currentUserId}/${Date.now()}.${ext}`;
    const { error: err } = await supabase.storage
      .from("project-posts")
      .upload(filename, file, { cacheControl: "3600", upsert: false });
    if (err) {
      setError(`アップロード失敗: ${err.message}`);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage
      .from("project-posts")
      .getPublicUrl(filename);
    setImageUrl(data.publicUrl);
    setUploading(false);
  };

  const submit = async () => {
    if (!content.trim() && !imageUrl) {
      setError("本文か画像のいずれかを入力してください");
      return;
    }
    if (!projectId) {
      setError("プロジェクトを選んでください");
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.from("project_posts").insert({
      project_id: projectId,
      author_user_id: currentUserId,
      content: content.trim() || "",
      image_url: imageUrl,
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setContent("");
    setImageUrl(null);
    if (fileRef.current) fileRef.current.value = "";
    onPosted?.();
  };

  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="t-label">📝 タイムラインに投稿</span>
        {projects.length > 1 && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-[12px] rounded-md border border-line bg-white px-2 py-1 outline-none focus:border-[--c-accent]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji ?? "🚀"} {p.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <textarea
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="今日の活動 / 気づき / 写真でシェア。チームの後押しになります。"
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-[--c-accent] resize-none mb-2"
      />
      {imageUrl && (
        <div className="relative mb-2 rounded-lg overflow-hidden border border-line-soft">
          <Image
            src={imageUrl}
            alt="upload preview"
            width={800}
            height={500}
            unoptimized
            className="w-full h-auto max-h-[280px] object-cover"
          />
          <button
            type="button"
            onClick={() => setImageUrl(null)}
            className="absolute top-2 right-2 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-semibold text-white"
          >
            ✕ 画像を削除
          </button>
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700 mb-2">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="rounded-md bg-white border border-line px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink cursor-pointer">
          {uploading ? "📤 アップロード中..." : "🖼 画像を添付"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file);
            }}
            className="hidden"
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || uploading || (!content.trim() && !imageUrl)}
          className="rounded-md bg-ink px-4 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? "投稿中..." : "✦ 投稿"}
        </button>
      </div>
    </GlassCard>
  );
}

function PostCard({
  tp,
  currentUserId,
  orgSlug,
  crossProject,
  authorsById,
  onToggleLike,
  onComment,
  onDelete,
}: {
  tp: TimelinePost;
  currentUserId: string | null;
  orgSlug: string;
  crossProject: boolean;
  authorsById: Map<string, PostAuthor>;
  onToggleLike: () => void;
  onComment: (c: string) => void;
  onDelete: () => void;
}) {
  const liked = currentUserId
    ? tp.likes.some((l) => l.user_id === currentUserId)
    : false;
  const isAuthor = tp.author?.user_id === currentUserId;
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");

  const sortedComments = [...tp.comments].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  return (
    <GlassCard className="p-4">
      <div className="flex items-start gap-3 mb-2">
        <span
          className="grid h-10 w-10 place-items-center rounded-full text-white text-[13px] font-semibold flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
          }}
        >
          {(tp.author?.display_name ?? "?")[0]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-bold">
              {tp.author?.display_name ?? "（名前未設定）"}
            </span>
            {crossProject && tp.project && (
              <Link
                href={`/${orgSlug}/dashboard?p=${tp.project.id}`}
                className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-[--c-accent-deep] hover:opacity-80"
              >
                {tp.project.emoji ?? "🚀"} {tp.project.name}
              </Link>
            )}
            <span className="t-cap">{relTime(tp.post.created_at)}</span>
          </div>
        </div>
        {isAuthor && (
          <button
            type="button"
            onClick={onDelete}
            className="text-mute hover:text-error text-[12px]"
            aria-label="削除"
          >
            ✕
          </button>
        )}
      </div>
      {tp.post.content && (
        <p className="text-[13px] leading-relaxed mb-2 whitespace-pre-wrap">
          {tp.post.content}
        </p>
      )}
      {tp.post.image_url && (
        <div className="rounded-lg overflow-hidden border border-line-soft mb-2">
          <Image
            src={tp.post.image_url}
            alt=""
            width={800}
            height={500}
            unoptimized
            className="w-full h-auto max-h-[400px] object-cover"
          />
        </div>
      )}
      <div className="flex items-center gap-3 t-cap">
        <button
          type="button"
          onClick={onToggleLike}
          disabled={!currentUserId}
          className={
            "inline-flex items-center gap-1 transition " +
            (liked ? "text-error font-bold" : "hover:text-error")
          }
        >
          <span aria-hidden>{liked ? "❤️" : "🤍"}</span>
          <span>{tp.likes.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="inline-flex items-center gap-1 hover:text-[--c-accent-deep]"
        >
          <span aria-hidden>💬</span>
          <span>{sortedComments.length}</span>
        </button>
      </div>
      {showComments && (
        <div className="mt-3 pt-3 border-t border-line-soft flex flex-col gap-2">
          {sortedComments.map((c) => {
            const a = c.author ?? authorsById.get(c.author_user_id) ?? null;
            return (
              <div key={c.id} className="flex items-start gap-2">
                <span
                  className="grid h-6 w-6 place-items-center rounded-full text-white text-[10px] font-semibold flex-shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                  }}
                >
                  {(a?.display_name ?? "?")[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11.5px] font-semibold">
                    {a?.display_name ?? "（名前未設定）"}{" "}
                    <span className="t-cap font-normal">
                      ・ {relTime(c.created_at)}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed whitespace-pre-wrap">
                    {c.content}
                  </p>
                </div>
              </div>
            );
          })}
          {currentUserId && (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim()) {
                    onComment(draft);
                    setDraft("");
                  }
                }}
                placeholder="コメントを書く..."
                className="flex-1 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
              />
              <button
                type="button"
                onClick={() => {
                  if (draft.trim()) {
                    onComment(draft);
                    setDraft("");
                  }
                }}
                disabled={!draft.trim()}
                className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                送信
              </button>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}
