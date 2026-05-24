"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

export interface PendingProject {
  id: string;
  name: string;
  team_name: string | null;
  idea_title: string | null;
  publish_submitted_at: string | null;
}

export interface PendingTheme {
  id: string;
  code: string | null;
  title: string;
  company_name: string | null;
  submitted_at: string | null;
}

/**
 * 管理者ダッシュの「審査」タブ。
 * - プロジェクトの公開申請 (visibility=submitted)
 * - テーマ出題の申請 (themes.status=submitted)
 * を一つのキューで承認 / 差し戻しする (Phase 1: 全体承認)。
 */
export function ReviewQueue({
  orgSlug,
  pendingProjects,
  pendingThemes,
}: {
  orgSlug: string;
  pendingProjects: PendingProject[];
  pendingThemes: PendingTheme[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const setNote = (id: string, v: string) =>
    setNotes((n) => ({ ...n, [id]: v }));

  const me = async () => (await supabase.auth.getUser()).data.user?.id ?? null;

  const decideProject = async (id: string, approve: boolean) => {
    setBusyId(id);
    setError(null);
    const reviewer = await me();
    const { error: e } = await supabase
      .from("projects")
      .update({
        visibility: approve ? "published" : "private",
        publish_reviewed_at: new Date().toISOString(),
        publish_reviewed_by: reviewer,
        publish_note: notes[id]?.trim() || null,
      })
      .eq("id", id);
    setBusyId(null);
    if (e) setError(e.message);
    else router.refresh();
  };

  const decideTheme = async (id: string, approve: boolean) => {
    setBusyId(id);
    setError(null);
    const reviewer = await me();
    const { error: e } = await supabase
      .from("themes")
      .update({
        status: approve ? "active" : "changes_requested",
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewer,
        review_note: notes[id]?.trim() || null,
      })
      .eq("id", id);
    setBusyId(null);
    if (e) setError(e.message);
    else router.refresh();
  };

  const total = pendingProjects.length + pendingThemes.length;

  if (total === 0) {
    return (
      <GlassCard className="p-10 text-center">
        <div className="text-4xl mb-2">✅</div>
        <p className="t-cap">審査待ちの申請はありません。</p>
      </GlassCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-error/10 px-3 py-2 text-[12px] text-error">
          {error}
        </div>
      )}

      {pendingProjects.length > 0 && (
        <section>
          <h3 className="t-h3 mb-2">
            🚀 プロジェクト公開申請（{pendingProjects.length}）
          </h3>
          <div className="flex flex-col gap-2">
            {pendingProjects.map((p) => (
              <GlassCard key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold truncate">
                      {p.team_name ?? p.name}
                    </div>
                    <div className="t-cap truncate">
                      {p.idea_title ?? p.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => decideProject(p.id, false)}
                      className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:bg-mute/5 disabled:opacity-50"
                    >
                      差し戻し
                    </button>
                    <Link
                      href={`/${orgSlug}/admin/review/${p.id}`}
                      className="rounded-full border border-[--c-accent] px-3 py-1.5 text-[12px] font-bold text-[--c-accent-deep] hover:bg-accent-soft"
                    >
                      📝 項目ごとに審査する →
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => decideProject(p.id, true)}
                      className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      ✓ 承認して公開
                    </button>
                  </div>
                </div>
                <textarea
                  value={notes[p.id] ?? ""}
                  onChange={(e) => setNote(p.id, e.target.value)}
                  placeholder="コメント（差し戻し理由など・任意）"
                  className="mt-2 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
                  rows={2}
                />
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {pendingThemes.length > 0 && (
        <section>
          <h3 className="t-h3 mb-2">
            🎯 テーマ出題の申請（{pendingThemes.length}）
          </h3>
          <div className="flex flex-col gap-2">
            {pendingThemes.map((t) => (
              <GlassCard key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold truncate">
                      {t.code ? `${t.code} ・ ` : ""}
                      {t.title}
                    </div>
                    <div className="t-cap truncate">
                      {t.company_name ?? "主催企業未設定"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => decideTheme(t.id, false)}
                      className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:bg-mute/5 disabled:opacity-50"
                    >
                      差し戻し
                    </button>
                    <Link
                      href={`/${orgSlug}/admin/review/theme/${t.id}`}
                      className="rounded-full border border-[--c-accent] px-3 py-1.5 text-[12px] font-bold text-[--c-accent-deep] hover:bg-accent-soft"
                    >
                      📝 項目ごとに審査する →
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => decideTheme(t.id, true)}
                      className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      ✓ 承認して公開
                    </button>
                  </div>
                </div>
                <textarea
                  value={notes[t.id] ?? ""}
                  onChange={(e) => setNote(t.id, e.target.value)}
                  placeholder="コメント（差し戻し理由など・任意）"
                  className="mt-2 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent]"
                  rows={2}
                />
              </GlassCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
