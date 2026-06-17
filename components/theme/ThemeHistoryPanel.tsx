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
  themeId: string;
  /** 復元権限 (出題者 / 組織管理者 / editor collaborator) */
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

/** スナップショットの内容プレビュー (主要フィールドの先頭文字を見せる) */
function summary(snap: Record<string, unknown>): string {
  const keys = [
    "title",
    "vision",
    "current_state",
    "pain",
    "background",
    "description_long",
  ];
  for (const k of keys) {
    const v = snap[k];
    if (typeof v === "string" && v.trim()) {
      return v.trim().slice(0, 60) + (v.length > 60 ? "…" : "");
    }
  }
  return "(タイトル/内容なし)";
}

export function ThemeHistoryPanel({ open, onClose, themeId, canRestore }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SnapshotRow | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // open になったら fetch
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      // 1. スナップショットを引く
      const { data: snaps, error: err } = await supabase
        .from("content_snapshots")
        .select("id, taken_at, taken_by, source, snapshot")
        .eq("target_type", "theme")
        .eq("target_id", themeId)
        .order("taken_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (err) {
        setLoading(false);
        setError(`履歴の取得に失敗しました: ${err.message}`);
        return;
      }
      const rawRows = (snaps ?? []) as Omit<SnapshotRow, "taken_by_name">[];
      // 2. taken_by 一覧の profile を取得
      const ids = Array.from(
        new Set(rawRows.map((r) => r.taken_by).filter((x): x is string => !!x)),
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
      const result = rawRows.map((r) => ({
        ...r,
        taken_by_name: r.taken_by ? nameById.get(r.taken_by) ?? null : null,
      }));
      setRows(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, themeId, supabase]);

  const restore = async (row: SnapshotRow) => {
    if (
      !window.confirm(
        `この時点 (${fmt(row.taken_at)}) の状態に戻します。\n\n` +
          `・現在の状態は「↩️ 復元直前」として自動保存されるので、\n` +
          `  間違っても戻し直せます。\n` +
          `・このテーマだけが対象です。他のテーマ・プロジェクトは触りません。\n\n` +
          `続行しますか?`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("restore_theme_snapshot", {
      p_snapshot_id: row.id,
    });
    setBusy(false);
    if (err) {
      const msg = err.message.includes("permission_denied")
        ? "復元する権限がありません"
        : err.message.includes("snapshot_not_found")
          ? "スナップショットが見つかりません"
          : err.message.includes("wrong_target_type")
            ? "テーマ用のスナップショットではありません"
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
    const { error: err } = await supabase.rpc("snapshot_theme", {
      p_theme_id: themeId,
      p_source: "manual",
    });
    setBusy(false);
    if (err) {
      setError(`保存に失敗しました: ${err.message}`);
      return;
    }
    // 再 fetch
    setSelected(null);
    const { data: snaps } = await supabase
      .from("content_snapshots")
      .select("id, taken_at, taken_by, source, snapshot")
      .eq("target_type", "theme")
      .eq("target_id", themeId)
      .order("taken_at", { ascending: false })
      .limit(100);
    if (snaps) {
      const ids = Array.from(
        new Set(
          (snaps as Omit<SnapshotRow, "taken_by_name">[])
            .map((r) => r.taken_by)
            .filter((x): x is string => !!x),
        ),
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
        (snaps as Omit<SnapshotRow, "taken_by_name">[]).map((r) => ({
          ...r,
          taken_by_name: r.taken_by ? nameById.get(r.taken_by) ?? null : null,
        })),
      );
    }
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
              このテーマだけの履歴です。指定時点の状態に戻せます。
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
          {/* 左: 履歴リスト */}
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

          {/* 右: 選択中スナップショットの中身プレビュー */}
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

const PREVIEW_FIELDS: { key: string; label: string }[] = [
  { key: "title", label: "タイトル" },
  { key: "vision", label: "プロジェクトのビジョン" },
  { key: "current_state", label: "現状" },
  { key: "pain", label: "問題（ビジョンと現状のギャップ）" },
  { key: "root_cause", label: "問題が起きている要因" },
  { key: "focus_issue", label: "取り組むべき課題" },
  { key: "background", label: "WHY（背景）" },
  { key: "who_target", label: "WHO（ターゲット）" },
  { key: "what_benefit", label: "WHAT（提供価値）" },
  { key: "what_uniqueness", label: "独自性" },
  { key: "expected_outcome", label: "期待される成果" },
  { key: "internal_challenges", label: "実装する上でのリスク" },
  { key: "post_action", label: "採択後のアクション" },
  { key: "description_long", label: "テーマ概要" },
];

function SnapshotPreview({ snap }: { snap: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-3">
      {PREVIEW_FIELDS.map((f) => {
        const v = snap[f.key];
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
