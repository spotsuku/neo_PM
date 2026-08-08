"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";

type OrgMember = {
  user_id: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
  affiliation: string | null;
  title: string | null;
};

type TeamMember = {
  user_id: string;
  role: "lead" | "member";
  display_name: string | null;
  avatar_url: string | null;
};

type TeamApplication = {
  id: string;
  theme_id: string;
  theme_title: string;
  preference_rank: number | null;
  status: string;
};

type PendingInvite = {
  id: string;
  invited_user_id: string;
  display_name: string | null;
};

type Team = {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  consideringThemeIds: string[];
  members: TeamMember[];
  applications: TeamApplication[];
  pendingInvites: PendingInvite[];
};

type AvailableTheme = {
  id: string;
  code: string | null;
  title: string;
};

type InboxInvite = {
  id: string;
  team_id: string;
  team_name: string;
  invited_by_name: string;
  created_at: string;
};

interface Props {
  orgSlug: string;
  orgId: string;
  orgName: string;
  currentUserId: string;
  isAdmin: boolean;
  teams: Team[];
  orgMembers: OrgMember[];
  unaffiliated: OrgMember[];
  /** 自分のチームが招待中のユーザ ID (未所属欄で「招待済」ラベルを出すため) */
  pendingInvitedUserIds: string[];
  myTeamId: string | null;
  myTeamRole: "lead" | "member" | null;
  /** 自分宛ての pending 招待 */
  myInbox: InboxInvite[];
  /** 応募検討中テーマ候補として選択可能なテーマ */
  availableThemes: AvailableTheme[];
}

// 頭文字を安全に取り出す (絵文字 / 日本語 / null に耐性)
function initialOf(name: string | null): string {
  const t = (name ?? "").trim();
  if (!t) return "?";
  return Array.from(t)[0]!.toUpperCase();
}

