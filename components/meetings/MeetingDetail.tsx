"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Database } from "@/lib/types/database";

type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
type ActionItem = Database["public"]["Tables"]["action_items"]["Row"];

interface OrgMember {
  user_id: string;
  display_name: string | null;
}

interface Props {
  orgSlug: string;
  projectName: string;
  projectId: string;
  meeting: Meeting;
  initialActionItems: ActionItem[];
  orgMembers: OrgMember[];
  hasAnthropic: boolean;
}

const STATUS_META: Record<
  Meeting["status"],
  { label: string; bg: string; emo: string }
> = {
  scheduled: { label: "予定", bg: "var(--c-accent)", emo: "📅" },
  in_progress: { label: "進行中", bg: "var(--warn)", emo: "🟢" },
  finished: { label: "完了", bg: "var(--ok)", emo: "✓" },
  cancelled: { label: "中止", bg: "var(--mute)", emo: "✕" },
};

const AI_STATUS_LABEL: Record<ActionItem["status"], string> = {
  open: "未着手",
  in_progress: "進行中",
  done: "完了",
  cancelled: "中止",
};

function toLocalDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface AISuggestion {
  title: string;
  detail?: string;
  assignee_hint?: string;
  due_hint?: string;
}

export function MeetingDetail({
  orgSlug,
  projectName,
  projectId,
  meeting,
  initialActionItems,
  orgMembers,
  hasAnthropic,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [title, setTitle] = useState(meeting.title);
  const [scheduledAt, setScheduledAt] = useState(
    toLocalDateTime(meeting.scheduled_at),
  );
  const [durationMin, setDurationMin] = useState(meeting.duration_min);
  const [location, setLocation] = useState(meeting.location ?? "");
  const [status, setStatus] = useState<Meeting["status"]>(meeting.status);
  const [agenda, setAgenda] = useState(meeting.agenda ?? "");
  const [minutes, setMinutes] = useState(meeting.minutes ?? "");
  const [decisions, setDecisions] = useState(meeting.decisions ?? "");
  const [notionUrl, setNotionUrl] = useState(meeting.notion_url ?? "");
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [actionItems, setActionItems] =
    useState<ActionItem[]>(initialActionItems);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);

  // デバウンス save
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const patch = (field: string, value: unknown) => {
    setSavingFields((prev) => new Set(prev).add(field));
    const t = timersRef.current.get(field);
    if (t) clearTimeout(t);
    const next = setTimeout(async () => {
      const { error: err } = await supabase
        .from("meetings")
        .update({ [field]: value })
        .eq("id", meeting.id);
      setSavingFields((prev) => {
        const s = new Set(prev);
        s.delete(field);
        return s;
      });
      if (err) setError(err.message);
    }, 600);
    timersRef.current.set(field, next);
  };
  useEffect(() => () => timersRef.current.forEach((t) => clearTimeout(t)), []);

  const deleteMeeting = async () => {
    if (!confirm("この会議を削除しますか？議事録と Action Items も一緒に削除されます。"))
      return;
    const { error: err } = await supabase
      .from("meetings")
      .delete()
      .eq("id", meeting.id);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(`/${orgSlug}/meetings`);
    router.refresh();
  };

  // ── Action Items ────────────────────────
  const addActionItem = async (suggestion?: AISuggestion) => {
    const hint = suggestion?.assignee_hint;
    const assigneeFromHint: OrgMember | undefined = hint
      ? orgMembers.find((m) => m.display_name?.includes(hint))
      : undefined;
    const dueDate =
      suggestion?.due_hint && /^\d{4}-\d{2}-\d{2}$/.test(suggestion.due_hint)
        ? suggestion.due_hint
        : null;
    const { data, error: err } = await supabase
      .from("action_items")
      .insert({
        project_id: projectId,
        meeting_id: meeting.id,
        title: suggestion?.title ?? "新しい Action Item",
        detail: suggestion?.detail ?? null,
        assignee_user_id: assigneeFromHint?.user_id ?? null,
        assignee_name: !assigneeFromHint
          ? suggestion?.assignee_hint ?? null
          : null,
        due_date: dueDate,
        status: "open",
        source: suggestion ? "ai_extracted" : "manual",
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "追加に失敗しました");
      return;
    }
    setActionItems((prev) => [...prev, data]);
  };

  const updateActionItem = async (id: string, patch: Partial<ActionItem>) => {
    setActionItems((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
    const { error: err } = await supabase
      .from("action_items")
      .update(patch as never)
      .eq("id", id);
    if (err) setError(err.message);
  };

  const removeActionItem = async (id: string) => {
    setActionItems((prev) => prev.filter((a) => a.id !== id));
    await supabase.from("action_items").delete().eq("id", id);
  };

  const promoteToTask = async (item: ActionItem) => {
    if (item.source_task_id) {
      // 既にタスク化済み
      alert("この Action Item は既にタスクに昇格しています。");
      return;
    }
    const { data: task, error: err } = await supabase
      .from("tasks")
      .insert({
        project_id: projectId,
        title: item.title,
        owner_name:
          item.assignee_name ??
          orgMembers.find((m) => m.user_id === item.assignee_user_id)
            ?.display_name ??
          null,
        status: "todo",
        progress: 0,
        start_week: 0,
        span_week: 2,
      })
      .select()
      .single();
    if (err || !task) {
      setError(err?.message ?? "タスク化に失敗しました");
      return;
    }
    await updateActionItem(item.id, { source_task_id: task.id });
  };

  const runAIExtract = async () => {
    if (!hasAnthropic) {
      setError("ANTHROPIC_API_KEY が設定されていません");
      return;
    }
    if (!minutes.trim() && !agenda.trim()) {
      setError("先に議事録を書いてください");
      return;
    }
    setError(null);
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/extract-action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          agenda,
          minutes,
          decisions,
          orgMembers: orgMembers.map((m) => m.display_name).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `エラー (${res.status})`);
      }
      const data = (await res.json()) as { suggestions: AISuggestion[] };
      setAiSuggestions(data.suggestions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "抽出に失敗しました");
    } finally {
      setAiBusy(false);
    }
  };

  const acceptSuggestion = async (i: number) => {
    await addActionItem(aiSuggestions[i]);
    setAiSuggestions((prev) => prev.filter((_, idx) => idx !== i));
  };
  const rejectSuggestion = (i: number) =>
    setAiSuggestions((prev) => prev.filter((_, idx) => idx !== i));

  const anySaving = savingFields.size > 0;
  const meta = STATUS_META[status];

  return (
    <>
      {/* Header */}
      <GlassCard className="p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white text-xl"
            style={{ background: meta.bg }}
          >
            {meta.emo}
          </span>
          <div className="min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                patch("title", e.target.value);
              }}
              className="text-[18px] font-extrabold tracking-tight bg-transparent outline-none border-b border-transparent focus:border-line w-full max-w-xl"
            />
            <div className="t-cap truncate">
              {projectName} ・{" "}
              {meeting.scheduled_at
                ? new Date(meeting.scheduled_at).toLocaleString("ja-JP")
                : "日時未定"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition " +
              (anySaving
                ? "bg-accent-soft text-[--c-accent-deep]"
                : "bg-white text-mute")
            }
          >
            {anySaving ? "💾 保存中..." : "✓ 自動保存"}
          </span>
          <select
            value={status}
            onChange={(e) => {
              const s = e.target.value as Meeting["status"];
              setStatus(s);
              patch("status", s);
            }}
            className="rounded-full bg-white border border-line px-3 py-1.5 text-[11.5px] font-semibold outline-none"
          >
            <option value="scheduled">📅 予定</option>
            <option value="in_progress">🟢 進行中</option>
            <option value="finished">✓ 完了</option>
            <option value="cancelled">✕ 中止</option>
          </select>
        </div>
      </GlassCard>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Meta + Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 lg:gap-5">
        <GlassCard className="p-5">
          <h3 className="t-h3 mb-3">
            <span aria-hidden className="mr-2">
              📝
            </span>
            会議情報
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="t-label block mb-1">日時</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => {
                  setScheduledAt(e.target.value);
                  patch(
                    "scheduled_at",
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  );
                }}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent]"
              />
            </label>
            <label className="block">
              <span className="t-label block mb-1">所要（分）</span>
              <input
                type="number"
                min={5}
                max={600}
                value={durationMin}
                onChange={(e) => {
                  const v = parseInt(e.target.value || "60", 10);
                  setDurationMin(v);
                  patch("duration_min", v);
                }}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent] t-mono"
              />
            </label>
          </div>
          <label className="block mb-3">
            <span className="t-label block mb-1">場所</span>
            <input
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                patch("location", e.target.value || null);
              }}
              placeholder="Zoom / 本社B会議室 など"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent]"
            />
          </label>
          <label className="block mb-3">
            <span className="t-label block mb-1">
              Notion 議事録 URL（任意）
            </span>
            <input
              type="url"
              value={notionUrl}
              onChange={(e) => {
                setNotionUrl(e.target.value);
                patch("notion_url", e.target.value || null);
              }}
              placeholder="https://notion.so/..."
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent] t-mono"
            />
          </label>
          <label className="block">
            <span className="t-label block mb-1">議題（Agenda）</span>
            <textarea
              rows={4}
              value={agenda}
              onChange={(e) => {
                setAgenda(e.target.value);
                patch("agenda", e.target.value || null);
              }}
              placeholder={"・現状確認\n・次のマイルストーンの認識合わせ\n・誰が何をやるか"}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent] resize-none"
            />
          </label>
        </GlassCard>

        <GlassCard variant="dark" className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-white text-[13px]"
              style={{
                background:
                  "conic-gradient(from 220deg, var(--c-accent), var(--c-accent-deep) 60%, #0a0a0a)",
              }}
            >
              ✦
            </span>
            <div className="text-[13px] font-bold">AI Action Item 抽出</div>
          </div>
          <p className="text-[12px] opacity-90 leading-relaxed mb-3">
            議事録と議題を AI に渡して、誰が何をいつまでに、を提案させます。
            提案カードが下に並ぶので、確認 → 承認 で Action Items に追加。
          </p>
          <button
            type="button"
            onClick={runAIExtract}
            disabled={!hasAnthropic || aiBusy}
            className="w-full rounded-md bg-white px-3 py-2 text-[12px] font-bold text-ink hover:bg-accent-soft disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiBusy
              ? "✦ 抽出中..."
              : hasAnthropic
                ? "✦ AI で Action Items を抽出"
                : "🔒 ANTHROPIC_API_KEY 未設定"}
          </button>
          {!hasAnthropic && (
            <p className="text-[10.5px] opacity-70 mt-2 leading-relaxed">
              Vercel の Environment Variables に
              <span className="t-mono"> ANTHROPIC_API_KEY </span>
              を追加 + Redeploy で有効化されます。
            </p>
          )}
        </GlassCard>
      </div>

      {/* Minutes + Decisions */}
      <GlassCard className="p-5">
        <h3 className="t-h3 mb-3">
          <span aria-hidden className="mr-2">
            📜
          </span>
          議事録
        </h3>
        <textarea
          rows={12}
          value={minutes}
          onChange={(e) => {
            setMinutes(e.target.value);
            patch("minutes", e.target.value || null);
          }}
          placeholder={
            "・参加者: 高橋、山田、佐藤\n・冒頭の現状共有\n  - プロトタイプ進捗 70%\n・次のステップ\n  - 高橋: 来週金曜までに現場テストの段取り\n  - 山田: 協賛先候補3社にアプローチ\n  - 佐藤: 広報チラシのドラフトを月曜まで"
          }
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent] resize-y font-mono leading-relaxed"
        />
        <h3 className="t-h3 mt-5 mb-3">
          <span aria-hidden className="mr-2">
            ✅
          </span>
          決定事項
        </h3>
        <textarea
          rows={4}
          value={decisions}
          onChange={(e) => {
            setDecisions(e.target.value);
            patch("decisions", e.target.value || null);
          }}
          placeholder={"・現場テストを来週金曜に実施することを決定\n・基金申請の中間報告を作成"}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent] resize-y"
        />
      </GlassCard>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <GlassCard className="p-5" style={{ borderLeft: "4px solid var(--c-accent)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="t-h3">
              <span aria-hidden className="mr-2">
                💡
              </span>
              AI 提案 ({aiSuggestions.length})
            </h3>
            <button
              type="button"
              onClick={() => setAiSuggestions([])}
              className="t-cap underline"
            >
              すべて却下
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {aiSuggestions.map((s, i) => (
              <li
                key={i}
                className="rounded-lg bg-accent-soft p-3 grid grid-cols-[1fr_auto] gap-3 items-start"
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] font-bold mb-1">{s.title}</div>
                  {s.detail && (
                    <div className="t-cap mb-1 leading-relaxed">{s.detail}</div>
                  )}
                  <div className="flex items-center gap-3 t-cap">
                    {s.assignee_hint && <span>👤 {s.assignee_hint}</span>}
                    {s.due_hint && <span>📅 {s.due_hint}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => acceptSuggestion(i)}
                    className="rounded-md bg-ink px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                  >
                    ✓ 承認
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectSuggestion(i)}
                    className="rounded-md bg-white border border-line px-2.5 py-1 text-[11px] font-medium text-mute"
                  >
                    却下
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Action Items table */}
      <GlassCard className="p-5">
        <div className="flex items-end justify-between mb-3">
          <h3 className="t-h3">
            <span aria-hidden className="mr-2">
              📌
            </span>
            Action Items ({actionItems.length})
          </h3>
          <button
            type="button"
            onClick={() => addActionItem()}
            className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90"
          >
            ＋ 追加
          </button>
        </div>

        {actionItems.length === 0 ? (
          <p className="t-cap text-center py-6">
            会議で決まった「誰が何をいつまでに」を入力すると、WBS にタスクとして反映できます。
          </p>
        ) : (
          <div className="rounded-lg overflow-hidden border border-line-soft">
            <div className="grid grid-cols-[1fr_140px_110px_90px_auto_28px] gap-2 px-3 py-2 bg-canvas-2 t-label">
              <span>タイトル / 詳細</span>
              <span>担当</span>
              <span>期日</span>
              <span>状態</span>
              <span>タスク化</span>
              <span />
            </div>
            {actionItems.map((it) => (
              <ActionRow
                key={it.id}
                item={it}
                orgMembers={orgMembers}
                onUpdate={(p) => updateActionItem(it.id, p)}
                onRemove={() => removeActionItem(it.id)}
                onPromote={() => promoteToTask(it)}
              />
            ))}
          </div>
        )}
      </GlassCard>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={deleteMeeting}
          className="rounded-md bg-red-50 px-3 py-1.5 text-[11.5px] font-semibold text-error hover:bg-red-100"
        >
          🗑 この会議を削除
        </button>
      </div>
    </>
  );
}

