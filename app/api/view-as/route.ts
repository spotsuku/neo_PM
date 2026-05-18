import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

type View = "member" | "theme_owner" | null;

interface Body {
  view: View;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const cookieStore = await cookies();

  if (body.view === "member" || body.view === "theme_owner") {
    cookieStore.set("neo:view-as", body.view, {
      httpOnly: false,
      path: "/",
      maxAge: 60 * 60 * 24, // 24h
      sameSite: "lax",
    });
  } else {
    cookieStore.delete("neo:view-as");
  }

  return NextResponse.json({ ok: true });
}
