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
- 50  = 骨組みはあるが具体性・根拠が不足 (申請ゲートはここ)
- 20  = 抽象的 / 1行で表面的
- 0   = 未記入 / 内容が無い

重要:
- 点数は必ず 5 点刻み (0,5,10,...,100) で付けること。
- 各項目の「評価のツボ」(上記) を最優先で見ること。共通スケール (100/70/50/20/0) は品質水準の目安。
- 全体方針: テーマ出題は応募者のアイデアの余地を残すことが価値。方向性・問い・制約が明確であれば、過度に具体化されていなくても高得点でよい (resources など具体性そのものが価値の項目を除く)。

対象項目 (item_key : 評価のツボ):
- title : USP (差別化・引きの強さ) が打ち出されているか。意外性・自虐・特定企業ならではの色があれば抽象的でも高得点 (例「イオンのダサいを変える」は抽象的だが有名企業の自虐の引きの強さで高得点)。誰でも書ける綺麗事スローガンは減点。
- description_long : 2〜4文でテーマの全体像と挑戦内容が一目で掴め、応募者が自分ごと化できる要約になっているか。タイトルと整合しているか。WHY/WHO/WHAT などの詳細は別項目で評価するので、ここでは概要の伝わりやすさだけを見て、要素の網羅性は問わない。
- vision : 達成したい理想状態が、応募者が共感できる解像度で描かれているか。「業界を変える」のような言い回しだけでなく、5年後/10年後にどんな景色が広がっているかが見えるか。
- current_state : ビジョンに対する現在の立ち位置が、観察可能な「事実」(数値・現場の声・行動データ) で書かれているか。評価・推測 (「停滞している」「うまくいっていない」だけ) は減点。
- pain : 理想 (vision) と現状 (current_state) の差分=ギャップが事実として記述されているか (問題=事実のズレ、課題=取り組むべきこと、と混同しない)。憶測・一般論・「不便だと思う」は減点。事実かどうかが鍵。
- root_cause : なぜその問題が起きているかの構造的な要因が、複数の観点 (構造・制度・行動・文化など) で分析されているか。「○○のせい」で1つの原因に矮小化していたら減点。
- focus_issue : 要因分析を踏まえ、このプロジェクトで取り組む「焦点」が絞れているか。「全部やる」「色々やる」は減点。問題そのものをコピペしただけも減点 (課題=要因分析を経て選んだもの)。
- background : なぜ「今」このテーマが必要かが、根拠 (出来事・データ・現場の声) に紐づいて語られているか。「日本を変える」のような抽象スローガンだけは減点。
- who_target : 誰の課題かが年代・属性・生活シーン・意思決定の文脈の解像度で示されているか。「若者全般」「みんな」のような幅広い指定は減点。
- what_benefit : 相手が得る「提供価値」(変化・成果) として書かれているか。「アプリを作る」「サービスを提供する」など手段 (How) と混同していないか。プロダクト/機能の説明になっていたら減点。
- expected_outcome : 地域・人・組織への変化 (できれば測れる形)。WHAT の個の変化を超えた集合的・中長期インパクト視点があるか。
- what_uniqueness : なぜこのテーマを「この組織が」出す意味があるか。地域性・歴史・既存資産との接続が見えると加点。単に「新しい」だけは減点。
- internal_challenges : 起こりうる障害 (業務制約・社内合意・技術難所・法令/倫理) が誠実に開示されているか。「特になし」「順調」は情報非開示として減点。
- resources : 応募者の意思決定の決め手になる具体 (例: 100万円、イオン博多店のポップアップスペース、貸出設備、人月、データ) が箇条書きで列挙されているか。具体的なほど高得点。曖昧な「サポートします」「相談に乗ります」は大きく減点。
- post_action : 採択後の次の一歩 (実証/共同開発/採用/出資 等) と関わり方が、応募者が「次を見通せる」レベルで書かれているか。「検討します」だけは減点。

各項目に score(5点刻み) と、改善の次の一手を示す 1 文の comment(日本語/です・ます調、60 文字以内) を付けてください。
最後に全体の summary を 2 文 (各 50 文字以内) で。
冗長な表現は避け、簡潔に。

応答は次の純粋な JSON のみ (コードフェンスや説明文なし):
{
  "items": {
    "title": { "score": <0-100>, "comment": "<1-2文>" },
    "description_long": { "score": <0-100>, "comment": "<1-2文>" },
    "vision": { "score": <0-100>, "comment": "<1-2文>" },
    "current_state": { "score": <0-100>, "comment": "<1-2文>" },
    "pain": { "score": <0-100>, "comment": "<1-2文>" },
    "root_cause": { "score": <0-100>, "comment": "<1-2文>" },
    "focus_issue": { "score": <0-100>, "comment": "<1-2文>" },
    "background": { "score": <0-100>, "comment": "<1-2文>" },
    "who_target": { "score": <0-100>, "comment": "<1-2文>" },
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
      max_tokens: 4000,
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
