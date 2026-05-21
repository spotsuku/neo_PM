"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { OrgIconAdjuster } from "@/components/settings/OrgIconAdjuster";
import {
  ORG_ICON_FALLBACK_BG,
  orgIconImgStyle,
} from "@/lib/orgIconStyle";
import type { Database } from "@/lib/types/database";

type Org = Database["public"]["Tables"]["organizations"]["Row"];

interface Props {
  org: Org;
  myRole: "owner" | "admin" | "member" | "theme_owner";
  memberCount: number;
  projectCount: number;
}

const PRESET_EMOJI = [
  "✦",
  "🌱",
  "🚀",
  "🏔",
  "🌊",
  "🎯",
  "🔭",
  "🛠",
  "📣",
  "💡",
  "🌸",
  "⚡",
];

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "team"
  );
}

export function OrgGeneralForm({
  org,
  myRole,
  memberCount,
  projectCount,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const canEdit = myRole === "owner" || myRole === "admin";
  const canDelete = myRole === "owner";

  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [description, setDescription] = useState(org.description ?? "");
  const [emoji, setEmoji] = useState(org.emoji ?? "✦");
  const [iconUrl, setIconUrl] = useState<string | null>(org.icon_url ?? null);
  const [iconZoom, setIconZoom] = useState<number>(Number(org.icon_zoom ?? 1));
  const [iconOffsetX, setIconOffsetX] = useState<number>(
    Number(org.icon_offset_x ?? 0),
  );
  const [iconOffsetY, setIconOffsetY] = useState<number>(
    Number(org.icon_offset_y ?? 0),
  );
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [competitionEnabled, setCompetitionEnabled] = useState(
    org.competition_enabled,
  );
  const [hideFreeTierBanner, setHideFreeTierBanner] = useState(
    org.hide_free_tier_banner,
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingCompetition, setSavingCompetition] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  const uploadIcon = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選んでください");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("3MB 以下の画像を選んでください");
      return;
    }
    setUploadingIcon(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `org-icons/${org.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("project-posts")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploadingIcon(false);
      setError(`アップロード失敗: ${upErr.message}`);
      return;
    }
    const { data: pub } = supabase.storage
      .from("project-posts")
      .getPublicUrl(path);
    const newUrl = pub.publicUrl;
    setIconUrl(newUrl);
    // 新しい画像はトリミングを一度リセット
    setIconZoom(1);
    setIconOffsetX(0);
    setIconOffsetY(0);
    const { error: updErr } = await supabase
      .from("organizations")
      .update({
        icon_url: newUrl,
        icon_zoom: 1,
        icon_offset_x: 0,
        icon_offset_y: 0,
      })
      .eq("id", org.id);
    setUploadingIcon(false);
    if (updErr) setError(updErr.message);
    else router.refresh();
  };

  const clearIcon = async () => {
    setIconUrl(null);
    setIconZoom(1);
    setIconOffsetX(0);
    setIconOffsetY(0);
    const { error: err } = await supabase
      .from("organizations")
      .update({
        icon_url: null,
        icon_zoom: 1,
        icon_offset_x: 0,
        icon_offset_y: 0,
      })
      .eq("id", org.id);
    if (err) setError(err.message);
    else router.refresh();
  };

  const saveIconTransform = async (next: {
    zoom: number;
    offsetX: number;
    offsetY: number;
  }) => {
    const { error: err } = await supabase
      .from("organizations")
      .update({
        icon_zoom: next.zoom,
        icon_offset_x: next.offsetX,
        icon_offset_y: next.offsetY,
      })
      .eq("id", org.id);
    if (err) setError(err.message);
    else router.refresh();
  };

  const toggleCompetition = async (next: boolean) => {
    if (!canEdit) return;
    // off に切り替えるときは確認 (既存テーマがホームから消えるため)
    if (!next && competitionEnabled) {
      const ok = window.confirm(
        "コンペ機能を OFF にすると、テーマ応募 / テーマ出題タブが非表示になります。\n\n既存のテーマ・応募データは削除されません(再度 ON にすれば戻ります)が、応募者側からテーマ一覧にアクセスできなくなります。\n\n続行しますか？",
      );
      if (!ok) return;
    }
    setSavingCompetition(true);
    const { error: err } = await supabase
      .from("organizations")
      .update({ competition_enabled: next })
      .eq("id", org.id);
    setSavingCompetition(false);
    if (err) {
      setError(err.message);
      return;
    }
    setCompetitionEnabled(next);
    router.refresh();
  };

  const toggleHideFreeTierBanner = async (next: boolean) => {
    if (!canEdit) return;
    setSavingBanner(true);
    const { error: err } = await supabase
      .from("organizations")
      .update({ hide_free_tier_banner: next })
      .eq("id", org.id);
    setSavingBanner(false);
    if (err) {
      setError(err.message);
      return;
    }
    setHideFreeTierBanner(next);
    router.refresh();
  };

  const dirty =
    name !== org.name ||
    slug !== org.slug ||
    description !== (org.description ?? "") ||
    emoji !== (org.emoji ?? "✦");

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError("組織名を入力してください");
      return;
    }
    if (!slug.trim() || !/^[a-z0-9-]+$/.test(slug)) {
      setError("スラッグは半角英数字とハイフンのみ使えます");
      return;
    }
    setSaving(true);
    const slugChanged = slug !== org.slug;
    const { error: err } = await supabase
      .from("organizations")
      .update({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        emoji: emoji || null,
      })
      .eq("id", org.id);
    setSaving(false);
    if (err) {
      setError(
        err.message.includes("duplicate")
          ? "そのスラッグは既に使われています。別のものを試してください。"
          : err.message,
      );
      return;
    }
    setSavedAt(Date.now());
    if (slugChanged) {
      // URL を新しい slug に張り替え
      router.push(`/${slug}/settings`);
    } else {
      router.refresh();
    }
  };

  const deleteOrg = async () => {
    const phrase = `${org.name} を削除`;
    const input = prompt(
      `本当にこの組織を削除しますか？\n\nプロジェクト・テーマ・タスク・予算・診断・チャット履歴を含む全データが完全に削除されます。元に戻せません。\n\n続行するには「${phrase}」と入力してください。`,
    );
    if (input !== phrase) {
      if (input !== null) alert("入力が一致しませんでした。削除を中止しました。");
      return;
    }
    setError(null);
    const { error: err } = await supabase
      .from("organizations")
      .delete()
      .eq("id", org.id);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/orgs");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* メタ情報 */}
      <GlassCard className="p-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="メンバー" value={memberCount} />
          <Stat label="プロジェクト" value={projectCount} />
          <Stat label="あなたの権限" value={myRole} />
        </div>
      </GlassCard>

      {/* 基本情報フォーム */}
      <GlassCard className="p-5">
        <h3 className="t-h3 mb-3">
          <span aria-hidden className="mr-2">
            📝
          </span>
          基本情報
        </h3>

        <div className="grid grid-cols-[80px_1fr] gap-4 items-start mb-4">
          <div>
            <span className="t-label block mb-1">アイコン</span>
            <div
              className="grid h-16 w-16 place-items-center rounded-2xl text-white text-2xl overflow-hidden"
              style={iconUrl ? undefined : ORG_ICON_FALLBACK_BG}
            >
              {iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={iconUrl}
                  alt=""
                  style={orgIconImgStyle({
                    iconUrl,
                    zoom: iconZoom,
                    offsetX: iconOffsetX,
                    offsetY: iconOffsetY,
                  })}
                />
              ) : (
                emoji || (name[0] ?? "?")
              )}
            </div>
          </div>
          <div>
            {/* 画像アップロード */}
            <span className="t-label block mb-1">
              📷 アイコン画像をアップロード (優先)
            </span>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="file"
                accept="image/*"
                disabled={!canEdit || uploadingIcon}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadIcon(f);
                }}
                className="text-[11.5px] file:mr-2 file:rounded-md file:border-0 file:bg-ink file:text-white file:px-3 file:py-1.5 file:cursor-pointer file:text-[11.5px] file:font-semibold disabled:opacity-50"
              />
              {iconUrl && (
                <button
                  type="button"
                  onClick={clearIcon}
                  disabled={!canEdit}
                  className="t-cap underline text-mute hover:text-error"
                >
                  画像を外す
                </button>
              )}
            </div>
            <p className="t-cap mb-3 opacity-70">
              3MB 以下 / JPG / PNG / WebP。画像があれば優先表示、無ければ絵文字が使われます。
            </p>

            {/* 画像の位置・サイズ調整 */}
            {iconUrl && canEdit && (
              <div className="mb-4 rounded-lg border border-line-soft bg-mute/5 p-3">
                <div className="t-label mb-2">🎯 表示位置・サイズの調整</div>
                <OrgIconAdjuster
                  iconUrl={iconUrl}
                  zoom={iconZoom}
                  offsetX={iconOffsetX}
                  offsetY={iconOffsetY}
                  onChange={({ zoom, offsetX, offsetY }) => {
                    setIconZoom(zoom);
                    setIconOffsetX(offsetX);
                    setIconOffsetY(offsetY);
                  }}
                  onCommit={(next) => saveIconTransform(next)}
                />
              </div>
            )}

            {/* 絵文字 */}
            <span className="t-label block mb-1">
              ✨ または 絵文字を選ぶ
            </span>
            <div className="flex flex-wrap gap-1 mb-2">
              {PRESET_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => canEdit && setEmoji(e)}
                  disabled={!canEdit}
                  className={
                    "grid h-9 w-9 place-items-center rounded-lg text-[18px] transition " +
                    (emoji === e
                      ? "bg-ink text-white"
                      : "bg-white border border-line hover:border-[--c-accent]") +
                    (!canEdit ? " opacity-50 cursor-not-allowed" : "")
                  }
                >
                  {e}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
              disabled={!canEdit}
              placeholder="絵文字 or 1〜2文字"
              className="w-32 rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[--c-accent] disabled:opacity-50"
            />
          </div>
        </div>

        <label className="block mb-4">
          <span className="t-label block mb-1">組織名 *</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              const v = e.target.value;
              setName(v);
              // slug が初期値と同じだったら追従させる
              if (slug === slugify(org.name)) {
                setSlug(slugify(v));
              }
            }}
            disabled={!canEdit}
            maxLength={80}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[--c-accent] disabled:opacity-50"
          />
        </label>

        <label className="block mb-4">
          <span className="t-label block mb-1">説明（任意・最大500文字）</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
            maxLength={500}
            placeholder="チームのミッション・活動内容・対象地域 など"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-[--c-accent] resize-none disabled:opacity-50"
          />
          <div className="text-right t-cap mt-1">{description.length}/500</div>
        </label>

        <label className="block mb-4">
          <span className="t-label block mb-1">スラッグ（URL の一部）</span>
          <div className="flex items-center gap-2">
            <span className="t-cap whitespace-nowrap">/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) =>
                setSlug(slugify(e.target.value).slice(0, 40))
              }
              disabled={!canEdit}
              className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm t-mono outline-none focus:border-[--c-accent] disabled:opacity-50"
            />
          </div>
          {slug !== org.slug && (
            <p className="t-cap mt-1.5 text-warn leading-relaxed">
              ⚠️ スラッグを変更するとブックマークしている URL や招待リンクの組織パスが変わります（招待トークン自体は引き続き有効）。
            </p>
          )}
        </label>

        <div className="flex items-center justify-between border-t border-line-soft pt-3">
          <div className="t-cap">
            {savedAt && Date.now() - savedAt < 3000 && (
              <span className="text-[--c-accent-deep]">✓ 保存しました</span>
            )}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={!canEdit || !dirty || saving}
            className="rounded-lg bg-ink px-5 py-2 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
          >
            {saving ? "保存中..." : "変更を保存"}
          </button>
        </div>
        {!canEdit && (
          <p className="t-cap mt-3 text-center">
            🔒 組織情報を編集する権限は owner / admin にあります。
          </p>
        )}
      </GlassCard>

      {/* 機能オプション */}
      <GlassCard className="p-5">
        <h3 className="t-h3 mb-3">
          <span aria-hidden className="mr-2">
            🧩
          </span>
          機能オプション
        </h3>

        <div className="flex items-start gap-3 mb-2">
          <button
            type="button"
            role="switch"
            aria-checked={competitionEnabled}
            disabled={!canEdit || savingCompetition}
            onClick={() => toggleCompetition(!competitionEnabled)}
            className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition disabled:opacity-50"
            style={{
              background: competitionEnabled
                ? "var(--c-accent)"
                : "var(--mute)",
            }}
          >
            <span
              className="inline-block h-5 w-5 transform rounded-full bg-white transition"
              style={{
                transform: competitionEnabled
                  ? "translateX(22px)"
                  : "translateX(2px)",
              }}
            />
          </button>
          <div className="flex-1">
            <div className="text-[13px] font-bold mb-0.5">
              コンペ運営 (テーマ出題 + 応募)
            </div>
            <p className="t-cap leading-relaxed">
              企業が「テーマ」を出題し、若者チームが応募する仕組みを使う場合に
              ON にしてください。OFF の組織はプロジェクト管理 (PM) 機能だけが
              表示されます。
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 mb-2 border-t border-line-soft pt-4 mt-4">
          <button
            type="button"
            role="switch"
            aria-checked={hideFreeTierBanner}
            disabled={!canEdit || savingBanner}
            onClick={() => toggleHideFreeTierBanner(!hideFreeTierBanner)}
            className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition disabled:opacity-50"
            style={{
              background: hideFreeTierBanner
                ? "var(--c-accent)"
                : "var(--mute)",
            }}
          >
            <span
              className="inline-block h-5 w-5 transform rounded-full bg-white transition"
              style={{
                transform: hideFreeTierBanner
                  ? "translateX(22px)"
                  : "translateX(2px)",
              }}
            />
          </button>
          <div className="flex-1">
            <div className="text-[13px] font-bold mb-0.5">
              「無料公開中」バナーを非表示にする
            </div>
            <p className="t-cap leading-relaxed">
              ON にすると、この組織の画面上部に出る「無料公開中です。有料化する
              場合は1ヶ月前に告知いたします。」バナーを表示しません。
            </p>
          </div>
        </div>
        {!canEdit && (
          <p className="t-cap mt-3">
            🔒 機能の切替は owner / admin が行います。
          </p>
        )}
      </GlassCard>

      {/* 危険ゾーン (owner のみ) */}
      {canDelete && (
        <GlassCard
          className="p-5"
          style={{ borderLeft: "4px solid var(--error)" }}
        >
          <h3 className="t-h3 mb-2 text-error">
            <span aria-hidden className="mr-2">
              ⚠️
            </span>
            危険ゾーン
          </h3>
          <p className="t-cap mb-4 leading-relaxed">
            組織を削除すると、所属するすべてのプロジェクト・テーマ・タスク・予算・診断・チャット履歴・招待リンクが完全に削除されます。**元に戻せません。**
          </p>
          <button
            type="button"
            onClick={deleteOrg}
            className="rounded-lg bg-red-50 px-4 py-2 text-[12.5px] font-semibold text-error hover:bg-red-100"
          >
            🗑 この組織を削除...
          </button>
        </GlassCard>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="t-label mb-1">{label}</div>
      <div className="t-mono text-[20px] font-bold">{value}</div>
    </div>
  );
}
