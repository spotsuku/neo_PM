import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `あなたは NEO PM の伴走者「NEO.ai」です。
プロジェクトの情報を読み、実行計画の Why / Who / What / How の下書きを生成します。

各項目の定義:
- Why = なぜ取り組むのか。社会的意義・自分ごと化のストーリー (2〜4 行)。
- Who = 誰の・どんな状況。受益者・関係者の具体的な姿 (2〜4 行)。
- What = 提供価値。相手が得る変化・体験 (プロダクト名ではない) (2〜4 行)。
- How = 実現方法。具体的な手段・段取り・必要リソース (2〜4 行)。

スタイル:
- 日本語、です・ます調。
- 「べき論」より「具体的なシーン」。
- 抽象語を避け、現場の言葉で。
- 与えられた既存値がある場合はそれを尊重・発展させる (上書きしない)。
- 与えられた既存値が空のキーだけ埋める。すべて空なら全部書く。

応答は次の純粋な JSON のみ。コードフェンスや解説は不要:
{
  "why": "...",
  "who": "...",
  "what": "...",
  "how": "...",
  "note": "下書きのねらいを 1 行で"
}`;

interface Body {
  projectId: string;
  /** true なら埋まっているフィールドも上書き提案として返す。
   *  false (デフォルト) なら空フィールドだけ返す。 */
  overwrite?: boolean;
}

interface AIResult {
  why: string;
  who: string;
  what: string;
  how: string;
  note: string;
}

function parseAIJson(text: string): AIResult | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenced ? fenced[1] : text;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const pick = (k: string) =>
      typeof obj[k] === "string" ? (obj[k] as string).trim() : "";
    return {
      why: pick("why"),
      who: pick("who"),
      what: pick("what"),
      how: pick("how"),
      note: pick("note"),
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 503 },
    );
  }

  const body = (await req.json()) as Body;
  if (!body.projectId) {
    return NextResponse.json(
      { error: "projectId は必須です" },
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

  const [{ data: project }, { data: plan }] = await Promise.all([
    supabase
      .from("projects")
      .select("name, team_name, idea_title, theme_id")
      .eq("id", body.projectId)
      .maybeSingle(),
    supabase
      .from("execution_plans")
      .select("id, why, who, what, how")
      .eq("project_id", body.projectId)
      .maybeSingle(),
  ]);
  if (!project) {
    return NextResponse.json(
      { error: "プロジェクトが見つかりません" },
      { status: 404 },
    );
  }

  // 紐付くテーマ (あれば) もコンテキストとして渡す
  let themeContext = "";
  if (project.theme_id) {
    const { data: theme } = await supabase
      .from("themes")
      .select("title, background, who_target, pain, what_uniqueness, what_benefit, expected_outcome")
      .eq("id", project.theme_id)
      .maybeSingle();
    if (theme) {
      themeContext = [
        `## 紐付くテーマ「${theme.title ?? ""}」`,
        theme.background ? `背景: ${theme.background}` : "",
        theme.who_target ? `ターゲット: ${theme.who_target}` : "",
        theme.pain ? `課題: ${theme.pain}` : "",
        theme.what_uniqueness ? `独自性: ${theme.what_uniqueness}` : "",
        theme.what_benefit ? `受益: ${theme.what_benefit}` : "",
        theme.expected_outcome ? `期待成果: ${theme.expected_outcome}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  const planContext = [
    `## プロジェクト`,
    `${project.name}${project.team_name ? `（チーム ${project.team_name}）` : ""}`,
    project.idea_title ? `アイデア: ${project.idea_title}` : "",
    "",
    `## 既存の実行計画`,
    `Why: ${plan?.why?.trim() || "（空）"}`,
    `Who: ${plan?.who?.trim() || "（空）"}`,
    `What: ${plan?.what?.trim() || "（空）"}`,
    `How: ${plan?.how?.trim() || "（空）"}`,
    themeContext ? "" : "",
    themeContext,
  ]
    .filter(Boolean)
    .join("\n");

  const client = new Anthropic({ apiKey });
  let aiText: string;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `次のプロジェクトの実行計画 (Why/Who/What/How) を下書きしてください。\n\n${planContext}`,
        },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    aiText = textBlock && textBlock.type === "text" ? textBlock.text : "";
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `Anthropic API エラー: ${message}` },
      { status: 502 },
    );
  }

  const parsed = parseAIJson(aiText);
  if (!parsed) {
    return NextResponse.json(
      { error: "AI 応答を解釈できませんでした", raw: aiText },
      { status: 502 },
    );
  }

  // 上書きしないモード (デフォルト): 既に値がある項目は空文字に潰す
  const overwrite = body.overwrite === true;
  const fields: Record<"why" | "who" | "what" | "how", string> = {
    why: parsed.why,
    who: parsed.who,
    what: parsed.what,
    how: parsed.how,
  };
  if (!overwrite && plan) {
    if (plan.why?.trim()) fields.why = "";
    if (plan.who?.trim()) fields.who = "";
    if (plan.what?.trim()) fields.what = "";
    if (plan.how?.trim()) fields.how = "";
  }

  // 全部空になってしまったら overwrite を強制
  const anyFilled = Object.values(fields).some((v) => v.trim());
  if (!anyFilled) {
    return NextResponse.json({
      fields: {
        why: parsed.why,
        who: parsed.who,
        what: parsed.what,
        how: parsed.how,
      },
      note: parsed.note,
      overwriteRequired: true,
    });
  }

  return NextResponse.json({
    fields,
    note: parsed.note,
    overwriteRequired: false,
  });
}
