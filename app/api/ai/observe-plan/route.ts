import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `あなたは AI PM の伴走者「NEO.ai」です。
ユーザーが実行計画 (Why / Who / What / How / 4P / 目標) を書いている途中です。

各項目の定義 (重要 / よく混同される):
- Why = なぜ取り組むのか。社会的意義・自分ごと化のストーリー。
- Who = 誰の・どんな状況。受益者・関係者の具体的な姿。
- What = 提供価値。顧客にどんな価値・変化・体験を届けるか。
       【プロダクト名やサービス名は What ではない】
- How = 実現方法。提供価値を届ける具体的な手段 (プロダクト / サービス /
       体験設計 / 実施方法 / スケジュール / 必要リソース)。

4P (マーケティングの 4P) の定義:
- Product = 提供する商品・サービスそのもの。何を売るか・中身/仕様。
- Price = 価格設定。いくらで・課金/料金モデル・根拠。
- Place = 提供チャネル・流通。どこで・どうやって届けるか。
- Promotion = 認知・販促。どう知ってもらい買ってもらうか。

タスク:
1. 各項目 (why, who, what, how) の現状を 0〜100 でスコアリング。
   - 100 = 具体的・矛盾なく・読者が動ける状態
   - 50  = 骨組みはあるが磨ける
   - 20  = 抽象的 / 1行で表面的
   - 0   = 未記入 / 内容が無い
   特に What がプロダクト説明になっていたら減点 (本来は『相手が得る変化』)。
2. 4P (product, price, place, promotion) も同じ基準で 0〜100 でスコアリング。
   - 未記入 / 内容が無い項目は 0。
3. 全体としての観察コメントを 3〜5 行で返す。
   - 良い点を1つ短く認め、磨くと尖るポイントを1〜2つ具体的に提案。
   - 「べき論」より「次の一手」。日本語、です・ます調。

応答は次の純粋な JSON のみで返してください（コードフェンスや説明文なし）:
{
  "scores": { "why": <int 0-100>, "who": <int 0-100>, "what": <int 0-100>, "how": <int 0-100>, "product": <int 0-100>, "price": <int 0-100>, "place": <int 0-100>, "promotion": <int 0-100> },
  "observation": "<3〜5行のコメント>"
}`;

interface Body {
  projectId: string;
}

interface AIResult {
  scores: {
    why: number;
    who: number;
    what: number;
    how: number;
    product: number;
    price: number;
    place: number;
    promotion: number;
  };
  observation: string;
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function parseAIJson(text: string): AIResult | null {
  // 万一コードフェンスが付いた場合は中身を抽出
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenced ? fenced[1] : text;
  try {
    const obj = JSON.parse(raw) as {
      scores?: Record<string, unknown>;
      observation?: string;
    };
    return {
      scores: {
        why: clampScore(obj.scores?.why),
        who: clampScore(obj.scores?.who),
        what: clampScore(obj.scores?.what),
        how: clampScore(obj.scores?.how),
        product: clampScore(obj.scores?.product),
        price: clampScore(obj.scores?.price),
        place: clampScore(obj.scores?.place),
        promotion: clampScore(obj.scores?.promotion),
      },
      observation:
        typeof obj.observation === "string" ? obj.observation : "",
    };
  } catch {
    return null;
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
      .select(
        "id, why, who, what, how, product, price, place, promotion, qualitative_goal",
      )
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
      scores: {
        why: 0,
        who: 0,
        what: 0,
        how: 0,
        product: 0,
        price: 0,
        place: 0,
        promotion: 0,
      },
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
  let aiText: string;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `以下の実行計画の現状を見てください。スコアと観察コメントを純粋な JSON で返してください。\n\n${planText}`,
        },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    aiText =
      textBlock && textBlock.type === "text" ? textBlock.text : "";
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `Anthropic API エラー: ${message}` },
      { status: 502 },
    );
  }

  const parsed = parseAIJson(aiText);
  if (!parsed) {
    // JSON が崩れた場合は本文をそのまま観察として返す（スコアは保存しない）
    return NextResponse.json({
      observation: aiText || "（応答を解釈できませんでした）",
      scores: null,
    });
  }

  // execution_plans に保存（失敗しても応答は返す）
  // 観察コメント / 採点 / 撮影時の値 (values_key) を全て永続化し、
  // 次の評価まで UI に維持できるようにする。
  const valuesKey = [
    plan.why,
    plan.who,
    plan.what,
    plan.how,
    plan.product,
    plan.price,
    plan.place,
    plan.promotion,
    plan.qualitative_goal,
  ]
    .map((v) => (v ?? "").trim())
    .join("");

  const observedAt = new Date().toISOString();
  await supabase
    .from("execution_plans")
    .update({
      scores: parsed.scores,
      last_observation: parsed.observation || "",
      last_observation_values_key: valuesKey,
      last_observed_at: observedAt,
    })
    .eq("id", plan.id);

  return NextResponse.json({
    observation: parsed.observation || "（コメントが空でした）",
    scores: parsed.scores,
    valuesKey,
    observedAt,
  });
}
