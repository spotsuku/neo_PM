import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface PatchBody {
  status: "approved" | "rejected";
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await req.json()) as PatchBody;
  if (!["approved", "rejected"].includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("proposals")
    .update({
      status: body.status,
      decided_at: new Date().toISOString(),
      decided_by: user.id,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 承認時の diff 適用は後続 PR で実装（kind ごとにテーブル更新）
  return NextResponse.json({ proposal: data });
}
