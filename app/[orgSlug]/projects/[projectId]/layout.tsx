import { ProjectScopedShell } from "./ProjectScopedShell";

/**
 * プロジェクトスコープレイアウト。
 *
 * クライアント側で:
 *   1. cookie (neo:last-project-id:<orgSlug>) を更新 (org トップから前回の続きへ)
 *   2. <div key={projectId}> でラップして、サイドバーで他プロジェクトに切替えた
 *      時に全 client component を unmount → remount し、useState の初期値
 *      スタレ化を構造的に防ぐ
 *
 * cookie 操作は server component で cookies().set() を呼ぶと Next.js 15 で
 * 実行時エラーになるため、ProjectScopedShell (client) で実行している。
 */
export default async function ProjectScopedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  return (
    <ProjectScopedShell orgSlug={orgSlug} projectId={projectId}>
      {children}
    </ProjectScopedShell>
  );
}
