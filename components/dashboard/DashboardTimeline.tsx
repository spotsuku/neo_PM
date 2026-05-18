"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type {
  PostAuthor,
  TimelinePost,
} from "@/components/timeline/TimelineFeed";

interface ProjectStub {
  id: string;
  name: string;
  team_name: string | null;
}

interface Props {
  orgSlug: string;
  currentUserId: string | null;
  posts: TimelinePost[];
  authorsTuples: [string, PostAuthor][];
  project: ProjectStub;
}

export function DashboardTimeline({
  orgSlug,
  currentUserId,
  posts,
  authorsTuples,
  project,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [local, setLocal] = useState<TimelinePost[]>(posts);
  const [error, setError] = useState<string | null>(null);
  const authorsById = useMemo(
    () => new Map(authorsTuples),
    [authorsTuples],
  );

  useEffect(() => setLocal(posts), [posts]);

  const toggleLike = async (postId: string) => {
    if (!currentUserId) return;
    const cur = local.find((p) => p.post.id === postId);
    if (!cur) return;
    const liked = cur.likes.some((l) => l.user_id === currentUserId);
    if (liked) {
      setLocal((prev) =>
        prev.map((p) =>
          p.post.id === postId
            ? { ...p, likes: p.likes.filter((l) => l.user_id !== currentUserId) }
            : p,
        ),
      );
      await supabase
        .from("project_post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", currentUserId);
    } else {
      const temp = {
        id: `temp-${Date.now()}`,
        post_id: postId,
        user_id: currentUserId,
        created_at: new Date().toISOString(),
      };
      setLocal((prev) =>
        prev.map((p) =>
          p.post.id === postId ? { ...p, likes: [...p.likes, temp] } : p,
        ),
      );
      const { data } = await supabase
        .from("project_post_likes")
        .insert({ post_id: postId, user_id: currentUserId })
        .select()
        .single();
      if (data) {
        setLocal((prev) =>
          prev.map((p) =>
            p.post.id === postId
              ? {
                  ...p,
                  likes: p.likes.map((l) => (l.id === temp.id ? data : l)),
                }
              : p,
          ),
        );
      }
    }
  };

  const addComment = async (postId: string, content: string) => {
    if (!currentUserId || !content.trim()) return;
    const { data, error: err } = await supabase
      .from("project_post_comments")
      .insert({
        post_id: postId,
        author_user_id: currentUserId,
        content: content.trim(),
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "コメントに失敗しました");
      return;
    }
    const author = authorsById.get(currentUserId) ?? null;
    setLocal((prev) =>
      prev.map((p) =>
        p.post.id === postId
          ? { ...p, comments: [...p.comments, { ...data, author }] }
          : p,
      ),
    );
  };

  const deletePost = async (postId: string) => {
    if (!window.confirm("この投稿を削除しますか？")) return;
    setLocal((prev) => prev.filter((p) => p.post.id !== postId));
    await supabase.from("project_posts").delete().eq("id", postId);
  };

  const editPost = async (postId: string, nextContent: string) => {
    const prevPost = local.find((p) => p.post.id === postId);
    if (!prevPost) return;
    // 楽観的更新
    setLocal((prev) =>
      prev.map((p) =>
        p.post.id === postId
          ? { ...p, post: { ...p.post, content: nextContent } }
          : p,
      ),
    );
    const { error: err } = await supabase
      .from("project_posts")
      .update({ content: nextContent })
      .eq("id", postId);
    if (err) {
      // 失敗したら元に戻す
      setLocal((prev) =>
        prev.map((p) => (p.post.id === postId ? prevPost : p)),
      );
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {currentUserId && (
        <CompactComposer
          projectId={project.id}
          currentUserId={currentUserId}
          onPosted={() => router.refresh()}
        />
      )}

      {local.length === 0 ? (
        <div className="t-cap text-center py-6">
          まだ投稿がありません
        </div>
      ) : (
        local.map((tp) => (
          <CompactPostCard
            key={tp.post.id}
            tp={tp}
            currentUserId={currentUserId}
            orgSlug={orgSlug}
            authorsById={authorsById}
            onToggleLike={() => toggleLike(tp.post.id)}
            onComment={(c) => addComment(tp.post.id, c)}
            onDelete={() => deletePost(tp.post.id)}
            onEdit={(c) => editPost(tp.post.id, c)}
          />
        ))
      )}
    </div>
  );
}

function CompactComposer({
  projectId,
  currentUserId,
  onPosted,
}: {
  projectId: string;
  currentUserId: string;
  onPosted: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const uploadImage = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filename = `${projectId}/${currentUserId}/${Date.now()}.${ext}`;
    await supabase.storage
      .from("project-posts")
      .upload(filename, file, { cacheControl: "3600", upsert: false });
    const { data } = supabase.storage
      .from("project-posts")
      .getPublicUrl(filename);
    setImageUrl(data.publicUrl);
    setUploading(false);
  };

  const submit = async () => {
    if (!content.trim() && !imageUrl) return;
    setSubmitting(true);
    await supabase.from("project_posts").insert({
      project_id: projectId,
      author_user_id: currentUserId,
      content: content.trim() || "",
      image_url: imageUrl,
    });
    setContent("");
    setImageUrl(null);
    if (fileRef.current) fileRef.current.value = "";
    setOpen(false);
    setSubmitting(false);
    onPosted();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-white border border-dashed border-line px-3 py-2 text-[11.5px] font-semibold text-mute hover:text-[--c-accent-deep] hover:border-[--c-accent] text-left"
      >
        ✦ タイムラインに投稿...
      </button>
    );
  }

  return (
    <div className="rounded-lg bg-white border border-line p-2.5 flex flex-col gap-1.5">
      <textarea
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="今日の活動 / 気づき"
        autoFocus
        className="w-full rounded-md border border-line-soft bg-white px-2 py-1.5 text-[11.5px] outline-none focus:border-[--c-accent] resize-none"
      />
      {imageUrl && (
        <div
          className="relative rounded-xl overflow-hidden border border-line-soft max-w-[360px]"
          style={{ aspectRatio: "16 / 9" }}
        >
          <Image
            src={imageUrl}
            alt=""
            fill
            unoptimized
            sizes="360px"
            className="object-cover"
          />
          <button
            type="button"
            onClick={() => setImageUrl(null)}
            className="absolute top-1.5 right-1.5 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-semibold text-white"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <label className="rounded-md bg-canvas-2 border border-line-soft px-2 py-0.5 text-[10.5px] text-mute cursor-pointer hover:text-ink">
          {uploading ? "..." : "🖼"}
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
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setContent("");
              setImageUrl(null);
            }}
            className="rounded-md bg-white border border-line px-2 py-0.5 text-[10.5px] text-mute"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || uploading || (!content.trim() && !imageUrl)}
            className="rounded-md bg-ink px-2.5 py-0.5 text-[10.5px] font-semibold text-white disabled:opacity-40"
          >
            {submitting ? "..." : "✦ 投稿"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompactPostCard({
  tp,
  currentUserId,
  orgSlug,
  authorsById,
  onToggleLike,
  onComment,
  onDelete,
  onEdit,
}: {
  tp: TimelinePost;
  currentUserId: string | null;
  orgSlug: string;
  authorsById: Map<string, PostAuthor>;
  onToggleLike: () => void;
  onComment: (c: string) => void;
  onDelete: () => void;
  onEdit: (next: string) => Promise<void> | void;
}) {
  const liked = currentUserId
    ? tp.likes.some((l) => l.user_id === currentUserId)
    : false;
  const isAuthor = tp.author?.user_id === currentUserId;
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(tp.post.content ?? "");
  const sortedComments = [...tp.comments].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );

  const saveEdit = async () => {
    const next = editDraft.trim();
    if (!next) return;
    await onEdit(next);
    setEditing(false);
  };
  return (
    <div className="rounded-lg bg-white border border-line-soft p-2.5">
      <div className="flex items-start gap-2 mb-1.5">
        <span
          className="grid h-7 w-7 place-items-center rounded-full text-white text-[11px] font-semibold flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
          }}
        >
          {(tp.author?.display_name ?? "?")[0]}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11.5px] font-bold truncate">
            {tp.author?.display_name ?? "（名前未設定）"}
          </div>
          <div className="t-cap">{relTime(tp.post.created_at)}</div>
        </div>
        {isAuthor && !editing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setEditDraft(tp.post.content ?? "");
                setEditing(true);
              }}
              className="text-mute hover:text-ink text-[11px]"
              aria-label="編集"
              title="編集"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-mute hover:text-error text-[11px]"
              aria-label="削除"
              title="削除"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="mb-1.5">
          <textarea
            rows={3}
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[--c-accent] resize-none"
          />
          <div className="flex items-center justify-end gap-1.5 mt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md bg-white border border-line px-2 py-0.5 text-[10.5px] text-mute"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={!editDraft.trim()}
              className="rounded-md bg-ink px-2.5 py-0.5 text-[10.5px] font-semibold text-white disabled:opacity-40"
            >
              保存
            </button>
          </div>
        </div>
      ) : (
        tp.post.content && (
          <p className="text-[12px] leading-relaxed mb-1.5 whitespace-pre-wrap break-words">
            {tp.post.content}
          </p>
        )
      )}
      {tp.post.image_url && (
        <div
          className="relative rounded-xl overflow-hidden border border-line-soft mb-1.5 max-w-[360px]"
          style={{ aspectRatio: "16 / 9" }}
        >
          <Image
            src={tp.post.image_url}
            alt=""
            fill
            unoptimized
            sizes="360px"
            className="object-cover"
          />
        </div>
      )}
      <div className="flex items-center gap-3 t-cap">
        <button
          type="button"
          onClick={onToggleLike}
          disabled={!currentUserId}
          className={
            "inline-flex items-center gap-0.5 transition " +
            (liked ? "text-error font-bold" : "hover:text-error")
          }
        >
          <span aria-hidden>{liked ? "❤️" : "🤍"}</span>
          <span>{tp.likes.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="inline-flex items-center gap-0.5 hover:text-[--c-accent-deep]"
        >
          <span aria-hidden>💬</span>
          <span>{sortedComments.length}</span>
        </button>
      </div>
      {showComments && (
        <div className="mt-2 pt-2 border-t border-line-soft flex flex-col gap-1.5">
          {sortedComments.map((c) => {
            const a = c.author ?? authorsById.get(c.author_user_id) ?? null;
            return (
              <div key={c.id} className="flex items-start gap-1.5">
                <span
                  className="grid h-5 w-5 place-items-center rounded-full text-white text-[9px] font-semibold flex-shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                  }}
                >
                  {(a?.display_name ?? "?")[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10.5px] font-semibold">
                    {a?.display_name ?? "—"}{" "}
                    <span className="t-cap font-normal">
                      ・ {relTime(c.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                    {c.content}
                  </p>
                </div>
              </div>
            );
          })}
          {currentUserId && (
            <div className="flex items-center gap-1 mt-0.5">
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
                placeholder="コメント"
                className="flex-1 rounded-full border border-line bg-white px-2 py-1 text-[11px] outline-none focus:border-[--c-accent] min-w-0"
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
                className="rounded-full bg-ink px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
              >
                送信
              </button>
            </div>
          )}
        </div>
      )}
    </div>
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
