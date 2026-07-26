import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";
import {
  extractTokens,
  getUsageStatus,
  recordUsage,
} from "@/lib/ai/usage";

type Proposal = Database["public"]["Tables"]["proposals"]["Row"];

export const runtime = "nodejs";

const SYSTEM_PROMPT = `あなたは AI PM の伴走者「NEO.ai」です。応援資本主義のもとで地域プロジェクトを進める若者チームの相棒として振る舞います。

【最重要】あなたはこの AI PM アプリの中で動いており、返答の中にコードフェンス
(neo:plan / neo:wbs / neo:promo / neo:budget) を含めると、
右側の「提案カード」に反映され、ユーザーが 1 クリックで
実行計画 / WBS / 収支計画 に登録できます。
ユーザーが「WBS」「タスク」「段取り」「スケジュール」等について聞いてきたら、
Notion / Excel / Zapier などの外部ツールの話をせず、
必ず このアプリの WBS 提案 (neo:wbs コードフェンス) を返してください。
「機能はありますか」と聞かれたら「はい、私が今この場で下書きします」と答えて
即座に neo:wbs ブロックを出してください。
同様に「実行計画」「Why/Who/What/How」「4P」「収支」「広報」「SNS」も
アプリ内の対応する提案カード形式で返してください。

スタイル:
- 短く、温かく、具体的に。
- 「べき論」より「次の一手」を示す。
- 質問は1度に1つだけ。
- 必要なら箇条書きを使う。
- 日本語で答える。

実行計画の項目定義（よく混同される）:
- Why = なぜ取り組むのか。社会的意義・自分ごと化のストーリー。
- Who = 誰の・どんな状況。受益者・関係者の具体的な姿。
- What = 提供価値。相手が得る変化・体験 (プロダクト名ではない)。
- How = 実現方法。具体的な手段・段取り・必要リソース。

マーケティング 4P の項目定義:
- Product = 何を提供するか。プロダクト/サービスの機能・特徴。
- Price = 価格戦略・単価・課金モデル。
- Place = 提供チャネル・接点・流通経路。
- Promotion = 認知・獲得の方法。マーケティング施策。

【重要】ユーザーが Why / Who / What / How や 4P (Product / Price / Place / Promotion) の話をしたら
(質問形式「作れますか」でも指示形式「作って」でも同じ扱い)、
返答の最後に必ず次の形式のコードフェンスで提案を出してください。
外部ツール (Notion / ドキュメント作成ツール等) の解説はしないこと。

\`\`\`neo:plan
{
  "summary": "ユーザー向け 1 行サマリー (例: 「Why と Who の下書きを提案します」)",
  "reasoning": "なぜこの内容を提案するのか 1〜2 行",
  "fields": {
    "why":  "本文 (なければキー自体省略)",
    "who":  "本文",
    "what": "本文",
    "how":  "本文",
    "product":   "本文",
    "price":     "本文",
    "place":     "本文",
    "promotion": "本文"
  }
}
\`\`\`

【重要】ユーザーが 広報・SNS・キャッチコピー・PR文 の話をしたら
(質問形式でも指示形式でも同じ扱い)、次の形式で複数の下書きを必ず提案してください。
「どこに投稿すればいいですか」「投稿文を考えて」等でも同じ。

\`\`\`neo:promo
{
  "summary": "SNS 用の広報テキスト 3 案を提案します",
  "reasoning": "誰にどう届けたいか 1〜2 行",
  "title_ideas": ["キャッチコピー案 1", "キャッチコピー案 2"],
  "posts": [
    { "channel": "x", "body": "X (旧 Twitter) 向け 140 字以内の投稿文", "hashtags": ["#タグ1", "#タグ2"] },
    { "channel": "instagram", "body": "Instagram 向け 3〜5 行の投稿文", "hashtags": ["#タグ1"] },
    { "channel": "blog", "body": "ブログ導入 1 段落", "hashtags": [] }
  ]
}
\`\`\`

【重要】ユーザーが WBS・タスク・段取り・スケジュール の話をしたら
(質問形式「機能はありますか」でも、指示形式「作って」でも同じ扱い)、
5〜10 件程度のタスクを次の形式で必ず提案してください。
外部ツール (Notion / Excel / Google Sheets 等) の解説はしないこと。

\`\`\`neo:wbs
{
  "summary": "WBS の下書きを提案します",
  "reasoning": "なぜこの順番/粒度か 1〜2 行",
  "tasks": [
    { "title": "アイデア深堀り会議", "owner_name": "誰でも可", "start_week": 1, "span_week": 1, "tag": "リサーチ", "is_milestone": false },
    { "title": "PoC 準備完了", "start_week": 4, "span_week": 0, "is_milestone": true }
  ]
}
\`\`\`

WBS ルール:
- title 必須、owner_name / start_week / span_week / tag は任意。
- start_week は 1 起点の週数、span_week は継続週。マイルストーンは span_week=0。
- 現状のタスク (文脈に与えられる) と title が重複しない、抜けているものだけ提案する。
- 実行計画の Why/Who/What/How と How の段取りを踏まえて、時系列に並べる。
- タスクは動詞始まりの具体的な行動 (例:「顧客ヒアリング設計」「PoC テスト実施」)。

【重要】ユーザーが 収支計画・損益・単価・原価・固定費・売上・売価・予算 の話をしたら
(質問形式「収支計画も作れますか」でも指示形式「収支を作って」でも同じ扱い)、
月次PL の各行 (収入 / 売上原価 / 販管費 / 販売外費用) を返答の最後に必ず次の形式で提案してください。
外部ツール (Excel / スプレッドシート等) の解説はしないこと。

\`\`\`neo:budget
{
  "summary": "収支計画の下書きを提案します",
  "reasoning": "なぜこの構成か 1〜2 行",
  "items": [
    { "kind": "income", "category": "販売",   "name": "見学プラン",   "monthly_amounts": { "7": 30000, "8": 60000, "9": 90000 } },
    { "kind": "cogs",   "category": "仕入",   "name": "原価",         "monthly_amounts": { "7": 12000, "8": 24000, "9": 36000 } },
    { "kind": "sga",    "category": "人件費", "name": "アルバイト",   "monthly_amounts": { "7": 100000, "8": 100000, "9": 100000 } },
    { "kind": "sga",    "category": "販促",   "name": "SNS 広告",     "monthly_amounts": { "7": 20000, "8": 20000, "9": 20000 } }
  ]
}
\`\`\`

収支ルール:
- kind は必ず income (収入) / cogs (売上原価) / sga (販管費) / expense (販売外費用) のいずれか。
- monthly_amounts のキーは月番号 (1〜12) を string で、値は 円単位の数値 (int)。金額 0 の月はキー省略可。
- category は自由記述 (例: 販売 / 補助金 / 人件費 / 広報 / 家賃 / 什器)。
- 現状の 4P や Why/Who/What/How の内容と整合するように単価・数量を推定する。
- 販売開始前の月は 収入 0 のまま、固定費だけ入れる。金額は 現実的な値 (千円〜十万円単位) にする。

ルール:
- fields / items 等は更新したいキーだけ。不要ならキーごと省略。
- 提案する場合は本文中にも 1〜2 行で「◯◯を下書きしてみました。提案カードから反映してください」と触れること。
- 情報が足りない場合はブロックを出さず、追加質問だけしてください。
- 1 つの応答に neo:plan / neo:wbs / neo:promo / neo:budget は最大 1 つずつ、応答の最後にまとめて。

【厳守】あなた自身はデータを反映できません。データベースへの反映は、
ユーザーが右側の提案カードの「✓ 承認」ボタンを押した時にだけ行われます。
- 「反映しました」「反映されました」「登録しました」「保存しました」等、
  実行が完了したかのような発言は絶対にしないでください。
- ユーザーが「反映して」「登録して」等と言ったら、
  「右側の提案カードの『✓ 承認』ボタンを押してください」と案内するだけにしてください。
- 反映先が実行計画なのに WBS と書く、収支なのに WBS と書く等、
  反映先を取り違えた発言も禁止です。反映先は次の対応関係のみ:
  - neo:plan (Why/Who/What/How, 4P) → 実行計画ページ
  - neo:wbs → WBS ページ (tasks テーブル)
  - neo:budget → 収支ページ (月次PL grid)
  - neo:promo → コピペ用 (どこにも書き込まれない、ユーザーが自分で貼る)

プロジェクトの文脈が文末に与えられます。それを踏まえて返答してください。`;

