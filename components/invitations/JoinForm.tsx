"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

const ROLE_LABEL: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "メンバー",
  theme_owner: "テーマオーナー",
  lead: "プロジェクトリーダー",
};

export function JoinForm({
  token,
  orgName,
  role,
  projectName,
  projectRole,
  intendedEmail,
  intendedName,
}: {
  token: string;
  orgName: string;
  role: string;
  projectName?: string | null;
  projectRole?: string | null;
  intendedEmail?: string | null;
  intendedName?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  // 宛先名が指定されている時はなりすまし防止のため明示確認を要求
  const requiresConfirm = Boolean(intendedName);
  const [confirmed, setConfirmed] = useState(false);

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
              : error.message.includes("email_mismatch")
                ? `この招待は ${intendedEmail} 宛です。一度サインアウトし、そのメールアドレスでログインし直してください。`
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
    // プロジェクト指定ならダッシュへ、無ければ組織ホームへ
    if (row.project_id) {
      router.push(`/${row.org_slug}/dashboard?p=${row.project_id}`);
    } else {
      router.push(`/${row.org_slug}`);
    }
    router.refresh();
  };

  return (
    <GlassCard variant="strong" className="p-8 max-w-md w-full animate-risein text-center">
      <div className="text-5xl mb-4" aria-hidden>
        🤝
      </div>
      <h1 className="t-h2 mb-1">招待を受け取りました</h1>
      {intendedName && (
        <p className="text-[14px] mb-2">
          ようこそ、<strong>{intendedName}</strong> さん
        </p>
      )}
      {intendedEmail && (
        <p className="t-cap mb-3">
          この招待は <strong>{intendedEmail}</strong> 宛です
        </p>
      )}
      <p className="t-cap mb-6 leading-relaxed">
        {projectName ? (
          <>
            プロジェクト <strong>{projectName}</strong> に{" "}
            <strong>
              {ROLE_LABEL[projectRole ?? "member"] ?? projectRole ?? "member"}
            </strong>{" "}
            として参加できます。
          </>
        ) : (
          <>
            以下の組織に <strong>{ROLE_LABEL[role] ?? role}</strong> として
            参加できます。
          </>
        )}
      </p>

      <div
        className="rounded-xl bg-accent-soft p-5 mb-6 inline-block"
        style={{ minWidth: 240 }}
      >
        <div className="t-label mb-1 text-[--c-accent-deep]">
          {projectName ? "プロジェクト" : "組織"}
        </div>
        <div className="text-[18px] font-bold">
          {projectName ?? orgName}
        </div>
        {projectName && (
          <div className="t-cap mt-1">主催: {orgName}</div>
        )}
      </div>

      {requiresConfirm && (
        <label className="mb-3 flex items-start gap-2 text-left rounded-lg border border-warn/40 bg-warn/5 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 accent-[--c-accent]"
          />
          <span className="text-[12.5px] leading-relaxed">
            私は <strong>{intendedName}</strong> 本人です。
            <span className="block t-cap mt-0.5 opacity-80">
              他の人のリンクを間違えて踏んだ場合は、チェックせずページを閉じてください。
            </span>
          </span>
        </label>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={accept}
          disabled={
            status.kind === "loading" || (requiresConfirm && !confirmed)
          }
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
