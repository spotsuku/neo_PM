import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * AI 機能の利用可否を返す。
 * ANTHROPIC_API_KEY が server 環境変数として設定されているかだけを公開する。
 */
export async function GET() {
  return NextResponse.json({
    hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
