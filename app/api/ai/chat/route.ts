import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

type Proposal = Database["public"]["Tables"]["proposals"]["Row"];

export const runtime = "nodejs";

const SYSTEM_PROMPT = `あなたは AI PM の伴走者「NEO.ai」です。応援資本主義のもとで地域プロジェクトを進める若者チームの相棒として振る舞います。

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

【重要】ユーザーが Why/Who/What/How の記入を依頼してきた場合、または会話の流れから具体的に書ける材料が揃った場合は、
返答の最後に必ず次の形式のコードフェンスで提案を出してください:

\`\`\`neo:plan
{
  "summary": "ユーザー向け 1 行サマリー (例: 「Why と Who の下書きを提案します」)",
  "reasoning": "なぜこの内容を提案するのか 1〜2 行",
  "fields": {
    "why":  "本文 (なければキー自体省略)",
    "who":  "本文",
    "what": "本文",
    "how":  "本文"
  }
}
\`\`\`

ルール:
- fields は更新したいキーだけ。空にする場合はキーごと省略。
- 提案する場合は本文中にも 1〜2 行で「Why / Who を下書きしてみました。提案カードから反映してください」と触れること。
- 提案しない場合 (会話の探索段階・情報が足りない場合) は neo:plan ブロックを出さなくてよい。
- neo:plan ブロックは応答の最後に1つだけ。

プロジェクトの文脈が文末に与えられます。それを踏まえて返答してください。`;

interface Body {
  projectId: string;
  message: string;
}

interface ParsedPlanProposal {
  summary: string;
  reasoning: string | null;
  fields: Partial<Record<"why" | "who" | "what" | "how", string>>;
}

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
    for (const k of ["why", "who", "what", "how"] as const) {
      const v = obj.fields?.[k];
      if (typeof v === "string" && v.trim()) fields[k] = v.trim();
    }
    if (Object.keys(fields).length === 0) {
      return { cleaned, proposal: null };
    }
    return {
      cleaned,
      proposal: {
        summary:
          typeof obj.summary === "string" && obj.summary.trim()
            ? obj.summary.trim()
            : "実行計画の下書きを提案します",
        reasoning:
          typeof obj.reasoning === "string" && obj.reasoning.trim()
            ? obj.reasoning.trim()
            : null,
        fields,
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
      max_tokens: 1200,
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

  // neo:plan ブロックを抽出して本文から除去
  const { cleaned, proposal } = extractPlanProposal(assistantText);

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

  // 提案カードを作成 (あれば)
  let savedProposal: Proposal | null = null;
  if (proposal) {
    const { data: prop, error: propErr } = await supabase
      .from("proposals")
      .insert({
        project_id: body.projectId,
        kind: "execution_plan",
        summary: proposal.summary,
        reasoning: proposal.reasoning,
        diff: proposal.fields,
        status: "pending",
      })
      .select()
      .single();
    if (propErr) {
      // 失敗しても会話は返す
      console.error("proposal insert failed:", propErr.message);
    } else {
      savedProposal = prop;
    }
  }

  return NextResponse.json({
    reply: cleaned || assistantText,
    proposal: savedProposal,
  });
}
