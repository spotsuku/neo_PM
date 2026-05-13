import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

export type ProjectHealth = "good" | "watch" | "stalled";

export interface ProjectStats {
  id: string;
  name: string;
  team_name: string | null;
  idea_title: string | null;
  status: "active" | "paused" | "completed" | "archived";
  progress_pct: number;
  streak_days: number;
  updated_at: string;
  daysSinceUpdate: number;
  taskCounts: {
    total: number;
    done: number;
    doing: number;
    todo: number;
  };
  overdueMilestones: number;
  whyFilled: boolean;
  aiMessages30d: number;
  memberCount: number;
  health: ProjectHealth;
  alerts: string[];
}

export interface MemberActivity {
  user_id: string;
  display_name: string | null;
  org_role: "owner" | "admin" | "member";
  projectCount: number;
  taskCount: number;
  doneTaskCount: number;
  aiMessages30d: number;
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
}

export interface OrgSummary {
  projectsTotal: number;
  projectsActive: number;
  projectsStalled: number;
  membersTotal: number;
  membersInactive: number;
  updates30d: number;
  aiMessages30d: number;
  meetingsThisMonth: number;
  pendingInvitations: number;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

export async function fetchProjectStats(
  supabase: Client,
  orgId: string,
): Promise<ProjectStats[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
  const todayISO = now.toISOString().slice(0, 10);

  const [
    { data: projects },
    { data: tasks },
    { data: milestones },
    { data: plans },
    { data: chats },
    { data: memberships },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, team_name, idea_title, status, progress_pct, streak_days, updated_at",
      )
      .eq("organization_id", orgId),
    supabase
      .from("tasks")
      .select("project_id, status")
      .in(
        "project_id",
        (await supabase.from("projects").select("id").eq("organization_id", orgId))
          .data?.map((p) => p.id) ?? [],
      ),
    supabase
      .from("milestones")
      .select("project_id, date, done")
      .lt("date", todayISO)
      .eq("done", false),
    supabase.from("execution_plans").select("project_id, why"),
    supabase
      .from("chat_messages")
      .select("project_id")
      .eq("role", "assistant")
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("project_memberships")
      .select("project_id"),
  ]);

  const tasksByProject = new Map<string, ProjectStats["taskCounts"]>();
  for (const t of tasks ?? []) {
    if (!tasksByProject.has(t.project_id)) {
      tasksByProject.set(t.project_id, {
        total: 0,
        done: 0,
        doing: 0,
        todo: 0,
      });
    }
    const c = tasksByProject.get(t.project_id)!;
    c.total++;
    if (t.status === "done") c.done++;
    else if (t.status === "doing" || t.status === "review") c.doing++;
    else c.todo++;
  }

  const overdueByProject = new Map<string, number>();
  for (const m of milestones ?? []) {
    overdueByProject.set(
      m.project_id,
      (overdueByProject.get(m.project_id) ?? 0) + 1,
    );
  }

  const whyByProject = new Map<string, boolean>();
  for (const p of plans ?? []) {
    whyByProject.set(p.project_id, Boolean((p.why ?? "").trim()));
  }

  const aiByProject = new Map<string, number>();
  for (const c of chats ?? []) {
    aiByProject.set(c.project_id, (aiByProject.get(c.project_id) ?? 0) + 1);
  }

  const memberCountByProject = new Map<string, number>();
  for (const m of memberships ?? []) {
    memberCountByProject.set(
      m.project_id,
      (memberCountByProject.get(m.project_id) ?? 0) + 1,
    );
  }

  return (projects ?? []).map((p) => {
    const updated = new Date(p.updated_at);
    const days = daysBetween(updated, now);
    const taskCounts = tasksByProject.get(p.id) ?? {
      total: 0,
      done: 0,
      doing: 0,
      todo: 0,
    };
    const overdue = overdueByProject.get(p.id) ?? 0;
    const why = whyByProject.get(p.id) ?? false;
    const ai = aiByProject.get(p.id) ?? 0;
    const members = memberCountByProject.get(p.id) ?? 0;

    const alerts: string[] = [];
    if (days >= 7) alerts.push(`${days}日更新なし`);
    if (overdue >= 1) alerts.push(`期限超過マイルストーン ${overdue} 件`);
    if (!why && p.status === "active") alerts.push("Why 未記入");
    if (members <= 1 && p.status === "active")
      alerts.push("メンバー1名のみ（リスク）");

    let health: ProjectHealth = "good";
    if (p.status === "active") {
      if (days >= 7 || (!why && days >= 3)) health = "stalled";
      else if (days >= 3 || overdue >= 1) health = "watch";
    } else {
      health = "good";
    }

    return {
      id: p.id,
      name: p.name,
      team_name: p.team_name,
      idea_title: p.idea_title,
      status: p.status,
      progress_pct: p.progress_pct,
      streak_days: p.streak_days,
      updated_at: p.updated_at,
      daysSinceUpdate: days,
      taskCounts,
      overdueMilestones: overdue,
      whyFilled: why,
      aiMessages30d: ai,
      memberCount: members,
      health,
      alerts,
    };
  });
}

