"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

const ROLE_LABEL: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "メンバー",
};

export function JoinForm({
  token,
  orgName,
  role,
}: {
  token: string;
  orgName: string;
  role: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const accept = async () => {
    setStatus({ kind: "loading" });
    const { data, error } = await supabase.rpc("redeem_invitation", {
      p_token: token,
    });
    if (error) {
      const msg =
        error.message.includes("already_used")
          ? "この招待は既に使われています"
          : error.message.includes("expired")
            ? "この招待は期限切れです"
            : error.message.includes("invalid_token")
              ? "招待が見つかりませんでした"
              : error.message;
      setStatus({ kind: "error", message: msg });
      return;
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      setStatus({
        kind: "error",
        message: "予期せぬエラーが発生しました",
      });
      return;
    }
    router.push(`/${row.org_slug}`);
    router.refresh();
  };

  return (
    <GlassCard variant="strong" className="p-8 max-w-md w-full animate-risein text-center">
      <div className="text-5xl mb-4" aria-hidden>
        🤝
      </div>
      <h1 className="t-h2 mb-1">招待を受け取りました</h1>
      <p className="t-cap mb-6 leading-relaxed">
        以下の組織に <strong>{ROLE_LABEL[role] ?? role}</strong> として
        参加できます。
      </p>

      <div
        className="rounded-xl bg-accent-soft p-5 mb-6 inline-block"
        style={{ minWidth: 240 }}
      >
        <div className="t-label mb-1 text-[--c-accent-deep]">組織</div>
        <div className="text-[18px] font-bold">{orgName}</div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={accept}
          disabled={status.kind === "loading"}
          className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {status.kind === "loading" ? "..." : "✦ 参加する"}
        </button>
        <a
          href="/orgs"
          className="t-cap underline"
        >
          後で決める
        </a>
      </div>

      {status.kind === "error" && (
        <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {status.message}
        </div>
      )}
    </GlassCard>
  );
}
