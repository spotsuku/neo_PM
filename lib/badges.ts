/** プロジェクト立ち上げの 10 ステップに対応する個別バッジ + 立ち上げ完了の master。
 *  LaunchReadinessCard が条件評価して獲得可能なバッジを判定し、🚀 立ち上げ時に
 *  projects.badges に全部書き出す。 */

export type BadgeGlyph =
  | "users"
  | "mic"
  | "heart-pulse"
  | "link"
  | "yen"
  | "trophy"
  | "spark";

export interface BadgeDef {
  id: string;
  /** 立ち上げチェックリストの順序 (1〜10)、master は null */
  step: number | null;
  name: string;
  desc: string;
  glyph: BadgeGlyph;
}

export const PROJECT_LAUNCHED_BADGE = "project_launched";

/** 10 ステップ + 1 master の計 11 バッジ。表示順 (UI の左→右、上→下) に並べる。 */
export const BADGES: BadgeDef[] = [
  {
    id: "kickoff_done",
    step: 1,
    name: "キックオフ",
    desc: "最初の MTG が記録された",
    glyph: "mic",
  },
  {
    id: "team_formed",
    step: 2,
    name: "チーム完成",
    desc: "3名以上・役割/責任/業務・予算決裁者が揃った",
    glyph: "users",
  },
  {
    id: "recurring_meeting",
    step: 3,
    name: "定例会議設定",
    desc: "定例ルール (毎週 / 隔週 / 毎月) が登録された",
    glyph: "mic",
  },
  {
    id: "goals_set",
    step: 4,
    name: "目標設定",
    desc: "定性目標 + KPI が 1 件以上",
    glyph: "trophy",
  },
  {
    id: "why_polished",
    step: 5,
    name: "Why が磨かれた",
    desc: "Why/Who/What/How がすべて 70 点以上",
    glyph: "spark",
  },
  {
    id: "fourp_filled",
    step: 6,
    name: "4P 完成",
    desc: "Product / Price / Place / Promotion が全て 70 点以上",
    glyph: "link",
  },
  {
    id: "first_retro",
    step: 7,
    name: "初回振り返り",
    desc: "全員がチーム評価の振り返りを 1 回保存した",
    glyph: "heart-pulse",
  },
  {
    id: "milestones_set",
    step: 8,
    name: "マイルストーン設計",
    desc: "マイルストーン 5 件以上が登録された",
    glyph: "trophy",
  },
  {
    id: "wbs_set",
    step: 9,
    name: "WBS 完成",
    desc: "WBS タスク 10 件以上が登録された",
    glyph: "trophy",
  },
  {
    id: "budget_set",
    step: 10,
    name: "収支計画",
    desc: "半年分 (6 ヶ月) の収支計画が作成された",
    glyph: "yen",
  },
  {
    id: PROJECT_LAUNCHED_BADGE,
    step: null,
    name: "立ち上げ完了",
    desc: "10 ステップ全部クリアし正式に始動した",
    glyph: "trophy",
  },
];

export const BADGE_BY_ID: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((b) => [b.id, b]),
);
