"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Database } from "@/lib/types/database";

type Application = Database["public"]["Tables"]["theme_applications"]["Row"];
type AppStatus = Application["status"];

interface ThemeLite {
  id: string;
  code: string | null;
  title: string;
  thumbnail_url: string | null;
}

type WithTheme = Application & { theme: ThemeLite | null };

interface Props {
  orgSlug: string;
  canReview: boolean;
  myApps: WithTheme[];
  incoming: WithTheme[];
}

type Tab = "mine" | "incoming";

const STATUS_META: Record<AppStatus, { label: string; bg: string; emo: string }> = {
  draft: { label: "下書き", bg: "var(--mute)", emo: "📝" },
  submitted: { label: "応募済み", bg: "var(--c-accent)", emo: "✉️" },
  under_review: { label: "審査中", bg: "var(--warn)", emo: "🔎" },
  approved: { label: "✓ 合格", bg: "var(--ok)", emo: "🎉" },
  rejected: { label: "✕ 不採択", bg: "var(--error)", emo: "📦" },
  withdrawn: { label: "取下げ", bg: "var(--mute)", emo: "↩" },
};

export function ApplicationsBoard({
  orgSlug,
  canReview,
  myApps,
  incoming,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>(
    canReview && incoming.length > 0 && myApps.length === 0
      ? "incoming"
      : "mine",
  );
  const [incomingState, setIncomingState] = useState<WithTheme[]>(incoming);
  const [filter, setFilter] = useState<"all" | AppStatus>("all");
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const filteredIncoming = incomingState.filter(
    (a) => filter === "all" || a.status === filter,
  );

  const incomingCounts = useMemo(() => {
    const c: Record<string, number> = { all: incomingState.length };
    for (const a of incomingState) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [incomingState]);

  const review = async (
    app: WithTheme,
    status: "approved" | "rejected",
    note: string,
  ) => {
    setError(null);
    let createdProjectId: string | null = null;

    if (status === "approved") {
      // 合格時はプロジェクトを作成
      // テーマの組織を所有組織として、応募者の team_name でプロジェクトを作る
      const { data: theme } = await supabase
        .from("themes")
        .select("organization_id, title")
        .eq("id", app.theme_id)
        .maybeSingle();
      if (!theme) {
        setError("テーマが見つかりません");
        return;
      }
      const { data: proj, error: projErr } = await supabase
        .from("projects")
        .insert({
          organization_id: theme.organization_id,
          name: app.team_name || theme.title,
          team_name: app.team_name || null,
          idea_title: theme.title,
          theme_id: app.theme_id,
          status: "active",
        })
        .select()
        .single();
      if (projErr || !proj) {
        setError(projErr?.message ?? "プロジェクト作成に失敗");
        return;
      }
      createdProjectId = proj.id;

      // 応募者をプロジェクトの lead として登録
      await supabase.from("project_memberships").insert({
        project_id: proj.id,
        user_id: app.applicant_user_id,
        role: "lead",
      });

      // 空の execution_plan を seed
      await supabase
        .from("execution_plans")
        .insert({ project_id: proj.id });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: updated, error: err } = await supabase
      .from("theme_applications")
      .update({
        status,
        decided_at: new Date().toISOString(),
        decided_by: user?.id ?? null,
        decision_note: note || null,
        created_project_id: createdProjectId,
      })
      .eq("id", app.id)
      .select()
      .single();
    if (err || !updated) {
      setError(err?.message ?? "更新に失敗しました");
      return;
    }
    setIncomingState((prev) =>
      prev.map((a) =>
        a.id === app.id ? { ...a, ...(updated as Application) } : a,
      ),
    );
    setReviewingId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <TabBtn
          label="📤 自分の応募"
          count={myApps.length}
          active={tab === "mine"}
          onClick={() => setTab("mine")}
        />
        {canReview && (
          <TabBtn
            label="📥 受信応募（審査）"
            count={incomingState.length}
            active={tab === "incoming"}
            onClick={() => setTab("incoming")}
          />
        )}
      </div>

      {tab === "mine" &&
        (myApps.length === 0 ? (
          <GlassCard className="p-10 text-center">
            <div className="text-4xl mb-3">📭</div>
            <h3 className="t-h3 mb-1">応募はまだありません</h3>
            <p className="t-cap mb-5">
              「📋 テーマ応募」からテーマを見つけて応募してください。
            </p>
            <Link
              href={`/${orgSlug}/themes`}
              className="inline-block rounded-full bg-ink px-5 py-2 text-[12px] font-semibold text-white"
            >
              → テーマを見る
            </Link>
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-2">
            {myApps.map((a) => (
              <MyAppRow key={a.id} orgSlug={orgSlug} app={a} />
            ))}
          </div>
        ))}

      {tab === "incoming" && canReview && (
        <>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              ["all", "submitted", "under_review", "approved", "rejected"] as const
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={
                  "rounded-full px-3 py-1.5 text-[11px] font-semibold transition " +
                  (filter === s
                    ? "bg-ink text-white"
                    : "bg-white text-mute hover:bg-mute/5")
                }
              >
                {s === "all" ? "すべて" : STATUS_META[s].label}
                <span
                  className={
                    "ml-1.5 rounded-full px-1.5 text-[10px] " +
                    (filter === s ? "bg-white/20" : "bg-mute/10 text-mute")
                  }
                >
                  {incomingCounts[s] ?? 0}
                </span>
              </button>
            ))}
          </div>
          {filteredIncoming.length === 0 ? (
            <GlassCard className="p-10 text-center">
              <p className="t-cap">該当する応募がありません</p>
            </GlassCard>
          ) : (
            filteredIncoming.map((a) => (
              <IncomingAppCard
                key={a.id}
                app={a}
                orgSlug={orgSlug}
                isReviewing={reviewingId === a.id}
                onStartReview={() => setReviewingId(a.id)}
                onCancelReview={() => setReviewingId(null)}
                onDecide={(status, note) => review(a, status, note)}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}

function TabBtn({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition " +
        (active
          ? "bg-ink text-white"
          : "bg-white text-mute hover:bg-mute/5 shadow-[0_1px_0_var(--line-soft)]")
      }
    >
      <span>{label}</span>
      <span
        className={
          "rounded-full px-1.5 text-[10px] " +
          (active ? "bg-white/20" : "bg-mute/10 text-mute")
        }
      >
        {count}
      </span>
    </button>
  );
}

function MyAppRow({
  orgSlug,
  app,
}: {
  orgSlug: string;
  app: WithTheme;
}) {
  const meta = STATUS_META[app.status];
  return (
    <Link
      href={`/${orgSlug}/themes/${app.theme_id}/apply`}
      className="block"
    >
      <GlassCard className="p-4 lift cursor-pointer">
        <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {app.theme?.code && (
                <span className="t-mono text-[11px] text-mute">
                  {app.theme.code}
                </span>
              )}
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ background: meta.bg }}
              >
                {meta.emo} {meta.label}
              </span>
            </div>
            <h3 className="text-[13.5px] font-bold mb-1 truncate">
              {app.theme?.title ?? "（テーマ削除済）"}
            </h3>
            <div className="t-cap flex items-center gap-3">
              <span>チーム: {app.team_name || "（未設定）"}</span>
              {app.submitted_at && (
                <span>
                  応募日 {new Date(app.submitted_at).toLocaleDateString("ja-JP")}
                </span>
              )}
              {app.created_project_id && (
                <span className="text-[--c-accent-deep]">
                  → プロジェクト組成済
                </span>
              )}
            </div>
          </div>
          <span className="t-cap opacity-50">›</span>
        </div>
      </GlassCard>
    </Link>
  );
}

function IncomingAppCard({
  app,
  orgSlug,
  isReviewing,
  onStartReview,
  onCancelReview,
  onDecide,
}: {
  app: WithTheme;
  orgSlug: string;
  isReviewing: boolean;
  onStartReview: () => void;
  onCancelReview: () => void;
  onDecide: (status: "approved" | "rejected", note: string) => void;
}) {
  const [note, setNote] = useState(app.decision_note ?? "");
  const meta = STATUS_META[app.status];
  const decided = app.status === "approved" || app.status === "rejected";
  const isPending = app.status === "submitted" || app.status === "under_review";
  return (
    <GlassCard
      className="p-4"
      style={{ borderLeft: `4px solid ${meta.bg}` }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {app.theme?.code && (
              <span className="t-mono text-[11px] text-mute">
                {app.theme.code}
              </span>
            )}
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ background: meta.bg }}
            >
              {meta.emo} {meta.label}
            </span>
            <span className="t-cap">
              テーマ: <strong>{app.theme?.title}</strong>
            </span>
          </div>
          <h3 className="text-[14px] font-bold mb-1">
            👥 {app.team_name || "（チーム名未設定）"}
          </h3>
          {app.members && (
            <div className="t-cap mb-1">メンバー: {app.members}</div>
          )}
          <div className="t-cap">
            {app.submitted_at && (
              <span>
                応募日:{" "}
                {new Date(app.submitted_at).toLocaleDateString("ja-JP")}
              </span>
            )}
            {app.decided_at && (
              <span className="ml-3">
                審査日:{" "}
                {new Date(app.decided_at).toLocaleDateString("ja-JP")}
              </span>
            )}
          </div>
        </div>
        {!decided && !isReviewing && isPending && (
          <button
            type="button"
            onClick={onStartReview}
            className="rounded-md bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90"
          >
            🔎 審査する
          </button>
        )}
        {decided && app.created_project_id && (
          <Link
            href={`/${orgSlug}/dashboard?p=${app.created_project_id}`}
            className="rounded-md bg-ok text-white px-3 py-1.5 text-[11.5px] font-semibold hover:opacity-90"
          >
            → プロジェクトを開く
          </Link>
        )}
      </div>

      {app.proposal && (
        <details
          className="rounded-lg bg-canvas-2 p-3 mb-3"
          open={isReviewing}
        >
          <summary className="t-label cursor-pointer">
            提案内容を読む（{app.proposal.length}文字）
          </summary>
          <p className="mt-2 text-[12.5px] leading-relaxed whitespace-pre-wrap">
            {app.proposal}
          </p>
        </details>
      )}

      {app.decision_note && (
        <div
          className="rounded-lg p-3 mb-3"
          style={{
            background:
              app.status === "approved"
                ? "rgba(10,135,84,.1)"
                : "rgba(192,57,43,.08)",
            borderLeft: `3px solid ${
              app.status === "approved" ? "var(--ok)" : "var(--error)"
            }`,
          }}
        >
          <div className="t-label mb-1">主催側コメント</div>
          <p className="text-[12.5px] leading-relaxed">{app.decision_note}</p>
        </div>
      )}

      {isReviewing && (
        <div className="rounded-lg border border-accent bg-accent-soft/40 p-3">
          <div className="t-label mb-2">審査結果を入力</div>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="合否の理由・期待・サポート方針などをコメント"
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-[12px] outline-none focus:border-[--c-accent] resize-none mb-2"
          />
          <div className="flex items-center gap-2 justify-end flex-wrap">
            <button
              type="button"
              onClick={onCancelReview}
              className="rounded-md bg-white border border-line px-3 py-1.5 text-[11px] font-medium text-mute"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => onDecide("rejected", note)}
              className="rounded-md bg-error px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90"
            >
              ✕ 不採択
            </button>
            <button
              type="button"
              onClick={() => onDecide("approved", note)}
              className="rounded-md bg-ok px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90"
              title="プロジェクトとして組成されます"
            >
              ✓ 合格 → プロジェクト組成
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
