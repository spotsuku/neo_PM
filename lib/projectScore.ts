/** AI 総合評価スコア (決定論的: 既存データから 6 次元 + total を計算)。
 *  Claude 呼び出しなしで動くので、サーバ集計に組み込んでも遅くならない。
 *  各次元に閾値別の AI 総評コメントを付与する。 */

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
  /** kpis.progress (0-100) のリスト */
  kpiProgressList: number[];
}

export type ProjectScoreKey =
  | "plan"
  | "team"
  | "execution"
  | "engagement"
  | "retro"
  | "kpi";

export interface ProjectScoreDimension {
  key: ProjectScoreKey;
  emo: string;
  label: string;
  desc: string;
  score: number;
  detail: string;
  /** スコア tier に基づく AI 総評 */
  comment: string;
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

type Tier = "none" | "early" | "mid" | "good" | "great";
function tierFor(score: number): Tier {
  if (score <= 0) return "none";
  if (score < 30) return "early";
  if (score < 60) return "mid";
  if (score < 85) return "good";
  return "great";
}

/** 次元 × tier の総評コメント表 */
const COMMENTS: Record<ProjectScoreKey, Record<Tier, string>> = {
  plan: {
    none: "🌱 Why から 1 行書き出してみましょう。AI 採点を 1 度受けると道筋が見えます。",
    early: "📝 骨格はあります。Why と Who の解像度を上げると一気に説得力が出ます。",
    mid: "🛠 Why/Who/What/How が繋がってきました。What を「相手が得る変化」に磨くと尖ります。",
    good: "✨ 強い計画です。AI 採点を再度受けてさらに研いでみましょう。",
    great: "🏆 説得力の高い計画。意思決定で迷ったら立ち戻れる軸になっています。",
  },
  team: {
    none: "🦁 まずはリードを 1 名決めましょう。動き出すきっかけになります。",
    early: "👥 役職は埋まりつつあります。各自の責任と業務を 1 行ずつ明文化しましょう。",
    mid: "🤝 役割が見える状態。誰が何に責任を持つかが揃うと、判断スピードが上がります。",
    good: "🎯 役割分担が機能しています。新メンバーが入った時もここを見れば動けます。",
    great: "🏆 チームとしての完成度が高い。プロセスとロールが一致しています。",
  },
  execution: {
    none: "📋 WBS にタスクとマイルストーンを置いて、動かす対象を可視化しましょう。",
    early: "🚧 着手はしているがまだ序盤。今週中に 3 件 done を作ると流れが生まれます。",
    mid: "⚙️ 半分は越えました。期限超過になっているマイルストーンを潰すと加速します。",
    good: "🚀 順調なペース。完了タスクの学びを振り返りに残すとさらに強くなります。",
    great: "🏆 高い実行力。チームのリズムが定着しています。",
  },
  engagement: {
    none: "🔥 まだエンジンがかかっていません。今日 1 つでも前進記録を残しましょう。",
    early: "🌱 連続が始まりました。3 日 / 7 日のチェックポイントを超えると習慣化します。",
    mid: "🔥 リズムができてきました。15 日連続で更新するとチームの推進力に変わります。",
    good: "🚀 高い活性度。週末を跨いでも更新が止まらないチームです。",
    great: "🏆 卓越した活性度。25 日以上の連続稼働は文化として根付いた状態です。",
  },
  retro: {
    none: "💗 チーム評価タブで 14 項目を全員 1 度ずつ保存しましょう。視点が揃います。",
    early: "💗 一部のメンバーが振り返り済み。残りのメンバーに呼びかけると 6 角形が見えます。",
    mid: "🪞 半数以上が振り返り完了。月次で更新する習慣を作るとトレンドが追えます。",
    good: "💗 振り返り率が高い。チームの自己認識が揃っています。",
    great: "🏆 全員が振り返りを保存。組織の理想形です。",
  },
  kpi: {
    none: "🎯 KPI を 1〜3 個セットしましょう。実行計画タブ右側の「定量 KPI」から追加できます。",
    early: "📊 KPI はセット済み、計測はこれから。進捗を 10% でも動かしてみましょう。",
    mid: "📈 KPI が動いてきました。停滞している指標があれば原因を 1 行で言語化を。",
    good: "🎯 KPI 達成が見えてきました。終盤に向け次の指標を準備すると伸び続けます。",
    great: "🏆 KPI を高水準で達成。次のステージの指標を設計するタイミングです。",
  },
};

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
      : clamp(planValues.reduce((a, b) => a + b, 0) / planValues.length);
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

  // ── 6. KPI 達成 (kpis.progress の平均)
  const kpiCount = snap.kpiProgressList.length;
  const kpiScore =
    kpiCount === 0
      ? 0
      : clamp(snap.kpiProgressList.reduce((a, b) => a + b, 0) / kpiCount);
  const kpiDetail =
    kpiCount === 0
      ? "KPI 未登録"
      : `${kpiCount} 件の KPI 平均達成率 ${kpiScore}%`;

  const dimensions: ProjectScoreDimension[] = [
    {
      key: "plan",
      emo: "✨",
      label: "計画の解像度",
      desc: "Why / Who / What / How の AI 採点平均",
      score: planScore,
      detail: planDetail,
      comment: COMMENTS.plan[tierFor(planScore)],
    },
    {
      key: "team",
      emo: "👥",
      label: "チーム構成",
      desc: "役職 / 責任 / 業務内容 の充足率",
      score: teamScore,
      detail: teamDetail,
      comment: COMMENTS.team[tierFor(teamScore)],
    },
    {
      key: "execution",
      emo: "🛠",
      label: "実行進捗",
      desc: "タスクとマイルストーンの完了率の平均",
      score: executionScore,
      detail: executionDetail,
      comment: COMMENTS.execution[tierFor(executionScore)],
    },
    {
      key: "engagement",
      emo: "🔥",
      label: "アクティビティ",
      desc: "連続稼働日数 (25 日で満点)",
      score: engagementScore,
      detail: engagementDetail,
      comment: COMMENTS.engagement[tierFor(engagementScore)],
    },
    {
      key: "retro",
      emo: "💗",
      label: "振り返り",
      desc: "チーム評価を保存したメンバー比率",
      score: retroScore,
      detail: retroDetail,
      comment: COMMENTS.retro[tierFor(retroScore)],
    },
    {
      key: "kpi",
      emo: "🎯",
      label: "KPI 達成",
      desc: "登録済み KPI の平均達成率",
      score: kpiScore,
      detail: kpiDetail,
      comment: COMMENTS.kpi[tierFor(kpiScore)],
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
