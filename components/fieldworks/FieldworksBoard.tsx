"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

type Theme = {
  id: string;
  title: string;
  code: string | null;
  posted_by: string | null;
};

type Participant = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_me: boolean;
};

type Card = {
  id: string;
  title: string;
  theme_title: string;
  owner_name: string | null;
  meeting_place: string | null;
  meeting_at: string | null;
  capacity: number | null;
  application_deadline: string | null;
  fee_yen: number;
  thumbnail_url: string | null;
  status: "draft" | "published" | "closed" | "cancelled";
  is_mine: boolean;
  participants: Participant[];
};

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  currentUserId: string;
  canCreate: boolean;
  isAdmin: boolean;
  themes: Theme[];
  fieldworks: Card[];
}

const STATUS_STYLE: Record<
  Card["status"],
  { label: string; bg: string; text: string }
> = {
  draft: { label: "下書き", bg: "bg-mute/15", text: "text-mute" },
  published: {
    label: "募集中",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
  },
  closed: { label: "募集終了", bg: "bg-mute/15", text: "text-mute" },
  cancelled: { label: "中止", bg: "bg-red-100", text: "text-red-700" },
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "未定";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "numeric",
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
  size = 22,
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
        fontSize: Math.max(9, size * 0.5),
      }}
    >
      {initialOf(name)}
    </span>
  );
}

