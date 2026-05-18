"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { todayISO } from "@/lib/dates";
import type { Database } from "@/lib/types/database";

export type Milestone = Database["public"]["Tables"]["milestones"]["Row"];

interface Props {
  projectId: string;
  milestones: Milestone[];
  onChange: (next: Milestone[]) => void;
}

const PRESETS = [
  "PJTチーム キックオフ完了",
  "仮説検証 完了",
  "初期プロトタイプ リリース",
  "現場テスト 完了",
  "初期売上 達成",
  "中間報告",
  "本番実施",
  "振り返り",
];

export function MilestoneEditor({ projectId, milestones, onChange }: Props) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDate, setNewDate] = useState(todayISO());

  const addMilestone = async (label: string, date: string) => {
    if (!label.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("milestones")
      .insert({
        project_id: projectId,
        label: label.trim(),
        date: date || null,
        done: false,
      })
      .select()
      .single();
    setBusy(false);
    if (err || !data) {
      setError(err?.message ?? "追加に失敗しました");
      return;
    }
    onChange([...milestones, data]);
    setNewLabel("");
    setNewDate(todayISO());
    setAdding(false);
  };

  const updateMilestone = async (
    id: string,
    patch: Partial<Milestone>,
  ) => {
    onChange(
      milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
    const { error: err } = await supabase
      .from("milestones")
      .update(patch as never)
      .eq("id", id);
    if (err) setError(err.message);
  };

  const removeMilestone = async (id: string) => {
    if (!confirm("このマイルストーンを削除しますか？")) return;
    onChange(milestones.filter((m) => m.id !== id));
    await supabase.from("milestones").delete().eq("id", id);
  };

  const sorted = [...milestones].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  const doneCount = milestones.filter((m) => m.done).length;

  return (
    <GlassCard className={expanded ? "p-5" : "p-3"}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-left hover:opacity-80"
          aria-expanded={expanded}
        >
          <span className="text-mute text-[11px] w-3 inline-block">
            {expanded ? "▼" : "▶"}
          </span>
          <span aria-hidden>📍</span>
          <span className="text-[13px] font-bold">マイルストーン</span>
          <span className="t-cap">
            {milestones.length === 0
              ? "未登録"
              : `${milestones.length} 件 (${doneCount} 完了)`}
          </span>
        </button>
        {expanded && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
          >
            {adding ? "✕ 閉じる" : "＋ マイルストーンを追加"}
          </button>
        )}
      </div>

      {!expanded ? null : (
        <>
          <p className="t-cap mt-2 mb-3">
            プロジェクトの節目を期日付きで記録します。ガントとダッシュボードに反映されます。
          </p>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      {adding && (
        <div className="rounded-lg border border-dashed border-line p-3 mb-3 bg-canvas-2">
          <div className="grid grid-cols-[1fr_140px_auto] gap-2 items-end mb-2">
            <label className="block">
              <span className="t-label block mb-1">名前</span>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="例: 初期プロトタイプ リリース"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent]"
              />
            </label>
            <label className="block">
              <span className="t-label block mb-1">期日</span>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent] t-mono"
              />
            </label>
            <button
              type="button"
              onClick={() => addMilestone(newLabel, newDate)}
              disabled={busy || !newLabel.trim()}
              className="rounded-md bg-ink px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              追加
            </button>
          </div>
          <div className="t-label mb-1.5">よくある例（タップで挿入）</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setNewLabel(p)}
                className="rounded-full bg-white border border-line px-2.5 py-0.5 text-[10.5px] text-mute hover:text-ink hover:border-[--c-accent]"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="t-cap text-center py-4">
          まだマイルストーンがありません。「＋ マイルストーンを追加」から作成してください。
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {sorted.map((m) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              onUpdate={(patch) => updateMilestone(m.id, patch)}
              onRemove={() => removeMilestone(m.id)}
            />
          ))}
        </ul>
      )}
        </>
      )}
    </GlassCard>
  );
}

function MilestoneRow({
  milestone,
  onUpdate,
  onRemove,
}: {
  milestone: Milestone;
  onUpdate: (patch: Partial<Milestone>) => void;
  onRemove: () => void;
}) {
  const [local, setLocal] = useState({
    label: milestone.label,
    date: milestone.date ?? "",
  });
  const commit = (patch: Partial<typeof local>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onUpdate({
      label: next.label,
      date: next.date || null,
    });
  };

  return (
    <li className="grid grid-cols-[24px_1fr_140px_28px] gap-2 items-center rounded-lg px-2 py-1.5 hover:bg-accent-soft/40">
      <button
        type="button"
        onClick={() => onUpdate({ done: !milestone.done })}
        className="grid h-5 w-5 place-items-center rounded transition"
        aria-label={milestone.done ? "未完了に戻す" : "完了にする"}
        style={{
          background: milestone.done ? "var(--ink)" : "transparent",
          border: milestone.done
            ? "2px solid var(--ink)"
            : "2px solid var(--line)",
        }}
        title={milestone.done ? "完了済み" : "未完了"}
      >
        {milestone.done && (
          <span className="text-white text-[10px] font-bold">✓</span>
        )}
      </button>
      <input
        type="text"
        value={local.label}
        onChange={(e) => setLocal((s) => ({ ...s, label: e.target.value }))}
        onBlur={() => commit({})}
        className={
          "rounded bg-transparent px-1 py-0.5 text-[12.5px] outline-none hover:bg-white focus:bg-white font-medium " +
          (milestone.done ? "line-through opacity-60" : "")
        }
      />
      <input
        type="date"
        value={local.date}
        onChange={(e) => commit({ date: e.target.value })}
        className="rounded bg-transparent px-1 py-0.5 text-[11.5px] outline-none hover:bg-white focus:bg-white t-mono"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="削除"
        className="grid h-5 w-5 place-items-center text-mute hover:text-error hover:bg-red-50 rounded"
      >
        ✕
      </button>
    </li>
  );
}
