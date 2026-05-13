import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "@/components/invitations/JoinForm";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "招待に応じる — NEO PM",
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  // 招待の内容をプレビュー（peek_invitation は security definer なので RLS バイパス）
  const { data, error } = await supabase.rpc("peek_invitation", {
    p_token: token,
  });

  const peek = Array.isArray(data) ? data[0] : null;
  const errMsg = error
    ? error.message
    : !peek
      ? "invalid_token"
      : peek.used
        ? "already_used"
        : peek.expired
          ? "expired"
          : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      {errMsg ? (
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
      ) : (
        <JoinForm
          token={token}
          orgName={peek!.org_name}
          role={peek!.role}
        />
      )}
    </main>
  );
}
