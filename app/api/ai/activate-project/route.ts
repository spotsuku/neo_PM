import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface Body {
  projectId: string;
}

interface Suggestion {
  title: string;
  detail: string;
  kind: "quest" | "meeting" | "task";
}

const SYSTEM_PROMPT = `あなたは NEO PM の管理者アシスタントです。停滞している地域プロジェクトを再起動するために、組織 admin が今日とれる具体策を3つ提案するのが仕事です。

ルール:
- 各提案は kind in {quest, meeting, task} のいずれか。
  * quest = チームに対して設定する「今週やってほしいこと」
  * meeting = 関係者と開く会議（30分〜1時間程度）
  * task = WBS に追加すべき個別タスク
- 「べき論」より「次の一手」。1つでもクリアすれば前進する大きさにする。
- 担当者名や具体的な数字を入れて、当事者が「明日朝にやる」レベルに落とす。
- 出力は JSON 配列のみ。前置き / 後置きの文章は禁止。
- 厳密に3件。

出力フォーマット:
[
  {
    "kind": "quest",
    "title": "Why を 200 字で言語化",
    "detail": "リードの三木さんに「なぜこのプロジェクトを今やるのか」を 200 字で書き直してもらう。実行計画→Why の編集だけで完了。"
  }
]`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY が未設定です。Vercel の Environment Variables に追加してください。",
      },
      { status: 503 },
    );
  }

  const body = (await req.json()) as Body;
  if (!body.projectId) {
    return NextResponse.json({ error: "projectId が必要です" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  // 権限チェック: 組織 owner / admin のみ
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, team_name, idea_title, status, progress_pct, streak_days, updated_at, organization_id",
    )
    .eq("id", body.projectId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json(
      { error: "プロジェクトが見つかりません" },
      { status: 404 },
    );
  }

  const { data: myMembership } = await supabase
    .from("memberships")
    .select("role")
    .eq("organization_id", project.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    !myMembership ||
    (myMembership.role !== "owner" && myMembership.role !== "admin")
  ) {
    return NextResponse.json(
      { error: "管理者のみ実行可能です" },
      { status: 403 },
    );
  }

  // コンテキスト収集
  const [{ data: plan }, { data: openTasks }, { data: overdueMs }] =
    await Promise.all([
      supabase
        .from("execution_plans")
        .select("why, who, what, how")
        .eq("project_id", project.id)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("title, status, owner_name, end_date")
        .eq("project_id", project.id)
        .neq("status", "done")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("milestones")
        .select("label, date")
        .eq("project_id", project.id)
        .eq("done", false)
        .lt("date", new Date().toISOString().slice(0, 10)),
    ]);

  const today = new Date().toISOString().slice(0, 10);
  const updatedAt = new Date(project.updated_at);
  const daysSince = Math.floor(
    (Date.now() - updatedAt.getTime()) / 86400000,
  );

  const userMessage = `今日: ${today}

== プロジェクト ==
${project.name}${project.team_name ? `（${project.team_name}）` : ""}
アイデア: ${project.idea_title ?? "（未記入）"}
状態: ${project.status}、進捗 ${project.progress_pct}%、連続 ${project.streak_days} 日
最終更新: ${daysSince} 日前

== 実行計画 ==
Why: ${plan?.why || "（未記入）"}
Who: ${plan?.who || "（未記入）"}
What: ${plan?.what || "（未記入）"}
How: ${plan?.how || "（未記入）"}

== 未完了タスク (最大8件) ==
${
  (openTasks ?? [])
    .map(
      (t) =>
        `- [${t.status}] ${t.title}${t.owner_name ? ` (${t.owner_name})` : ""}${t.end_date ? ` ~${t.end_date}` : ""}`,
    )
    .join("\n") || "（なし）"
}

== 期限超過マイルストーン ==
${
  (overdueMs ?? [])
    .map((m) => `- ${m.label} (${m.date})`)
    .join("\n") || "（なし）"
}

このプロジェクトを来週から再起動させるため、今日 admin が打つべき手を 3 件、JSON 配列で出力してください。`;

  const client = new Anthropic({ apiKey });
  let suggestions: Suggestion[] = [];
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = response.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text : "";
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
              typeof (it as Record<string, unknown>).title === "string" &&
              typeof (it as Record<string, unknown>).detail === "string" &&
              ["quest", "meeting", "task"].includes(
                String((it as Record<string, unknown>).kind),
              ),
          )
          .map((it) => ({
            kind: it.kind,
            title: String(it.title).slice(0, 120),
            detail: String(it.detail).slice(0, 500),
          }))
          .slice(0, 3);
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