interface Body {
  projectId: string;
  message: string;
}

type PlanFieldKey =
  | "why"
  | "who"
  | "what"
  | "how"
  | "product"
  | "price"
  | "place"
  | "promotion";

interface ParsedPlanProposal {
  summary: string;
  reasoning: string | null;
  fields: Partial<Record<PlanFieldKey, string>>;
  /** 主に 4P だけ提案されている場合は "marketing"、それ以外は "execution_plan" */
  kind: "execution_plan" | "marketing";
}

interface ParsedBudgetItem {
  kind: "income" | "cogs" | "sga" | "expense";
  category: string | null;
  name: string;
  monthly_amounts: Record<string, number>;
}

interface ParsedBudgetProposal {
  summary: string;
  reasoning: string | null;
  data: { items: ParsedBudgetItem[] };
}

interface ParsedWbsTask {
  title: string;
  owner_name?: string;
  start_week?: number;
  span_week?: number;
  tag?: string;
  is_milestone?: boolean;
}

interface ParsedWbsProposal {
  summary: string;
  reasoning: string | null;
  data: { tasks: ParsedWbsTask[] };
}

interface ParsedPromoPost {
  channel: string;
  body: string;
  hashtags: string[];
}
interface ParsedPromoProposal {
  summary: string;
  reasoning: string | null;
  data: {
    title_ideas: string[];
    posts: ParsedPromoPost[];
  };
}

