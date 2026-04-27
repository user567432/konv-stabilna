import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// GET /api/shift-edit-log?limit=100
export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

  const supabase = createSupabaseServer();
  const { data, error } = await supabase
    .from("shift_edit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Takođe pokreni auto-purge (fire & forget)
  try {
    await supabase.rpc("purge_old_shift_edit_log");
  } catch {
    // ignoriši – nije kritično
  }

  return NextResponse.json({ entries: data ?? [] });
}
