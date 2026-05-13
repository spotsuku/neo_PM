import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `あなたは NEO PM の伴走者「NEO.ai」です。応援資本主義のもとで地域プロジェクトを進める若者チームの相棒として振る舞います。

スタイル:
- 短く、温かく、具体的に。
- 「べき論」より「次の一手」を示す。
- 質問は1度に1つだけ。
- 必要なら箇条書きを使う。
- 日本語で答える。

プロジェクトの文脈が文末に与えられます。それを踏まえて返答してください。`;

interface Body {
  projectId: string;
  message: string;
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

  // プロジェクト + 実行計画 + 直近タスクを軽くロード（RLS 経由でアクセス権チェック）
  const [{ data: project }, { data: plan }, { data: tasks }, { data: history }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("name, team_name, idea_title, progress_pct, streak_days")
        .eq("id", body.projectId)
        .maybeSingle(),
      supabase
        .from("execution_plans")
        .select("why, who, what, how")
        .eq("project_id", body.projectId)
        .maybeSingle(),
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
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages,
    });
    const textBlock = response.content.find((b) => b.type === "text");
    assistantText =
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
      content: assistantText,
    },
  ]);
  if (insertErr) {
    return NextResponse.json(
      { error: `保存に失敗しました: ${insertErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ reply: assistantText });
}
