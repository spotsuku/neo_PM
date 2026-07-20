"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

type Theme = {
  id: string;
  title: string;
  description: string | null;
};

type Round = {
  id: string;
  label: string;
  round_number: number;
  opens_at: string;
  closes_at: string;
};

type Preference = {
  id: string;
  user_id: string;
  theme_id: string;
  preference_rank: number;
  display_name: string;
  is_me: boolean;
};

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  currentUserId: string;
  isAdmin: boolean;
  themes: Theme[];
  rounds: Round[];
  selectedRound: Round | null;
  preferences: Preference[];
  memberCount: number;
}

const RANK_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#22c55e",
  5: "#3b82f6",
};

const RANK_LABEL: Record<number, string> = {
  1: "第1希望",
  2: "第2希望",
  3: "第3希望",
  4: "第4希望",
  5: "第5希望",
};

function rankToScore(rank: number): number {
  return Math.max(0, 6 - rank);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtRoundRange(r: Round): string {
  const opens = new Date(r.opens_at);
  const closes = new Date(r.closes_at);
  const sameDay =
    opens.toDateString() === closes.toDateString();
  return sameDay ? fmtDate(r.opens_at) : `${fmtDate(r.opens_at)}〜${fmtDate(r.closes_at)}`;
}

type RoundState = "upcoming" | "open" | "closed";
function roundState(r: Round): RoundState {
  const now = Date.now();
  const opens = new Date(r.opens_at).getTime();
  const closes = new Date(r.closes_at).getTime();
  if (now < opens) return "upcoming";
  if (now > closes) return "closed";
  return "open";
}

export function SurveyBoard({
  orgSlug,
  orgId,
  orgName,
  currentUserId,
  isAdmin,
  themes,
  rounds,
  selectedRound,
  preferences,
  memberCount,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = selectedRound ? roundState(selectedRound) : null;
  const isEditable = state === "open" && selectedRound !== null;

  // 楽観的 UI 用のローカル state。props の preferences をベースにしつつ、
  // ユーザーが選択した瞬間に即時反映する (DB 書き込みは裏で走る)。
  const [localPrefs, setLocalPrefs] = useState<Preference[]>(preferences);
  // 選択回が切り替わった / 親から新しい props が来たら local を同期
  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  // 自分の希望 (rank -> theme_id) — localPrefs から算出
  const myChoices = useMemo(() => {
    const map: Record<number, string | null> = { 1: null, 2: null, 3: null, 4: null, 5: null };
    for (const p of localPrefs) {
      if (p.is_me) map[p.preference_rank] = p.theme_id;
    }
    return map;
  }, [localPrefs]);

  const stats = useMemo(() => {
    const byTheme: Record<
      string,
      { rank: number; users: { user_id: string; display_name: string; is_me: boolean }[] }[]
    > = {};
    for (const t of themes) byTheme[t.id] = [1, 2, 3, 4, 5].map((r) => ({ rank: r, users: [] }));
    for (const p of localPrefs) {
      const bucket = byTheme[p.theme_id]?.find((b) => b.rank === p.preference_rank);
      if (bucket) {
        bucket.users.push({
          user_id: p.user_id,
          display_name: p.display_name,
          is_me: p.is_me,
        });
      }
    }
    return byTheme;
  }, [themes, localPrefs]);

  const rankedThemes = useMemo(() => {
    return themes
      .map((t) => {
        const s = stats[t.id] ?? [];
        const total = s.reduce((acc, b) => acc + b.users.length, 0);
        const score = s.reduce(
          (acc, b) => acc + rankToScore(b.rank) * b.users.length,
          0,
        );
        return { theme: t, buckets: s, total, score };
      })
      .sort((a, b) => b.score - a.score || b.total - a.total);
  }, [themes, stats]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const rt of rankedThemes) if (rt.total > m) m = rt.total;
    return Math.max(m, 1);
  }, [rankedThemes]);

  const respondedUserCount = useMemo(
    () => new Set(localPrefs.map((p) => p.user_id)).size,
    [localPrefs],
  );

  const myPickCount = Object.values(myChoices).filter(Boolean).length;

  const takenThemeIds = new Set(
    Object.entries(myChoices)
      .filter(([, v]) => v)
      .map(([, v]) => v as string),
  );

  // 選択中の回を切り替え (URL param に反映)
  const switchRound = (roundId: string) => {
    router.push(`/${orgSlug}/survey?round=${roundId}`);
  };

  const saveChoice = async (rank: number, themeId: string | null) => {
    if (!selectedRound) {
      setError("先に回を選択してください");
      return;
    }
    if (!isEditable) {
      setError("この回は編集期間外です");
      return;
    }

    const currentThemeId = myChoices[rank];
    if (currentThemeId === themeId) return;

    const existingPref = localPrefs.find(
      (p) => p.is_me && p.preference_rank === rank,
    );

    // ── 楽観的 UI 更新 (即時反映) ──
    // 先にローカル state を書き換え、その後で DB 書き込み。失敗時にロールバック。
    const prevPrefs = localPrefs;
    const displayName =
      localPrefs.find((p) => p.is_me)?.display_name ?? "自分";
    let optimistic: Preference[] = localPrefs.filter(
      (p) => !(p.is_me && p.preference_rank === rank),
    );
    if (themeId) {
      optimistic = [
        ...optimistic,
        {
          id: existingPref?.id ?? `__pending_${rank}`,
          user_id: currentUserId,
          theme_id: themeId,
          preference_rank: rank,
          display_name: displayName,
          is_me: true,
        },
      ];
    }
    setLocalPrefs(optimistic);
    setBusy(true);
    setError(null);

    const extractErr = (e: unknown): { msg: string; code: string | null } => {
      if (!e) return { msg: "保存に失敗しました", code: null };
      if (typeof e === "string") return { msg: e, code: null };
      const obj = e as { message?: unknown; details?: unknown; code?: unknown };
      const parts = [
        typeof obj.message === "string" ? obj.message : null,
        typeof obj.details === "string" ? obj.details : null,
      ].filter(Boolean);
      return {
        msg: parts.join(" — ") || "保存に失敗しました",
        code: typeof obj.code === "string" ? obj.code : null,
      };
    };

    try {
      if (!themeId) {
        if (existingPref) {
          const { error: err } = await supabase
            .from("theme_preferences")
            .delete()
            .eq("id", existingPref.id);
          if (err) throw err;
        }
      } else if (existingPref) {
        const { error: err } = await supabase
          .from("theme_preferences")
          .update({ theme_id: themeId } as never)
          .eq("id", existingPref.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("theme_preferences")
          .insert({
            user_id: currentUserId,
            organization_id: orgId,
            theme_id: themeId,
            preference_rank: rank,
            survey_round_id: selectedRound.id,
          } as never);
        if (err) throw err;
      }
      // DB 書込成功: サーバから最新を取り直して local を差し替え (id 補正など)
      router.refresh();
    } catch (e) {
      // 失敗したら optimistic を巻き戻す
      setLocalPrefs(prevPrefs);
      const { msg, code } = extractErr(e);
      if (code === "23505" || msg.includes("duplicate key")) {
        if (msg.includes("theme_prefs_user_round_theme_uniq")) {
          setError("このテーマは既に別の希望順位で選択されています。");
        } else if (msg.includes("theme_prefs_user_round_rank_uniq")) {
          router.refresh();
        } else {
          setError(msg);
        }
      } else if (msg.includes("row-level security")) {
        setError("この回は編集期間外のため保存できません。");
      } else {
        setError(msg);
        // eslint-disable-next-line no-console
        console.error("[survey] save failed:", e);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Header */}
      <GlassCard className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white text-xl"
            style={{ background: "linear-gradient(135deg, #ef4444, #eab308)" }}
            aria-hidden
          >
            🗳️
          </span>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold tracking-tight">
              テーマ意識調査
            </h1>
            <p className="t-cap">
              {orgName} ・ あなたは第1〜第5希望を選べます (回答: {respondedUserCount}/{memberCount || "?"} 名)
            </p>
          </div>
        </div>
        <span
          className={
            "rounded-full px-3 py-1.5 text-[11.5px] font-semibold " +
            (myPickCount === 5
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800")
          }
        >
          あなたの回答: {myPickCount}/5
        </span>
      </GlassCard>

      {/* 回タブ */}
      {rounds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {rounds.map((r) => {
            const s = roundState(r);
            const isSelected = selectedRound?.id === r.id;
            const stateStyle: Record<RoundState, { label: string; bg: string }> = {
              open: { label: "回答受付中", bg: "bg-emerald-100 text-emerald-700" },
              upcoming: { label: "開催前", bg: "bg-mute/15 text-mute" },
              closed: { label: "終了", bg: "bg-mute/15 text-mute" },
            };
            const st = stateStyle[s];
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => switchRound(r.id)}
                className={
                  "text-left p-4 rounded-2xl border-2 transition bg-white " +
                  (isSelected
                    ? "border-[--c-accent] shadow"
                    : "border-line hover:border-[--c-accent]/50")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[16px] font-extrabold">{r.label}</div>
                    <div className="t-cap">{fmtRoundRange(r)}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${st.bg}`}
                  >
                    {st.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <GlassCard className="p-6 text-center flex flex-col gap-2">
          <span aria-hidden className="text-2xl">
            📅
          </span>
          <p className="text-[13px] text-mute">
            意識調査の回がまだ設定されていません。
            {isAdmin && " 下の管理者パネルから作成できます。"}
          </p>
        </GlassCard>
      )}

      {/* 状態バー */}
      {selectedRound && (
        <div className="flex items-center justify-between gap-3 text-[12px] text-ink-2 rounded-lg bg-white/60 px-3 py-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span aria-hidden>ℹ️</span>
            各回ごとに回答期限が設定され、締切後は変更できません
            <span className="mx-2">・</span>
            <span>
              🕒 {selectedRound.label}の回答期限:{" "}
              <strong>{fmtDateTime(selectedRound.closes_at)}</strong>
            </span>
          </div>
          {state === "closed" && (
            <span className="text-mute">🔒 締切後は編集できません</span>
          )}
          {state === "upcoming" && (
            <span className="text-mute">開始まで待ってください</span>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {themes.length === 0 ? (
        <GlassCard className="p-8 text-center flex flex-col gap-2">
          <span aria-hidden className="text-2xl">
            📭
          </span>
          <p className="text-[13px] text-mute">
            この組織にはまだ公開中のテーマがありません。
          </p>
        </GlassCard>
      ) : (
        selectedRound && (
          <>
            <MyChoiceSection
              round={selectedRound}
              themes={themes}
              myChoices={myChoices}
              takenThemeIds={takenThemeIds}
              busy={busy}
              editable={isEditable}
              onChange={saveChoice}
            />
            <AggregateSection
              round={selectedRound}
              themes={themes}
              rankedThemes={rankedThemes}
              maxCount={maxCount}
              respondedUserCount={respondedUserCount}
              locked={state === "closed"}
            />
          </>
        )
      )}

      {isAdmin && <AdminRoundsPanel orgId={orgId} rounds={rounds} />}
    </div>
  );
}

function MyChoiceSection({
  round,
  themes,
  myChoices,
  takenThemeIds,
  busy,
  editable,
  onChange,
}: {
  round: Round;
  themes: Theme[];
  myChoices: Record<number, string | null>;
  takenThemeIds: Set<string>;
  busy: boolean;
  editable: boolean;
  onChange: (rank: number, themeId: string | null) => void;
}) {
  return (
    <GlassCard className="p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span aria-hidden>👤</span>
        <h2 className="text-[15px] font-extrabold">
          あなたの希望 <span className="opacity-70">({round.label})</span>
        </h2>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
            (editable
              ? "bg-emerald-50 text-emerald-700"
              : "bg-mute/15 text-mute")
          }
        >
          {editable ? "回答期間内のみ編集できます" : "🔒 締切後 編集不可"}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((rank) => {
          const current = myChoices[rank];
          return (
            <li key={rank} className="flex items-center gap-3 flex-wrap">
              <span
                className="inline-flex items-center justify-center flex-shrink-0 rounded-full text-white text-[11px] font-bold w-16 py-1.5"
                style={{ background: RANK_COLORS[rank] }}
              >
                {RANK_LABEL[rank]}
              </span>
              <select
                value={current ?? ""}
                disabled={busy || !editable}
                onChange={(e) => onChange(rank, e.target.value || null)}
                className="flex-1 min-w-[220px] rounded-md border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-[--c-accent] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">— 未選択 —</option>
                {themes.map((t) => {
                  const isTakenByOther =
                    takenThemeIds.has(t.id) && current !== t.id;
                  return (
                    <option key={t.id} value={t.id} disabled={isTakenByOther}>
                      {t.title}
                      {isTakenByOther ? " (他の希望に選択済)" : ""}
                    </option>
                  );
                })}
              </select>
              {current && editable && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onChange(rank, null)}
                  className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)] disabled:opacity-50"
                >
                  クリア
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}

function AggregateSection({
  round,
  rankedThemes,
  maxCount,
  respondedUserCount,
  locked,
}: {
  round: Round;
  themes: Theme[];
  rankedThemes: {
    theme: Theme;
    buckets: {
      rank: number;
      users: { user_id: string; display_name: string; is_me: boolean }[];
    }[];
    total: number;
    score: number;
  }[];
  maxCount: number;
  respondedUserCount: number;
  locked: boolean;
}) {
  return (
    <GlassCard className="p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span aria-hidden>📊</span>
        <h2 className="text-[15px] font-extrabold">
          みんなの意識調査結果 ({round.label}・{respondedUserCount} 名が回答)
        </h2>
        <span className="rounded-full bg-[--c-accent]/12 text-[--c-accent-deep] text-[10.5px] font-semibold px-2 py-0.5">
          この回の集計結果
        </span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map((r) => (
            <span key={r} className="inline-flex items-center gap-1 text-[10.5px] text-ink-2">
              <span
                className="inline-block w-3 h-3 rounded"
                style={{ background: RANK_COLORS[r] }}
                aria-hidden
              />
              {RANK_LABEL[r]}
            </span>
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {rankedThemes.map((rt) => (
          <li key={rt.theme.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h3 className="text-[13.5px] font-bold truncate">
                {rt.theme.title}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-mute flex-shrink-0">
                <span>{rt.total} 票</span>
                <span className="text-ink-2 font-bold">加重{rt.score}pt</span>
              </div>
            </div>
            <div
              className="flex h-6 rounded-md overflow-hidden bg-mute/10"
              title={`合計 ${rt.total} 票`}
              style={{
                width: `${(rt.total / maxCount) * 100}%`,
                minWidth: rt.total > 0 ? "3%" : "0",
              }}
            >
              {rt.buckets.map((b) => {
                if (b.users.length === 0) return null;
                const pct = (b.users.length / rt.total) * 100;
                return (
                  <div
                    key={b.rank}
                    className="flex items-center justify-center text-white text-[10px] font-bold overflow-hidden"
                    style={{ width: `${pct}%`, background: RANK_COLORS[b.rank] }}
                    title={`${RANK_LABEL[b.rank]}: ${b.users.map((u) => u.display_name).join(", ")}`}
                  >
                    {b.users.length}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1">
              {rt.buckets.flatMap((b) =>
                b.users.map((u) => (
                  <span
                    key={`${b.rank}-${u.user_id}`}
                    className={
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] " +
                      (u.is_me
                        ? "bg-ink text-white font-semibold"
                        : "bg-mute/10 text-ink-2")
                    }
                    title={RANK_LABEL[b.rank]}
                    style={{ borderLeft: `3px solid ${RANK_COLORS[b.rank]}` }}
                  >
                    <span aria-hidden className="text-[9px]">
                      第{b.rank}
                    </span>
                    {u.display_name}
                    {u.is_me && <span className="text-[8.5px] opacity-80">YOU</span>}
                  </span>
                )),
              )}
              {rt.total === 0 && (
                <span className="t-cap italic">まだ誰も選んでいません</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {locked && (
        <div className="rounded-lg bg-mute/10 px-3 py-2 text-[12px] text-mute flex items-center gap-2">
          <span aria-hidden>🔒</span>
          {round.label}の締切後は、集計結果のみ表示され、編集できません。
        </div>
      )}
    </GlassCard>
  );
}

function AdminRoundsPanel({
  orgId,
  rounds,
}: {
  orgId: string;
  rounds: Round[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    label: `第${rounds.length + 1}回`,
    opens_at: "",
    closes_at: "",
  });

  useEffect(() => {
    setForm((f) => ({ ...f, label: `第${rounds.length + 1}回` }));
  }, [rounds.length]);

  const create = async () => {
    if (!form.label.trim() || !form.opens_at || !form.closes_at) {
      setError("回名 / 開始日時 / 締切日時をすべて入力してください");
      return;
    }
    if (new Date(form.closes_at) <= new Date(form.opens_at)) {
      setError("締切日時は開始日時より後にしてください");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("survey_rounds").insert({
      organization_id: orgId,
      label: form.label.trim(),
      round_number: rounds.length + 1,
      opens_at: new Date(form.opens_at).toISOString(),
      closes_at: new Date(form.closes_at).toISOString(),
    } as never);
    setBusy(false);
    if (err) {
      setError(`作成失敗: ${err.message}`);
      return;
    }
    setCreating(false);
    setForm({ label: "", opens_at: "", closes_at: "" });
    router.refresh();
  };

  const remove = async (id: string, label: string) => {
    if (!confirm(`「${label}」を削除しますか?\n関連する回答も一緒に消えます。`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("survey_rounds")
      .delete()
      .eq("id", id);
    setBusy(false);
    if (err) {
      setError(`削除失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  return (
    <GlassCard className="p-5 flex flex-col gap-3 border-2 border-dashed border-line">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-[13px] font-extrabold text-mute uppercase tracking-wider">
          🛠 管理者: 意識調査の回を管理
        </h3>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90"
          >
            ＋ 新しい回を追加
          </button>
        )}
      </div>

      {creating && (
        <div className="rounded-lg bg-white/60 p-3 flex flex-col gap-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="font-semibold">回の名前</span>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="第1回"
                className="rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="font-semibold">開始日時</span>
              <input
                type="datetime-local"
                value={form.opens_at}
                onChange={(e) => setForm({ ...form, opens_at: e.target.value })}
                className="rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px]">
              <span className="font-semibold">締切日時</span>
              <input
                type="datetime-local"
                value={form.closes_at}
                onChange={(e) => setForm({ ...form, closes_at: e.target.value })}
                className="rounded-md border border-line bg-white px-3 py-2 text-[13px]"
              />
            </label>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={create}
              className="rounded-full bg-ink px-4 py-1.5 text-[11.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "作成中…" : "作成"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {rounds.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rounds.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-md bg-white/60 px-3 py-1.5 text-[12px]"
            >
              <div className="flex-1 min-w-0">
                <strong>{r.label}</strong>
                <span className="mx-2 text-mute">
                  {fmtRoundRange(r)} ({fmtDateTime(r.opens_at)}〜{fmtDateTime(r.closes_at)})
                </span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(r.id, r.label)}
                className="text-[11px] text-red-600 hover:underline disabled:opacity-50"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
