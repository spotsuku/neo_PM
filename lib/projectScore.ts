/** AI 総合評価スコア (決定論的: 既存データから 5 次元 + total を計算)。
 *  Claude 呼び出しなしで動くので、サーバ集計に組み込んでも遅くならない。 */

export interface ProjectScoreSnapshot {
  /** execution_plans.scores (why/who/what/how 0-100) */
  planScores: {
    why?: number;
    who?: number;
    what?: number;
    how?: number;
  } | null;
  members: {
    role: "lead" | "member";
    title: string | null;
    responsibility: string | null;
    work_description: string | null;
  }[];
  taskTotal: number;
  taskDone: number;
  milestoneTotal: number;
  milestoneDone: number;
  streakDays: number;
  retroSubmittedUserCount: number;
  memberCount: number;
}

export interface ProjectScoreDimension {
  key: "plan" | "team" | "execution" | "engagement" | "retro";
  emo: string;
  label: string;
  desc: string;
  score: number;
  detail: string;
}

export interface ProjectScore {
  total: number;
  rating: "A+" | "A" | "B" | "C" | "D";
  dimensions: ProjectScoreDimension[];
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function ratingFor(total: number): ProjectScore["rating"] {
  if (total >= 90) return "A+";
  if (total >= 75) return "A";
  if (total >= 60) return "B";
  if (total >= 40) return "C";
  return "D";
}

export function computeProjectScore(
  snap: ProjectScoreSnapshot,
): ProjectScore {
  // ── 1. 計画 (Why/Who/What/How の平均)
  const planValues = [
    snap.planScores?.why,
    snap.planScores?.who,
    snap.planScores?.what,
    snap.planScores?.how,
  ].filter((v): v is number => typeof v === "number");
  const planScore =
    planValues.length === 0
      ? 0
      : clamp(
          planValues.reduce((a, b) => a + b, 0) / planValues.length,
        );
  const planDetail =
    planValues.length === 0
      ? "未評価 (Why/Who/What/How が未採点)"
      : `Why ${snap.planScores?.why ?? 0} / Who ${snap.planScores?.who ?? 0} / What ${snap.planScores?.what ?? 0} / How ${snap.planScores?.how ?? 0}`;

  // ── 2. チーム (役割・責任・業務の充足率)
  let teamScore = 0;
  let teamDetail = "メンバー未登録";
  if (snap.members.length > 0) {
    const filledCount = snap.members.filter(
      (m) =>
        m.title?.trim() &&
        m.responsibility?.trim() &&
        m.work_description?.trim(),
    ).length;
    teamScore = clamp((filledCount / snap.members.length) * 100);
    teamDetail = `${filledCount} / ${snap.members.length} 名 のプロフィール完了`;
  }

  // ── 3. 実行 (タスク完了率 + マイルストーン完了率 の平均)
  const taskRatio =
    snap.taskTotal > 0 ? (snap.taskDone / snap.taskTotal) * 100 : 0;
  const milestoneRatio =
    snap.milestoneTotal > 0
      ? (snap.milestoneDone / snap.milestoneTotal) * 100
      : 0;
  const executionScore = clamp((taskRatio + milestoneRatio) / 2);
  const executionDetail = `タスク ${snap.taskDone}/${snap.taskTotal} ・ マイルストーン ${snap.milestoneDone}/${snap.milestoneTotal}`;

  // ── 4. アクティビティ (連続稼働、最大 25 日で満点)
  const engagementScore = clamp((snap.streakDays / 25) * 100);
  const engagementDetail = `🔥 ${snap.streakDays} 日連続稼働`;

  // ── 5. 振り返り (全員提出で 100%)
  const retroScore =
    snap.memberCount === 0
      ? 0
      : clamp((snap.retroSubmittedUserCount / snap.memberCount) * 100);
  const retroDetail =
    snap.memberCount === 0
      ? "メンバー未登録"
      : `${snap.retroSubmittedUserCount} / ${snap.memberCount} 名 が振り返りを保存`;

  const dimensions: ProjectScoreDimension[] = [
    {
      key: "plan",
      emo: "✨",
      label: "計画の解像度",
      desc: "Why / Who / What / How の AI 採点平均",
      score: planScore,
      detail: planDetail,
    },
    {
      key: "team",
      emo: "👥",
      label: "チーム構成",
      desc: "役職 / 責任 / 業務内容 の充足率",
      score: teamScore,
      detail: teamDetail,
    },
    {
      key: "execution",
      emo: "🛠",
      label: "実行進捗",
      desc: "タスクとマイルストーンの完了率の平均",
      score: executionScore,
      detail: executionDetail,
    },
    {
      key: "engagement",
      emo: "🔥",
      label: "アクティビティ",
      desc: "連続稼働日数 (25 日で満点)",
      score: engagementScore,
      detail: engagementDetail,
    },
    {
      key: "retro",
      emo: "💗",
      label: "振り返り",
      desc: "チーム評価を保存したメンバー比率",
      score: retroScore,
      detail: retroDetail,
    },
  ];

  const total = clamp(
    dimensions.reduce((a, d) => a + d.score, 0) / dimensions.length,
  );

  return {
    total,
    rating: ratingFor(total),
    dimensions,
  };
}
