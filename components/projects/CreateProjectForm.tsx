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

interface Props {
  orgSlug: string;
  orgId: string;
  themes: Theme[];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function plusMonthsISO(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_MILESTONES = [
  { label: "キックオフ", weekOffset: 0 },
  { label: "仮説検証 完了", weekOffset: 4 },
  { label: "プロトタイプ", weekOffset: 10 },
  { label: "現場テスト", weekOffset: 16 },
  { label: "本番実施", weekOffset: 22 },
  { label: "振り返り", weekOffset: 26 },
];

export function CreateProjectForm({ orgSlug, orgId, themes }: Props) {
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

  const milestonePreview = useMemo(() => {
    if (!startedAt) return [];
    const start = new Date(startedAt);
    return DEFAULT_MILESTONES.map((m) => {
      const d = new Date(start);
      d.setDate(d.getDate() + m.weekOffset * 7);
      return { label: m.label, date: d.toISOString().slice(0, 10) };
    });
  }, [startedAt]);

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

    // Seed: 6 default milestones
    await supabase.from("milestones").insert(
      milestonePreview.map((m) => ({
        project_id: project.id,
        label: m.label,
        date: m.date,
        done: false,
      })),
    );

    router.push(`/${orgSlug}/dashboard`);
    router.refresh();
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

      <GlassCard className="p-5 md:p-6">
        <h3 className="t-h3 mb-3">
          <span aria-hidden className="mr-2">
            📍
          </span>
          自動で仮置きされるマイルストーン
        </h3>
        <p className="t-cap mb-4">
          いつでも編集できます。WBS 画面でドラッグして調整してください。
        </p>
        <ul className="grid grid-cols-2 gap-2">
          {milestonePreview.map((m, i) => (
            <li
              key={m.label}
              className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[12px] border border-line-soft"
            >
              <span
                className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white"
                style={{
                  background: i === 0 ? "var(--ink)" : "var(--c-accent)",
                }}
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate">{m.label}</span>
              <span className="t-mono">{m.date.slice(5)}</span>
            </li>
          ))}
        </ul>
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
          {submitting
            ? "作成中..."
            : "✦ プロジェクトを立ち上げる"}
        </button>
      </div>
    </form>
  );
}
