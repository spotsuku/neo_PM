"use client";

import { useMemo, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

interface OrgMember {
  user_id: string;
  org_role: "owner" | "admin" | "member" | "theme_owner";
  display_name: string | null;
}

export interface ProjMember {
  id: string;
  user_id: string;
  role: "lead" | "member";
  title: string | null;
  responsibility: string | null;
  work_description: string | null;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
  isMe: boolean;
}

interface Props {
  projectId: string;
  canManage: boolean;
  orgMembers: OrgMember[];
  initialMembers: ProjMember[];
  onMembersChange?: (members: ProjMember[]) => void;
}

const ROLE_LABEL: Record<string, string> = {
  lead: "リード",
  member: "メンバー",
};

const ROLE_COLOR: Record<string, string> = {
  lead: "var(--ink)",
  member: "var(--c-accent)",
};

export function isMemberRegistered(m: {
  title: string | null;
  responsibility: string | null;
  work_description: string | null;
}): boolean {
  return Boolean(
    m.title?.trim() &&
      m.responsibility?.trim() &&
      m.work_description?.trim(),
  );
}

export function ProjectMembersPanel({
  projectId,
  canManage,
  orgMembers,
  initialMembers,
  onMembersChange,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<ProjMember[]>(initialMembers);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [newRole, setNewRole] = useState<"lead" | "member">("member");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 親に変更を通知
  const syncMembers = (next: ProjMember[]) => {
    setMembers(next);
    onMembersChange?.(next);
  };

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
      .select(
        "id, user_id, role, title, responsibility, work_description, created_at",
      )
      .single();
    setAdding(false);
    if (err || !data) {
      setError(err?.message ?? "メンバー追加に失敗しました");
      return;
    }
    const candidate = orgMembers.find((c) => c.user_id === selectedUserId);
    const newMember: ProjMember = {
      id: data.id,
      user_id: data.user_id,
      role: data.role as "lead" | "member",
      title: data.title,
      responsibility: data.responsibility,
      work_description: data.work_description,
      created_at: data.created_at,
      display_name: candidate?.display_name ?? null,
      avatar_url: null,
      isMe: false,
    };
    syncMembers([...members, newMember]);
    setSelectedUserId("");
    setNewRole("member");
    // 追加直後にプロフィール入力を促す
    setExpandedId(newMember.id);
  };

  const removeMember = async (id: string, isLead: boolean, isMe: boolean) => {
    if (isLead && !isMe) {
      if (!confirm("プロジェクトリードを外しますか？")) return;
    } else if (isMe) {
      if (
        !confirm(
          "自分自身をこのプロジェクトから外しますか？以降アクセスできなくなります。",
        )
      )
        return;
    } else {
      if (!confirm("このメンバーを外しますか？")) return;
    }
    setError(null);
    syncMembers(members.filter((m) => m.id !== id));
    const { error: err } = await supabase
      .from("project_memberships")
      .delete()
      .eq("id", id);
    if (err) setError(err.message);
  };

  const toggleRole = async (id: string, role: "lead" | "member") => {
    syncMembers(members.map((m) => (m.id === id ? { ...m, role } : m)));
    const { error: err } = await supabase
      .from("project_memberships")
      .update({ role })
      .eq("id", id);
    if (err) setError(err.message);
  };

  // 役職 / 責任 / 業務内容 を debounced で保存
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const patchMember = (
    id: string,
    patch: Partial<
      Pick<ProjMember, "title" | "responsibility" | "work_description">
    >,
  ) => {
    syncMembers(members.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    const key = id + ":" + Object.keys(patch).join(",");
    const existing = timersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const tm = setTimeout(async () => {
      const { error: err } = await supabase
        .from("project_memberships")
        .update(patch)
        .eq("id", id);
      if (err) setError(err.message);
    }, 600);
    timersRef.current.set(key, tm);
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
          <p className="t-cap text-center py-4">まだメンバーがいません</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {members.map((m) => {
              const expanded = expandedId === m.id;
              const registered = isMemberRegistered(m);
              return (
                <li
                  key={m.id}
                  className="rounded-lg border border-line-soft bg-white"
                >
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-3 py-2.5">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-full text-white text-[12px] font-semibold"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
                      }}
                    >
                      {(m.display_name ?? "?")[0]}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold truncate flex items-center gap-1.5">
                        {m.display_name ?? "（名前未設定）"}
                        {m.isMe && (
                          <span className="t-cap text-[--c-accent-deep]">
                            （あなた）
                          </span>
                        )}
                        {registered ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-ok/15 px-1.5 py-px text-[9.5px] font-bold text-[var(--ok)]">
                            ✓ 登録完了
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-warn/15 px-1.5 py-px text-[9.5px] font-bold text-[var(--warn)]">
                            ⏳ 未登録
                          </span>
                        )}
                      </div>
                      <div className="t-cap truncate">
                        {m.title?.trim() ?? "役職未設定"} ・ 加入{" "}
                        {new Date(m.created_at).toLocaleDateString("ja-JP")}
                      </div>
                    </div>
                    {canManage ? (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          toggleRole(
                            m.id,
                            e.target.value as "lead" | "member",
                          )
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
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(expanded ? null : m.id)
                      }
                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-mute hover:text-ink hover:bg-mute/5"
                      aria-expanded={expanded}
                    >
                      {expanded ? "閉じる ▲" : "詳細 ▼"}
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() =>
                          removeMember(m.id, m.role === "lead", m.isMe)
                        }
                        className="rounded-md px-2 py-1 text-[11px] font-semibold text-mute hover:text-error hover:bg-red-50"
                        aria-label="メンバーを外す"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {expanded && (
                    <div className="border-t border-line-soft px-3 py-3 grid grid-cols-1 md:grid-cols-2 gap-2.5 bg-canvas-2/40">
                      <label className="block md:col-span-2">
                        <span className="t-label block mb-1">
                          🎖 役職 (例: PdM, デザイナー)
                        </span>
                        <input
                          type="text"
                          value={m.title ?? ""}
                          onChange={(e) =>
                            patchMember(m.id, {
                              title: e.target.value || null,
                            })
                          }
                          placeholder="例: PdM / プロジェクトマネージャー / 現場リサーチャー"
                          disabled={!canManage && !m.isMe}
                          className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] disabled:opacity-60"
                        />
                      </label>
                      <label className="block">
                        <span className="t-label block mb-1">
                          🎯 責任範囲
                        </span>
                        <textarea
                          rows={3}
                          value={m.responsibility ?? ""}
                          onChange={(e) =>
                            patchMember(m.id, {
                              responsibility: e.target.value || null,
                            })
                          }
                          placeholder="例: 顧客インタビューの設計と実施、結果のチームへの共有"
                          disabled={!canManage && !m.isMe}
                          className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] resize-none disabled:opacity-60"
                        />
                      </label>
                      <label className="block">
                        <span className="t-label block mb-1">
                          🛠 業務内容 (具体的なアクション)
                        </span>
                        <textarea
                          rows={3}
                          value={m.work_description ?? ""}
                          onChange={(e) =>
                            patchMember(m.id, {
                              work_description: e.target.value || null,
                            })
                          }
                          placeholder="例: 週次で 3 件のヒアリングを行い、議事録と要約を Notion にまとめてチームに共有"
                          disabled={!canManage && !m.isMe}
                          className="w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-[--c-accent] resize-none disabled:opacity-60"
                        />
                      </label>
                      <p className="t-cap md:col-span-2 opacity-70">
                        ※ 編集できるのは管理者 / リード / 本人です。入力は自動保存されます。
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
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
                <span className="t-label block mb-1">
                  組織メンバーから選択
                </span>
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
          <p className="t-cap mt-2 opacity-70">
            追加後にメンバー行の「詳細 ▼」を開いて 役職 / 責任 / 業務内容
            を記入できます。
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="p-4">
          <p className="t-cap text-center">
            🔒 メンバーを管理する権限はプロジェクトリード / 組織 admin / owner
            に限定されています。
          </p>
        </GlassCard>
      )}
    </div>
  );
}
