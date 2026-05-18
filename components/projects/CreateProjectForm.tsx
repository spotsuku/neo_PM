"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

interface Theme {
  id: string;
  title: string;
  code: string | null;
}

interface MilestoneTemplate {
  label: string;
  weekOffset: number;
}

interface Props {
  orgSlug: string;
  orgId: string;
  themes: Theme[];
  defaultMilestones: MilestoneTemplate[];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function plusMonthsISO(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function CreateProjectForm({
  orgSlug,
  orgId,
  themes,
  defaultMilestones,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [themeId, setThemeId] = useState<string>("");
  const [startedAt, setStartedAt] = useState<string>(todayISO());
  const [dueAt, setDueAt] = useState<string>(plusMonthsISO(6));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 編集可能なマイルストーンテンプレ
  const [milestones, setMilestones] =
    useState<MilestoneTemplate[]>(defaultMilestones);
  const [savedAsDefault, setSavedAsDefault] = useState(false);

  const isDirtyFromDefault = useMemo(() => {
    if (milestones.length !== defaultMilestones.length) return true;
    return milestones.some((m, i) => {
      const d = defaultMilestones[i];
      return m.label !== d.label || m.weekOffset !== d.weekOffset;
    });
  }, [milestones, defaultMilestones]);

  const milestoneDates = useMemo(() => {
    if (!startedAt) return [];
    const start = new Date(startedAt);
    return milestones.map((m) => {
      const d = new Date(start);
      d.setDate(d.getDate() + m.weekOffset * 7);
      return { label: m.label, date: d.toISOString().slice(0, 10) };
    });
  }, [startedAt, milestones]);

  const updateMilestone = (i: number, patch: Partial<MilestoneTemplate>) =>
    setMilestones((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    );

  const addMilestone = () =>
    setMilestones((prev) => [
      ...prev,
      {
        label: "新しいマイルストーン",
        weekOffset: prev.length > 0 ? prev[prev.length - 1].weekOffset + 4 : 0,
      },
    ]);

  const removeMilestone = (i: number) =>
    setMilestones((prev) => prev.filter((_, idx) => idx !== i));

  const resetToHardcoded = () => {
    setMilestones([
      { label: "キックオフ", weekOffset: 0 },
      { label: "仮説検証 完了", weekOffset: 4 },
      { label: "プロトタイプ", weekOffset: 10 },
      { label: "現場テスト", weekOffset: 16 },
      { label: "本番実施", weekOffset: 22 },
      { label: "振り返り", weekOffset: 26 },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("プロジェクト名を入力してください");
      return;
    }
    setSubmitting(true);

    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .insert({
        organization_id: orgId,
        name: name.trim(),
        team_name: teamName.trim() || null,
        idea_title: ideaTitle.trim() || null,
        theme_id: themeId || null,
        started_at: startedAt ? new Date(startedAt).toISOString() : null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        status: "active",
      })
      .select()
      .single();

    if (projectErr || !project) {
      setError(projectErr?.message ?? "プロジェクトの作成に失敗しました");
      setSubmitting(false);
      return;
    }

    // Seed: empty execution plan
    await supabase.from("execution_plans").insert({ project_id: project.id });

    // Seed: milestones（編集済みの内容を使う）
    if (milestoneDates.length > 0) {
      await supabase.from("milestones").insert(
        milestoneDates.map((m) => ({
          project_id: project.id,
          label: m.label,
          date: m.date,
          done: false,
        })),
      );
    }

    // 編集していたら組織のデフォルトとして上書き保存
    if (isDirtyFromDefault) {
      await supabase
        .from("organizations")
        .update({
          default_milestones: milestones as never,
        })
        .eq("id", orgId);
    }

    router.push(`/${orgSlug}/dashboard`);
    router.refresh();
  };

  const saveAsOrgDefault = async () => {
    if (!isDirtyFromDefault) return;
    const { error: err } = await supabase
      .from("organizations")
      .update({
        default_milestones: milestones as never,
      })
      .eq("id", orgId);
    if (err) {
      setError(err.message);
      return;
    }
    setSavedAsDefault(true);
    window.setTimeout(() => setSavedAsDefault(false), 2500);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <GlassCard className="p-5 md:p-6">
        <label className="block mb-4">
          <span className="t-label block mb-1">プロジェクト名 *</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: みんなの通学路マップ"
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent]"
          />
        </label>

        <label className="block mb-4">
          <span className="t-label block mb-1">チーム名</span>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="例: NEW LINE"
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent]"
          />
        </label>

        <label className="block">
          <span className="t-label block mb-1">アイデアの一言</span>
          <textarea
            rows={2}
            value={ideaTitle}
            onChange={(e) => setIdeaTitle(e.target.value)}
            placeholder="例: 子どもと地域住民が一緒に通学路をアップデートする仕組みをつくる"
            className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent] resize-none"
          />
        </label>
      </GlassCard>

      <GlassCard className="p-5 md:p-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <label className="block">
            <span className="t-label block mb-1">キックオフ日</span>
            <input
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent]"
            />
          </label>
          <label className="block">
            <span className="t-label block mb-1">完了予定</span>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent]"
            />
          </label>
        </div>

        {themes.length > 0 && (
          <label className="block">
            <span className="t-label block mb-1">紐付くテーマ（任意）</span>
            <select
              value={themeId}
              onChange={(e) => setThemeId(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-4 py-3 text-sm outline-none focus:border-[--c-accent]"
            >
              <option value="">（テーマなし）</option>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code ? `${t.code} — ` : ""}
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </GlassCard>

      {/* マイルストーンエディタ */}
      <GlassCard className="p-5 md:p-6">
        <div className="flex items-end justify-between mb-2">
          <div>
            <h3 className="t-h3">
              <span aria-hidden className="mr-2">
                📍
              </span>
              マイルストーン
            </h3>
            <p className="t-cap mt-0.5 leading-relaxed">
              名前と週オフセットを自由に編集できます。編集すると組織の次回デフォルトとして保存されます。
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={resetToHardcoded}
              className="rounded-md bg-white border border-line px-2.5 py-1 text-[10.5px] font-medium text-mute hover:text-ink"
            >
              ↺ 初期値に戻す
            </button>
            <button
              type="button"
              onClick={addMilestone}
              className="rounded-md bg-ink px-2.5 py-1 text-[10.5px] font-semibold text-white hover:opacity-90"
            >
              ＋ 追加
            </button>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden border border-line-soft mt-3">
          <div className="grid grid-cols-[32px_1fr_72px_88px_28px] gap-2 px-3 py-1.5 bg-canvas-2 t-label">
            <span>#</span>
            <span>名前</span>
            <span className="text-right">+週</span>
            <span className="text-right">日付</span>
            <span />
          </div>
          {milestones.map((m, i) => (
            <div
              key={i}
              className="grid grid-cols-[32px_1fr_72px_88px_28px] gap-2 px-3 py-2 items-center border-t border-line-soft"
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white"
                style={{
                  background: i === 0 ? "var(--ink)" : "var(--c-accent)",
                }}
              >
                {i + 1}
              </span>
              <input
                type="text"
                value={m.label}
                onChange={(e) => updateMilestone(i, { label: e.target.value })}
                className="rounded bg-transparent px-1 py-0.5 text-[12.5px] outline-none hover:bg-white focus:bg-white"
              />
              <input
                type="number"
                min={0}
                max={104}
                value={m.weekOffset}
                onChange={(e) =>
                  updateMilestone(i, {
                    weekOffset: parseInt(e.target.value || "0", 10),
                  })
                }
                className="text-right t-mono rounded bg-transparent px-1 py-0.5 text-[12px] outline-none hover:bg-white focus:bg-white"
              />
              <span className="text-right t-mono text-[11.5px]">
                {milestoneDates[i]?.date.slice(5) ?? "—"}
              </span>
              <button
                type="button"
                onClick={() => removeMilestone(i)}
                disabled={milestones.length <= 1}
                aria-label="削除"
                className="grid h-5 w-5 place-items-center text-mute hover:text-error hover:bg-red-50 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-mute"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="t-cap">
            {isDirtyFromDefault ? (
              <span>
                次回プロジェクト作成時もこの内容が初期表示されます
              </span>
            ) : (
              <span>組織のデフォルト雛形を使用中</span>
            )}
          </div>
          {isDirtyFromDefault && (
            <button
              type="button"
              onClick={saveAsOrgDefault}
              className="rounded-md bg-white border border-line px-2.5 py-1 text-[11px] font-semibold text-mute hover:text-[--c-accent-deep] hover:border-[--c-accent]"
            >
              {savedAsDefault ? "✓ 雛形を更新" : "💾 雛形だけ更新"}
            </button>
          )}
        </div>
      </GlassCard>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-mute border border-line"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "作成中..." : "✦ プロジェクトを立ち上げる"}
        </button>
      </div>
    </form>
  );
}
