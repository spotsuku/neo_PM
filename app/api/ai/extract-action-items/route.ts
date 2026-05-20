import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface Body {
  meetingId: string;
  agenda?: string;
  minutes: string;
  decisions?: string;
  orgMembers?: (string | null)[];
}

interface Suggestion {
  title: string;
  detail?: string;
  assignee_hint?: string;
  due_hint?: string;
}

const SYSTEM_PROMPT = `あなたは AI PM の会議分析アシスタントです。日本語の議事録から「Action Items（誰が・何を・いつまでに）」を抽出するのが仕事です。

ルール:
- 議事録に明示されている内容だけを抽出。推測しない。
- 1 Action Item につき 1 つの動作。
- 担当が明示されていればその人名（assignee_hint）を入れる。「未定」「全員」等は assignee_hint を空に。
- 期日が明示されていれば、可能なら YYYY-MM-DD 形式で due_hint に入れる。「来週」「月末」のような相対表現はそのまま文字列で入れる。
- 出力は JSON 配列のみ。前置き・後置きの文章は禁止。
- 最大 10 件まで。

出力フォーマット:
[
  {
    "title": "現場テストの段取りを完了",
    "detail": "学校との調整 + 当日の流れの確定",
    "assignee_hint": "高橋",
    "due_hint": "2026-05-22"
  }
]`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY が未設定です。Vercel の Environment Variables で追加してください。",
      },
      { status: 503 },
    );
  }

  const body = (await req.json()) as Body;
  if (!body.meetingId) {
    return NextResponse.json({ error: "meetingId が必要です" }, { status: 400 });
  }
  if (!body.minutes?.trim() && !body.agenda?.trim()) {
    return NextResponse.json(
      { error: "議事録か議題のいずれかが必要です" },
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

  // RLS チェックを兼ねて会議が読めるか確認
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, title, project_id")
    .eq("id", body.meetingId)
    .maybeSingle();
  if (!meeting) {
    return NextResponse.json(
      { error: "会議が見つからないか、アクセス権限がありません" },
      { status: 404 },
    );
  }

  // メンバー名の候補（AI に名前を渡すと assignee_hint の精度が上がる）
  const namesHint = (body.orgMembers ?? [])
    .filter((n): n is string => Boolean(n))
    .slice(0, 30);
  const today = new Date().toISOString().slice(0, 10);

  const userMessage = `今日: ${today}
組織メンバー候補: ${namesHint.length > 0 ? namesHint.join(", ") : "（不明）"}

== 議題 ==
${body.agenda?.trim() || "（未記入）"}

== 議事録 ==
${body.minutes.trim() || "（未記入）"}

== 決定事項 ==
${body.decisions?.trim() || "（未記入）"}

上記から Action Items を JSON 配列で抽出してください。`;

  const client = new Anthropic({ apiKey });
  let suggestions: Suggestion[] = [];
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = response.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text : "";

    // JSON 部分を取り出す（前後にコードフェンスがあっても対応）
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        suggestions = parsed
          .filter(
            (it): it is Suggestion =>
              typeof it === "object" &&
              it !== null &&
              typeof (it as Record<string, unknown>).title === "string",
          )
          .map((it) => ({
            title: String(it.title).slice(0, 200),
            detail: it.detail ? String(it.detail).slice(0, 500) : undefined,
            assignee_hint: it.assignee_hint
              ? String(it.assignee_hint).slice(0, 80)
              : undefined,
            due_hint: it.due_hint ? String(it.due_hint).slice(0, 40) : undefined,
          }))
          .slice(0, 10);
      }
    } catch {
      return NextResponse.json(
        { error: "AI 応答の JSON 解析に失敗しました。再試行してください。" },
        { status: 502 },
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `Anthropic API エラー: ${message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ suggestions });
}