const PLAN_KEYS: PlanFieldKey[] = [
  "why",
  "who",
  "what",
  "how",
  "product",
  "price",
  "place",
  "promotion",
];
const P_MARKETING_KEYS = new Set<PlanFieldKey>([
  "product",
  "price",
  "place",
  "promotion",
]);

/** assistant 応答末尾の ```neo:plan ... ``` ブロックを抽出して JSON にし、
 *  本文からは除去したテキストを返す。 */
function extractPlanProposal(text: string): {
  cleaned: string;
  proposal: ParsedPlanProposal | null;
} {
  const match = text.match(/```neo:plan\s*([\s\S]*?)\s*```/);
  if (!match) return { cleaned: text, proposal: null };
  const raw = match[1];
  const cleaned = text.replace(match[0], "").trim();
  try {
    const obj = JSON.parse(raw) as {
      summary?: string;
      reasoning?: string;
      fields?: Record<string, unknown>;
    };
    const fields: ParsedPlanProposal["fields"] = {};
    for (const k of PLAN_KEYS) {
      const v = obj.fields?.[k];
      if (typeof v === "string" && v.trim()) fields[k] = v.trim();
    }
    if (Object.keys(fields).length === 0) {
      return { cleaned, proposal: null };
    }
    // 4P だけ (marketing) か Why/Who/What/How を含む (execution_plan) か
    const has4POnly = Object.keys(fields).every((k) =>
      P_MARKETING_KEYS.has(k as PlanFieldKey),
    );
    const kind = has4POnly ? "marketing" : "execution_plan";
    return {
      cleaned,
      proposal: {
        summary:
          typeof obj.summary === "string" && obj.summary.trim()
            ? obj.summary.trim()
            : kind === "marketing"
              ? "マーケティング 4P の下書きを提案します"
              : "実行計画の下書きを提案します",
        reasoning:
          typeof obj.reasoning === "string" && obj.reasoning.trim()
            ? obj.reasoning.trim()
            : null,
        fields,
        kind,
      },
    };
  } catch {
    return { cleaned: text, proposal: null };
  }
}

