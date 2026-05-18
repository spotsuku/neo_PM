// 14 項目評価のマスター定義。handoff/prototype/data.jsx の NEO.radar を参照。
// 各項目は 0(×) / 1(△未満) / 2(△) / 3(○) の 4 値で評価される。

export const DIAG_ITEMS = [
  { key: "goal_setting", label: "目標設定", desc: "プロジェクトの Why と Goal を明確に言語化できているか" },
  { key: "strategy", label: "戦略力", desc: "課題から逆算した戦略を組み立てられているか" },
  { key: "execution", label: "実行力", desc: "意思決定 → 行動の速度と質" },
  { key: "leadership", label: "リーダーシップ", desc: "メンバーを巻き込み方向性を示せているか" },
  { key: "cocreation", label: "共創力", desc: "他者の力を借り、共に作る姿勢" },
  { key: "engagement", label: "巻き込み力", desc: "外部関係者を仲間にする力" },
  { key: "conflict", label: "衝突力", desc: "違う意見を率直に伝え、対話できる力" },
  { key: "field_first", label: "現場主義", desc: "現場・当事者と直接接触し続けているか" },
  { key: "hypothesis", label: "仮説力", desc: "明確で検証可能な仮説を立てられているか" },
  { key: "observation", label: "観察力", desc: "兆候や微細な変化に気付く力" },
  { key: "learning", label: "学習力", desc: "失敗・成功から学び次に活かす速度" },
  { key: "reflection", label: "振り返り", desc: "定期的な振り返りと改善のサイクル" },
  { key: "sustainability", label: "持続力", desc: "粘り強さ、習慣化、燃え尽き回避" },
  { key: "ethics", label: "倫理観", desc: "関わる相手への誠実さ、社会的責任の意識" },
] as const;

export type DiagKey = (typeof DIAG_ITEMS)[number]["key"];

export type DiagScores = Partial<Record<DiagKey, number>>;

export const MAX_PER_ITEM = 3;
export const MAX_TOTAL = DIAG_ITEMS.length * MAX_PER_ITEM; // 42

export function totalScore(scores: DiagScores): number {
  return DIAG_ITEMS.reduce((sum, it) => sum + (scores[it.key] ?? 0), 0);
}

export function tierLabel(total: number): { label: string; stars: 0 | 1 | 2 | 3 } {
  const pct = total / MAX_TOTAL;
  if (pct >= 0.75) return { label: "ベテラン伴走", stars: 3 };
  if (pct >= 0.5) return { label: "現場主義", stars: 2 };
  if (pct >= 0.25) return { label: "スターター", stars: 1 };
  return { label: "ファーストステップ", stars: 0 };
}

export function categorize(scores: DiagScores): {
  strong: number;
  caution: number;
  needsSupport: number;
} {
  let strong = 0;
  let caution = 0;
  let needsSupport = 0;
  for (const it of DIAG_ITEMS) {
    const v = scores[it.key] ?? 0;
    if (v >= 3) strong++;
    else if (v >= 2) caution++;
    else needsSupport++;
  }
  return { strong, caution, needsSupport };
}

export function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0(Sun) - 6(Sat)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