// 名前 → HSL 色に決定的マッピング (アイコン背景色を安定させる)
function colorOf(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 55% 55%)`;
}

// 小さな丸アイコン (アバター画像 or イニシャル)
function AvatarBubble({
  name,
  url,
  size = 20,
  ring,
}: {
  name: string | null;
  url?: string | null;
  size?: number;
  ring?: string;
}) {
  const seed = name ?? "?";
  const styleBase: React.CSSProperties = {
    width: size,
    height: size,
    boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
  };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="flex-shrink-0 rounded-full object-cover"
        style={styleBase}
      />
    );
  }
  return (
    <span
      className="flex-shrink-0 grid place-items-center rounded-full text-white font-bold"
      style={{
        ...styleBase,
        background: colorOf(seed),
        fontSize: Math.max(9, size * 0.5),
      }}
      aria-hidden
    >
      {initialOf(name)}
    </span>
  );
}

const APP_STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  submitted: "申請中",
  under_review: "審査中",
  approved: "採択",
  rejected: "不採択",
  withdrawn: "取り下げ",
};

const APP_STATUS_COLOR: Record<string, string> = {
  draft: "bg-mute/15 text-mute",
  submitted: "bg-[--c-accent]/12 text-[--c-accent-deep]",
  under_review: "bg-[--c-accent]/12 text-[--c-accent-deep]",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-mute/15 text-mute",
};

export function TeamsBoard({
  orgSlug,
  orgId,
  orgName,
  currentUserId,
  isAdmin,
  teams,
  orgMembers,
  unaffiliated,
  pendingInvitedUserIds,
  myTeamId,
  myTeamRole,
  myInbox,
  availableThemes,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const themesById = useMemo(
    () => new Map(availableThemes.map((t) => [t.id, t])),
    [availableThemes],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newConsideringThemeIds, setNewConsideringThemeIds] = useState<string[]>([]);
  const [newInviteUserIds, setNewInviteUserIds] = useState<string[]>([]);
  const [newInviteQuery, setNewInviteQuery] = useState("");
  // 既存チームからの一括招待 (チームカード内)
  const [invitingTeamId, setInvitingTeamId] = useState<string | null>(null);
  const [bulkInviteUserIds, setBulkInviteUserIds] = useState<string[]>([]);
  const [bulkInviteQuery, setBulkInviteQuery] = useState("");
  // 各チームのインライン編集状態 (id → { name, considering })
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editConsidering, setEditConsidering] = useState<string[]>([]);
  const [newDesc, setNewDesc] = useState("");
  const [unaffiliatedQuery, setUnaffiliatedQuery] = useState("");
  const [unaffiliatedRow, setUnaffiliatedRow] = useState<string>("ALL");

  const stats = useMemo(() => {
    const total = orgMembers.length;
    const affiliated = total - unaffiliated.length;
    return { total, affiliated, unaffiliated: unaffiliated.length };
  }, [orgMembers.length, unaffiliated.length]);

  // 既に所属中になったらフォームを自動で閉じる (作成成功後や別タブでの加入対策)
  useEffect(() => {
    if (myTeamId && creating) {
      setCreating(false);
      setNewName("");
      setNewDesc("");
    }
  }, [myTeamId, creating]);

  const createTeam = async () => {
    const name = newName.trim();
    if (!name) {
      setError("チーム名を入力してください");
      return;
    }
    if (myTeamId) {
      setError(
        "既に別のチームに所属しています。掛け持ちはできません。先に現在のチームを抜けてから作成してください。",
      );
      return;
    }
    setBusy(true);
    setError(null);
    const { data: team, error: insErr } = await supabase
      .from("teams")
      .insert({
        organization_id: orgId,
        name,
        description: newDesc.trim() || null,
        created_by: currentUserId,
      } as never)
      .select()
      .single();
    if (insErr) {
      setBusy(false);
      setError(`チーム作成に失敗: ${insErr.message}`);
      return;
    }

    // 自分を lead として team_members に追加
    if (team) {
      const { error: joinErr } = await supabase
        .from("team_members")
        .insert({
          team_id: team.id,
          user_id: currentUserId,
          role: "lead",
        } as never);
      if (joinErr) {
        // 孤立チームを削除 (org admin なら消せる。member なら残るが lead 不在なので UI 上「解散」誘導)
        await supabase.from("teams").delete().eq("id", team.id);
        setBusy(false);
        const msg = joinErr.message.includes("one_active_team_per_user_per_org")
          ? "既に別のチームに所属しています。掛け持ちはできません。先に現在のチームを抜けてから作成してください。"
          : `あなたの加入に失敗: ${joinErr.message}`;
        setError(msg);
        router.refresh();
        return;
      }
    }
    // 応募検討中テーマを一括挿入 (0 件なら未定)
    if (team && newConsideringThemeIds.length > 0) {
      const rows = newConsideringThemeIds.map((theme_id) => ({
        team_id: team.id,
        theme_id,
        added_by: currentUserId,
      }));
      await supabase
        .from("team_considering_themes")
        .insert(rows as never);
    }

    // 選択したメンバーに招待を送信 (自分は除外、重複挿入は無視)
    if (team && newInviteUserIds.length > 0) {
      const rows = newInviteUserIds
        .filter((uid) => uid !== currentUserId)
        .map((uid) => ({
          team_id: team.id,
          invited_user_id: uid,
          invited_by: currentUserId,
        }));
      if (rows.length > 0) {
        // 招待送信は 1 件でも失敗すると全体を中断する必要はないので個別に呼ぶ
        for (const r of rows) {
          await supabase
            .from("team_invitations")
            .insert(r as never);
        }
      }
    }

    setCreating(false);
    setNewName("");
    setNewDesc("");
    setNewConsideringThemeIds([]);
    setNewInviteUserIds([]);
    setNewInviteQuery("");
    setBusy(false);
    router.refresh();
  };

  const startEditTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setEditName(team.name);
    setEditConsidering([...team.consideringThemeIds]);
    setError(null);
  };
  const cancelEditTeam = () => {
    setEditingTeamId(null);
    setEditName("");
    setEditConsidering([]);
  };
  const saveTeamEdit = async (team: Team) => {
    const name = editName.trim();
    if (!name) {
      setError("チーム名を入力してください");
      return;
    }
    setBusy(true);
    setError(null);
    // 1. チーム名を更新 (変わっていれば)
    if (name !== team.name) {
      const { error: err } = await supabase
        .from("teams")
        .update({ name } as never)
        .eq("id", team.id);
      if (err) {
        setBusy(false);
        setError(`チーム名の更新に失敗: ${err.message}`);
        return;
      }
    }
    // 2. 検討テーマの差分を適用
    const prev = new Set(team.consideringThemeIds);
    const next = new Set(editConsidering);
    const toAdd = [...next].filter((id) => !prev.has(id));
    const toRemove = [...prev].filter((id) => !next.has(id));
    if (toAdd.length > 0) {
      const rows = toAdd.map((theme_id) => ({
        team_id: team.id,
        theme_id,
        added_by: currentUserId,
      }));
      const { error: err } = await supabase
        .from("team_considering_themes")
        .insert(rows as never);
      if (err) {
        setBusy(false);
        setError(`検討テーマの追加に失敗: ${err.message}`);
        return;
      }
    }
    for (const theme_id of toRemove) {
      const { error: err } = await supabase
        .from("team_considering_themes")
        .delete()
        .eq("team_id", team.id)
        .eq("theme_id", theme_id);
      if (err) {
        setBusy(false);
        setError(`検討テーマの削除に失敗: ${err.message}`);
        return;
      }
    }
    setBusy(false);
    cancelEditTeam();
    router.refresh();
  };

  const joinTeam = async (teamId: string) => {
    if (myTeamId) {
      setError(
        "既に別のチームに所属しています。掛け持ちはできません。先に今のチームを抜けてください。",
      );
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("team_members")
      .insert({
        team_id: teamId,
        user_id: currentUserId,
        role: "member",
      } as never);
    setBusy(false);
    if (err) {
      setError(`加入に失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  const leaveTeam = async (teamId: string) => {
    if (
      !confirm(
        "このチームを抜けますか?\nチームに紐付いた応募からもあなたが外れます。",
      )
    )
      return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", currentUserId);
    setBusy(false);
    if (err) {
      setError(`退会に失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  // lead / 組織 admin が未所属メンバーを一括で招待する (チームカード内から)
  const startBulkInvite = (teamId: string) => {
    setInvitingTeamId(teamId);
    setBulkInviteUserIds([]);
    setBulkInviteQuery("");
    setError(null);
  };
  const cancelBulkInvite = () => {
    setInvitingTeamId(null);
    setBulkInviteUserIds([]);
    setBulkInviteQuery("");
  };
  const sendBulkInvites = async () => {
    if (!invitingTeamId) return;
    if (bulkInviteUserIds.length === 0) return;
    setBusy(true);
    setError(null);
    const rows = bulkInviteUserIds
      .filter((uid) => uid !== currentUserId)
      .map((uid) => ({
        team_id: invitingTeamId,
        invited_user_id: uid,
        invited_by: currentUserId,
      }));
    const failures: string[] = [];
    for (const r of rows) {
      const { error: err } = await supabase
        .from("team_invitations")
        .insert(r as never);
      if (err) failures.push(err.message);
    }
    setBusy(false);
    if (failures.length > 0) {
      const hasDup = failures.some((m) => m.includes("unique_pending"));
      setError(
        (hasDup
          ? "一部のメンバーは既に招待中でした。それ以外は送信しました。"
          : `送信に一部失敗: ${failures[0]}`) +
          ` (成功 ${rows.length - failures.length}/${rows.length} 件)`,
      );
    }
    cancelBulkInvite();
    router.refresh();
  };

  // lead / 組織 admin が未所属メンバーに招待を送る
  const inviteToMyTeam = async (userId: string, displayName: string) => {
    if (!myTeamId) {
      setError("先に自分のチームを作成してください。");
      return;
    }
    if (myTeamRole !== "lead" && !isAdmin) {
      setError("招待送信はチームリーダーまたは組織管理者のみ可能です。");
      return;
    }
    if (!confirm(`${displayName} さんに招待を送りますか?`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("team_invitations")
      .insert({
        team_id: myTeamId,
        invited_user_id: userId,
        invited_by: currentUserId,
      } as never);
    setBusy(false);
    if (err) {
      const msg = err.message.includes("unique_pending")
        ? `${displayName} さんには既に招待中です。相手の返答をお待ちください。`
        : `招待送信に失敗: ${err.message}`;
      setError(msg);
      return;
    }
    router.refresh();
  };

  // 自分宛て招待の受諾 (RPC 経由で atomically team_members に加入)
  const acceptInvite = async (invId: string, teamName: string) => {
    if (myTeamId) {
      if (
        !confirm(
          `既に別のチームに所属しています。この招待を受けると現在のチームは自動で外れます...ではなく、まず現在のチームを抜けてください。招待は保留のまま残ります。`,
        )
      )
        return;
      setError(
        "既に別のチームに所属しています。先に「チームを抜ける」を押してから招待を受けてください。",
      );
      return;
    }
    if (!confirm(`「${teamName}」からの招待を受けますか?`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("accept_team_invitation", {
      inv_id: invId,
    });
    setBusy(false);
    if (err) {
      setError(`承認に失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  const declineInvite = async (invId: string, teamName: string) => {
    if (!confirm(`「${teamName}」からの招待を辞退しますか?`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("team_invitations")
      .update({ status: "declined", responded_at: new Date().toISOString() } as never)
      .eq("id", invId);
    setBusy(false);
    if (err) {
      setError(`辞退処理に失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  const cancelInvite = async (invId: string, displayName: string) => {
    if (!confirm(`${displayName} さんへの招待を取り消しますか?`)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("team_invitations")
      .update({ status: "cancelled", responded_at: new Date().toISOString() } as never)
      .eq("id", invId);
    setBusy(false);
    if (err) {
      setError(`取り消しに失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  const disbandTeam = async (teamId: string, teamName: string) => {
    if (
      !confirm(
        `「${teamName}」を解散しますか?\n\nこのチームに紐付いた応募は無効になります。この操作は元に戻せません。`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("teams")
      .update({ status: "disbanded" } as never)
      .eq("id", teamId);
    setBusy(false);
    if (err) {
      setError(`解散に失敗: ${err.message}`);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Header */}
      <GlassCard className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white text-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--c-accent), var(--c-accent-deep))",
            }}
            aria-hidden
          >
            👥
          </span>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold tracking-tight">
              チーム組成
            </h1>
            <p className="t-cap">
              {orgName} ・ メンバー {stats.total} 名 (所属 {stats.affiliated} /
              未所属 {stats.unaffiliated})
            </p>
          </div>
        </div>
        {!myTeamId ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90"
          >
            ＋ 新しいチームを作る
          </button>
        ) : (
          <span className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 text-[11.5px] font-semibold">
            所属中 ({myTeamRole === "lead" ? "リーダー" : "メンバー"})
          </span>
        )}
      </GlassCard>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 自分宛て招待 (受信箱) */}
      {myInbox.length > 0 && (
        <GlassCard className="p-4 flex flex-col gap-3 border-2 border-[--c-accent]/40">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-lg">
              🎉
            </span>
            <h2 className="text-[14px] font-extrabold">
              あなたに届いた招待 ({myInbox.length})
            </h2>
          </div>
          <ul className="flex flex-col gap-2">
            {myInbox.map((iv) => (
              <li
                key={iv.id}
                className="flex items-center justify-between gap-3 rounded-md bg-[--c-accent]/5 px-3 py-2 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">
                    {iv.team_name}
                  </div>
                  <div className="t-cap">
                    {iv.invited_by_name} さんからの招待
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => acceptInvite(iv.id, iv.team_name)}
                    className="rounded-full bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    受ける
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => declineInvite(iv.id, iv.team_name)}
                    className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)] disabled:opacity-50"
                  >
                    辞退
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* 統計 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="組織メンバー"
          value={stats.total}
          color="var(--c-accent)"
        />
        <StatCard
          label="チーム所属済"
          value={stats.affiliated}
          total={stats.total}
          color="var(--ok)"
        />
        <StatCard
          label="未所属"
          value={stats.unaffiliated}
          total={stats.total}
          color={stats.unaffiliated > 0 ? "var(--error)" : "var(--ok)"}
        />
      </div>

      {/* 新規作成モーダル (インライン) — 既に所属中なら描画しない */}
      {creating && !myTeamId && (
        <GlassCard className="p-5 flex flex-col gap-3">
          <h2 className="text-[15px] font-extrabold">新しいチームを作る</h2>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="font-semibold">チーム名 *</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="例: にんげんOS チーム"
              className="rounded-md border border-line px-3 py-2 outline-none focus:border-[--c-accent]"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="font-semibold">紹介文 (任意)</span>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
              placeholder="どんなチーム？ 探しているスキル・関心テーマなど"
              className="rounded-md border border-line px-3 py-2 outline-none focus:border-[--c-accent] resize-y"
            />
          </label>
          <div className="flex flex-col gap-1 text-[12px]">
            <span className="font-semibold">
              応募検討中テーマ (任意 · 複数可)
              <span className="ml-2 text-mute font-normal">
                未定でも OK。後から編集できます
              </span>
            </span>
            <ConsideringThemePicker
              availableThemes={availableThemes}
              selected={newConsideringThemeIds}
              onChange={setNewConsideringThemeIds}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-1 text-[12px]">
            <span className="font-semibold">
              一緒に組むメンバー (任意 · 複数可)
              <span className="ml-2 text-mute font-normal">
                作成と同時に招待メールを送ります (相手の承諾が必要)
              </span>
            </span>
            <MemberInvitePicker
              candidates={unaffiliated.filter(
                (m) => m.user_id !== currentUserId,
              )}
              selected={newInviteUserIds}
              onChange={setNewInviteUserIds}
              query={newInviteQuery}
              onQueryChange={setNewInviteQuery}
              disabled={busy}
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCreating(false);
                setNewName("");
                setNewDesc("");
                setError(null);
              }}
              className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={busy || !newName.trim()}
              onClick={createTeam}
              className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "作成中…" : "作成してリーダーになる"}
            </button>
          </div>
        </GlassCard>
      )}

      {/* チーム一覧 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-extrabold text-mute uppercase tracking-wider">
          チーム ({teams.length})
        </h2>
        {teams.length === 0 ? (
          <GlassCard className="p-6 text-center text-mute text-[13px]">
            まだチームはありません。最初のチームを作りましょう。
          </GlassCard>
        ) : (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {teams.map((t) => {
              const iAmMember = t.members.some(
                (m) => m.user_id === currentUserId,
              );
              const iAmLead = t.members.some(
                (m) => m.user_id === currentUserId && m.role === "lead",
              );
              const canDisband = iAmLead || isAdmin;
              const isEditing = editingTeamId === t.id;
              const canEdit = iAmLead || isAdmin;
              return (
                <li key={t.id}>
                  <GlassCard className="p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={busy}
                            className="w-full rounded-md border border-line px-2 py-1 text-[14px] font-extrabold outline-none focus:border-[--c-accent]"
                          />
                        ) : (
                          <h3 className="text-[15px] font-extrabold truncate">
                            {t.name}
                          </h3>
                        )}
                        {t.description && !isEditing && (
                          <p className="t-cap mt-0.5 line-clamp-2">
                            {t.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="rounded-full bg-mute/10 text-mute text-[10.5px] px-2 py-0.5">
                          {t.members.length}人
                        </span>
                        {canEdit && !isEditing && (
                          <button
                            type="button"
                            onClick={() => startEditTeam(t)}
                            className="rounded-md bg-white border border-line px-2 py-0.5 text-[10.5px] text-mute hover:text-ink"
                            title="チーム名 / 検討中テーマを編集"
                          >
                            ✎ 編集
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 応募検討中テーマ */}
                    {isEditing ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="t-label">応募検討中テーマ (未定も可)</div>
                        <ConsideringThemePicker
                          availableThemes={availableThemes}
                          selected={editConsidering}
                          onChange={setEditConsidering}
                          disabled={busy}
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={cancelEditTeam}
                            className="rounded-full bg-white border border-line px-3 py-1 text-[11.5px] text-mute hover:text-ink disabled:opacity-50"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            disabled={busy || !editName.trim()}
                            onClick={() => saveTeamEdit(t)}
                            className="rounded-full bg-ink text-white px-3 py-1 text-[11.5px] font-semibold hover:opacity-90 disabled:opacity-50"
                          >
                            {busy ? "保存中…" : "✓ 保存"}
                          </button>
                        </div>
                      </div>
                    ) : t.consideringThemeIds.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-mute">
                          🔖 応募検討中テーマ ({t.consideringThemeIds.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {t.consideringThemeIds.map((tid) => {
                            const theme = themesById.get(tid);
                            if (!theme) return null;
                            return (
                              <span
                                key={tid}
                                className="inline-flex items-center gap-1 rounded-md border border-line-soft bg-white px-1.5 py-0.5 text-[10.5px]"
                                title={theme.title}
                              >
                                {theme.code && (
                                  <span className="font-mono text-[--c-accent-deep]">
                                    {theme.code}
                                  </span>
                                )}
                                <span className="truncate max-w-[10em]">
                                  {theme.title}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10.5px] text-mute italic">
                        🔖 応募検討中テーマ: 未定
                      </div>
                    )}

                    {/* メンバー */}
                    <div className="flex flex-wrap gap-1.5">
                      {t.members.length === 0 ? (
                        <span className="t-cap italic text-mute">
                          メンバー未登録
                        </span>
                      ) : (
                        t.members
                          .slice()
                          .sort((a, b) =>
                            a.role === b.role
                              ? 0
                              : a.role === "lead"
                                ? -1
                                : 1,
                          )
                          .map((m) => (
                            <span
                              key={m.user_id}
                              className={
                                "inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-2 py-0.5 text-[11.5px] " +
                                (m.role === "lead"
                                  ? "bg-[--c-accent]/15 text-[--c-accent-deep] font-semibold"
                                  : "bg-mute/10 text-ink-2")
                              }
                              title={m.role === "lead" ? "リーダー" : "メンバー"}
                            >
                              <AvatarBubble
                                name={m.display_name}
                                url={m.avatar_url}
                                size={22}
                                ring={
                                  m.role === "lead" ? "var(--c-accent)" : undefined
                                }
                              />
                              <span className="flex items-center gap-1">
                                {m.role === "lead" && <span aria-hidden>👑</span>}
                                {m.display_name ?? "名前未設定"}
                              </span>
                            </span>
                          ))
                      )}
                    </div>

                    {/* 招待中 (pending) — チームメンバー / lead / admin から見える */}
                    {t.pendingInvites.length > 0 && (iAmMember || isAdmin) && (
                      <div className="flex flex-col gap-1">
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-mute">
                          招待中 ({t.pendingInvites.length})
                        </div>
                        <ul className="flex flex-wrap gap-1">
                          {t.pendingInvites.map((iv) => (
                            <li
                              key={iv.id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 text-[11px]"
                              title="返答待ち"
                            >
                              <span aria-hidden>⏳</span>
                              <span>{iv.display_name ?? "名前未設定"}</span>
                              {(iAmLead || isAdmin) && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    cancelInvite(
                                      iv.id,
                                      iv.display_name ?? "この人",
                                    )
                                  }
                                  className="text-[10px] text-amber-800/70 hover:text-red-700 disabled:opacity-50"
                                  title="招待を取り消す"
                                >
                                  ×
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 応募 */}
                    <div className="flex flex-col gap-1">
                      <div className="text-[10.5px] font-bold uppercase tracking-wider text-mute">
                        応募中テーマ ({t.applications.length})
                      </div>
                      {t.applications.length === 0 ? (
                        <div className="rounded-md bg-mute/5 px-2 py-2 text-[11.5px] text-mute">
                          まだテーマに応募していません。
                          {iAmMember && (
                            <a
                              href={`/${orgSlug}/themes`}
                              className="ml-1 underline hover:text-ink"
                            >
                              テーマに応募する →
                            </a>
                          )}
                        </div>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {t.applications.map((a) => (
                            <li
                              key={a.id}
                              className="flex items-center justify-between gap-2 rounded-md bg-mute/5 px-2 py-1 text-[11.5px]"
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                {a.preference_rank && (
                                  <span
                                    className="inline-flex flex-shrink-0 items-center rounded-full bg-ink text-white text-[9.5px] font-bold px-1.5 py-0.5"
                                    aria-label={`第${a.preference_rank}希望`}
                                  >
                                    第{a.preference_rank}
                                  </span>
                                )}
                                <span className="truncate">{a.theme_title}</span>
                              </span>
                              <span
                                className={
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 " +
                                  (APP_STATUS_COLOR[a.status] ??
                                    "bg-mute/10 text-mute")
                                }
                              >
                                {APP_STATUS_LABEL[a.status] ?? a.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* メンバー招待 (リーダー or admin) */}
                    {(iAmLead || isAdmin) && invitingTeamId === t.id ? (
                      <div className="border-t border-line-soft pt-3 flex flex-col gap-2">
                        <div className="text-[11.5px] font-semibold">
                          👥 招待するメンバーを選択
                        </div>
                        <MemberInvitePicker
                          candidates={unaffiliated.filter((m) => {
                            if (m.user_id === currentUserId) return false;
                            if (pendingInvitedUserIds.includes(m.user_id))
                              return false;
                            return true;
                          })}
                          selected={bulkInviteUserIds}
                          onChange={setBulkInviteUserIds}
                          query={bulkInviteQuery}
                          onQueryChange={setBulkInviteQuery}
                          disabled={busy}
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={cancelBulkInvite}
                            className="rounded-full bg-white px-3 py-1.5 text-[11.5px] text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)] disabled:opacity-50"
                          >
                            キャンセル
                          </button>
                          <button
                            type="button"
                            disabled={busy || bulkInviteUserIds.length === 0}
                            onClick={sendBulkInvites}
                            className="rounded-full bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {busy
                              ? "送信中…"
                              : `${bulkInviteUserIds.length || ""} 名に招待を送る`}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Actions */}
                    <div className="mt-auto flex items-center gap-2 flex-wrap pt-1">
                      {!iAmMember && !myTeamId && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => joinTeam(t.id)}
                          className="rounded-full bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          このチームに加入
                        </button>
                      )}
                      {(iAmLead || isAdmin) && invitingTeamId !== t.id && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startBulkInvite(t.id)}
                          className="rounded-full bg-[--c-accent] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          👥 メンバーを招待
                        </button>
                      )}
                      {iAmMember && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => leaveTeam(t.id)}
                          className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
                        >
                          チームを抜ける
                        </button>
                      )}
                      {canDisband && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => disbandTeam(t.id, t.name)}
                          className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-red-600 hover:bg-red-50 shadow-[0_1px_0_var(--line-soft)]"
                        >
                          解散
                        </button>
                      )}
                      <a
                        href={`/${orgSlug}/themes`}
                        className="ml-auto rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-mute hover:text-ink shadow-[0_1px_0_var(--line-soft)]"
                      >
                        テーマに応募 →
                      </a>
                    </div>
                  </GlassCard>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 未所属メンバー */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-extrabold text-mute uppercase tracking-wider">
          未所属メンバー ({unaffiliated.length})
        </h2>
        {unaffiliated.length === 0 ? (
          <GlassCard className="p-6 text-center text-emerald-700 text-[13px]">
            ✨ 全員がどこかのチームに所属しています
          </GlassCard>
        ) : (
          <GlassCard className="p-4 flex flex-col gap-3">
            {(myTeamRole === "lead" || isAdmin) && myTeamId && (
              <p className="t-cap">
                💡 名前をクリックすると自分のチームに招待を送れます (相手の承認が必要)
              </p>
            )}
            {/* 検索 + 五十音順 */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={unaffiliatedQuery}
                onChange={(e) => setUnaffiliatedQuery(e.target.value)}
                placeholder="🔍 メンバーを検索 (名前・所属)"
                className="flex-1 min-w-[220px] rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[--c-accent]"
              />
              <span className="t-cap">
                {(() => {
                  const q = unaffiliatedQuery.trim().toLowerCase();
                  const shown = q
                    ? unaffiliated.filter(
                        (m) =>
                          (m.display_name ?? "").toLowerCase().includes(q) ||
                          (m.affiliation ?? "").toLowerCase().includes(q) ||
                          (m.title ?? "").toLowerCase().includes(q),
                      ).length
                    : unaffiliated.length;
                  return q
                    ? `${shown}/${unaffiliated.length} 件`
                    : `五十音順・${unaffiliated.length} 名`;
                })()}
              </span>
            </div>
            {/* 五十音行タブ */}
            {(() => {
              const q = unaffiliatedQuery.trim();
              if (q) return null;
              const countByRow = new Map<string, number>();
              for (const m of unaffiliated) {
                const r = rowOfMember(m.display_name);
                countByRow.set(r, (countByRow.get(r) ?? 0) + 1);
              }
              return (
                <div className="flex flex-wrap gap-1 border-b border-line-soft pb-2">
                  <button
                    type="button"
                    onClick={() => setUnaffiliatedRow("ALL")}
                    className={
                      "rounded-md px-2 py-1 text-[11.5px] font-semibold transition " +
                      (unaffiliatedRow === "ALL"
                        ? "bg-ink text-white"
                        : "bg-white text-ink hover:bg-mute/10 border border-line")
                    }
                  >
                    すべて
                    <span
                      className={
                        "ml-1 text-[10px] " +
                        (unaffiliatedRow === "ALL" ? "opacity-80" : "text-mute")
                      }
                    >
                      {unaffiliated.length}
                    </span>
                  </button>
                  {KANA_ROWS.map((r) => {
                    const count = countByRow.get(r.key) ?? 0;
                    if (count === 0) return null;
                    const active = unaffiliatedRow === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setUnaffiliatedRow(r.key)}
                        className={
                          "rounded-md px-2 py-1 text-[11.5px] font-semibold transition " +
                          (active
                            ? "bg-ink text-white"
                            : "bg-white text-ink hover:bg-mute/10 border border-line")
                        }
                      >
                        {r.label}
                        <span
                          className={
                            "ml-1 text-[10px] " +
                            (active ? "opacity-80" : "text-mute")
                          }
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            <ul className="flex flex-wrap gap-1.5">
              {unaffiliated
                .slice()
                .sort((a, b) =>
                  (a.display_name ?? "").localeCompare(
                    b.display_name ?? "",
                    "ja",
                  ),
                )
                .filter((m) => {
                  const q = unaffiliatedQuery.trim().toLowerCase();
                  if (q) {
                    return (
                      (m.display_name ?? "").toLowerCase().includes(q) ||
                      (m.affiliation ?? "").toLowerCase().includes(q) ||
                      (m.title ?? "").toLowerCase().includes(q)
                    );
                  }
                  if (unaffiliatedRow === "ALL") return true;
                  return rowOfMember(m.display_name) === unaffiliatedRow;
                })
                .map((m) => {
                const alreadyInvited = pendingInvitedUserIds.includes(m.user_id);
                const canInvite =
                  (myTeamRole === "lead" || isAdmin) &&
                  myTeamId !== null &&
                  m.user_id !== currentUserId &&
                  !alreadyInvited;
                const label = m.display_name ?? "名前未設定";
                // 所属 (会社名)。チップ内では名前の後ろに控えめに表示する。
                const affil = m.affiliation?.trim() || null;
                return (
                  <li key={m.user_id}>
                    {canInvite ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => inviteToMyTeam(m.user_id, label)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white border border-line hover:border-[--c-accent] hover:bg-[--c-accent]/5 pl-0.5 pr-3 py-0.5 text-[12px] transition disabled:opacity-50"
                        title={
                          [m.affiliation, m.title].filter(Boolean).join(" / ") ||
                          `${label} に招待を送る`
                        }
                      >
                        <AvatarBubble
                          name={m.display_name}
                          url={m.avatar_url}
                          size={22}
                        />
                        <span className="text-[10px] text-[--c-accent-deep]">✉️</span>
                        {label}
                        {affil && (
                          <span className="text-[10.5px] text-mute truncate max-w-[140px]">
                            {affil}
                          </span>
                        )}
                      </button>
                    ) : (
                      <span
                        className={
                          "inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-3 py-0.5 text-[12px] " +
                          (alreadyInvited
                            ? "bg-amber-50 text-amber-800"
                            : "bg-mute/10")
                        }
                        title={
                          [m.affiliation, m.title].filter(Boolean).join(" / ") ||
                          undefined
                        }
                      >
                        <AvatarBubble
                          name={m.display_name}
                          url={m.avatar_url}
                          size={22}
                        />
                        {alreadyInvited && <span aria-hidden>⏳</span>}
                        {label}
                        {affil && (
                          <span className="text-[10.5px] text-mute truncate max-w-[140px]">
                            {affil}
                          </span>
                        )}
                        {m.user_id === currentUserId && (
                          <span
                            className="text-[9.5px] font-bold text-[--c-accent-deep]"
                            aria-label="自分"
                          >
                            YOU
                          </span>
                        )}
                        {alreadyInvited && (
                          <span className="text-[9.5px] font-bold">招待中</span>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total?: number;
  color: string;
}) {
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <GlassCard className="p-4">
      <div className="t-label mb-1">{label}</div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="t-big" style={{ fontSize: 26 }}>
          {value}
        </span>
        {total !== undefined && <span className="t-cap">/ {total}</span>}
      </div>
      {pct !== null && (
        <div className="h-1.5 rounded-full bg-line-soft overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      )}
    </GlassCard>
  );
}

/** 応募検討中テーマの複数選択 UI (チップ + トグル)。0件でも「未定」として有効。 */
function ConsideringThemePicker({
  availableThemes,
  selected,
  onChange,
  disabled,
}: {
  availableThemes: AvailableTheme[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const selSet = new Set(selected);
  const toggle = (id: string) => {
    if (disabled) return;
    if (selSet.has(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };
  if (availableThemes.length === 0) {
    return (
      <p className="t-cap italic">
        まだ公開中のテーマがありません
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {availableThemes.map((t) => {
          const active = selSet.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              disabled={disabled}
              className={
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition disabled:opacity-50 " +
                (active
                  ? "bg-ink text-white border-ink"
                  : "bg-white text-ink border-line hover:border-[--c-accent]")
              }
              title={t.title}
            >
              {active && "✓ "}
              {t.code && (
                <span
                  className={
                    "font-mono " +
                    (active ? "opacity-80" : "text-[--c-accent-deep]")
                  }
                >
                  {t.code}
                </span>
              )}
              <span className="truncate max-w-[12em]">{t.title}</span>
            </button>
          );
        })}
      </div>
      <div className="t-cap">
        選択中: {selected.length === 0 ? "未定" : `${selected.length} 件`}
      </div>
    </div>
  );
}

/** チーム作成時のメンバー招待ピッカー (未所属メンバーから複数選択)。 */
// 50音 行 → 属する平仮名 / 片仮名 (合成)
const KANA_ROWS: { key: string; label: string; chars: string }[] = [
  {
    key: "あ",
    label: "あ",
    chars: "あいうえおぁぃぅぇぉアイウエオァィゥェォヴ",
  },
  {
    key: "か",
    label: "か",
    chars: "かきくけこがぎぐげごカキクケコガギグゲゴヵヶ",
  },
  {
    key: "さ",
    label: "さ",
    chars: "さしすせそざじずぜぞサシスセソザジズゼゾ",
  },
  {
    key: "た",
    label: "た",
    chars: "たちつてとだぢづでどっタチツテトダヂヅデドッ",
  },
  {
    key: "な",
    label: "な",
    chars: "なにぬねのナニヌネノ",
  },
  {
    key: "は",
    label: "は",
    chars: "はひふへほばびぶべぼぱぴぷぺぽハヒフヘホバビブベボパピプペポ",
  },
  {
    key: "ま",
    label: "ま",
    chars: "まみむめもマミムメモ",
  },
  {
    key: "や",
    label: "や",
    chars: "やゆよゃゅょヤユヨャュョ",
  },
  {
    key: "ら",
    label: "ら",
    chars: "らりるれろラリルレロ",
  },
  {
    key: "わ",
    label: "わ",
    chars: "わをんワヲン",
  },
  { key: "A-Z", label: "A-Z", chars: "" },
  { key: "他", label: "他", chars: "" },
];

// 日本人姓に頻出する漢字 → 読みの先頭 の対応表。
// 単文字 + 2 文字熟語 (「岩崎」「桜井」等) を並列に持つ。
// 未収録は「他」タブへフォールバック。
const KANJI_YOMI_HEAD: Record<string, string> = {
  // あ行
  阿: "あ", 相: "あ", 青: "あ", 赤: "あ", 秋: "あ", 芥: "あ", 麻: "あ",
  安: "あ", 荒: "あ", 有: "あ", 網: "あ", 天: "あ", 尼: "あ", 綾: "あ",
  鮎: "あ", 姉: "あ", 明: "あ", 朝: "あ", 浅: "あ", 飴: "あ",
  伊: "い", 井: "い", 池: "い", 石: "い", 泉: "い", 磯: "い", 板: "い",
  一: "い", 市: "い", 稲: "い", 犬: "い", 猪: "い", 岩: "い",
  今: "い", 入: "い", 生: "い",
  上: "う", 宇: "う", 梅: "う", 浦: "う", 臼: "う", 鵜: "う",
  江: "え", 恵: "え", 榎: "え", 遠: "え", 円: "え",
  尾: "お", 大: "お", 岡: "お", 奥: "お", 沖: "お", 荻: "お", 織: "お",
  音: "お", 落: "お", 小: "お",
  // か行
  苅: "か", 甲: "か", 貝: "か", 加: "か", 香: "か", 賀: "か", 掛: "か",
  笠: "か", 樫: "か", 梶: "か", 片: "か", 勝: "か", 桂: "か",
  金: "か", 兼: "か", 兜: "か", 神: "か", 亀: "か", 蒲: "か", 河: "か",
  川: "か",
  岸: "き", 木: "き", 菊: "き", 北: "き", 桐: "き",
  黄: "き", 京: "き",
  楠: "く", 工: "く", 串: "く", 熊: "く", 蔵: "く", 倉: "く", 桑: "く",
  黒: "く", 久: "く",
  剣: "け", 毛: "け",
  郡: "こ", 古: "こ", 児: "こ", 越: "こ", 近: "こ",
  // さ行
  齋: "さ", 斉: "さ", 斎: "さ", 榊: "さ", 阪: "さ", 坂: "さ", 佐: "さ",
  桜: "さ", 笹: "さ", 里: "さ", 沢: "さ",
  塩: "し", 敷: "し", 重: "し", 篠: "し", 柴: "し",
  芝: "し", 島: "し", 清: "し", 白: "し", 新: "し",
  末: "す", 菅: "す", 杉: "す", 助: "す", 鈴: "す", 諏訪: "す", 砂: "す",
  世: "せ", 瀬: "せ", 関: "せ", 仙: "せ",
  曽: "そ", 添: "そ", 園: "そ", 荘: "そ",
  // た行
  太: "た", 田: "た", 高: "た", 滝: "た", 竹: "た", 武: "た",
  立: "た", 谷: "た", 俵: "た", 玉: "た", 段: "だ",
  地: "ち",
  塚: "つ", 津: "つ", 都: "つ", 恒: "つ", 続: "つ", 坪: "つ", 堤: "つ",
  出: "で", 弟: "て", 手: "て", 寺: "て",
  戸: "と", 東: "と", 徳: "と", 富: "と", 冨: "と", 豊: "と", 砥: "と",
  // な行
  内: "な", 中: "な", 長: "な", 永: "な", 名: "な", 夏: "な",
  楢: "な", 縄: "な", 難: "な",
  二: "に", 西: "に",
  沼: "ぬ", 根: "ね",
  野: "の", 濃: "の", 能: "の",
  // は行
  萩: "は", 橋: "は", 端: "は", 秦: "は", 服: "は", 畑: "は", 花: "は",
  早: "は", 林: "は", 原: "は", 針: "は", 春: "は",
  比: "ひ", 引: "ひ", 樋: "ひ", 平: "ひ", 廣: "ひ", 広: "ひ",
  深: "ふ", 福: "ふ", 藤: "ふ", 冬: "ふ", 舟: "ふ", 船: "ふ",
  堀: "ほ", 保: "ほ", 星: "ほ", 帆: "ほ", 本: "ほ",
  // ま行
  前: "ま", 増: "ま", 松: "ま", 丸: "ま", 万: "ま", 圓: "ま",
  御: "み", 岬: "み", 三: "み", 水: "み", 溝: "み", 光: "み", 南: "み",
  峯: "み", 峰: "み", 宮: "み",
  向: "む", 麦: "む", 村: "む",
  目: "め",
  望: "も", 桃: "も", 元: "も", 森: "も", 諸: "も",
  // や行
  八: "や", 矢: "や", 屋: "や", 弥: "や", 柳: "や", 山: "や",
  結: "ゆ", 幸: "ゆ", 由: "ゆ", 湯: "ゆ",
  横: "よ", 吉: "よ", 米: "よ", 与: "よ", 依: "よ",
  // ら行
  頼: "ら", 良: "ら",
  竜: "り", 龍: "り",
  類: "る",
  麗: "れ",
  路: "ろ", 廊: "ろ",
  // わ行
  若: "わ", 和: "わ", 渡: "わ", 我: "わ", 鷲: "わ",
  // 姓の 2 文字熟語 (単文字と読みが違うケース)
  阿部: "あ", 遠藤: "え", 池田: "い", 伊藤: "い", 岩崎: "い", 岩本: "い",
  井上: "い", 井内: "い", 井手: "い", 井田: "い",
  神田: "か", 桜井: "さ", 佐藤: "さ", 佐々: "さ", 進藤: "し",
  相良: "さ",
  春日: "か", 神戸: "こ", 神保: "し", 河内: "こ", 木下: "き", 木村: "き",
  桑田: "く", 木曽: "き",
  近藤: "こ", 小林: "こ", 小島: "こ", 小田: "お", 小野: "お", 小畑: "お",
  小場: "お", 小場川: "お", 小畠: "お",
  中村: "な", 中山: "な", 中井: "な", 中川: "な", 長井: "な", 長尾: "な",
  長岡: "な", 長瀬: "な", 長田: "な",
  永井: "な", 永岡: "な", 永田: "な", 難波: "な",
  西沢: "に", 西田: "に", 西村: "に",
  根本: "ね",
  野口: "の", 野田: "の", 野村: "の", 野原: "の",
  橋本: "は", 橋村: "は", 服部: "は", 花田: "は", 原田: "は", 原口: "は",
  樋口: "ひ", 平田: "ひ", 平野: "ひ", 広瀬: "ひ",
  藤田: "ふ", 藤井: "ふ", 藤原: "ふ", 藤本: "ふ", 藤村: "ふ", 藤崎: "ふ",
  星野: "ほ", 本田: "ほ", 本間: "ほ",
  前田: "ま", 前川: "ま", 前山: "ま", 増田: "ま", 松井: "ま", 松尾: "ま",
  松岡: "ま", 松下: "ま", 松田: "ま", 松本: "ま", 松村: "ま",
  三上: "み", 三浦: "み", 三木: "み", 三坪: "み", 三宅: "み", 三好: "み",
  水野: "み", 宮田: "み", 宮本: "み", 宮下: "み",
  向井: "む", 武藤: "む", 村上: "む", 村田: "む", 村山: "む",
  森田: "も", 森本: "も", 森下: "も", 森山: "も", 森川: "も", 望月: "も",
  安田: "や", 安部: "あ", 安藤: "あ",
  山内: "や", 山岸: "や", 山口: "や", 山下: "や", 山田: "や", 山中: "や",
  山根: "や", 山野: "や", 山本: "や", 山村: "や", 山元: "や",
  湯浅: "ゆ",
  横山: "よ", 横田: "よ", 横川: "よ", 吉井: "よ", 吉田: "よ", 吉尾: "よ",
  吉川: "よ", 吉村: "よ", 吉岡: "よ", 米山: "よ",
  若林: "わ", 若山: "わ", 和田: "わ", 渡辺: "わ", 渡部: "わ", 渡邊: "わ",
  越後: "え", 越智: "お",
  児玉: "こ", 児島: "こ",
  高橋: "た", 高田: "た", 高木: "た", 高野: "た",
  田中: "た", 田村: "た", 田代: "た", 谷口: "た",
  竹内: "た", 竹田: "た", 武田: "た",
  秋山: "あ", 秋田: "あ", 秋吉: "あ", 秋穂: "あ",
  金子: "か", 金田: "か",
  恵良: "え",
  恒吉: "つ",
  笹川: "さ",
  篠原: "し",
  柴田: "し",
  桑野: "く", 久保: "く", 久保山: "く", 久保田: "く",
  苅北: "か",
  岡本: "お", 岡田: "お", 岡松: "お",
  古野: "こ", 古田: "こ",
  太田: "お",
  堀田: "ほ",
  中野: "な", 中沢: "な",
  上田: "う",
  宇野: "う", 宇都宮: "う",
  内田: "う", 内山: "う", 内藤: "な",
  梅田: "う",
  // ── 追加: 単文字漢字 (未収録だったもの) ──
  城: "し", 成: "な", 千: "ち", 猿: "さ", 鮫: "さ", 樺: "か", 榛: "は",
  乾: "い", 沓: "く", 番: "ば", 檜: "ひ", 桝: "ま", 牧: "ま",
  // ── 追加: 姓 2 文字熟語 (単文字と読みが違うもの / よく出るもの) ──
  榎本: "え", 遠山: "と",
  生駒: "い", 猪股: "い", 稲垣: "い", 磯部: "い", 和泉: "い",
  上原: "う", 上野: "う", 上林: "う", 宇治: "う",
  江頭: "え", 江藤: "え", 江川: "え",
  大森: "お", 大野: "お", 大山: "お", 大江: "お", 大原: "お",
  奥山: "お", 奥田: "お",
  神谷: "か", 香川: "か", 加藤: "か", 川口: "か", 川崎: "か",
  川島: "か", 川村: "か", 川原: "か", 貫: "ぬ",
  木内: "き", 岸本: "き", 北村: "き", 北原: "き", 北野: "き",
  熊谷: "く", 倉田: "く",
  越水: "こ", 越田: "こ", 幸田: "こ",
  桜田: "さ", 佐々木: "さ", 佐野: "さ", 猿渡: "さ",
  塩田: "し", 塩谷: "し", 志村: "し", 志田: "し", 芝原: "し", 城戸: "き",
  末広: "す", 末永: "す", 杉山: "す", 杉本: "す", 杉田: "す",
  住田: "す", 住吉: "す",
  瀬川: "せ", 瀬野: "せ", 関口: "せ", 関谷: "せ",
  高瀬: "た", 高倉: "た", 高山: "た", 高松: "た",
  滝口: "た", 滝田: "た",
  竹本: "た", 竹村: "た",
  田口: "た", 田島: "た", 田端: "た", 田辺: "た",
  谷川: "た", 谷本: "た", 谷崎: "た", 玉井: "た",
  地村: "ち",
  津田: "つ", 津野: "つ", 都築: "つ", 恒川: "つ", 恒松: "つ",
  出口: "で",
  戸田: "と", 徳田: "と", 徳永: "と", 富岡: "と", 富田: "と", 富永: "と",
  富松: "と", 冨永: "と", 豊田: "と", 豊島: "と",
  中田: "な", 中原: "な", 中島: "な", 中森: "な",
  夏目: "な",
  西山: "に", 西野: "に", 西原: "に", 二宮: "に", 二階堂: "に",
  丹羽: "に", 仁科: "に",
  沼田: "ぬ", 布施: "ふ",
  根岸: "ね",
  萩原: "は", 萩野: "は", 八田: "は", 花岡: "は", 早川: "は", 林田: "は",
  濱田: "は", 浜田: "は", 浜: "は", 濱: "は",
  板東: "ば",
  比嘉: "ひ", 樋田: "ひ", 樋渡: "ひ",
  平山: "ひ", 平井: "ひ", 平岡: "ひ", 平川: "ひ", 平松: "ひ", 平沼: "ひ",
  廣田: "ひ", 廣瀬: "ひ", 広田: "ひ", 広川: "ひ", 広木: "ひ",
  深田: "ふ", 福井: "ふ", 福田: "ふ", 福島: "ふ", 福本: "ふ", 福原: "ふ",
  福山: "ふ", 藤野: "ふ", 藤川: "ふ", 藤沢: "ふ", 藤山: "ふ", 藤木: "ふ",
  古川: "ふ", 古谷: "ふ", 古賀: "こ",
  堀内: "ほ", 堀口: "ほ", 堀部: "ほ", 星子: "ほ", 星山: "ほ",
  細田: "ほ", 細川: "ほ", 細野: "ほ", 細谷: "ほ",
  前原: "ま", 前野: "ま", 前橋: "ま", 前島: "ま", 前村: "ま",
  牧田: "ま", 牧野: "ま", 増山: "ま", 増井: "ま",
  松山: "ま", 松浦: "ま", 松原: "ま", 松川: "ま", 松永: "ま",
  松崎: "ま", 松沢: "ま",
  丸山: "ま", 丸田: "ま", 丸井: "ま", 丸川: "ま",
  水島: "み", 水口: "み", 水谷: "み", 水田: "み", 水原: "み",
  溝口: "み", 溝端: "み", 溝田: "み",
  三田: "み", 三村: "み", 三谷: "み", 三橋: "み", 三国: "み",
  南野: "み", 南田: "み", 南川: "み",
  宮川: "み", 宮沢: "み", 宮原: "み", 宮内: "み", 宮崎: "み", 宮野: "み",
  向山: "む", 武井: "む",
  村井: "む", 村岡: "む", 村瀬: "む", 村中: "む",
  森野: "も", 森崎: "も", 森岡: "も", 森園: "も", 森永: "も",
  安井: "や", 安永: "や", 安孫子: "あ", 安倍: "あ",
  柳沢: "や", 柳田: "や", 矢田: "や", 矢野: "や", 矢部: "や", 矢島: "や",
  湯本: "ゆ", 湯川: "ゆ", 湯田: "ゆ",
  横井: "よ", 横内: "よ", 横島: "よ", 横沢: "よ",
  吉本: "よ", 吉野: "よ", 吉永: "よ",
  依田: "よ", 依光: "よ", 与田: "よ",
  竜崎: "り", 龍谷: "り",
  和久田: "わ", 綿貫: "わ", 渡瀬: "わ",
  鷲田: "わ", 鷹野: "た",
};

function rowFromKana(c: string): string | null {
  if (/[A-Za-z]/.test(c)) return "A-Z";
  for (const r of KANA_ROWS) {
    if (r.chars.includes(c)) return r.key;
  }
  return null;
}

function rowOfMember(name: string | null): string {
  const raw = (name ?? "").trim();
  if (!raw) return "他";
  // 先頭 2 文字の熟語 (e.g. 井上, 桜井) → 単文字 の順で辞書引き
  const first2 = raw.slice(0, 2);
  const first1 = raw[0]!;
  const yomiHead =
    KANJI_YOMI_HEAD[first2] ?? KANJI_YOMI_HEAD[first1] ?? null;
  if (yomiHead) {
    for (const r of KANA_ROWS) {
      if (r.chars.includes(yomiHead)) return r.key;
    }
  }
  const direct = rowFromKana(first1);
  if (direct) return direct;
  return "他";
}

function MemberInvitePicker({
  candidates,
  selected,
  onChange,
  query,
  onQueryChange,
  disabled,
}: {
  candidates: OrgMember[];
  selected: string[];
  onChange: (next: string[]) => void;
  query: string;
  onQueryChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [activeRow, setActiveRow] = useState<string>("ALL");
  const selSet = new Set(selected);
  const toggle = (uid: string) => {
    if (disabled) return;
    if (selSet.has(uid)) {
      onChange(selected.filter((x) => x !== uid));
    } else {
      onChange([...selected, uid]);
    }
  };

  const sortedAll = candidates
    .slice()
    .sort((a, b) =>
      (a.display_name ?? "").localeCompare(b.display_name ?? "", "ja"),
    );

  const countByRow = new Map<string, number>();
  for (const m of sortedAll) {
    const r = rowOfMember(m.display_name);
    countByRow.set(r, (countByRow.get(r) ?? 0) + 1);
  }

  const q = query.trim().toLowerCase();
  const bySearch = sortedAll.filter((m) => {
    if (!q) return true;
    return (
      (m.display_name ?? "").toLowerCase().includes(q) ||
      (m.affiliation ?? "").toLowerCase().includes(q) ||
      (m.title ?? "").toLowerCase().includes(q)
    );
  });

  // 検索クエリがあれば全件、無ければ選択中の 50音 行でフィルタ
  const filtered =
    q || activeRow === "ALL"
      ? bySearch
      : bySearch.filter((m) => rowOfMember(m.display_name) === activeRow);

  if (candidates.length === 0) {
    return (
      <p className="t-cap italic">
        招待可能な未所属メンバーがいません
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="🔍 メンバーを検索 (名前・所属)"
          disabled={disabled}
          className="flex-1 min-w-[200px] rounded-md border border-line bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[--c-accent] disabled:opacity-50"
        />
        <span className="t-cap">
          {selected.length > 0
            ? `${selected.length} 名を招待予定`
            : `${filtered.length}/${candidates.length} 名`}
        </span>
      </div>

      {/* 五十音行タブ (検索クエリ入力時はタブを隠す) */}
      {!q && (
        <div className="flex flex-wrap gap-1 border-b border-line-soft pb-2">
          <button
            type="button"
            onClick={() => setActiveRow("ALL")}
            disabled={disabled}
            className={
              "rounded-md px-2 py-1 text-[11.5px] font-semibold transition disabled:opacity-50 " +
              (activeRow === "ALL"
                ? "bg-ink text-white"
                : "bg-white text-ink hover:bg-mute/10 border border-line")
            }
          >
            すべて
            <span
              className={
                "ml-1 text-[10px] " +
                (activeRow === "ALL" ? "opacity-80" : "text-mute")
              }
            >
              {candidates.length}
            </span>
          </button>
          {KANA_ROWS.map((r) => {
            const count = countByRow.get(r.key) ?? 0;
            if (count === 0) return null;
            const active = activeRow === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setActiveRow(r.key)}
                disabled={disabled}
                className={
                  "rounded-md px-2 py-1 text-[11.5px] font-semibold transition disabled:opacity-50 " +
                  (active
                    ? "bg-ink text-white"
                    : "bg-white text-ink hover:bg-mute/10 border border-line")
                }
              >
                {r.label}
                <span
                  className={
                    "ml-1 text-[10px] " +
                    (active ? "opacity-80" : "text-mute")
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div
        className="flex flex-wrap gap-1.5 max-h-[260px] overflow-y-auto pr-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {filtered.length === 0 ? (
          <p className="t-cap italic w-full text-center py-3">
            該当メンバーがいません
          </p>
        ) : (
          filtered.map((m) => {
            const active = selSet.has(m.user_id);
            const label = m.display_name ?? "名前未設定";
            const affil = m.affiliation?.trim() || null;
            return (
              <button
                key={m.user_id}
                type="button"
                onClick={() => toggle(m.user_id)}
                disabled={disabled}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border pl-0.5 pr-3 py-0.5 text-[12px] transition disabled:opacity-50 " +
                  (active
                    ? "bg-[--c-accent] text-white border-[--c-accent]"
                    : "bg-white text-ink border-line hover:border-[--c-accent]")
                }
                title={
                  [m.affiliation, m.title].filter(Boolean).join(" / ") ||
                  undefined
                }
              >
                <AvatarBubble
                  name={m.display_name}
                  url={m.avatar_url}
                  size={22}
                />
                {active && <span aria-hidden>✓</span>}
                <span>{label}</span>
                {affil && (
                  <span
                    className={
                      "text-[10.5px] truncate max-w-[140px] " +
                      (active ? "opacity-80" : "text-mute")
                    }
                  >
                    {affil}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