/** assistant 応答末尾の ```neo:wbs ... ``` ブロックを抽出して JSON にし、
 *  本文からは除去したテキストを返す。 */
function extractWbsProposal(text: string): {
  cleaned: string;
  proposal: ParsedWbsProposal | null;
} {
  const match = text.match(/```neo:wbs\s*([\s\S]*?)\s*```/);
  if (!match) return { cleaned: text, proposal: null };
  const raw = match[1];
  const cleaned = text.replace(match[0], "").trim();
  try {
    const obj = JSON.parse(raw) as {
      summary?: string;
      reasoning?: string;
      tasks?: unknown[];
    };
    if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) {
      return { cleaned, proposal: null };
    }
    const tasks: ParsedWbsTask[] = [];
    for (const t of obj.tasks) {
      if (!t || typeof t !== "object" || Array.isArray(t)) continue;
      const r = t as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title.trim() : "";
      if (!title) continue;
      const task: ParsedWbsTask = { title };
      if (typeof r.owner_name === "string" && r.owner_name.trim()) {
        task.owner_name = r.owner_name.trim();
      }
      if (typeof r.start_week === "number" && Number.isFinite(r.start_week)) {
        task.start_week = Math.max(1, Math.round(r.start_week));
      }
      if (typeof r.span_week === "number" && Number.isFinite(r.span_week)) {
        task.span_week = Math.max(0, Math.round(r.span_week));
      }
      if (typeof r.tag === "string" && r.tag.trim()) {
        task.tag = r.tag.trim();
      }
      if (typeof r.is_milestone === "boolean") {
        task.is_milestone = r.is_milestone;
      }
      tasks.push(task);
    }
    if (tasks.length === 0) return { cleaned, proposal: null };
    return {
      cleaned,
      proposal: {
        summary:
          typeof obj.summary === "string" && obj.summary.trim()
            ? obj.summary.trim()
            : "WBS の下書きを提案します",
        reasoning:
          typeof obj.reasoning === "string" && obj.reasoning.trim()
            ? obj.reasoning.trim()
            : null,
        data: { tasks },
      },
    };
  } catch {
    return { cleaned: text, proposal: null };
  }
}

/** assistant 応答末尾の ```neo:promo ... ``` ブロックを抽出。 */
function extractPromoProposal(text: string): {
  cleaned: string;
  proposal: ParsedPromoProposal | null;
} {
  const match = text.match(/```neo:promo\s*([\s\S]*?)\s*```/);
  if (!match) return { cleaned: text, proposal: null };
  const raw = match[1];
  const cleaned = text.replace(match[0], "").trim();
  try {
    const obj = JSON.parse(raw) as {
      summary?: string;
      reasoning?: string;
      title_ideas?: unknown[];
      posts?: unknown[];
    };
    const title_ideas: string[] = Array.isArray(obj.title_ideas)
      ? obj.title_ideas.filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0,
        )
      : [];
    const posts: ParsedPromoPost[] = [];
    if (Array.isArray(obj.posts)) {
      for (const p of obj.posts) {
        if (!p || typeof p !== "object" || Array.isArray(p)) continue;
        const r = p as Record<string, unknown>;
        const channel =
          typeof r.channel === "string" && r.channel.trim()
            ? r.channel.trim()
            : "";
        const body =
          typeof r.body === "string" && r.body.trim() ? r.body.trim() : "";
        if (!channel || !body) continue;
        const hashtags: string[] = Array.isArray(r.hashtags)
          ? r.hashtags.filter(
              (v): v is string => typeof v === "string" && v.trim().length > 0,
            )
          : [];
        posts.push({ channel, body, hashtags });
      }
    }
    if (title_ideas.length === 0 && posts.length === 0) {
      return { cleaned, proposal: null };
    }
    return {
      cleaned,
      proposal: {
        summary:
          typeof obj.summary === "string" && obj.summary.trim()
            ? obj.summary.trim()
            : "広報テキストの下書きを提案します",
        reasoning:
          typeof obj.reasoning === "string" && obj.reasoning.trim()
            ? obj.reasoning.trim()
            : null,
        data: { title_ideas, posts },
      },
    };
  } catch {
    return { cleaned: text, proposal: null };
  }
}