export function FieldworksBoard({
  orgSlug,
  orgId,
  orgName,
  currentUserId,
  canCreate,
  isAdmin,
  themes,
  fieldworks,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  // 新規作成フォーム state (最低限)
  const [form, setForm] = useState({
    theme_id: "",
    title: "",
    owner_name: "",
    meeting_place: "",
    address: "",
    meeting_at: "",
    what_you_gain: "",
    what_to_bring: "",
    dress_code: "",
    rain_plan: "",
    cancellation_policy: "",
    capacity: "",
    application_deadline: "",
    fee_yen: "0",
    timeline_text: "", // 「10:00-11:00 集合と挨拶\n11:00-12:00 現地見学」形式
  });

  const stats = useMemo(
    () => ({
      total: fieldworks.length,
      published: fieldworks.filter((f) => f.status === "published").length,
      participants: fieldworks.reduce(
        (acc, f) => acc + f.participants.length,
        0,
      ),
    }),
    [fieldworks],
  );

  const createFieldwork = async (publish: boolean) => {
    if (!form.theme_id) {
      setError("対象テーマを選んでください");
      return;
    }
    if (!form.title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    setBusy(true);
    setError(null);

    // タイムライン parse (行ごとに "10:00-11:00 内容" 形式)
    const timeline = form.timeline_text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(\d{1,2}:\d{2})\s*[-〜~]\s*(\d{1,2}:\d{2})\s+(.+)$/);
        if (m) return { start: m[1], end: m[2], activity: m[3] };
        return { start: null, end: null, activity: line };
      });

    const payload = {
      organization_id: orgId,
      theme_id: form.theme_id,
      title: form.title.trim(),
      owner_name: form.owner_name.trim() || null,
      meeting_place: form.meeting_place.trim() || null,
      address: form.address.trim() || null,
      meeting_at: form.meeting_at ? new Date(form.meeting_at).toISOString() : null,
      what_you_gain: form.what_you_gain.trim() || null,
      what_to_bring: form.what_to_bring.trim() || null,
      dress_code: form.dress_code.trim() || null,
      rain_plan: form.rain_plan.trim() || null,
      cancellation_policy: form.cancellation_policy.trim() || null,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      application_deadline: form.application_deadline
        ? new Date(form.application_deadline).toISOString()
        : null,
      fee_yen: parseInt(form.fee_yen || "0", 10) || 0,
      timeline,
      status: publish ? "published" : "draft",
      created_by: currentUserId,
    };

    const { data, error: err } = await supabase
      .from("fieldworks")
      .insert(payload as never)
      .select("id")
      .single();
    setBusy(false);
    if (err) {
      setError(`作成失敗: ${err.message}`);
      return;
    }
    setCreating(false);
    if (data?.id) router.push(`/${orgSlug}/fieldworks/${data.id}`);
    else router.refresh();
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <GlassCard className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white text-xl"
            style={{
              background: "linear-gradient(135deg, #10b981, #3b82f6)",
            }}
            aria-hidden
          >
            👣
          </span>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold">フィールドワーク</h1>
            <p className="t-cap">
              {orgName} ・ 開催 {stats.total} 件 (募集中 {stats.published}) ・
              参加予定 {stats.participants} 名
            </p>
          </div>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90"
          >
            {creating ? "キャンセル" : "＋ 新しいフィールドワーク"}
          </button>
        )}
      </GlassCard>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 作成フォーム */}
      {creating && canCreate && (
        <GlassCard className="p-5 flex flex-col gap-3">
          <h2 className="text-[15px] font-extrabold">新しいフィールドワーク</h2>
          {themes.length === 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              テーマ紐付けが必須ですが、公開中/承認済のテーマがありません。
              先にテーマ出題を作成・承認してください。
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="対象テーマ *">
              <select
                value={form.theme_id}
                onChange={(e) => setForm({ ...form, theme_id: e.target.value })}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              >
                <option value="">— 選択 —</option>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code ? `${t.code} ` : ""}
                    {t.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="タイトル *">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例: 大橋 OHASHI HILL 見学会"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="テーマオーナー名 (表示用)">
              <input
                type="text"
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                placeholder="例: 株式会社えんホールディングス"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="集合日時">
              <input
                type="datetime-local"
                value={form.meeting_at}
                onChange={(e) =>
                  setForm({ ...form, meeting_at: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="集合場所">
              <input
                type="text"
                value={form.meeting_place}
                onChange={(e) =>
                  setForm({ ...form, meeting_place: e.target.value })
                }
                placeholder="例: 大橋駅 東口ロータリー"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="住所 / アクセス">
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="例: 福岡市南区大橋 X-X-X (西鉄大橋駅徒歩3分)"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="定員">
              <input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                placeholder="空欄なら無制限"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="応募締切">
              <input
                type="datetime-local"
                value={form.application_deadline}
                onChange={(e) =>
                  setForm({ ...form, application_deadline: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="参加費 (円)">
              <input
                type="number"
                min={0}
                value={form.fee_yen}
                onChange={(e) => setForm({ ...form, fee_yen: e.target.value })}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
          </div>

          <Field label="タイムライン (1行1コマ: 例 10:00-11:00 集合と挨拶)">
            <textarea
              rows={4}
              value={form.timeline_text}
              onChange={(e) =>
                setForm({ ...form, timeline_text: e.target.value })
              }
              placeholder={`10:00-11:00 集合・自己紹介\n11:00-12:00 施設見学\n12:00-13:00 ランチ交流会`}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] font-mono resize-y"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="フィールドワークで得られるもの">
              <textarea
                rows={3}
                value={form.what_you_gain}
                onChange={(e) =>
                  setForm({ ...form, what_you_gain: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] resize-y"
              />
            </Field>
            <Field label="持ち物">
              <textarea
                rows={3}
                value={form.what_to_bring}
                onChange={(e) =>
                  setForm({ ...form, what_to_bring: e.target.value })
                }
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] resize-y"
              />
            </Field>
            <Field label="服装指定">
              <input
                type="text"
                value={form.dress_code}
                onChange={(e) =>
                  setForm({ ...form, dress_code: e.target.value })
                }
                placeholder="例: 動きやすい服装、汚れても良い靴"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="雨天時対応">
              <input
                type="text"
                value={form.rain_plan}
                onChange={(e) => setForm({ ...form, rain_plan: e.target.value })}
                placeholder="例: 小雨決行、荒天時は前日 17 時までに連絡"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </Field>
          </div>

          <Field label="キャンセルポリシー">
            <textarea
              rows={2}
              value={form.cancellation_policy}
              onChange={(e) =>
                setForm({ ...form, cancellation_policy: e.target.value })
              }
              placeholder="例: 前日以降のキャンセルは連絡必須。無断キャンセルは以後の参加をお断りする場合があります。"
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] resize-y"
            />
          </Field>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => createFieldwork(false)}
              className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
            >
              下書き保存
            </button>
            <button
              type="button"
              disabled={busy || themes.length === 0}
              onClick={() => createFieldwork(true)}
              className="rounded-full bg-ink px-5 py-2 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "作成中…" : "公開して募集開始"}
            </button>
          </div>
        </GlassCard>
      )}

      {/* 一覧 */}
      {fieldworks.length === 0 ? (
        <GlassCard className="p-8 text-center flex flex-col gap-2">
          <span aria-hidden className="text-2xl">
            🥾
          </span>
          <p className="text-[13px] text-mute">
            まだフィールドワークがありません。
            {canCreate && "右上のボタンから作成してください。"}
          </p>
        </GlassCard>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {fieldworks.map((f) => {
            const s = STATUS_STYLE[f.status];
            const capacityLabel = f.capacity
              ? `${f.participants.length}/${f.capacity} 名`
              : `${f.participants.length} 名`;
            const isFull =
              f.capacity !== null && f.participants.length >= f.capacity;
            const iAmIn = f.participants.some((p) => p.is_me);
            return (
              <li key={f.id}>
                <Link
                  href={`/${orgSlug}/fieldworks/${f.id}`}
                  className="block h-full"
                >
                  <GlassCard className="p-4 flex flex-col gap-2.5 h-full hover:border-[--c-accent] transition border border-transparent">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${s.bg} ${s.text}`}
                          >
                            {s.label}
                          </span>
                          {iAmIn && (
                            <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold bg-[--c-accent] text-white">
                              参加予定
                            </span>
                          )}
                          {isFull && !iAmIn && (
                            <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700">
                              満員
                            </span>
                          )}
                        </div>
                        <h3 className="text-[15px] font-extrabold mt-1 truncate">
                          {f.title}
                        </h3>
                        <p className="t-cap truncate mt-0.5">
                          🎯 {f.theme_title}
                          {f.owner_name && ` ・ ${f.owner_name}`}
                        </p>
                      </div>
                      {f.thumbnail_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={f.thumbnail_url}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
                      <span className="text-mute">
                        📅 {fmtDateTime(f.meeting_at)}
                      </span>
                      <span className="text-mute truncate">
                        📍 {f.meeting_place ?? "未定"}
                      </span>
                      <span className="text-mute">👥 {capacityLabel}</span>
                      <span className="text-mute">
                        💴 {f.fee_yen > 0 ? `${f.fee_yen.toLocaleString()}円` : "無料"}
                      </span>
                    </div>

                    {/* 参加者アバター (透明化) */}
                    {f.participants.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-line-soft">
                        <span className="text-[10.5px] text-mute">
                          参加予定:
                        </span>
                        {f.participants.slice(0, 8).map((p) => (
                          <span
                            key={p.user_id}
                            className={
                              "inline-flex items-center gap-1 rounded-full pl-0.5 pr-2 py-0.5 text-[10.5px] " +
                              (p.is_me
                                ? "bg-ink text-white font-semibold"
                                : "bg-mute/10 text-ink-2")
                            }
                            title={p.display_name ?? "名前未設定"}
                          >
                            <Avatar
                              name={p.display_name}
                              url={p.avatar_url}
                              size={18}
                            />
                            {p.display_name ?? "名前未設定"}
                          </span>
                        ))}
                        {f.participants.length > 8 && (
                          <span className="t-cap">
                            +{f.participants.length - 8}
                          </span>
                        )}
                      </div>
                    )}
                  </GlassCard>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* admin 参照用: 全参加者マトリクス (簡易) */}
      {isAdmin && fieldworks.length > 0 && (
        <GlassCard className="p-4">
          <h3 className="text-[13px] font-extrabold text-mute uppercase tracking-wider mb-2">
            📋 参加予定一覧 (管理者ビュー)
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-1.5 pr-3">フィールドワーク</th>
                  <th className="text-left py-1.5 pr-3">日時</th>
                  <th className="text-left py-1.5 pr-3">参加者数</th>
                  <th className="text-left py-1.5">参加者</th>
                </tr>
              </thead>
              <tbody>
                {fieldworks.map((f) => (
                  <tr key={f.id} className="border-b border-line-soft">
                    <td className="py-1.5 pr-3 font-semibold">{f.title}</td>
                    <td className="py-1.5 pr-3 text-mute">
                      {fmtDateTime(f.meeting_at)}
                    </td>
                    <td className="py-1.5 pr-3">
                      {f.participants.length}
                      {f.capacity && `/${f.capacity}`}
                    </td>
                    <td className="py-1.5">
                      {f.participants
                        .map((p) => p.display_name ?? "名前未設定")
                        .join(", ") || <span className="text-mute">なし</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
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
