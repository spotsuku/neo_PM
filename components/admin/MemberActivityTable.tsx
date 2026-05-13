"use client";

import Link from "next/link";

import { GlassCard } from "@/components/ui/GlassCard";
import type { MemberActivity } from "@/lib/admin";

interface Props {
  orgSlug: string;
  members: MemberActivity[];
}

const ROLE_COLOR: Record<string, string> = {
  owner: "var(--ink)",
  admin: "var(--c-accent)",
  member: "var(--mute)",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "メンバー",
};

export function MemberActivityTable({ orgSlug, members }: Props) {
  const sorted = [...members].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, member: 2 } as const;
    return (
      roleOrder[a.org_role] - roleOrder[b.org_role] ||
      b.projectCount - a.projectCount
    );
  });

  return (
    <div className="flex flex-col gap-3">
      <GlassCard className="p-0 overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between bg-canvas-2 border-b border-line-soft">
          <h3 className="t-h3">
            <span aria-hidden className="mr-2">
              👥
            </span>
            メンバー活動量
          </h3>
          <Link
            href={`/${orgSlug}/settings/members`}
            className="text-[11px] underline text-mute hover:text-ink"
          >
            メンバー設定 →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead>
              <tr className="t-label">
                <th className="text-left px-3 py-2">名前</th>
                <th className="text-left px-2 py-2">ロール</th>
                <th className="text-right px-2 py-2">担当PJ</th>
                <th className="text-right px-2 py-2">担当タスク</th>
                <th className="text-right px-2 py-2">完了率</th>
                <th className="text-right px-2 py-2">AI 利用 (30d)</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 t-cap">
                    メンバーがいません
                  </td>
                </tr>
              ) : (
                sorted.map((m) => {
                  const donePct =
                    m.taskCount > 0
                      ? Math.round((m.doneTaskCount / m.taskCount) * 100)
                      : 0;
                  return (
                    <tr
                      key={m.user_id}
                      className="border-t border-line-soft hover:bg-accent-soft/30"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="grid h-7 w-7 place-items-center rounded-full text-white text-[11px] font-semibold"
                            style={{
                              background:
                                "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                            }}
                          >
                            {(m.display_name ?? "?")[0]}
                          </span>
                          <span className="font-medium">
                            {m.display_name ?? "（名前未設定）"}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                          style={{ background: ROLE_COLOR[m.org_role] }}
                        >
                          {ROLE_LABEL[m.org_role]}
                        </span>
                      </td>
                      <td className="text-right px-2 py-2 t-mono">
                        {m.projectCount}
                      </td>
                      <td className="text-right px-2 py-2 t-mono">
                        {m.taskCount > 0 ? `${m.doneTaskCount}/${m.taskCount}` : "—"}
                      </td>
                      <td className="text-right px-2 py-2 t-mono">
                        {m.taskCount > 0 ? `${donePct}%` : "—"}
                      </td>
                      <td className="text-right px-2 py-2 t-mono">
                        {m.aiMessages30d}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <p className="t-cap leading-relaxed">
          💡 担当タスク・最終ログインの精度向上は次のフェーズで実装します（現状はプロジェクト所属数まで取得可能）。
          メンバーの追加・削除は{" "}
          <Link
            href={`/${orgSlug}/settings/members`}
            className="underline text-[--c-accent-deep]"
          >
            メンバー設定
          </Link>{" "}
          で。
        </p>
      </GlassCard>
    </div>
  );
}
