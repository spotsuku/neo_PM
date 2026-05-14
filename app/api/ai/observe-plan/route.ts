import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `あなたは NEO PM の伴走者「NEO.ai」です。
ユーザーが実行計画 (Why / Who / What / How / 4P / 目標) を書いている途中なので、現状を読んで「次の一手」となる短いコメントを返してください。

スタイル:
- 全部で 3〜5行、長くしすぎない。
- 良い点を1つだけ短く認め、もっと磨くと尖るポイントを1〜2つ具体的に提案。
- 「べき論」より「次の一手」。1段細かくする / もう1人の声を入れる など。
- 質問は1度に1つだけ。
- 日本語、です・ます調。`;

interface Body {
  projectId: string;
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
      .select("name, team_name, idea_title")
      .eq("id", body.projectId)
      .maybeSingle(),
    supabase
      .from("execution_plans")
      .select("why, who, what, how, product, price, place, promotion, qualitative_goal")
      .eq("project_id", body.projectId)
      .maybeSingle(),
  ]);

  if (!project) {
    return NextResponse.json(
      { error: "プロジェクトが見つかりません" },
      { status: 404 },
    );
  }
  if (!plan) {
    return NextResponse.json(
      { error: "実行計画が見つかりません" },
      { status: 404 },
    );
  }

  const empty = (s: string | null | undefined) => !s || s.trim() === "";
  const allEmpty =
    empty(plan.why) &&
    empty(plan.who) &&
    empty(plan.what) &&
    empty(plan.how) &&
    empty(plan.product) &&
    empty(plan.price) &&
    empty(plan.place) &&
    empty(plan.promotion) &&
    empty(plan.qualitative_goal);

  if (allEmpty) {
    return NextResponse.json({
      observation:
        "まだ何も書かれていません。まずは Why の1行から始めましょう。「誰の、何を、なぜ今」を書くと一気に解像度が上がります。",
    });
  }

  const planText = [
    `## プロジェクト`,
    `${project.name}${project.team_name ? `（チーム ${project.team_name}）` : ""}`,
    project.idea_title ? `アイデア: ${project.idea_title}` : "",
    "",
    `## 実行計画`,
    `Why: ${plan.why || "（未記入）"}`,
    `Who: ${plan.who || "（未記入）"}`,
    `What: ${plan.what || "（未記入）"}`,
    `How: ${plan.how || "（未記入）"}`,
    "",
    `## 4P`,
    `Product: ${plan.product || "（未記入）"}`,
    `Price: ${plan.price || "（未記入）"}`,
    `Place: ${plan.place || "（未記入）"}`,
    `Promotion: ${plan.promotion || "（未記入）"}`,
    "",
    `## 目標`,
    `定性的なゴール: ${plan.qualitative_goal || "（未記入）"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const client = new Anthropic({ apiKey });
  let observation: string;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `以下の実行計画の現状を見て、観察コメントを返してください。\n\n${planText}`,
        },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    observation =
      textBlock && textBlock.type === "text"
        ? textBlock.text
        : "（応答を取得できませんでした）";
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `Anthropic API エラー: ${message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ observation });
}