export async function fetchMemberActivity(
  supabase: Client,
  orgId: string,
): Promise<MemberActivity[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, role, profiles:user_id(display_name)")
    .eq("organization_id", orgId);

  type Profile = { display_name: string | null };
  type Row = {
    user_id: string;
    role: "owner" | "admin" | "member";
    profiles: Profile | Profile[] | null;
  };

  const members = ((memberships ?? []) as unknown as Row[]).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      user_id: m.user_id,
      org_role: m.role,
      display_name: p?.display_name ?? null,
    };
  });

  // 組織内プロジェクト ID
  const { data: orgProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("organization_id", orgId);
  const projectIds = (orgProjects ?? []).map((p) => p.id);

  // 各ユーザーのプロジェクト数
  const { data: projMembers } = await supabase
    .from("project_memberships")
    .select("user_id, project_id")
    .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"]);

  const projectCountByUser = new Map<string, number>();
  for (const pm of projMembers ?? []) {
    projectCountByUser.set(
      pm.user_id,
      (projectCountByUser.get(pm.user_id) ?? 0) + 1,
    );
  }

  // 最後のチャット送信時刻（簡易的にこれを最終活動とする）
  // chat_messages には user 関連付けがないので、tasks.updated_at + owner_name から推定するしかない
  // とりあえず profiles + project_memberships ベースで返す

  return members.map((m) => ({
    ...m,
    projectCount: projectCountByUser.get(m.user_id) ?? 0,
    taskCount: 0, // owner_name は文字列なので user_id 紐付けは難しい。後の拡張で。
    doneTaskCount: 0,
    aiMessages30d: 0,
    lastActivityAt: null,
    daysSinceActivity: null,
  }));
}

export async function fetchOrgSummary(
  supabase: Client,
  orgId: string,
  projectStats: ProjectStats[],
  memberActivity: MemberActivity[],
): Promise<OrgSummary> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const projectIds = projectStats.map((p) => p.id);

  const [
    { data: invitations },
    { count: meetingsCount },
    { count: aiCount },
    { count: tasksCount },
  ] = await Promise.all([
    supabase
      .from("invitations")
      .select("id")
      .eq("organization_id", orgId)
      .is("used_at", null),
    supabase
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"])
      .gte("created_at", monthStart),
    supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"])
      .eq("role", "assistant")
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("project_id", projectIds.length > 0 ? projectIds : ["__none__"])
      .gte("updated_at", thirtyDaysAgo),
  ]);

  return {
    projectsTotal: projectStats.length,
    projectsActive: projectStats.filter((p) => p.status === "active").length,
    projectsStalled: projectStats.filter((p) => p.health === "stalled").length,
    membersTotal: memberActivity.length,
    membersInactive: memberActivity.filter(
      (m) => m.daysSinceActivity !== null && m.daysSinceActivity >= 30,
    ).length,
    updates30d: tasksCount ?? 0,
    aiMessages30d: aiCount ?? 0,
    meetingsThisMonth: meetingsCount ?? 0,
    pendingInvitations: (invitations ?? []).length,
  };
}
