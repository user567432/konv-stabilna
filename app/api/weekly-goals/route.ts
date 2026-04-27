import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/weekly-goals?store_id=D1&month=2026-04-01
export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const url = new URL(req.url);
  const store_id = url.searchParams.get("store_id");
  const month = url.searchParams.get("month");

  const supabase = createSupabaseServer();
  let q = supabase
    .from("weekly_goals")
    .select("*")
    .order("week_start", { ascending: true });

  if (store_id) q = q.eq("store_id", store_id);
  if (month) q = q.eq("source_month", month);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ weeks: data ?? [] });
}

interface PutPayload {
  id: string;
  goal_rsd: number;
}

// PUT /api/weekly-goals — ručno overridovanje jedne nedelje
export async function PUT(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await req.json()) as PutPayload;
  if (!body.id) {
    return NextResponse.json({ error: "id required." }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("weekly_goals")
    .update({
      goal_rsd: body.goal_rsd,
      manual_override: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/weekly-goals?id=... — reset na automatski (obriši override)
export async function DELETE(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const supabase = createSupabaseServer();
  const { error } = await supabase
    .from("weekly_goals")
    .update({ manual_override: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
