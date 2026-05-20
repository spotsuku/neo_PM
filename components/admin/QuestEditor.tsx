"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ProjectStats } from "@/lib/admin";
import type { Database } from "@/lib/types/database";

type Quest = Database["public"]["Tables"]["quests"]["Row"];
type QuestItem = Database["public"]["Tables"]["quest_items"]["Row"];

interface Props {
  orgId: string;
  orgSlug: string;
  initialQuests: Quest[];
  initialItems: QuestItem[];
  projects: ProjectStats[];
}

function endOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function QuestEditor({
  orgId,
  initialQuests,
  initialItems,
  projects,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [quests, setQuests] = useState<Quest[]>(initialQuests);
  const [items, setItems] = useState<QuestItem[]>(initialItems);
  const [error, setError] = useState<string | null>(null);

  // server から最新が来たら同期
  useEffect(() => {
    setQuests(initialQuests);
  }, [initialQuests]);
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const orgQuests = quests.filter((q) => !q.project_id);
  const projectQuests = quests.filter((q) => q.project_id);

  const itemsByQuest = useMemo(() => {
    const map = new Map<string, QuestItem[]>();
    for (const it of items) {
      if (!map.has(it.quest_id)) map.set(it.quest_id, []);
      map.get(it.quest_id)!.push(it);
    }
    return map;
  }, [items]);

  const createQuest = async (projectId: string | null) => {
    setError(null);
    const { data, error: err } = await supabase
      .from("quests")
      .insert({
        organization_id: orgId,
        project_id: projectId,
        title: projectId ? "プロジェクト別クエスト" : "今週のクエスト",
        emoji: "🎯",
        starts_at: startOfWeekISO(),
        ends_at: endOfWeekISO(),
        status: "active",
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "作成に失敗しました");
      return;
    }
    setQuests((prev) => [...prev, data]);
    router.refresh();
  };

  const updateQuest = async (id: string, patch: Partial<Quest>) => {
    setQuests((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    const { error: err } = await supabase
      .from("quests")
      .update(patch as never)
      .eq("id", id);
    if (err) setError(err.message);
    else router.refresh();
  };

  const archiveQuest = async (id: string) => {
    if (!confirm("このクエストをアーカイブしますか？")) return;
    setQuests((prev) => prev.filter((q) => q.id !== id));
    await supabase.from("quests").update({ status: "archived" }).eq("id", id);
    router.refresh();
  };

  const addItem = async (questId: string) => {
    const sibling = items.filter((it) => it.quest_id === questId);
    const position = sibling.length;
    const { data, error: err } = await supabase
      .from("quest_items")
      .insert({
        quest_id: questId,
        label: "新しいタスク",
        position,
        target_count: 1,
        done_count: 0,
      })
      .select()
      .single();
    if (err || !data) {
      setError(err?.message ?? "アイテム追加に失敗しました");
      return;
    }
    setItems((prev) => [...prev, data]);
    router.refresh();
  };

  const updateItem = async (id: string, patch: Partial<QuestItem>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
    const { error: err } = await supabase
      .from("quest_items")
      .update(patch as never)
      .eq("id", id);
    if (err) setError(err.message);
    else router.refresh();
  };

  const removeItem = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("quest_items").delete().eq("id", id);
    router.refresh();
  };

  const renderQuest = (q: Quest) => {
    const qItems = itemsByQuest.get(q.id) ?? [];
    const proj = projects.find((p) => p.id === q.project_id);
    const totalTargets = qItems.reduce((s, it) => s + it.target_count, 0);
    const totalDone = qItems.reduce(
      (s, it) => s + Math.min(it.done_count, it.target_count),
      0,
    );
    const pct =
      totalTargets > 0 ? Math.round((totalDone / totalTargets) * 100) : 0;
    return (
      <GlassCard key={q.id} className="p-5">
        <div className="grid grid-cols-[1fr_auto] gap-3 items-start mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <input
                type="text"
                value={q.emoji ?? ""}
                onChange={(e) =>
                  updateQuest(q.id, { emoji: e.target.value.slice(0, 2) })
                }
                className="w-10 rounded-md border border-line bg-white px-2 py-1 text-center text-[14px]"
              />
              <input
                type="text"
                value={q.title}
                onChange={(e) =>
                  updateQuest(q.id, { title: e.target.value })
                }
                className="flex-1 rounded-md border border-line bg-white px-3 py-1 text-[14px] font-bold outline-none focus:border-[--c-accent]"
              />
              {proj ? (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-[--c-accent-deep]">
                  📁 {proj.name}
                </span>
              ) : (
                <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">
                  組織共通
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 t-cap">
              <label>
                開始
                <input
                  type="date"
                  value={q.starts_at}
                  onChange={(e) =>
                    updateQuest(q.id, { starts_at: e.target.value })
                  }
                  className="block w-full rounded-md border border-line bg-white px-2 py-1 text-[11px] t-mono"
                />
              </label>
              <label>
                期限
                <input
                  type="date"
                  value={q.ends_at}
                  onChange={(e) =>
                    updateQuest(q.id, { ends_at: e.target.value })
                  }
                  className="block w-full rounded-md border border-line bg-white px-2 py-1 text-[11px] t-mono"
                />
              </label>
              <div className="self-end">
                達成 <strong>{totalDone}</strong>/{totalTargets} (
                {pct}%)
              </div>
              <div className="self-end text-right">
                <button
                  type="button"
                  onClick={() => archiveQuest(q.id)}
                  className="rounded-md bg-red-50 px-2 py-1 text-[10.5px] font-semibold text-error hover:bg-red-100"
                >
                  🗑 アーカイブ
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden border border-line-soft">
          <div className="grid grid-cols-[1fr_60px_60px_28px] gap-2 px-3 py-1.5 bg-canvas-2 t-label">
            <span>クエスト項目</span>
            <span className="text-right">達成</span>
            <span className="text-right">目標</span>
            <span />
          </div>
          {qItems.length === 0 ? (
            <div className="t-cap text-center py-3">項目を追加</div>
          ) : (
            qItems.map((it) => (
              <QuestItemRow
                key={it.id}
                item={it}
                onUpdate={(p) => updateItem(it.id, p)}
                onRemove={() => removeItem(it.id)}
              />
            ))
          )}
        </div>
        <button
          type="button"
          onClick={() => addItem(q.id)}
          className="mt-2 w-full rounded-md border border-dashed border-line px-3 py-2 text-[11.5px] font-semibold text-mute hover:border-[--c-accent] hover:text-[--c-accent-deep]"
        >
          ＋ 項目を追加
        </button>
      </GlassCard>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 組織共通クエスト */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="t-h3">
            <span aria-hidden className="mr-2">
              🌐
            </span>
            組織共通クエスト ({orgQuests.length})
          </h3>
          <button
            type="button"
            onClick={() => createQuest(null)}
            className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
          >
            ＋ 組織共通クエスト
          </button>
        </div>
        {orgQuests.length === 0 ? (
          <GlassCard className="p-6 text-center">
            <p className="t-cap">
              組織共通のクエストはまだありません。「＋ 組織共通クエスト」で作成 → ランキングページの「🎯 今週のクエスト」に表示されます。
            </p>
          </GlassCard>
        ) : (
          orgQuests.map(renderQuest)
        )}
      </section>

      {/* プロジェクト別クエスト */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="t-h3">
            <span aria-hidden className="mr-2">
              📁
            </span>
            プロジェクト別クエスト ({projectQuests.length})
          </h3>
          <select
            onChange={(e) => {
              if (e.target.value) {
                createQuest(e.target.value);
                e.target.value = "";
              }
            }}
            value=""
            className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
          >
            <option value="">＋ プロジェクトを選んで追加</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id} style={{ color: "black" }}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {projectQuests.length === 0 ? (
          <GlassCard className="p-6 text-center">
            <p className="t-cap">
              プロジェクト別のクエストはまだありません。停滞中のプロジェクトに個別のミッションを設定して活性化を促せます。
            </p>
          </GlassCard>
        ) : (
          projectQuests.map(renderQuest)
        )}
      </section>
    </div>
  );
}

function QuestItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: QuestItem;
  onUpdate: (patch: Partial<QuestItem>) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(item.label);

  return (
    <div className="grid grid-cols-[1fr_60px_60px_28px] gap-2 px-3 py-1.5 items-center border-t border-line-soft">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label !== item.label && onUpdate({ label })}
        className="rounded bg-transparent px-1 py-0.5 text-[12px] outline-none hover:bg-white focus:bg-white"
      />
      <input
        type="number"
        min={0}
        value={item.done_count}
        onChange={(e) =>
          onUpdate({ done_count: parseInt(e.target.value || "0", 10) })
        }
        className="text-right t-mono rounded bg-transparent px-1 py-0.5 text-[11.5px] outline-none hover:bg-white focus:bg-white"
      />
      <input
        type="number"
        min={1}
        value={item.target_count}
        onChange={(e) =>
          onUpdate({ target_count: parseInt(e.target.value || "1", 10) })
        }
        className="text-right t-mono rounded bg-transparent px-1 py-0.5 text-[11.5px] outline-none hover:bg-white focus:bg-white"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="削除"
        className="grid h-5 w-5 place-items-center text-mute hover:text-error hover:bg-red-50 rounded"
      >
        ✕
      </button>
    </div>
  );
}
