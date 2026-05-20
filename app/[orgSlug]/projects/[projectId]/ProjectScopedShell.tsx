"use client";

import { useEffect } from "react";

interface Props {
  orgSlug: string;
  projectId: string;
  children: React.ReactNode;
}

/** プロジェクトスコープレイアウトのクライアント側ロジック。
 *  - key={projectId} で children を完全 remount → useState スタレ化を構造的防止
 *  - cookie 更新は client 側で実行 (server component から cookies().set() を
 *    呼ぶと Next.js 15 で実行時エラーになるため) */
export function ProjectScopedShell({ orgSlug, projectId, children }: Props) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.cookie = `neo:last-project-id:${orgSlug}=${projectId}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  }, [orgSlug, projectId]);

  return <div key={projectId}>{children}</div>;
}
