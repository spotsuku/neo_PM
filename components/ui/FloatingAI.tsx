"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
}

interface ProjectContext {
  id: string;
  name: string;
  team_name: string | null;
  organization_id: string;
}

type ResolveState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; project: ProjectContext }
  | { kind: "empty"; reason: string };

/**
 * 浮遊する NEO.ai ボタン。
 * - 位置: bottom-left (右1/4のタイムラインと干渉しない)
 * - プロジェクト文脈をサーバで解決し、その場で実チャットが使える
 * - ANTHROPIC_API_KEY 未設定や未解決などの状態は明示的に表示
 */
export function FloatingAI() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const segs = pathname.split("/").filter(Boolean);
  const orgSlug =
    segs[0] && !["login", "orgs", "auth", "welcome", "join"].includes(segs[0])
      ? segs[0]
      : null;

  // 現在 URL から projectId を抽出
  //   /<org>/projects/<projectId>/<feature> 形式 (PR #152 以降の標準)
  //   旧形式の ?p= もフォールバックとしてサポート (legacy redirect 経由)
  const pathProjectId =
    segs[0] === orgSlug && segs[1] === "projects" && segs[2] ? segs[2] : null;
  const explicitProjectId = pathProjectId ?? searchParams?.get("p") ?? null;

  const [resolve, setResolve] = useState<ResolveState>({ kind: "idle" });
  const [hasAnthropic, setHasAnthropic] = useState<boolean | null>(null);

  // パネルを開いた時に文脈解決 + 環境変数チェック
  useEffect(() => {
    if (!open) return;
    if (!orgSlug) {
      setResolve({ kind: "empty", reason: "no_org" });
      return;
    }
    let cancelled = false;
    setResolve({ kind: "loading" });

    const params = new URLSearchParams({ org: orgSlug });
    if (explicitProjectId) params.set("p", explicitProjectId);

    Promise.all([
      fetch(`/api/current-project?${params.toString()}`).then((r) => r.json()),
      fetch("/api/ai/status").then((r) => r.json()),
    ])
      .then(([proj, status]) => {
        if (cancelled) return;
        setHasAnthropic(Boolean(status?.hasAnthropic));
        if (proj?.project) {
          setResolve({ kind: "ok", project: proj.project as ProjectContext });
        } else {
          setResolve({
            kind: "empty",
            reason: (proj?.reason as string) ?? "unknown",
          });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[FloatingAI] resolve failed", e);
        setResolve({ kind: "empty", reason: "network_error" });
      });

    return () => {
      cancelled = true;
    };
  }, [open, orgSlug, explicitProjectId, pathname]);

  return (
    <>
      {!open && (
        <div
          className="glass-dark fixed bottom-[148px] left-[88px] z-40 max-w-[220px] rounded-[14px_14px_14px_0] px-3.5 py-2.5 text-[11.5px] leading-relaxed animate-risein"
          style={{ pointerEvents: "none" }}
        >
          今週の Why を 3分で整理しませんか？ ✨
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-tour="floating-ai"
        className="fixed bottom-[80px] left-[88px] z-50 grid h-[52px] w-[52px] place-items-center rounded-full border-2 border-white text-white outline-none"
        style={{
          background:
            "linear-gradient(160deg, #1a2540 0%, var(--c-accent-deep) 60%, var(--c-accent) 100%)",
          boxShadow:
            "0 14px 36px -8px rgba(40,80,180,.55), 0 0 0 6px rgba(91,141,239,.12), inset 0 1px 0 rgba(255,255,255,.35)",
        }}
        aria-label="AI 伴走者を開く"
      >
        <span
          className="text-[26px] leading-none"
          style={{ animation: "sparkle 3s ease-in-out infinite" }}
        >
          ✦
        </span>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-[--c-accent-deep]"
            style={{ animation: "badgePop .5s ease-out" }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <ChatPanel
          orgSlug={orgSlug}
          resolve={resolve}
          hasAnthropic={hasAnthropic}
          onClose={() => setOpen(false)}
          onNewReply={() => setUnread((u) => u + 1)}
        />
      )}
    </>
  );
}

function ChatPanel({
  orgSlug,
  resolve,
  hasAnthropic,
  onClose,
  onNewReply,
}: {
  orgSlug: string | null;
  resolve: ResolveState;
  hasAnthropic: boolean | null;
  onClose: () => void;
  onNewReply: () => void;
}) {
  const project = resolve.kind === "ok" ? resolve.project : null;
  const projectId = project?.id ?? null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!projectId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/ai/messages?projectId=${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setMessages((d.messages ?? []) as Message[]);
      })
      .catch((e) => {
        console.error("[FloatingAI] load messages failed", e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async () => {
    if (!projectId) {
      setError("プロジェクト文脈が解決できていません。下のボタンから開いてください。");
      return;
    }
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    setMessages((prev) => [
      ...prev,
      { id: `temp-u-${Date.now()}`, role: "user", content: text },
    ]);
    setInput("");
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message: text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `エラー (${res.status})`);
      }
      if (!data.reply) {
        throw new Error("空の応答が返ってきました");
      }
      setMessages((prev) => [
        ...prev,
        { id: `temp-a-${Date.now()}`, role: "assistant", content: data.reply! },
      ]);
      onNewReply();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "送信に失敗しました";
      console.error("[FloatingAI] send failed", e);
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-strong fixed bottom-[148px] left-[88px] z-40 flex w-[400px] max-w-[calc(100vw-7rem)] flex-col rounded-[14px] animate-risein max-h-[calc(100vh-200px)]">
      <div className="glass-dark flex items-center gap-3 rounded-t-[14px] px-4 py-3">
        <div
          className="grid h-8 w-8 place-items-center rounded-full text-white"
          style={{
            background:
              "conic-gradient(from 220deg, var(--c-accent), var(--c-accent-deep) 60%, #0a0a0a)",
          }}
        >
          ✦
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">NEO.ai</div>
          <div className="text-[10px] opacity-70 truncate">
            {project ? `${project.name} の伴走者` : "あなたの伴走者"}
          </div>
        </div>
        {orgSlug && (
          <Link
            href={projectId ? `/${orgSlug}/projects/${projectId}/ai` : `/${orgSlug}/ai`}
            className="rounded-md bg-white/10 px-2 py-0.5 text-[10.5px] font-semibold text-white/90 hover:bg-white/20"
            title="フル画面のチャットを開く"
            onClick={onClose}
          >
            ↗ 全画面
          </Link>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-white/80 hover:bg-white/10"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>

      {hasAnthropic === false && (
        <div className="border-b border-line-soft bg-yellow-50 px-3 py-2 text-[11.5px] text-yellow-900 leading-relaxed">
          ⚠️ <strong>ANTHROPIC_API_KEY</strong> が未設定です。Vercel の
          Environment Variables に追加して Redeploy すると AI 応答が有効になります。
        </div>
      )}

      {/* 本体 */}
      {resolve.kind === "loading" ? (
        <div className="flex-1 px-4 py-6 text-center t-cap">
          プロジェクト文脈を解決中…
        </div>
      ) : resolve.kind === "empty" || !project ? (
        <EmptyBody
          orgSlug={orgSlug}
          reason={resolve.kind === "empty" ? resolve.reason : "no_org"}
          onClose={onClose}
        />
      ) : (
        <>
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5"
            style={{ minHeight: 200 }}
          >
            {loading ? (
              <p className="t-cap text-center">履歴を読み込み中…</p>
            ) : messages.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2" aria-hidden>
                  💬
                </div>
                <p className="t-cap leading-relaxed">
                  「今週どこから手をつける？」「Why を磨きたい」
                  <br />
                  などお気軽に。
                </p>
              </div>
            ) : (
              messages.map((m) => <Bubble key={m.id} message={m} />)
            )}
            {sending && (
              <div className="flex items-start gap-2">
                <Avatar role="assistant" />
                <div className="rounded-2xl bg-white border border-line-soft px-3 py-2 text-[12px] text-mute animate-pulse">
                  考え中…
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mx-3 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] text-red-700 leading-relaxed">
              {error}
            </div>
          )}

          <div className="border-t border-line-soft px-3 py-2 flex items-center gap-2 bg-white/60 rounded-b-[14px]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                hasAnthropic === false
                  ? "API キー未設定のため送信できません"
                  : "メッセージを入力…"
              }
              disabled={sending || hasAnthropic === false}
              className="flex-1 min-w-0 rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[--c-accent] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !input.trim() || hasAnthropic === false}
              className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white hover:opacity-90 disabled:opacity-40"
              aria-label="送信"
            >
              ➤
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyBody({
  orgSlug,
  reason,
  onClose,
}: {
  orgSlug: string | null;
  reason: string;
  onClose: () => void;
}) {
  if (!orgSlug || reason === "no_org") {
    return (
      <div className="flex-1 px-4 py-5 text-[12.5px] leading-relaxed">
        <div className="text-3xl mb-2 text-center" aria-hidden>
          🚪
        </div>
        <p className="text-center mb-2">
          <strong>ログインまたは組織選択が必要です</strong>
        </p>
        <p className="t-cap text-center">
          NEO.ai は組織配下のプロジェクトと対話します。
        </p>
      </div>
    );
  }
  if (reason === "unauthenticated") {
    return (
      <div className="flex-1 px-4 py-5 text-[12.5px] leading-relaxed">
        <p className="text-center mb-2">
          <strong>サインインが必要です</strong>
        </p>
        <p className="t-cap text-center">
          <Link href="/login" onClick={onClose} className="underline">
            /login へ
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="flex-1 px-4 py-5 text-[12.5px] leading-relaxed">
      <div className="text-3xl mb-2 text-center" aria-hidden>
        ✦
      </div>
      <p className="text-center mb-3">
        <strong>プロジェクトを選んで会話を始めましょう</strong>
      </p>
      <p className="t-cap mb-4 leading-relaxed">
        NEO.ai は実行計画 / タスク / 会話履歴を読んで返答します。
        下のいずれかからプロジェクトを開いてください。
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/${orgSlug}/dashboard`}
          onClick={onClose}
          className="rounded-lg bg-ink px-3 py-2 text-[11.5px] font-semibold text-white text-center hover:opacity-90"
        >
          🚀 ダッシュへ
        </Link>
        <Link
          href={`/${orgSlug}/ai`}
          onClick={onClose}
          className="rounded-lg bg-white border border-line px-3 py-2 text-[11.5px] font-semibold text-mute text-center hover:text-ink"
        >
          ✨ AI伴走タブ
        </Link>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: Message["role"] }) {
  if (role === "user") {
    return (
      <span
        className="grid h-[26px] w-[26px] place-items-center rounded-[8px] text-white text-[12px] flex-shrink-0"
        style={{
          background:
            "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
        }}
      >
        🙂
      </span>
    );
  }
  return (
    <span
      className="grid h-[26px] w-[26px] place-items-center rounded-[8px] text-white text-[12px] flex-shrink-0"
      style={{ background: "var(--ink)" }}
    >
      ✦
    </span>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div
      className={
        "flex items-start gap-2 " + (isUser ? "flex-row-reverse" : "")
      }
    >
      <Avatar role={message.role} />
      <div
        className={
          "rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed max-w-[85%] whitespace-pre-wrap " +
          (isUser
            ? "bg-ink text-white rounded-tr-sm"
            : "bg-white border border-line-soft text-ink rounded-tl-sm")
        }
      >
        {message.content}
      </div>
    </div>
  );
}
