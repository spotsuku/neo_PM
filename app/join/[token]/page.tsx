import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "@/components/invitations/JoinForm";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "メンバー",
  theme_owner: "テーマオーナー",
  lead: "プロジェクトリーダー",
};

interface PeekRow {
  org_name: string;
  role: string;
  project_name: string | null;
  project_role: string | null;
  intended_email: string | null;
  intended_name: string | null;
  expired: boolean;
  used: boolean;
}

async function fetchPeek(token: string): Promise<PeekRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("peek_invitation", {
    p_token: token,
  });
  if (error) return null;
  return (Array.isArray(data) ? data[0] : null) as PeekRow | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const peek = await fetchPeek(token);
  if (!peek || peek.used || peek.expired) {
    return {
      title: "招待 — NEO PM",
      description: "NEO PM への招待リンクです。",
    };
  }
  const who = peek.intended_name ? `${peek.intended_name} さん宛: ` : "";
  const where = peek.project_name
    ? `プロジェクト「${peek.project_name}」`
    : `組織「${peek.org_name}」`;
  const roleLabel =
    ROLE_LABEL[peek.project_role ?? peek.role] ??
    peek.project_role ??
    peek.role;
  const title = `${who}${where} への招待 — NEO PM`;
  const description = `${peek.intended_name ? `${peek.intended_name} さんに、` : ""}${where} (${roleLabel}) への参加リンクが届いています。`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // 認証前でも peek_invitation は引けるよう、先にプレビュー
  const { data, error } = await supabase.rpc("peek_invitation", {
    p_token: token,
  });

  const peek = (Array.isArray(data) ? data[0] : null) as PeekRow | null;
  const errMsg = error
    ? error.message
    : !peek
      ? "invalid_token"
      : peek.used
        ? "already_used"
        : peek.expired
          ? "expired"
          : null;

  if (errMsg) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-12">
        <GlassCard className="p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-3" aria-hidden>
            {errMsg === "already_used"
              ? "✅"
              : errMsg === "expired"
                ? "⏰"
                : "⚠️"}
          </div>
          <h1 className="t-h2 mb-2">
            {errMsg === "already_used"
              ? "この招待は使用済みです"
              : errMsg === "expired"
                ? "この招待は期限切れです"
                : "招待が見つかりません"}
          </h1>
          <p className="t-cap leading-relaxed mb-5">
            {errMsg === "already_used"
              ? "招待リンクは1回限り有効です。組織の owner / admin に新しい招待を発行してもらってください。"
              : errMsg === "expired"
                ? "招待リンクの有効期限が過ぎています。owner / admin に再発行を依頼してください。"
                : "URL が間違っているか、招待が取り消されています。"}
          </p>
          <a
            href="/orgs"
            className="inline-block rounded-full bg-ink px-5 py-2 text-[12px] font-semibold text-white"
          >
            組織一覧に戻る
          </a>
        </GlassCard>
      </main>
    );
  }

  // 認証チェック。未ログインなら redirect せず、招待内容を見せた上で
  // 「ログインして参加」ボタンを出す。 → Slack 等の OG タグもこちらが採用される。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginParams = new URLSearchParams();
    loginParams.set("next", `/join/${token}`);
    if (peek!.intended_email) loginParams.set("email", peek!.intended_email);
    const loginHref = `/login?${loginParams.toString()}`;
    const whereLabel = peek!.project_name
      ? `プロジェクト「${peek!.project_name}」`
      : `組織「${peek!.org_name}」`;
    const roleLabel =
      ROLE_LABEL[peek!.project_role ?? peek!.role] ??
      peek!.project_role ??
      peek!.role;

    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-12">
        <GlassCard
          variant="strong"
          className="p-8 max-w-md w-full animate-risein text-center"
        >
          <div className="text-5xl mb-4" aria-hidden>
            🤝
          </div>
          <h1 className="t-h2 mb-1">招待が届いています</h1>
          {peek!.intended_name && (
            <p className="text-[14px] mb-2">
              <strong>{peek!.intended_name}</strong> さんへ
            </p>
          )}
          {peek!.intended_email && (
            <p className="t-cap mb-3">
              この招待は <strong>{peek!.intended_email}</strong> 宛です
            </p>
          )}
          <p className="t-cap mb-6 leading-relaxed">
            {whereLabel} に <strong>{roleLabel}</strong> として参加できます。
            ログイン (または新規登録) の後、参加が完了します。
          </p>

          <div
            className="rounded-xl bg-accent-soft p-5 mb-6 inline-block"
            style={{ minWidth: 240 }}
          >
            <div className="t-label mb-1 text-[--c-accent-deep]">
              {peek!.project_name ? "プロジェクト" : "組織"}
            </div>
            <div className="text-[18px] font-bold">
              {peek!.project_name ?? peek!.org_name}
            </div>
            {peek!.project_name && (
              <div className="t-cap mt-1">主催: {peek!.org_name}</div>
            )}
          </div>

          <a
            href={loginHref}
            className="block w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            ✦ ログインして参加する
          </a>
          <p className="t-cap mt-3 opacity-70">
            まだアカウントがない方は、ログイン画面から新規登録できます。
          </p>
        </GlassCard>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <JoinForm
        token={token}
        orgName={peek!.org_name}
        role={peek!.role}
        projectName={peek!.project_name ?? null}
        projectRole={peek!.project_role ?? null}
        intendedEmail={peek!.intended_email ?? null}
        intendedName={peek!.intended_name ?? null}
      />
    </main>
  );
}
