import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/admin-auth";
import { distributeMonthlyGoal } from "@/lib/weekly-goals";

export const dynamic = "force-dynamic";

interface Payload {
  store_id: string;
  month: string; // YYYY-MM-01
  monthly_goal: number;
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await req.json()) as Payload;
  if (!body.store_id || !body.month || !body.monthly_goal) {
    return NextResponse.json(
      { error: "store_id, month, monthly_goal required." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServer();

  const [y, m] = body.month.split("-").map(Number);
  const anyDateInMonth = new Date(y, m - 1, 15);

  const slices = distributeMonthlyGoal(
    body.store_id,
    body.monthly_goal,
    anyDateInMonth
  );

  // Prvo procitaj postojece da znamo koje su rucno prepisane
  const sourceMonth = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
  const { data: existing } = await supabase
    .from("weekly_goals")
    .select("week_start, manual_override")
    .eq("store_id", body.store_id)
    .eq("source_month", sourceMonth);

  const manualSet = new Set<string>();
  (existing ?? []).forEach((r) => {
    if (r.manual_override) manualSet.add(r.week_start as string);
  });

  let preserved = 0;
  let processed = 0;

  for (const slice of slices) {
    if (manualSet.has(slice.week_start)) {
      preserved += 1;
      continue;
    }
    // Upsert preko RPC (zaobilazi RLS)
    const { error } = await supabase.rpc("upsert_weekly_goal", {
      p_store_id: body.store_id,
      p_week_start: slice.week_start,
      p_week_end: slice.week_end,
      p_goal_rsd: slice.goal_rsd,
      p_source_month: slice.source_month,
      p_manual_override: false,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    processed += 1;
  }

  return NextResponse.json({
    ok: true,
    weeks_created: processed,
    preserved,
    total_weeks: slices.length,
  });
}
