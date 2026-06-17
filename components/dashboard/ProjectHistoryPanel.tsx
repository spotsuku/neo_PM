"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

interface SnapshotRow {
  id: string;
  taken_at: string;
  taken_by: string | null;
  source: "autosave" | "manual" | "before_restore";
  snapshot: Record<string, unknown>;
  taken_by_name: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** 復元権限 (プロジェクトメンバー / 組織管理者) */
  canRestore: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  autosave: "💾 自動保存",
  manual: "✋ 手動保存",
  before_restore: "↩️ 復元直前",
};

const fmt = (s: string) => {
  const d = new Date(s);
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

/** プロジェクトスナップショットの要約 (主要項目の先頭文字)。 */
function summary(snap: Record<string, unknown>): string {
  const proj = (snap.project ?? {}) as Record<string, unknown>;
  const ep = (snap.execution_plan ?? {}) as Record<string, unknown>;
  const candidates = [
    proj.idea_title,
    ep.idea_summary,
    ep.qualitative_goal,
    ep.why,
    ep.what,
    proj.name,
  ];
  for (const v of candidates) {
    if (typeof v === "string" && v.trim()) {
      return v.trim().slice(0, 60) + (v.length > 60 ? "…" : "");
    }
  }
  return "(内容なし)";
}

export function ProjectHistoryPanel({
  open,
  onClose,
  projectId,
  canRestore,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SnapshotRow | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    const { data: snaps, error: err } = await supabase
      .from("content_snapshots")
      .select("id, taken_at, taken_by, source, snapshot")
      .eq("target_type", "project")
      .eq("target_id", projectId)
      .order("taken_at", { ascending: false })
      .limit(100);
    if (err) {
      setLoading(false);
      setError(`履歴の取得に失敗しました: ${err.message}`);
      return;
    }
    const raw = (snaps ?? []) as Omit<SnapshotRow, "taken_by_name">[];
    const ids = Array.from(
      new Set(raw.map((r) => r.taken_by).filter((x): x is string => !!x)),
    );
    let nameById = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      nameById = new Map(
        (profs ?? []).map((p) => [p.id, p.display_name ?? null]),
      );
    }
    setRows(
      raw.map((r) => ({
        ...r,
        taken_by_name: r.taken_by ? nameById.get(r.taken_by) ?? null : null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await fetchRows();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const restore = async (row: SnapshotRow) => {
    if (
      !window.confirm(
        `この時点 (${fmt(row.taken_at)}) の状態にプロジェクトを戻します。\n\n` +
          `・現在の状態は「↩️ 復元直前」として自動保存されるので、\n` +
          `  間違っても戻し直せます。\n` +
          `・このプロジェクトだけが対象です。他のテーマ・プロジェクトは触りません。\n\n` +
          `続行しますか?`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("restore_project_snapshot", {
      p_snapshot_id: row.id,
    });
    setBusy(false);
    if (err) {
      const msg = err.message.includes("permission_denied")
        ? "復元する権限がありません"
        : err.message.includes("snapshot_not_found")
          ? "スナップショットが見つかりません"
          : err.message.includes("wrong_target_type")
            ? "プロジェクト用のスナップショットではありません"
            : `復元に失敗しました: ${err.message}`;
      setError(msg);
      return;
    }
    onClose();
    router.refresh();
  };

  const snapshotNow = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("snapshot_project", {
      p_project_id: projectId,
      p_source: "manual",
    });
    setBusy(false);
    if (err) {
      setError(`保存に失敗しました: ${err.message}`);
      return;
    }
    setSelected(null);
    await fetchRows();
  };

  if (!open || !mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center px-4 py-6 overflow-y-auto"
      onClick={onClose}
      style={{ background: "rgba(15,23,42,0.55)" }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-white border border-line-soft shadow-2xl my-auto max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-soft">
          <div>
            <h3 className="t-h3">
              <span aria-hidden className="mr-1">
                🕒
              </span>
              編集履歴
            </h3>
            <p className="t-cap mt-1 opacity-70">
              このプロジェクトだけの履歴です。指定時点の状態に戻せます。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={snapshotNow}
              disabled={busy || loading}
              className="rounded-full bg-white border border-line px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink disabled:opacity-50"
              title="今の状態を履歴として残す"
            >
              📌 今すぐ保存
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-mute hover:bg-mute/10 text-[13px]"
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-0 flex-1 min-h-0">
          <div className="overflow-y-auto border-r border-line-soft min-h-0">
            {loading ? (
              <p className="t-cap p-5">読み込み中…</p>
            ) : rows.length === 0 ? (
              <p className="t-cap p-5">
                履歴はまだありません。編集を行うと自動的に履歴が作られます。
              </p>
            ) : (
              <ul className="flex flex-col">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className={
                        "w-full text-left px-4 py-3 border-b border-line-soft hover:bg-accent-soft/40 " +
                        (selected?.id === r.id ? "bg-accent-soft/60" : "")
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[12.5px] font-semibold truncate">
                          {fmt(r.taken_at)}
                        </div>
                        <span className="t-cap whitespace-nowrap">
                          {SOURCE_LABEL[r.source]}
                        </span>
                      </div>
                      <div className="t-cap opacity-70 mt-0.5">
                        {r.taken_by_name ?? "（不明）"}
                      </div>
                      <div className="t-cap opacity-80 mt-1 line-clamp-2">
                        {summary(r.snapshot as Record<string, unknown>)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="overflow-y-auto p-5 min-h-0">
            {selected ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="t-label">📍 {fmt(selected.taken_at)}</div>
                    <div className="t-cap mt-0.5 opacity-70">
                      {SOURCE_LABEL[selected.source]} ・{" "}
                      {selected.taken_by_name ?? "（不明）"}
                    </div>
                  </div>
                  {canRestore && (
                    <button
                      type="button"
                      onClick={() => restore(selected)}
                      disabled={busy}
                      className="rounded-full bg-ink px-4 py-2 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {busy ? "復元中…" : "↩️ この時点に戻す"}
                    </button>
                  )}
                </div>
                <SnapshotPreview snap={selected.snapshot as Record<string, unknown>} />
              </div>
            ) : (
              <p className="t-cap">
                左から履歴を選ぶと、その時点の内容をプレビューできます。
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const PROJECT_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "プロジェクト名" },
  { key: "team_name", label: "チーム名" },
  { key: "idea_title", label: "アイデアタイトル" },
];
const PLAN_FIELDS: { key: string; label: string }[] = [
  { key: "idea_summary", label: "アイデア概要" },
  { key: "why", label: "WHY (なぜやるか)" },
  { key: "who", label: "WHO (誰のため)" },
  { key: "what", label: "WHAT (提供価値)" },
  { key: "how", label: "HOW (どう実現するか)" },
  { key: "qualitative_goal", label: "定性ゴール" },
  { key: "product", label: "プロダクト" },
  { key: "price", label: "価格" },
  { key: "place", label: "提供場所" },
  { key: "promotion", label: "プロモーション" },
  { key: "schedule", label: "スケジュール" },
  { key: "budget_plan", label: "予算計画" },
  { key: "last_observation", label: "最終観察" },
];

function SnapshotPreview({ snap }: { snap: Record<string, unknown> }) {
  const proj = (snap.project ?? {}) as Record<string, unknown>;
  const ep = (snap.execution_plan ?? {}) as Record<string, unknown>;
  return (
    <div className="flex flex-col gap-3">
      {[
        ...PROJECT_FIELDS.map((f) => ({ ...f, source: proj })),
        ...PLAN_FIELDS.map((f) => ({ ...f, source: ep })),
      ].map((f) => {
        const v = f.source[f.key];
        const s = typeof v === "string" ? v.trim() : "";
        if (!s) return null;
        return (
          <div key={f.key} className="rounded-lg bg-canvas-2/40 px-3 py-2">
            <div className="t-label mb-1">{f.label}</div>
            <div className="text-[12.5px] whitespace-pre-wrap leading-relaxed">
              {s}
            </div>
          </div>
        );
      })}
    </div>
  );
}
