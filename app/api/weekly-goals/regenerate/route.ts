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

  // Parse month as a local date (YYYY-MM-01)
  const [y, m] = body.month.split("-").map(Number);
  const anyDateInMonth = new Date(y, m - 1, 15); // sredina meseca

  const slices = distributeMonthlyGoal(
    body.store_id,
    body.monthly_goal,
    anyDateInMonth
  );

  // Prvo pronađi postojeće nedelje iz istog izvornog meseca — sačuvaj one koje su ručno prepisane
  const sourceMonth = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
  const { data: existing } = await supabase
    .from("weekly_goals")
    .select("*")
    .eq("store_id", body.store_id)
    .eq("source_month", sourceMonth);

  const existingMap = new Map<string, { id: string; manual_override: boolean }>();
  (existing ?? []).forEach((r) => {
    existingMap.set(r.week_start, {
      id: r.id as string,
      manual_override: Boolean(r.manual_override),
    });
  });

  let preserved = 0;
  let created = 0;
  let updated = 0;

  for (const slice of slices) {
    const ex = existingMap.get(slice.week_start);
    if (ex?.manual_override) {
      preserved += 1;
      continue; // ne diraj ručno podešeno
    }
    if (ex) {
      const { error } = await supabase
        .from("weekly_goals")
        .update({
          week_end: slice.week_end,
          goal_rsd: slice.goal_rsd,
          source_month: slice.source_month,
          manual_override: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ex.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updated += 1;
    } else {
      const { error } = await supabase.from("weekly_goals").insert({
        store_id: body.store_id,
        week_start: slice.week_start,
        week_end: slice.week_end,
        goal_rsd: slice.goal_rsd,
        source_month: slice.source_month,
        manual_override: false,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      created += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    weeks_created: created,
    weeks_updated: updated,
    preserved,
    total_weeks: slices.length,
  });
}
