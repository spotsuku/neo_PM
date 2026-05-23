import Link from "next/link";

import { GlassCard } from "@/components/ui/GlassCard";

/**
 * 未参加メンバーが、ダッシュボード以外のタブを開いたときに表示する案内。
 * 404 ではなく「参加すると閲覧できます」をアプリのシェル内で出す。
 */
export function ProjectJoinGate({
  orgSlug,
  projectId,
  projectName,
  tabLabel,
}: {
  orgSlug: string;
  projectId: string;
  projectName: string;
  tabLabel?: string;
}) {
  return (
    <GlassCard className="p-10 grid place-items-center text-center">
      <div className="max-w-md">
        <div className="text-5xl mb-3">🔒</div>
        <h2 className="t-h2 mb-2">参加すると閲覧できます</h2>
        <p className="t-cap mb-1 leading-relaxed">
          「{projectName}」の
          {tabLabel ? `「${tabLabel}」` : "この情報"}
          は、プロジェクトのメンバーだけが見られます。
        </p>
        <p className="t-cap mb-5 leading-relaxed opacity-80">
          ダッシュボードは閲覧できます。参加についてはプロジェクトのリードまたは管理者にご相談ください。
        </p>
        <Link
          href={`/${orgSlug}/projects/${projectId}/dashboard`}
          className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-bold text-white hover:opacity-90"
        >
          ダッシュボードを見る →
        </Link>
      </div>
    </GlassCard>
  );
}
