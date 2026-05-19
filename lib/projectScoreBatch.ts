import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import {
  computeProjectScore,
  type ProjectScore,
} from "@/lib/projectScore";

type Client = SupabaseClient<Database>;

/** 複数プロジェクトの AI 総合評価スコアをバッチで計算する。
 *  ホームのランキングや一覧表示など、N+1 を避けて一括で出すのに使う。
 *  各テーブルから projectIds で一括取得 → メモリで group by して算出。 */
export async function computeBatchProjectScores(
  supabase: Client,
  projects: { id: string; streak_days: number }[],
): Promise<Map<string, ProjectScore>> {
  const ids = projects.map((p) => p.id);
  if (ids.length === 0) return new Map();

  const [
    { data: plans },
    { data: pms },
    { data: tasks },
    { data: ms },
    { data: diags },
  ] = await Promise.all([
    supabase
      .from("execution_plans")
      .select("id, project_id, scores")
      .in("project_id", ids),
    supabase
      .from("project_memberships")
      .select("project_id, user_id, role, title, responsibility, work_description")
      .in("project_id", ids),
    supabase
      .from("tasks")
      .select("project_id, status")
      .in("project_id", ids),
    supabase
      .from("milestones")
      .select("project_id, done")
      .in("project_id", ids),
    supabase
      .from("diagnosis_entries")
      .select("project_id, user_id")
      .in("project_id", ids)
      .not("user_id", "is", null),
  ]);

  const planIdToProject = new Map<string, string>();
  const planByProject = new Map<
    string,
    { why?: number; who?: number; what?: number; how?: number } | null
  >();
  for (const p of plans ?? []) {
    planIdToProject.set(p.id, p.project_id);
    planByProject.set(
      p.project_id,
      p.scores && typeof p.scores === "object"
        ? (p.scores as {
            why?: number;
            who?: number;
            what?: number;
            how?: number;
          })
        : null,
    );
  }

  // KPI は plan_id → project_id 経由
  let kpisByProject: Map<string, number[]> = new Map();
  if (planIdToProject.size > 0) {
    const { data: kpis } = await supabase
      .from("kpis")
      .select("plan_id, progress")
      .in("plan_id", Array.from(planIdToProject.keys()));
    for (const k of kpis ?? []) {
      const pid = planIdToProject.get(k.plan_id);
      if (!pid) continue;
      const arr = kpisByProject.get(pid) ?? [];
      arr.push(typeof k.progress === "number" ? k.progress : 0);
      kpisByProject.set(pid, arr);
    }
  }

  const membersByProject = new Map<string, NonNullable<typeof pms>>();
  for (const m of pms ?? []) {
    const arr = membersByProject.get(m.project_id) ?? [];
    arr.push(m);
    membersByProject.set(m.project_id, arr);
  }

  const taskCounts = new Map<string, { total: number; done: number }>();
  for (const t of tasks ?? []) {
    const e = taskCounts.get(t.project_id) ?? { total: 0, done: 0 };
    e.total += 1;
    if (t.status === "done") e.done += 1;
    taskCounts.set(t.project_id, e);
  }

  const msCounts = new Map<string, { total: number; done: number }>();
  for (const m of ms ?? []) {
    const e = msCounts.get(m.project_id) ?? { total: 0, done: 0 };
    e.total += 1;
    if (m.done) e.done += 1;
    msCounts.set(m.project_id, e);
  }

  const retroByProject = new Map<string, Set<string>>();
  for (const d of diags ?? []) {
    if (!d.user_id) continue;
    const s = retroByProject.get(d.project_id) ?? new Set<string>();
    s.add(d.user_id);
    retroByProject.set(d.project_id, s);
  }

  const out = new Map<string, ProjectScore>();
  for (const proj of projects) {
    const members = membersByProject.get(proj.id) ?? [];
    const t = taskCounts.get(proj.id) ?? { total: 0, done: 0 };
    const m = msCounts.get(proj.id) ?? { total: 0, done: 0 };
    const retroUsers = retroByProject.get(proj.id) ?? new Set<string>();
    const memberUserIds = new Set(members.map((mm) => mm.user_id));
    const retroSubmittedUserCount = Array.from(memberUserIds).filter((uid) =>
      retroUsers.has(uid),
    ).length;

    const score = computeProjectScore({
      planScores: planByProject.get(proj.id) ?? null,
      members: members.map((mm) => ({
        role: mm.role as "lead" | "member",
        title: mm.title,
        responsibility: mm.responsibility,
        work_description: mm.work_description,
      })),
      taskTotal: t.total,
      taskDone: t.done,
      milestoneTotal: m.total,
      milestoneDone: m.done,
      streakDays: proj.streak_days,
      retroSubmittedUserCount,
      memberCount: members.length,
      kpiProgressList: kpisByProject.get(proj.id) ?? [],
    });
    out.set(proj.id, score);
  }
  return out;
}
