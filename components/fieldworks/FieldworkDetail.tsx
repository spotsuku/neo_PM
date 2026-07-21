"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Json } from "@/lib/types/database";

type Fieldwork = {
  id: string;
  title: string;
  theme_id: string;
  theme_title: string;
  theme_company: string | null;
  owner_name: string | null;
  meeting_place: string | null;
  address: string | null;
  meeting_at: string | null;
  timeline: Json;
  what_you_gain: string | null;
  what_to_bring: string | null;
  dress_code: string | null;
  rain_plan: string | null;
  cancellation_policy: string | null;
  fee_yen: number;
  capacity: number | null;
  application_deadline: string | null;
  thumbnail_url: string | null;
  status: "draft" | "published" | "closed" | "cancelled";
};

type Participant = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  applied_at: string;
  motivation: string | null;
  transportation: string | null;
  is_me: boolean;
};

interface Props {
  orgSlug: string;
  currentUserId: string;
  isAdmin: boolean;
  isCreator: boolean;
  fieldwork: Fieldwork;
  participants: Participant[];
  myParticipation: Participant | null;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "未定";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialOf(name: string | null): string {
  const t = (name ?? "").trim();
  if (!t) return "?";
  return Array.from(t)[0]!.toUpperCase();
}
function colorOf(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 55%)`;
}
function Avatar({
  name,
  url,
  size = 32,
}: {
  name: string | null;
  url?: string | null;
  size?: number;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt=""
        className="flex-shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex-shrink-0 grid place-items-center rounded-full text-white font-bold"
      style={{
        width: size,
        height: size,
        background: colorOf(name ?? "?"),
        fontSize: Math.max(11, size * 0.44),
      }}
    >
      {initialOf(name)}
    </span>
  );
}

type TimelineSlot = { start?: string | null; end?: string | null; activity?: string | null };

export function FieldworkDetail({
  orgSlug,
  currentUserId,
  isAdmin,
  isCreator,
  fieldwork: fw,
  participants,
  myParticipation,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [form, setForm] = useState({
    motivation: "",
    emergency_contact: "",
    allergies: "",
    transportation: "",
  });

  // ── 編集モード ──
  // datetime-local input は "YYYY-MM-DDTHH:mm" 形式が必要
  const toLocalInput = (iso: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const timelineToText = (tl: Json): string => {
    if (!Array.isArray(tl)) return "";
    return (tl as unknown as TimelineSlot[])
      .map((s) => {
        if (s.start && s.end) return `${s.start}-${s.end} ${s.activity ?? ""}`;
        return s.activity ?? "";
      })
      .filter((line) => line.trim())
      .join("\n");
  };

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: fw.title,
    owner_name: fw.owner_name ?? "",
    meeting_place: fw.meeting_place ?? "",
    address: fw.address ?? "",
    meeting_at: toLocalInput(fw.meeting_at),
    what_you_gain: fw.what_you_gain ?? "",
    what_to_bring: fw.what_to_bring ?? "",
    dress_code: fw.dress_code ?? "",
    rain_plan: fw.rain_plan ?? "",
    cancellation_policy: fw.cancellation_policy ?? "",
    capacity: fw.capacity != null ? String(fw.capacity) : "",
    application_deadline: toLocalInput(fw.application_deadline),
    fee_yen: String(fw.fee_yen),
    timeline_text: timelineToText(fw.timeline),
  });

  const timeline: TimelineSlot[] = Array.isArray(fw.timeline)
    ? (fw.timeline as unknown as TimelineSlot[])
    : [];

  const deadlinePassed =
    fw.application_deadline !== null &&
    new Date(fw.application_deadline).getTime() < Date.now();
  const isFull =
    fw.capacity !== null && participants.length >= fw.capacity;
  const canApply =
    fw.status === "published" &&
    !deadlinePassed &&
    !isFull &&
    !myParticipation;

  const apply = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("fieldwork_participants")
      .insert({
        fieldwork_id: fw.id,
        user_id: currentUserId,
        motivation: form.motivation.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
        allergies: form.allergies.trim() || null,
        transportation: form.transportation.trim() || null,
      } as never);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setShowApplyForm(false);
    router.refresh();
  };

  const cancel = async () => {
    if (!confirm("参加を取り消しますか？")) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("fieldwork_participants")
      .delete()
      .eq("fieldwork_id", fw.id)
      .eq("user_id", currentUserId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  };

  const removeOther = async (userId: string, name: string) => {
    if (!confirm(`${name} さんの参加を取り消しますか？`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("fieldwork_participants")
      .delete()
      .eq("fieldwork_id", fw.id)
      .eq("user_id", userId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  };

  const saveEdit = async () => {
    if (!editForm.title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    setBusy(true);
    setError(null);

    const timeline = editForm.timeline_text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(\d{1,2}:\d{2})\s*[-〜~]\s*(\d{1,2}:\d{2})\s+(.+)$/);
        if (m) return { start: m[1], end: m[2], activity: m[3] };
        return { start: null, end: null, activity: line };
      });

    const patch = {
      title: editForm.title.trim(),
      owner_name: editForm.owner_name.trim() || null,
      meeting_place: editForm.meeting_place.trim() || null,
      address: editForm.address.trim() || null,
      meeting_at: editForm.meeting_at
        ? new Date(editForm.meeting_at).toISOString()
        : null,
      what_you_gain: editForm.what_you_gain.trim() || null,
      what_to_bring: editForm.what_to_bring.trim() || null,
      dress_code: editForm.dress_code.trim() || null,
      rain_plan: editForm.rain_plan.trim() || null,
      cancellation_policy: editForm.cancellation_policy.trim() || null,
      capacity: editForm.capacity ? parseInt(editForm.capacity, 10) : null,
      application_deadline: editForm.application_deadline
        ? new Date(editForm.application_deadline).toISOString()
        : null,
      fee_yen: parseInt(editForm.fee_yen || "0", 10) || 0,
      timeline,
    };

    const { error: err } = await supabase
      .from("fieldworks")
      .update(patch as never)
      .eq("id", fw.id);
    setBusy(false);
    if (err) {
      setError(`保存に失敗しました: ${err.message}`);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const publish = async () => {
    if (!confirm("このフィールドワークを公開して募集を開始しますか？")) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("fieldworks")
      .update({ status: "published" } as never)
      .eq("id", fw.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  };

  const close = async () => {
    if (!confirm("募集を締め切りますか？")) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("fieldworks")
      .update({ status: "closed" } as never)
      .eq("id", fw.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  };

  const cancelFieldwork = async () => {
    if (!confirm("このフィールドワークを中止しますか？")) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("fieldworks")
      .update({ status: "cancelled" } as never)
      .eq("id", fw.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  };

  const capacityBar =
    fw.capacity !== null
      ? `${participants.length}/${fw.capacity} 名`
      : `${participants.length} 名`;

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
      <Link
        href={`/${orgSlug}/fieldworks`}
        className="t-cap underline w-fit"
      >
        ← フィールドワーク一覧
      </Link>

      {/* ヘッダ */}
      <GlassCard className="p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <StatusBadge status={fw.status} />
              {myParticipation && (
                <span className="rounded-full bg-[--c-accent] text-white text-[10.5px] font-bold px-2 py-0.5">
                  参加予定
                </span>
              )}
              {isFull && !myParticipation && (
                <span className="rounded-full bg-red-100 text-red-700 text-[10.5px] font-bold px-2 py-0.5">
                  満員
                </span>
              )}
              {deadlinePassed && (
                <span className="rounded-full bg-mute/20 text-mute text-[10.5px] font-bold px-2 py-0.5">
                  締切済
                </span>
              )}
            </div>
            <h1 className="t-h2">{fw.title}</h1>
            <p className="t-cap mt-1">
              🎯 <strong>{fw.theme_title}</strong>
              {fw.theme_company && ` ・ ${fw.theme_company}`}
              {fw.owner_name && ` ・ 主催: ${fw.owner_name}`}
            </p>
          </div>
          {fw.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fw.thumbnail_url}
              alt=""
              className="w-24 h-24 md:w-32 md:h-32 rounded-xl object-cover flex-shrink-0"
            />
          )}
        </div>

        {/* オーナー用アクションバー */}
        {(isCreator || isAdmin) && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-line-soft">
            <span className="t-cap font-semibold">オーナー操作:</span>
            {!editing && fw.status !== "cancelled" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(true)}
                className="rounded-full bg-white border border-line px-3 py-1 text-[11.5px] font-semibold text-mute hover:text-ink disabled:opacity-50"
              >
                ✏️ 編集
              </button>
            )}
            {fw.status === "draft" && (
              <button
                type="button"
                disabled={busy}
                onClick={publish}
                className="rounded-full bg-emerald-600 px-3 py-1 text-[11.5px] font-bold text-white disabled:opacity-50"
              >
                🚀 公開して募集開始
              </button>
            )}
            {fw.status === "published" && (
              <button
                type="button"
                disabled={busy}
                onClick={close}
                className="rounded-full bg-white border border-line px-3 py-1 text-[11.5px] font-semibold text-mute hover:text-ink disabled:opacity-50"
              >
                📦 募集終了
              </button>
            )}
            {(fw.status === "published" || fw.status === "closed") && (
              <button
                type="button"
                disabled={busy}
                onClick={cancelFieldwork}
                className="rounded-full bg-white border border-red-200 px-3 py-1 text-[11.5px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                中止
              </button>
            )}
          </div>
        )}
      </GlassCard>

      {/* 編集フォーム */}
      {editing && (isCreator || isAdmin) && (
        <GlassCard className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span aria-hidden>✏️</span>
            <h2 className="text-[15px] font-extrabold">フィールドワークを編集</h2>
            {fw.status === "published" && (
              <span className="rounded-full bg-amber-50 text-amber-800 text-[10.5px] font-semibold px-2 py-0.5">
                ⚠️ 公開中 — 変更は即座に反映されます
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="タイトル *">
              <input
                type="text"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="テーマオーナー名 (表示用)">
              <input
                type="text"
                value={editForm.owner_name}
                onChange={(e) =>
                  setEditForm({ ...editForm, owner_name: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="集合日時">
              <input
                type="datetime-local"
                value={editForm.meeting_at}
                onChange={(e) =>
                  setEditForm({ ...editForm, meeting_at: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="集合場所">
              <input
                type="text"
                value={editForm.meeting_place}
                onChange={(e) =>
                  setEditForm({ ...editForm, meeting_place: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="住所 / アクセス">
              <input
                type="text"
                value={editForm.address}
                onChange={(e) =>
                  setEditForm({ ...editForm, address: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="定員">
              <input
                type="number"
                min={1}
                value={editForm.capacity}
                onChange={(e) =>
                  setEditForm({ ...editForm, capacity: e.target.value })
                }
                placeholder="空欄なら無制限"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="応募締切">
              <input
                type="datetime-local"
                value={editForm.application_deadline}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    application_deadline: e.target.value,
                  })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="参加費 (円)">
              <input
                type="number"
                min={0}
                value={editForm.fee_yen}
                onChange={(e) =>
                  setEditForm({ ...editForm, fee_yen: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
          </div>
          <Field label="タイムライン (1行1コマ: 10:00-11:00 集合と挨拶)">
            <textarea
              rows={4}
              value={editForm.timeline_text}
              onChange={(e) =>
                setEditForm({ ...editForm, timeline_text: e.target.value })
              }
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] font-mono resize-y"
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="得られるもの">
              <textarea
                rows={3}
                value={editForm.what_you_gain}
                onChange={(e) =>
                  setEditForm({ ...editForm, what_you_gain: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] resize-y"
              />
            </Field>
            <Field label="持ち物">
              <textarea
                rows={3}
                value={editForm.what_to_bring}
                onChange={(e) =>
                  setEditForm({ ...editForm, what_to_bring: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] resize-y"
              />
            </Field>
            <Field label="服装指定">
              <input
                type="text"
                value={editForm.dress_code}
                onChange={(e) =>
                  setEditForm({ ...editForm, dress_code: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="雨天時対応">
              <input
                type="text"
                value={editForm.rain_plan}
                onChange={(e) =>
                  setEditForm({ ...editForm, rain_plan: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
          </div>
          <Field label="キャンセルポリシー">
            <textarea
              rows={2}
              value={editForm.cancellation_policy}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  cancellation_policy: e.target.value,
                })
              }
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] resize-y"
            />
          </Field>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
              className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={busy || !editForm.title.trim()}
              onClick={saveEdit}
              className="rounded-full bg-ink px-5 py-2 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "保存中…" : "変更を保存"}
            </button>
          </div>
        </GlassCard>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 基本情報 */}
      <GlassCard className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Info label="📅 集合日時" value={fmtDateTime(fw.meeting_at)} />
        <Info label="📍 集合場所" value={fw.meeting_place ?? "未定"} />
        <Info
          label="🗺 住所 / アクセス"
          value={fw.address ?? "-"}
          multiline
        />
        <Info label="👥 定員" value={capacityBar} />
        <Info
          label="⏰ 応募締切"
          value={fmtDateTime(fw.application_deadline)}
        />
        <Info
          label="💴 参加費"
          value={fw.fee_yen > 0 ? `${fw.fee_yen.toLocaleString()} 円` : "無料"}
        />
      </GlassCard>

      {/* タイムライン */}
      {timeline.length > 0 && (
        <GlassCard className="p-5 flex flex-col gap-3">
          <h2 className="text-[14px] font-extrabold">🕐 タイムライン</h2>
          <ol className="flex flex-col gap-2">
            {timeline.map((slot, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="inline-block rounded-md bg-ink text-white text-[11px] font-mono font-bold px-2 py-1 min-w-[90px] text-center flex-shrink-0">
                  {slot.start && slot.end
                    ? `${slot.start} - ${slot.end}`
                    : slot.start || "—"}
                </span>
                <span className="text-[13px] leading-relaxed pt-1">
                  {slot.activity ?? "—"}
                </span>
              </li>
            ))}
          </ol>
        </GlassCard>
      )}

      {/* 得られるもの / 持ち物 / 服装 / 雨天 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fw.what_you_gain && (
          <GlassCard className="p-4">
            <h3 className="text-[13px] font-extrabold mb-1">🌱 得られるもの</h3>
            <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {fw.what_you_gain}
            </p>
          </GlassCard>
        )}
        {fw.what_to_bring && (
          <GlassCard className="p-4">
            <h3 className="text-[13px] font-extrabold mb-1">🎒 持ち物</h3>
            <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {fw.what_to_bring}
            </p>
          </GlassCard>
        )}
        {fw.dress_code && (
          <GlassCard className="p-4">
            <h3 className="text-[13px] font-extrabold mb-1">👕 服装</h3>
            <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {fw.dress_code}
            </p>
          </GlassCard>
        )}
        {fw.rain_plan && (
          <GlassCard className="p-4">
            <h3 className="text-[13px] font-extrabold mb-1">🌧 雨天時対応</h3>
            <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {fw.rain_plan}
            </p>
          </GlassCard>
        )}
      </div>

      {fw.cancellation_policy && (
        <GlassCard className="p-4">
          <h3 className="text-[13px] font-extrabold mb-1">
            ⚠️ キャンセルポリシー
          </h3>
          <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">
            {fw.cancellation_policy}
          </p>
        </GlassCard>
      )}

      {/* 応募ボタン / 応募状態 */}
      <GlassCard className="p-5 flex flex-col gap-3">
        {myParticipation ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-emerald-50 text-emerald-700 text-[12px] font-bold px-3 py-1.5">
                ✅ 参加予定に登録済み
              </span>
              <button
                type="button"
                onClick={cancel}
                disabled={busy}
                className="rounded-full bg-white border border-red-200 px-3 py-1.5 text-[11.5px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                参加をキャンセル
              </button>
            </div>
            {(myParticipation.motivation || myParticipation.transportation) && (
              <div className="rounded-lg bg-mute/5 p-3 text-[12px]">
                <div className="t-cap font-semibold mb-1">
                  あなたの応募情報
                </div>
                {myParticipation.motivation && (
                  <p className="mb-1">
                    <strong>参加理由:</strong> {myParticipation.motivation}
                  </p>
                )}
                {myParticipation.transportation && (
                  <p>
                    <strong>交通手段:</strong> {myParticipation.transportation}
                  </p>
                )}
              </div>
            )}
          </>
        ) : canApply ? (
          !showApplyForm ? (
            <button
              type="button"
              onClick={() => setShowApplyForm(true)}
              className="rounded-lg bg-ink px-4 py-3 text-[13px] font-bold text-white hover:opacity-90"
            >
              🙋 このフィールドワークに参加する
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <h3 className="text-[13px] font-extrabold">応募フォーム</h3>
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="font-semibold">参加理由 / 意気込み</span>
                <textarea
                  rows={2}
                  value={form.motivation}
                  onChange={(e) =>
                    setForm({ ...form, motivation: e.target.value })
                  }
                  className="rounded-md border border-line bg-white px-3 py-2 text-[13px] resize-y"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="font-semibold">
                  緊急連絡先 (当日連絡が取れる電話番号)
                </span>
                <input
                  type="tel"
                  value={form.emergency_contact}
                  onChange={(e) =>
                    setForm({ ...form, emergency_contact: e.target.value })
                  }
                  placeholder="090-xxxx-xxxx"
                  className="rounded-md border border-line bg-white px-3 py-2 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="font-semibold">アレルギー / 食事制限</span>
                <input
                  type="text"
                  value={form.allergies}
                  onChange={(e) =>
                    setForm({ ...form, allergies: e.target.value })
                  }
                  placeholder="なければ空欄で OK"
                  className="rounded-md border border-line bg-white px-3 py-2 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px]">
                <span className="font-semibold">交通手段</span>
                <input
                  type="text"
                  value={form.transportation}
                  onChange={(e) =>
                    setForm({ ...form, transportation: e.target.value })
                  }
                  placeholder="例: 電車、車 (要駐車場)、送迎希望"
                  className="rounded-md border border-line bg-white px-3 py-2 text-[13px]"
                />
              </label>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowApplyForm(false)}
                  disabled={busy}
                  className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={apply}
                  disabled={busy}
                  className="rounded-full bg-ink px-5 py-2 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "登録中…" : "参加を確定する"}
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center text-mute text-[12.5px]">
            {fw.status !== "published"
              ? "この募集は現在受け付けていません。"
              : isFull
                ? "定員に達しました。"
                : deadlinePassed
                  ? "応募締切を過ぎました。"
                  : "応募できません。"}
          </div>
        )}
      </GlassCard>

      {/* 参加者一覧 (透明化) */}
      <GlassCard className="p-5 flex flex-col gap-3">
        <h2 className="text-[14px] font-extrabold flex items-center gap-2">
          👥 参加予定 ({participants.length}
          {fw.capacity ? `/${fw.capacity}` : ""} 名)
          <span className="text-[10.5px] font-normal text-mute">
            誰が参加するか組織メンバー全員に見えます
          </span>
        </h2>
        {participants.length === 0 ? (
          <p className="t-cap italic">まだ参加者はいません。</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {participants.map((p) => (
              <li
                key={p.user_id}
                className="flex items-center gap-2.5 rounded-lg bg-mute/5 px-3 py-2"
              >
                <Avatar
                  name={p.display_name}
                  url={p.avatar_url}
                  size={32}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">
                    {p.display_name ?? "名前未設定"}
                    {p.is_me && (
                      <span className="ml-1 text-[9.5px] font-bold text-[--c-accent-deep]">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="t-cap opacity-70">
                    {new Date(p.applied_at).toLocaleDateString("ja-JP")} 登録
                  </div>
                </div>
                {(isCreator || isAdmin) && !p.is_me && (
                  <button
                    type="button"
                    onClick={() =>
                      removeOther(p.user_id, p.display_name ?? "この人")
                    }
                    disabled={busy}
                    className="text-[11px] text-red-600 hover:underline disabled:opacity-50"
                    title="オーナーとして参加を取り消す"
                  >
                    取消
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

function Info({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <div className="t-cap font-semibold mb-0.5">{label}</div>
      <div
        className={
          "text-[13px] " + (multiline ? "whitespace-pre-wrap leading-relaxed" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Fieldwork["status"] }) {
  const styles: Record<string, { label: string; bg: string; text: string }> = {
    draft: { label: "下書き", bg: "bg-mute/15", text: "text-mute" },
    published: {
      label: "募集中",
      bg: "bg-emerald-100",
      text: "text-emerald-700",
    },
    closed: { label: "募集終了", bg: "bg-mute/15", text: "text-mute" },
    cancelled: { label: "中止", bg: "bg-red-100", text: "text-red-700" },
  };
  const s = styles[status] ?? styles.draft;
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px]">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  );
}
