"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

interface Props {
  projectId: string;
  currentUrl: string | null;
  canEdit: boolean;
  /** ヒーローのサムネに被せるトリガー。子のクリックでモーダルが開く */
  children: React.ReactNode;
}

/** プロジェクトサムネを編集するクライアントコンポーネント。
 *  サムネ画像 (any 子要素) をクリックすると編集モーダルが出る。
 *  - File アップロード (Supabase Storage: project-posts/thumbnails/<projectId>/...)
 *  - URL を直接入力
 *  - 画像をクリア
 *  保存は projects.thumbnail_url を update。
 */
export function ThumbnailEditor({
  projectId,
  currentUrl,
  canEdit,
  children,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(currentUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  if (!canEdit) {
    return <>{children}</>;
  }

  const close = () => {
    setOpen(false);
    setError(null);
  };

  const saveUrl = async (next: string | null) => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("projects")
      .update({ thumbnail_url: next })
      .eq("id", projectId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選んでください");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("5MB 以下の画像を選んでください");
      return;
    }
    setBusy(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `thumbnails/${projectId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("project-posts")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setBusy(false);
      setError(`アップロード失敗: ${upErr.message}`);
      return;
    }
    const { data: pub } = supabase.storage
      .from("project-posts")
      .getPublicUrl(path);
    const publicUrl = pub.publicUrl;
    setUrl(publicUrl);
    await saveUrl(publicUrl);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative group block w-full text-left"
        title="プロジェクトサムネを変更"
      >
        {children}
        <span className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition bg-ink/30 rounded-2xl">
          <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11.5px] font-bold text-ink shadow-md">
            📷 画像を変更
          </span>
        </span>
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto"
          onClick={close}
          style={{ background: "#f5f7fc" }}
        >
          <div
            className="min-h-screen w-full max-w-2xl mx-auto px-5 py-8 md:py-12"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="t-h2">
                <span aria-hidden className="mr-2">
                  📷
                </span>
                プロジェクト画像
              </h2>
              <button
                type="button"
                onClick={close}
                className="rounded-full bg-white border border-line px-4 py-2 text-[12px] font-semibold text-mute hover:bg-mute/5"
              >
                ✕ 閉じる
              </button>
            </div>

            {/* プレビュー */}
            <div
              className="w-full rounded-2xl mb-6 overflow-hidden border border-line-soft shadow-md"
              style={{
                aspectRatio: "16 / 9",
                background: url
                  ? `url(${url}) center / cover`
                  : "linear-gradient(135deg, var(--c-accent-soft), var(--c-accent-bright))",
              }}
            >
              {!url && (
                <div className="w-full h-full grid place-items-center text-7xl text-white/90">
                  🚀
                </div>
              )}
            </div>

            {/* ファイルアップロード */}
            <div className="mb-5">
              <span className="t-label block mb-2">ファイルから選ぶ</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="w-full rounded-xl border-2 border-dashed border-line bg-white px-4 py-6 text-[13px] font-semibold text-mute hover:bg-accent-soft hover:text-[--c-accent-deep] hover:border-[--c-accent] disabled:opacity-50 transition"
              >
                {busy
                  ? "⏳ アップロード中…"
                  : "📁 画像を選択 (最大 5MB / JPG / PNG / WebP)"}
              </button>
            </div>

            {/* URL 入力 */}
            <div className="mb-5">
              <span className="t-label block mb-2">
                または URL を貼り付け
              </span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://images.example.com/cover.jpg"
                disabled={busy}
                className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[--c-accent] t-mono disabled:opacity-50"
              />
              <p className="t-cap mt-1">
                Unsplash や自社ホスティングなど、公開アクセス可能な画像 URL
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-[12.5px] text-red-700 mb-5">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-line-soft">
              <button
                type="button"
                onClick={() => saveUrl(null)}
                disabled={busy || !currentUrl}
                className="text-[12.5px] underline text-mute hover:text-error disabled:opacity-30 disabled:no-underline"
              >
                🗑 画像を外す
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg bg-white border border-line px-5 py-2.5 text-[13px] font-medium text-mute"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => saveUrl(url.trim() ? url.trim() : null)}
                  disabled={busy}
                  className="rounded-lg bg-ink px-6 py-2.5 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "保存中…" : "✦ 保存"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
