import { cookies } from "next/headers";

/**
 * プロジェクトスコープレイアウト。
 *
 * 役割:
 *   1. params.projectId を cookie に保存 (org トップから "前回の続き" に戻る用途)
 *   2. <div key={projectId}> でラップして、サイドバーで他プロジェクトに切替えた
 *      時に全 client component が unmount → remount するように強制 (useState の
 *      初期値スタレ化を構造的に防ぐ)
 */
export default async function ProjectScopedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;

  // 次回 /[orgSlug] に来た時に最後に見たプロジェクトへ戻れるよう cookie 更新
  const cookieStore = await cookies();
  const cookieKey = `neo:last-project-id:${orgSlug}`;
  if (cookieStore.get(cookieKey)?.value !== projectId) {
    cookieStore.set(cookieKey, projectId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }

  // key={projectId} で project 切替 = 完全 remount
  return <div key={projectId}>{children}</div>;
}
