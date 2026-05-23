"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PUBLISH_FIELDS, type PublishApp } from "@/lib/publishFields";

type Visibility = "private" | "submitted" | "published";

/**
 * プロジェクト公開申請フォーム (テーマ出題と同様のプレビュー + フォーム方式)。
 * 既存のプロジェクト内容を初期値として引用し、公開用に整えて申請する。
 */
export function PublishApplicationForm({
  orgSlug,
  projectId,
  visibility,
  initial,
}: {
  orgSlug: string;
  projectId: string;
  visibility: Visibility;
  /** 保存済み publish_app があればそれ、無ければプロジェクトから引用した初期値 */
  initial: PublishApp;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [app, setApp] = useState<PublishApp>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof PublishApp, v: string) =>
    setApp((a) => ({ ...a, [key]: v }));

  const uploadImage = async (file: File) => {
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
    setApp((a) => ({ ...a, image_url: pub.publicUrl }));
    setBusy(false);
  };

  const persist = async (nextVisibility?: Visibility) => {
    setBusy(true);
    setError(null);
    const patch: Record<string, unknown> = { publish_app: app };
    if (nextVisibility) {
      patch.visibility = nextVisibility;
      if (nextVisibility === "submitted")
        patch.publish_submitted_at = new Date().toISOString();
    }
    const { error: e } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", projectId);
    setBusy(false);
    if (e) {
      setError(e.message);
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    if (await persist()) {
      setSavedNote("下書きを保存しました");
      router.refresh();
    }
  };

  const submit = async () => {
    if (!app.title?.trim()) {
      setError("プロジェクトタイトルを入力してください");
      return;
    }
    if (await persist("submitted")) {
      router.push(`/${orgSlug}/projects/${projectId}/dashboard`);
      router.refresh();
    }
  };

  const withdraw = async () => {
    if (await persist("private")) {
      router.refresh();
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4 pb-10">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            href={`/${orgSlug}/projects/${projectId}/dashboard`}
            className="t-cap underline"
          >
            ← ダッシュボードへ
          </Link>
          <h1 className="t-h2 mt-2">🌐 ホームに公開申請</h1>
          <p className="t-cap mt-1">
            公開用の内容を整えて申請します。プロジェクトの記入内容を引用済みです。
            申請後、管理者が項目ごとに審査します。
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {visibility === "submitted" ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-3 py-1.5 text-[12px] font-bold text-warn">
                🕓 公開審査中
              </span>
              <button
                type="button"
                onClick={withdraw}
                disabled={busy}
                className="rounded-full border border-line px-4 py-2 text-[12px] font-semibold text-ink-2 hover:bg-mute/5 disabled:opacity-50"
              >
                取り下げ
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={saveDraft}
                disabled={busy}
                className="rounded-full border border-line px-4 py-2 text-[12.5px] font-semibold text-ink-2 hover:bg-mute/5 disabled:opacity-50"
              >
                下書き保存
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                📨 申請する
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-lg bg-error/10 px-3 py-2 text-[12px] text-error">
          {error}
        </div>
      )}
      {savedNote && (
        <div className="rounded-lg bg-accent-soft px-3 py-2 text-[12px] text-[--c-accent-deep]">
          {savedNote}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 items-start">
        {/* プレビュー (固定) */}
        <div className="order-2 lg:order-1 lg:sticky lg:top-[90px] flex flex-col gap-2">
          <div className="t-label">👀 公開プレビュー</div>
          <GlassCard className="p-0 overflow-hidden">
            {/* 画像枠: クリックでアップロード */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative group block w-full"
              title="クリックして画像をアップロード"
            >
              <div
                className="w-full aspect-[16/10]"
                style={{
                  background: app.image_url
                    ? `url(${app.image_url}) center / cover`
                    : "linear-gradient(135deg, var(--c-accent-soft), var(--c-accent-bright))",
                }}
                aria-hidden
              />
              <span className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition bg-ink/30">
                <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11.5px] font-bold text-ink shadow-md">
                  {busy ? "⏳ アップロード中…" : "📷 画像を選択 / 変更"}
                </span>
              </span>
              {!app.image_url && (
                <span className="absolute inset-0 grid place-items-center text-5xl text-white/90 pointer-events-none">
                  🚀
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImage(f);
              }}
            />
            <div className="p-4 flex flex-col gap-2">
              <h2 className="text-[18px] font-extrabold">
                {app.title || "（タイトル未入力）"}
              </h2>
              {app.summary && (
                <p className="text-[12.5px] text-mute whitespace-pre-wrap">
                  {app.summary}
                </p>
              )}
              {PUBLISH_FIELDS.filter(
                (f) => f.key !== "title" && f.key !== "summary",
              ).map((f) => {
                const v = app[f.key];
                if (!v) return null;
                return (
                  <div key={f.key}>
                    <div className="t-label mt-1">
                      {f.emoji} {f.label}
                    </div>
                    <p className="text-[12.5px] whitespace-pre-wrap leading-relaxed">
                      {v}
                    </p>
                  </div>
                );
              })}
            </div>
          </GlassCard>
          <input
            type="text"
            value={app.image_url ?? ""}
            onChange={(e) => set("image_url", e.target.value)}
            placeholder="または画像URLを貼り付け"
            className="rounded-lg border border-line bg-white px-3 py-2 text-[12px] outline-none focus:border-[--c-accent] t-mono"
          />
        </div>

        {/* フォーム (右・スクロール) */}
        <div className="flex flex-col gap-3 order-1 lg:order-2">
          {PUBLISH_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="t-label">
                {f.emoji} {f.label}
              </label>
              {f.multiline ? (
                <textarea
                  value={app[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-[--c-accent]"
                />
              ) : (
                <input
                  type="text"
                  value={app[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-[--c-accent]"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