function ActionRow({
  item,
  orgMembers,
  onUpdate,
  onRemove,
  onPromote,
}: {
  item: ActionItem;
  orgMembers: OrgMember[];
  onUpdate: (patch: Partial<ActionItem>) => void;
  onRemove: () => void;
  onPromote: () => void;
}) {
  const [local, setLocal] = useState({
    title: item.title,
    detail: item.detail ?? "",
    assignee_user_id: item.assignee_user_id ?? "",
    assignee_name: item.assignee_name ?? "",
    due_date: item.due_date ?? "",
    status: item.status,
  });
  const commit = (patch: Partial<typeof local>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onUpdate({
      title: next.title,
      detail: next.detail || null,
      assignee_user_id: next.assignee_user_id || null,
      assignee_name: next.assignee_user_id ? null : next.assignee_name || null,
      due_date: next.due_date || null,
      status: next.status,
    });
  };

  const isDone = local.status === "done" || local.status === "cancelled";
  const promoted = Boolean(item.source_task_id);

  return (
    <div className="grid grid-cols-[1fr_140px_110px_90px_auto_28px] gap-2 px-3 py-2 items-start border-t border-line-soft">
      <div className="min-w-0 flex flex-col gap-1">
        <input
          type="text"
          value={local.title}
          onChange={(e) => setLocal((s) => ({ ...s, title: e.target.value }))}
          onBlur={() => commit({})}
          className={
            "rounded bg-transparent px-1 py-0.5 text-[12.5px] outline-none hover:bg-white focus:bg-white font-medium " +
            (isDone ? "line-through opacity-60" : "")
          }
        />
        <input
          type="text"
          value={local.detail}
          onChange={(e) => setLocal((s) => ({ ...s, detail: e.target.value }))}
          onBlur={() => commit({})}
          placeholder="詳細メモ（任意）"
          className="rounded bg-transparent px-1 py-0.5 text-[11px] outline-none hover:bg-white focus:bg-white text-mute"
        />
        {item.source === "ai_extracted" && (
          <span className="t-label text-[--c-accent-deep]">✦ AI 提案から</span>
        )}
      </div>
      <select
        value={local.assignee_user_id}
        onChange={(e) => commit({ assignee_user_id: e.target.value })}
        className="rounded bg-transparent px-1 py-0.5 text-[11px] outline-none hover:bg-white focus:bg-white"
      >
        <option value="">担当者未設定</option>
        {orgMembers.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.display_name ?? "（名前未設定）"}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={local.due_date}
        onChange={(e) => commit({ due_date: e.target.value })}
        className="rounded bg-transparent px-1 py-0.5 text-[11px] outline-none hover:bg-white focus:bg-white t-mono"
      />
      <select
        value={local.status}
        onChange={(e) =>
          commit({ status: e.target.value as ActionItem["status"] })
        }
        className="rounded bg-transparent px-1 py-0.5 text-[11px] outline-none hover:bg-white focus:bg-white"
      >
        {Object.entries(AI_STATUS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onPromote}
        disabled={promoted}
        className={
          "rounded-md px-2 py-1 text-[10.5px] font-semibold transition " +
          (promoted
            ? "bg-ok/15 text-ok cursor-not-allowed"
            : "bg-ink text-white hover:opacity-90")
        }
        title={promoted ? "WBS タスク化済み" : "WBS のタスクとして登録"}
      >
        {promoted ? "✓ タスク化済" : "🚀 タスク化"}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="削除"
        className="grid h-5 w-5 place-items-center text-mute hover:text-error hover:bg-red-50 rounded self-center"
      >
        ✕
      </button>
    </div>
  );
}
