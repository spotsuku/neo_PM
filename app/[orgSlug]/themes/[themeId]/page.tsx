import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOrgBySlug } from "@/lib/orgs";
import { ThemePublicView } from "@/components/themes/ThemePublicView";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; bg: string }> = {
  draft: { label: "下書き", bg: "var(--mute)" },
  submitted: { label: "応募済み", bg: "var(--c-accent)" },
  under_review: { label: "審査中", bg: "var(--warn)" },
  approved: { label: "✓ 合格", bg: "var(--ok)" },
  rejected: { label: "✕ 不採択", bg: "var(--error)" },
  withdrawn: { label: "取下げ", bg: "var(--mute)" },
};

export default async function ThemeDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; themeId: string }>;
}) {
  const { orgSlug, themeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/${orgSlug}/themes/${themeId}`);

  const org = await getOrgBySlug(supabase, orgSlug);
  if (!org) notFound();

  const { data: theme } = await supabase
    .from("themes")
    .select("*")
    .eq("id", themeId)
    .maybeSingle();
  if (!theme) notFound();

  // 既に応募していれば、ステータスを表示
  const { data: myApp } = await supabase
    .from("theme_applications")
    .select("id, status")
    .eq("theme_id", themeId)
    .eq("applicant_user_id", user.id)
    .maybeSingle();

  const deadlinePast =
    theme.deadline !== null && new Date(theme.deadline) < new Date();
  const notPublic = theme.status !== "active";

  let applyButton:
    | { kind: "preview" }
    | { kind: "link"; href: string; label?: string }
    | { kind: "disabled"; label: string }
    | { kind: "none" } = { kind: "none" };

  if (myApp) {
    applyButton = {
      kind: "link",
      href: `/${orgSlug}/themes/${themeId}/apply`,
      label:
        myApp.status === "draft"
          ? "📝 応募の下書きを編集"
          : "📨 応募内容を見る",
    };
  } else if (notPublic) {
    applyButton = { kind: "disabled", label: "現在は応募を受け付けていません" };
  } else if (deadlinePast) {
    applyButton = { kind: "disabled", label: "募集は締め切られました" };
  } else {
    applyButton = {
      kind: "link",
      href: `/${orgSlug}/themes/${themeId}/apply`,
      label: "✦ 応募申請する →",
    };
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <Link href={`/${orgSlug}/themes`} className="t-cap underline">
          ← テーマ一覧へ戻る
        </Link>
        <div className="flex items-center gap-2">
          {myApp && (
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold text-white"
              style={{ background: STATUS_LABEL[myApp.status]?.bg ?? "var(--mute)" }}
            >
              {STATUS_LABEL[myApp.status]?.label ?? myApp.status}
            </span>
          )}
          <Link
            href={`/${orgSlug}/themes/applications`}
            className="rounded-full bg-white px-3 py-1 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
          >
            📋 自分の応募一覧 →
          </Link>
        </div>
      </header>

      <ThemePublicView
        theme={theme}
        orgName={org.name}
        applyButton={applyButton}
      />

      {notPublic && (
        <GlassCard className="p-4">
          <p className="t-cap leading-relaxed">
            ⚠️ このテーマは現在「{theme.status}」状態のため一般公開されていません。
            出題者が「公開中」にすると応募できるようになります。
          </p>
        </GlassCard>
      )}
    </div>
  );
}
