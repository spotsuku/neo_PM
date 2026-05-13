import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

interface Body {
  view: "admin" | "member" | null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const cookieStore = await cookies();

  if (body.view === "member") {
    cookieStore.set("neo:view-as", "member", {
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
