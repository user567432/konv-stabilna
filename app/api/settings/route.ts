import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

interface Payload {
  store_id: string | null;
  conversion_target: number;
  aov_target: number;
  revenue_target?: number | null;
  monthly_revenue_target?: number | null;
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await req.json()) as Payload;
  const supabase = createSupabaseServer();

  // Upsert by store_id
  let query = supabase.from("settings").select("id");
  query = body.store_id
    ? query.eq("store_id", body.store_id)
    : query.is("store_id", null);
  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("settings")
      .update({
        conversion_target: body.conversion_target,
        aov_target: body.aov_target,
        revenue_target: body.revenue_target ?? null,
        monthly_revenue_target: body.monthly_revenue_target ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("settings").insert({
      store_id: body.store_id,
      conversion_target: body.conversion_target,
      aov_target: body.aov_target,
      revenue_target: body.revenue_target ?? null,
      monthly_revenue_target: body.monthly_revenue_target ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
