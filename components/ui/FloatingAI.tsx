"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

/**
 * 浮遊する NEO.ai ボタン。
 * - 位置は bottom-left (タイムラインの右カラムと干渉しない)
 * - プロジェクト文脈が解決できれば実チャットが使える
 * - 解決できなければ次の一手 (✨ AI伴走タブ / 🚀 ダッシュへ) を提案
 */
export function FloatingAI() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // orgSlug = path の最初のセグメント (login など組織外パスでは undefined)
  const segs = pathname.split("/").filter(Boolean);
  const orgSlug =
    segs[0] && !["login", "orgs", "auth", "welcome", "join"].includes(segs[0])
      ? segs[0]
      : null;

  // どの種類の画面か
  const pageSeg = segs[1];
  const projectSegs = new Set([
    "dashboard",
    "plan",
    "wbs",
    "meetings",
    "budget",
    "diag",
    "fund",
    "ai",
  ]);
  const onProjectPage = orgSlug && pageSeg && projectSegs.has(pageSeg);

  // 明示的な ?p= があればそれ、無ければ /api/current-project で取得
  const explicitProjectId = searchParams?.get("p");
  const [project, setProject] = useState<ProjectContext | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!orgSlug) {
      setProject(null);
      return;
    }
    if (!open) return;
    // パネルを開いた時に解決
    let cancelled = false;
    setResolving(true);
    const params = new URLSearchParams({ org: orgSlug });
    fetch(`/api/current-project?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setProject(d.project ?? null);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgSlug, open, explicitProjectId, pathname]);

  // 実プロジェクト ID: ?p= 優先、なければ resolve 結果
  const projectId =
    explicitProjectId && onProjectPage
      ? explicitProjectId
      : project?.id ?? null;
  const projectName =
    project?.name ?? (projectId ? "現在のプロジェクト" : null);

  return (
    <>
      {/* 吹き出し（閉じている時のみ）*/}
      {!open && (
        <div
          className="glass-dark fixed bottom-[110px] left-7 z-40 max-w-[280px] rounded-[14px_14px_14px_0] px-4 py-3 text-[12px] leading-relaxed animate-risein"
          style={{ pointerEvents: "none" }}
        >
          今週の Why を 3分で整理しませんか？ ✨
        </div>
      )}

      {/* メインボタン (左下に移動) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-7 left-7 z-50 grid h-[60px] w-[60px] place-items-center rounded-full border-2 border-white text-white outline-none"
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

      {/* 展開パネル */}
      {open && (
        <ChatPanel
          orgSlug={orgSlug}
          projectId={projectId}
          projectName={projectName}
          resolving={resolving}
          onClose={() => setOpen(false)}
          onNewReply={() => setUnread((u) => u + 1)}
        />
      )}
    </>
  );
}

function ChatPanel({
  orgSlug,
  projectId,
  projectName,
  resolving,
  onClose,
  onNewReply,
}: {
  orgSlug: string | null;
  projectId: string | null;
  projectName: string | null;
  resolving: boolean;
  onClose: () => void;
  onNewReply: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // 履歴取得
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
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // 自動スクロール
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    if (!projectId) return;
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    const tempUser: Message = {
      id: `temp-u-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, tempUser]);
    setInput("");
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message: text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `エラー (${res.status})`);
      }
      const data = (await res.json()) as { reply: string };
      setMessages((prev) => [
        ...prev,
        {
          id: `temp-a-${Date.now()}`,
          role: "assistant",
          content: data.reply,
        },
      ]);
      onNewReply();
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-strong fixed bottom-[100px] left-7 z-40 flex w-[420px] max-w-[calc(100vw-3.5rem)] flex-col rounded-[14px] animate-risein max-h-[calc(100vh-160px)]">
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
            {projectName ? `${projectName} の伴走者` : "あなたの伴走者"}
          </div>
        </div>
        {orgSlug && (
          <Link
            href={`/${orgSlug}/ai${projectId ? `?p=${projectId}` : ""}`}
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

      {/* 本体 */}
      {!orgSlug ? (
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
      ) : !projectId ? (
        <div className="flex-1 px-4 py-5 text-[12.5px] leading-relaxed">
          <div className="text-3xl mb-2 text-center" aria-hidden>
            ✦
          </div>
          <p className="text-center mb-3">
            <strong>プロジェクトを選んで会話を始めましょう</strong>
          </p>
          <p className="t-cap mb-4 leading-relaxed">
            NEO.ai はプロジェクトの実行計画 / タスク / 会話履歴を
            読みながら返答します。下のいずれかからプロジェクトを開いてください。
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
          {resolving && (
            <p className="t-cap text-center mt-3">プロジェクトを検索中…</p>
          )}
        </div>
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
            <div className="mx-3 mb-2 rounded-md bg-red-50 px-3 py-1.5 text-[11px] text-red-700">
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
              placeholder="メッセージを入力…"
              disabled={sending}
              className="flex-1 min-w-0 rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[--c-accent]"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !input.trim()}
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