/** assistant 応答末尾の ```neo:budget ... ``` ブロックを抽出して JSON にし、
 *  本文からは除去したテキストを返す。 */
function extractBudgetProposal(text: string): {
  cleaned: string;
  proposal: ParsedBudgetProposal | null;
} {
  const match = text.match(/```neo:budget\s*([\s\S]*?)\s*```/);
  if (!match) return { cleaned: text, proposal: null };
  const raw = match[1];
  const cleaned = text.replace(match[0], "").trim();
  try {
    const obj = JSON.parse(raw) as {
      summary?: string;
      reasoning?: string;
      items?: unknown[];
    };
    if (!Array.isArray(obj.items) || obj.items.length === 0) {
      return { cleaned, proposal: null };
    }
    const items: ParsedBudgetItem[] = [];
    for (const it of obj.items) {
      if (!it || typeof it !== "object" || Array.isArray(it)) continue;
      const r = it as Record<string, unknown>;
      const rawKind = typeof r.kind === "string" ? r.kind.trim() : "";
      if (!["income", "cogs", "sga", "expense"].includes(rawKind)) continue;
      const kind = rawKind as ParsedBudgetItem["kind"];
      const name =
        typeof r.name === "string" && r.name.trim() ? r.name.trim() : "";
      if (!name) continue;
      const category =
        typeof r.category === "string" && r.category.trim()
          ? r.category.trim()
          : null;
      const monthly_amounts: Record<string, number> = {};
      const ma = r.monthly_amounts;
      if (ma && typeof ma === "object" && !Array.isArray(ma)) {
        for (const [k, v] of Object.entries(ma)) {
          const mnum = Number.parseInt(k, 10);
          if (!Number.isFinite(mnum) || mnum < 1 || mnum > 12) continue;
          const amt = typeof v === "number" ? v : Number(v);
          if (!Number.isFinite(amt) || amt === 0) continue;
          monthly_amounts[String(mnum)] = Math.round(amt);
        }
      }
      if (Object.keys(monthly_amounts).length === 0) continue;
      items.push({ kind, category, name, monthly_amounts });
    }
    if (items.length === 0) return { cleaned, proposal: null };
    return {
      cleaned,
      proposal: {
        summary:
          typeof obj.summary === "string" && obj.summary.trim()
            ? obj.summary.trim()
            : "収支計画の下書きを提案します",
        reasoning:
          typeof obj.reasoning === "string" && obj.reasoning.trim()
            ? obj.reasoning.trim()
            : null,
        data: { items },
      },
    };
  } catch {
    return { cleaned: text, proposal: null };
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY が設定されていません。Vercel の Environment Variables で追加してください。",
      },
      { status: 503 },
    );
  }

  const body = (await req.json()) as Body;
  if (!body.projectId || !body.message?.trim()) {
    return NextResponse.json(
      { error: "projectId と message は必須です" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  // プロジェクト + 実行計画 + 直近タスク + 収支 を軽くロード（RLS 経由でアクセス権チェック）
  const [
    { data: project },
    { data: plan },
    { data: budgetItems },
    { data: tasks },
    { data: history },
  ] = await Promise.all([
      supabase
        .from("projects")
        .select("name, team_name, idea_title, progress_pct, streak_days, organization_id")
        .eq("id", body.projectId)
        .maybeSingle(),
      supabase
        .from("execution_plans")
        .select(
          "why, who, what, how, product, price, place, promotion, qualitative_goal",
        )
        .eq("project_id", body.projectId)
        .maybeSingle(),
      supabase
        .from("budget_items")
        .select("kind, category, name, monthly_amounts, plan_jpy")
        .eq("project_id", body.projectId),
      supabase
        .from("tasks")
        .select("title, status, owner_name")
        .eq("project_id", body.projectId)
        .neq("status", "done")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("chat_messages")
        .select("role, content")
        .eq("project_id", body.projectId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (!project) {
    return NextResponse.json(
      { error: "プロジェクトが見つかりません" },
      { status: 404 },
    );
  }

  // ── AI 使用量 上限チェック (¥1000/プロジェクト/月) ──
  const usage = await getUsageStatus(body.projectId);
  if (usage.blocked) {
    return NextResponse.json(
      {
        error: `このプロジェクトの今月の AI 使用額 (¥${Math.round(usage.usedYen)}) が上限 ¥${usage.limitYen} に達しました。翌月 1 日にリセットされます。`,
        usage,
      },
      { status: 429 },
    );
  }

  // 収支計画 (budget_items) の概要を軽く要約
  const budgetLines: string[] = [];
  const KIND_LABEL: Record<string, string> = {
    income: "収入",
    cogs: "売上原価",
    sga: "販管費",
    expense: "販売外費用",
  };
  const byKind: Record<string, string[]> = {};
  for (const bi of (budgetItems ?? []) as Array<{
    kind: string;
    category: string | null;
    name: string;
  }>) {
    const label = KIND_LABEL[bi.kind] ?? bi.kind;
    (byKind[label] ??= []).push(
      `${bi.name}${bi.category ? ` (${bi.category})` : ""}`,
    );
  }
  for (const [label, names] of Object.entries(byKind)) {
    budgetLines.push(`${label}: ${names.join(" / ")}`);
  }

  const contextSummary = [
    `## プロジェクト`,
    `${project.name}${project.team_name ? `（チーム ${project.team_name}）` : ""}`,
    project.idea_title ? `アイデア: ${project.idea_title}` : "",
    `進捗 ${project.progress_pct}%、連続 ${project.streak_days} 日`,
    "",
    `## 実行計画`,
    `Why: ${plan?.why || "（未記入）"}`,
    `Who: ${plan?.who || "（未記入）"}`,
    `What: ${plan?.what || "（未記入）"}`,
    `How: ${plan?.how || "（未記入）"}`,
    "",
    `## マーケティング 4P`,
    `Product: ${plan?.product || "（未記入）"}`,
    `Price: ${plan?.price || "（未記入）"}`,
    `Place: ${plan?.place || "（未記入）"}`,
    `Promotion: ${plan?.promotion || "（未記入）"}`,
    "",
    `## 収支計画`,
    budgetLines.length > 0 ? budgetLines.join("\n") : "（未記入）",
    "",
    `## 進行中タスク`,
    ...(tasks?.map((t) => `- [${t.status}] ${t.title}${t.owner_name ? ` (${t.owner_name})` : ""}`) ?? []),
  ]
    .filter(Boolean)
    .join("\n");

  // 直近の会話（古い→新しい）
  const prior = (history ?? []).reverse();
  const messages: Anthropic.MessageParam[] = prior
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
    }));

  messages.push({
    role: "user",
    content: `${body.message.trim()}\n\n---\n${contextSummary}`,
  });

  const client = new Anthropic({ apiKey });
  let assistantText: string;
  const model = "claude-haiku-4-5-20251001";
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages,
    });
    const textBlock = response.content.find((b) => b.type === "text");
    assistantText =
      textBlock && textBlock.type === "text"
        ? textBlock.text
        : "（応答を取得できませんでした）";
    // 使用量計上 (失敗しても本処理は継続)
    const tokens = extractTokens(response);
    await recordUsage({
      projectId: body.projectId,
      organizationId: project.organization_id,
      userId: user.id,
      endpoint: "chat",
      model,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
    }).catch(() => null);
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `Anthropic API エラー: ${message}` },
      { status: 502 },
    );
  }

  // neo:plan / neo:wbs / neo:promo / neo:budget ブロックを順に抽出して本文から除去
  const planExtract = extractPlanProposal(assistantText);
  const wbsExtract = extractWbsProposal(planExtract.cleaned);
  const promoExtract = extractPromoProposal(wbsExtract.cleaned);
  const budgetExtract = extractBudgetProposal(promoExtract.cleaned);
  const cleaned = budgetExtract.cleaned;

  // メッセージ2件保存（ユーザー→AI）
  const { error: insertErr } = await supabase.from("chat_messages").insert([
    {
      project_id: body.projectId,
      role: "user",
      content: body.message.trim(),
    },
    {
      project_id: body.projectId,
      role: "assistant",
      content: cleaned || assistantText,
      raw_content: assistantText !== cleaned ? assistantText : null,
    },
  ]);
  if (insertErr) {
    return NextResponse.json(
      { error: `保存に失敗しました: ${insertErr.message}` },
      { status: 500 },
    );
  }

  // 提案カードを作成 (あれば) - plan と budget の両方に対応
  const savedProposals: Proposal[] = [];
  if (planExtract.proposal) {
    const { data: prop, error: propErr } = await supabase
      .from("proposals")
      .insert({
        project_id: body.projectId,
        kind: planExtract.proposal.kind,
        summary: planExtract.proposal.summary,
        reasoning: planExtract.proposal.reasoning,
        diff: planExtract.proposal.fields as never,
        status: "pending",
      } as never)
      .select()
      .single();
    if (propErr) {
      console.error("plan proposal insert failed:", propErr.message);
    } else if (prop) {
      savedProposals.push(prop);
    }
  }
  if (wbsExtract.proposal) {
    const { data: prop, error: propErr } = await supabase
      .from("proposals")
      .insert({
        project_id: body.projectId,
        kind: "wbs",
        summary: wbsExtract.proposal.summary,
        reasoning: wbsExtract.proposal.reasoning,
        diff: wbsExtract.proposal.data as never,
        status: "pending",
      } as never)
      .select()
      .single();
    if (propErr) {
      console.error("wbs proposal insert failed:", propErr.message);
    } else if (prop) {
      savedProposals.push(prop);
    }
  }
  if (promoExtract.proposal) {
    const { data: prop, error: propErr } = await supabase
      .from("proposals")
      .insert({
        project_id: body.projectId,
        kind: "promo",
        summary: promoExtract.proposal.summary,
        reasoning: promoExtract.proposal.reasoning,
        diff: promoExtract.proposal.data as never,
        status: "pending",
      } as never)
      .select()
      .single();
    if (propErr) {
      console.error("promo proposal insert failed:", propErr.message);
    } else if (prop) {
      savedProposals.push(prop);
    }
  }
  if (budgetExtract.proposal) {
    const { data: prop, error: propErr } = await supabase
      .from("proposals")
      .insert({
        project_id: body.projectId,
        kind: "budget",
        summary: budgetExtract.proposal.summary,
        reasoning: budgetExtract.proposal.reasoning,
        diff: budgetExtract.proposal.data as never,
        status: "pending",
      } as never)
      .select()
      .single();
    if (propErr) {
      console.error("budget proposal insert failed:", propErr.message);
    } else if (prop) {
      savedProposals.push(prop);
    }
  }

  return NextResponse.json({
    reply: cleaned || assistantText,
    // 後方互換: 単数 proposal は plan があればそれ、無ければ budget
    proposal: savedProposals[0] ?? null,
    proposals: savedProposals,
  });
}
