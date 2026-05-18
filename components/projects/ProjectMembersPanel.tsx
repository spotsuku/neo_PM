"use client";

import { useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

interface OrgMember {
  user_id: string;
  org_role: "owner" | "admin" | "member" | "theme_owner";
  display_name: string | null;
}

interface ProjMember {
  id: string;
  user_id: string;
  role: "lead" | "member";
  created_at: string;
  display_name: string | null;
  isMe: boolean;
}

interface Props {
  projectId: string;
  canManage: boolean;
  orgMembers: OrgMember[];
  initialMembers: ProjMember[];
}

const ROLE_LABEL: Record<string, string> = {
  lead: "リード",
  member: "メンバー",
};

const ROLE_COLOR: Record<string, string> = {
  lead: "var(--ink)",
  member: "var(--c-accent)",
};

export function ProjectMembersPanel({
  projectId,
  canManage,
  orgMembers,
  initialMembers,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<ProjMember[]>(initialMembers);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [newRole, setNewRole] = useState<"lead" | "member">("member");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberIds = new Set(members.map((m) => m.user_id));
  const candidates = orgMembers.filter((om) => !memberIds.has(om.user_id));

  const addMember = async () => {
    if (!selectedUserId) return;
    setError(null);
    setAdding(true);
    const { data, error: err } = await supabase
      .from("project_memberships")
      .insert({
        project_id: projectId,
        user_id: selectedUserId,
        role: newRole,
      })
      .select("id, user_id, role, created_at")
      .single();
    setAdding(false);
    if (err || !data) {
      setError(err?.message ?? "メンバー追加に失敗しました");
      return;
    }
    // 表示用の名前は orgMembers の候補から流用
    const candidate = orgMembers.find((c) => c.user_id === selectedUserId);
    setMembers((prev) => [
      ...prev,
      {
        id: data.id,
        user_id: data.user_id,
        role: data.role as "lead" | "member",
        created_at: data.created_at,
        display_name: candidate?.display_name ?? null,
        isMe: false,
      },
    ]);
    setSelectedUserId("");
    setNewRole("member");
  };

  const removeMember = async (id: string, isLead: boolean, isMe: boolean) => {
    if (isLead && !isMe) {
      if (!confirm("プロジェクトリードを外しますか？")) return;
    } else if (isMe) {
      if (!confirm("自分自身をこのプロジェクトから外しますか？以降アクセスできなくなります。"))
        return;
    } else {
      if (!confirm("このメンバーを外しますか？")) return;
    }
    setError(null);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    const { error: err } = await supabase
      .from("project_memberships")
      .delete()
      .eq("id", id);
    if (err) setError(err.message);
  };

  const toggleRole = async (id: string, role: "lead" | "member") => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, role } : m)),
    );
    const { error: err } = await supabase
      .from("project_memberships")
      .update({ role })
      .eq("id", id);
    if (err) setError(err.message);
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <GlassCard className="p-5">
        <h3 className="t-h3 mb-3">
          <span aria-hidden className="mr-2">
            👤
          </span>
          メンバー ({members.length})
        </h3>
        {members.length === 0 ? (
          <p className="t-cap text-center py-4">
            まだメンバーがいません
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {members.map((m) => (
              <li
                key={m.id}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent-soft/40"
              >
                <span
                  className="grid h-8 w-8 place-items-center rounded-full text-white text-[12px] font-semibold"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                  }}
                >
                  {(m.display_name ?? "?")[0]}
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold truncate">
                    {m.display_name ?? "（名前未設定）"}
                    {m.isMe && (
                      <span className="ml-2 t-cap text-[--c-accent-deep]">
                        （あなた）
                      </span>
                    )}
                  </div>
                  <div className="t-cap">
                    加入 {new Date(m.created_at).toLocaleDateString("ja-JP")}
                  </div>
                </div>
                {canManage ? (
                  <select
                    value={m.role}
                    onChange={(e) =>
                      toggleRole(m.id, e.target.value as "lead" | "member")
                    }
                    className="rounded-md border border-line bg-white px-2 py-0.5 text-[11px] outline-none focus:border-[--c-accent]"
                  >
                    <option value="member">メンバー</option>
                    <option value="lead">リード</option>
                  </select>
                ) : (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: ROLE_COLOR[m.role] }}
                  >
                    {ROLE_LABEL[m.role]}
                  </span>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => removeMember(m.id, m.role === "lead", m.isMe)}
                    className="rounded-md px-2 py-1 text-[11px] font-semibold text-mute hover:text-error hover:bg-red-50"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {canManage ? (
        <GlassCard className="p-5">
          <h3 className="t-h3 mb-3">
            <span aria-hidden className="mr-2">
              ＋
            </span>
            メンバーを追加
          </h3>
          {candidates.length === 0 ? (
            <p className="t-cap text-center py-3">
              組織の全メンバーが既にこのプロジェクトに登録されています。
              <br />
              <span className="opacity-70">
                先に組織のメンバー設定でメンバーを増やしてください。
              </span>
            </p>
          ) : (
            <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
              <label className="block">
                <span className="t-label block mb-1">組織メンバーから選択</span>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent]"
                >
                  <option value="">— 選んでください —</option>
                  {candidates.map((c) => (
                    <option key={c.user_id} value={c.user_id}>
                      {c.display_name ?? "（名前未設定）"} ({c.org_role})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="t-label block mb-1">役割</span>
                <select
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value as "lead" | "member")
                  }
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[--c-accent]"
                >
                  <option value="member">メンバー</option>
                  <option value="lead">リード</option>
                </select>
              </label>
              <button
                type="button"
                onClick={addMember}
                disabled={!selectedUserId || adding}
                className="rounded-lg bg-ink px-4 py-2 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                追加
              </button>
            </div>
          )}
        </GlassCard>
      ) : (
        <GlassCard className="p-4">
          <p className="t-cap text-center">
            🔒 メンバーを管理する権限はプロジェクトリード / 組織 admin / owner に限定されています。
          </p>
        </GlassCard>
      )}
    </div>
  );
}
