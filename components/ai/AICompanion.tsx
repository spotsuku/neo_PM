"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { GlassCard } from "@/components/ui/GlassCard";
import { StatusDot } from "@/components/ui/StatusDot";
import { ProjectPicker } from "@/components/projects/ProjectPicker";
import type { Database } from "@/lib/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Message = Database["public"]["Tables"]["chat_messages"]["Row"];
type Proposal = Database["public"]["Tables"]["proposals"]["Row"];
type ProjectStub = {
  id: string;
  name: string;
  team_name: string | null;
  status: string;
};

interface Props {
  orgSlug: string;
  projects: ProjectStub[];
  current: Project;
  initialMessages: Message[];
  initialProposals: Proposal[];
  hasAnthropic: boolean;
}

const KIND_LABEL: Record<string, string> = {
  execution_plan: "🎯 実行計画",
  wbs: "📋 WBS",
  budget: "💴 収支",
  promo: "📣 広報",
  application: "📨 基金申請",
  theme: "📣 テーマ",
  diagnosis: "🔍 診断",
};

export function AICompanion({
  orgSlug,
  projects,
  current,
  initialMessages,
  initialProposals,
  hasAnthropic,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);

    // 楽観的にユーザー bubble を追加
    const temp: Message = {
      id: `temp-${Date.now()}`,
      project_id: current.id,
      role: "user",
      content: text,
      raw_content: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);
    setInput("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: current.id, message: text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `エラー (${res.status})`);
      }
      const data = (await res.json()) as {
        reply: string;
        proposal: Proposal | null;
      };
      // assistant bubble を追加
      setMessages((prev) => [
        ...prev,
        {
          id: `temp-a-${Date.now()}`,
          project_id: current.id,
          role: "assistant",
          content: data.reply,
          raw_content: null,
          created_at: new Date().toISOString(),
        },
      ]);
      // 提案カードが返ってきたら先頭に追加
      if (data.proposal) {
        setProposals((prev) => [data.proposal!, ...prev]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
      // 楽観追加した user メッセージは残す（再送できるように）
    } finally {
      setSending(false);
    }
  };

  const decideProposal = async (id: string, status: "approved" | "rejected") => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p)),
    );
    const res = await fetch(`/api/proposals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "更新に失敗しました");
      // 失敗したら status を pending に戻す
      setProposals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "pending" } : p)),
      );
      return;
    }
    if (status === "approved") {
      // 実行計画ページが開かれている時に再フェッチさせる
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Header */}
      <GlassCard className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white text-xl"
            style={{
              background:
                "conic-gradient(from 220deg, var(--c-accent), var(--c-accent-deep) 60%, #0a0a0a)",
              animation: "sparkle 3s ease-in-out infinite",
            }}
          >
            ✦
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-[18px] font-extrabold tracking-tight truncate">
                NEO.ai 伴走者
              </h1>
              <StatusDot status={current.status} />
            </div>
            <div className="t-cap truncate">
              {current.name}
              {current.team_name ? ` ・ ${current.team_name}` : ""}
            </div>
          </div>
        </div>
        <ProjectPicker
          orgSlug={orgSlug}
          projects={projects}
          currentId={current.id}
        />
      </GlassCard>

      {!hasAnthropic && (
        <GlassCard className="p-4 border-l-4 border-warn">
          <div className="text-[12.5px]">
            ⚠️ <strong>ANTHROPIC_API_KEY</strong> が未設定です。Vercel の
            Project → Settings → Environment Variables に追加 + Redeploy で
            AI 応答が有効化されます。
          </div>
        </GlassCard>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 lg:gap-5">
        {/* チャット */}
        <GlassCard className="p-0 flex flex-col" style={{ height: "70vh" }}>
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto p-5 flex flex-col gap-3"
          >
            {messages.length === 0 && (
              <div className="m-auto text-center max-w-sm">
                <div className="text-4xl mb-3" aria-hidden>
                  ✨
                </div>
                <p className="t-cap leading-relaxed">
                  プロジェクトのことを何でも聞いてください。
                  <br />
                  「今週どこから手をつける？」「Why が曖昧で困ってる」
                  <br />
                  「申請理由を磨きたい」など。
                </p>
              </div>
            )}
            {messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
            {sending && (
              <div className="flex items-start gap-2">
                <Avatar role="assistant" />
                <div className="rounded-2xl bg-white border border-line-soft px-3 py-2 text-[12.5px] text-mute animate-pulse">
                  考え中…
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={send}
            className="border-t border-line-soft p-3 flex items-center gap-2 bg-white/70"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                hasAnthropic
                  ? "Why を磨きたい / 今週のクエストを考えたい / ..."
                  : "AI 機能を使うには ANTHROPIC_API_KEY を設定"
              }
              disabled={!hasAnthropic || sending}
              className="flex-1 rounded-full border border-line bg-white px-4 py-2.5 text-[13px] outline-none focus:border-[--c-accent] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!hasAnthropic || sending || !input.trim()}
              className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white hover:opacity-90 disabled:opacity-40"
              aria-label="送信"
            >
              ➤
            </button>
          </form>
        </GlassCard>

        {/* 提案カードスタック */}
        <div className="flex flex-col gap-3" style={{ height: "70vh", overflowY: "auto" }}>
          <div className="flex items-center justify-between sticky top-0 z-10 bg-canvas/0 py-1">
            <h3 className="t-h3">
              <span aria-hidden className="mr-2">
                💡
              </span>
              提案カード
            </h3>
            <span className="t-label">{proposals.length} 件</span>
          </div>
          {proposals.length === 0 ? (
            <GlassCard className="p-6 text-center">
              <p className="t-cap leading-relaxed">
                AI 提案カードがまだありません。
                <br />
                各画面で AI に依頼すると、ここに具体的な diff 付きの提案が並びます。
              </p>
            </GlassCard>
          ) : (
            proposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onDecide={(s) => decideProposal(p.id, s)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" | "system" }) {
  if (role === "user") {
    return (
      <span
        className="grid h-[30px] w-[30px] place-items-center rounded-[10px] text-white text-[14px] flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
        }}
      >
        🙂
      </span>
    );
  }
  return (
    <span
      className="grid h-[30px] w-[30px] place-items-center rounded-[10px] text-white text-[14px] flex-shrink-0"
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
          "rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed max-w-[80%] whitespace-pre-wrap " +
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

function ProposalCard({
  proposal,
  onDecide,
}: {
  proposal: Proposal;
  onDecide: (s: "approved" | "rejected") => void;
}) {
  const isPending = proposal.status === "pending";
  const isApproved = proposal.status === "approved";
  return (
    <GlassCard
      className="p-4 transition"
      style={{
        borderLeft: isApproved
          ? "4px solid var(--ok)"
          : proposal.status === "rejected"
            ? "4px solid var(--mute)"
            : "4px solid var(--c-accent)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">
          {KIND_LABEL[proposal.kind] ?? proposal.kind}
        </span>
        {isApproved && (
          <span className="rounded-full bg-ok px-2 py-0.5 text-[10px] font-bold text-white">
            ✓ 反映済み
          </span>
        )}
        {proposal.status === "rejected" && (
          <span className="rounded-full bg-mute px-2 py-0.5 text-[10px] font-bold text-white">
            却下
          </span>
        )}
      </div>
      <p className="text-[12.5px] leading-relaxed mb-3">{proposal.summary}</p>
      {proposal.kind === "execution_plan" && (
        <PlanDiffPreview diff={proposal.diff} />
      )}
      {proposal.reasoning && (
        <p className="t-cap mb-3 leading-relaxed">
          理由: {proposal.reasoning}
        </p>
      )}
      {isPending && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onDecide("approved")}
            className="flex-1 rounded-md bg-ok px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
          >
            ✓ 承認して実行計画に反映
          </button>
          <button
            type="button"
            onClick={() => onDecide("rejected")}
            className="rounded-md bg-white border border-line px-3 py-1.5 text-[11px] font-medium text-mute hover:bg-mute/5"
          >
            却下
          </button>
        </div>
      )}
    </GlassCard>
  );
}

const PLAN_FIELD_META: Record<string, { label: string; emo: string }> = {
  why: { label: "Why", emo: "💡" },
  who: { label: "Who", emo: "🧑‍🤝‍🧑" },
  what: { label: "What", emo: "💎" },
  how: { label: "How", emo: "🛠" },
};

function PlanDiffPreview({ diff }: { diff: unknown }) {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) return null;
  const obj = diff as Record<string, unknown>;
  const entries: { key: string; value: string }[] = [];
  for (const k of ["why", "who", "what", "how"]) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) {
      entries.push({ key: k, value: v.trim() });
    }
  }
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 mb-3">
      {entries.map((e) => {
        const meta = PLAN_FIELD_META[e.key] ?? {
          label: e.key,
          emo: "•",
        };
        return (
          <div
            key={e.key}
            className="rounded-md border border-line-soft bg-white px-2.5 py-1.5"
          >
            <div className="t-label flex items-center gap-1 mb-0.5">
              <span aria-hidden>{meta.emo}</span>
              <span>{meta.label}</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-ink-2 whitespace-pre-wrap">
              {e.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
