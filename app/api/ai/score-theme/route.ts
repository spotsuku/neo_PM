import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import {
  THEME_SCORE_ITEMS,
  THEME_SCORE_THRESHOLD,
  buildThemeScoreContents,
  parseThemeAiScores,
  roundTo5,
  type ThemeAiScores,
  type ThemeScoreKey,
} from "@/lib/themeScore";
import type { Database } from "@/lib/types/database";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `あなたは NEO テーマ出題の審査AIです。
企業が出題する「課題テーマ」の各項目を、応募者が自分ごと化して挑戦できる水準にあるかで採点します。

採点基準 (各項目共通 / 0〜100):
- 100 = 具体的で説得力があり、応募者が動ける状態
- 70  = 公開できる最低水準。要点が揃い、致命的な欠落がない
- 50  = 骨組みはあるが具体性・根拠が不足
- 20  = 抽象的 / 1行で表面的
- 0   = 未記入 / 内容が無い
重要: 点数は必ず 5 点刻み (0,5,10,...,100) で付けること。
特に WHAT(提供価値) がプロダクト説明になっていたら減点 (本来は『相手が得る変化』)。

対象項目 (item_key : 説明):
- title : 課題テーマタイトル。一目で挑戦内容が伝わるか。
- description_long : 課題テーマ概要。2〜4文で自分ごと化できるか。
- background : WHY(背景)。なぜ今このテーマが必要か。
- who_target : WHO(ターゲット)。誰の何を解決するかの具体像。
- pain : 問題。既存のやり方で解決できていない Pain。
- what_benefit : WHAT(提供価値)。相手が得る変化。プロダクト名ではない。
- expected_outcome : 期待される成果。地域や人への変化。
- what_uniqueness : 独自性。このテーマ・組織ならではの新しさ。
- internal_challenges : 実装上のリスク。起こりうる障害や社内の壁。
- resources : 提供できるリソース。応募者の意思決定の決め手。
- post_action : 採択後のアクション。採用後の次のステップ。

各項目に score(5点刻み) と、改善の次の一手を示す 1〜2 文の comment(日本語/です・ます調) を付けてください。
最後に全体の summary を 2〜3 文で。

応答は次の純粋な JSON のみ (コードフェンスや説明文なし):
{
  "items": {
    "title": { "score": <0-100>, "comment": "<1-2文>" },
    "description_long": { "score": <0-100>, "comment": "<1-2文>" },
    "background": { "score": <0-100>, "comment": "<1-2文>" },
    "who_target": { "score": <0-100>, "comment": "<1-2文>" },
    "pain": { "score": <0-100>, "comment": "<1-2文>" },
    "what_benefit": { "score": <0-100>, "comment": "<1-2文>" },
    "expected_outcome": { "score": <0-100>, "comment": "<1-2文>" },
    "what_uniqueness": { "score": <0-100>, "comment": "<1-2文>" },
    "internal_challenges": { "score": <0-100>, "comment": "<1-2文>" },
    "resources": { "score": <0-100>, "comment": "<1-2文>" },
    "post_action": { "score": <0-100>, "comment": "<1-2文>" }
  },
  "summary": "<2〜3文の総評>"
}`;

interface Body {
  themeId: string;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw);
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

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  if (!body.themeId) {
    return NextResponse.json({ error: "themeId は必須です" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { data: theme } = await supabase
    .from("themes")
    .select("*")
    .eq("id", body.themeId)
    .maybeSingle();
  if (!theme) {
    return NextResponse.json({ error: "テーマが見つかりません" }, { status: 404 });
  }

  // 採点できるのは出題者本人、または組織の owner/admin。
  const isPoster = theme.posted_by === user.id;
  if (!isPoster) {
    const { data: mem } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", theme.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (mem?.role !== "owner" && mem?.role !== "admin") {
      return NextResponse.json({ error: "採点権限がありません" }, { status: 403 });
    }
  }

  const contents = buildThemeScoreContents(theme);
  const userText = [
    "以下のテーマ出題の各項目を採点してください。点数は5点刻みで、純粋な JSON で返してください。",
    "",
    ...contents.map(
      (c) => `## ${c.label} (${c.key})\n${c.content || "（未記入）"}`,
    ),
  ].join("\n");

  const client = new Anthropic({ apiKey });
  let aiText: string;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
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

  const parsedRaw = extractJson(aiText);
  const parsed = parseThemeAiScores(parsedRaw);
  if (!parsed) {
    return NextResponse.json(
      { error: "AI 応答を解釈できませんでした。もう一度お試しください。" },
      { status: 502 },
    );
  }

  // 未記入項目は AI 判断に依らず 0 点に補正し、全項目が揃った状態にする。
  const items: Partial<Record<ThemeScoreKey, { score: number; comment: string }>> =
    {};
  for (const c of contents) {
    const item = parsed.items[c.key];
    if (!c.content) {
      items[c.key] = { score: 0, comment: item?.comment || "未記入です。" };
    } else {
      items[c.key] = {
        score: roundTo5(item?.score ?? 0),
        comment: item?.comment ?? "",
      };
    }
  }

  const now = new Date().toISOString();
  const aiScores: ThemeAiScores = {
    items,
    summary: parsed.summary,
    threshold: THEME_SCORE_THRESHOLD,
    scored_at: now,
  };

  // 書き込みは SERVICE_ROLE で実行 (審査中などで RLS の更新制限に当たらないように)。
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const writer =
    serviceKey && url
      ? createSupabaseClient<Database>(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : supabase;
  await writer
    .from("themes")
    .update({ ai_scores: aiScores, ai_scored_at: now } as never)
    .eq("id", theme.id);

  const below = THEME_SCORE_ITEMS.filter(
    (it) => (items[it.key]?.score ?? 0) < THEME_SCORE_THRESHOLD,
  );
  return NextResponse.json({
    ok: true,
    scores: aiScores,
    pass: below.length === 0,
    threshold: THEME_SCORE_THRESHOLD,
  });
}
