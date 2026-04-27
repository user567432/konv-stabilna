import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { currentWeekRange } from "@/lib/weekly-goals";

export const dynamic = "force-dynamic";

// GET /api/worker-progress?store_id=D1
// Javni endpoint — radnice ga zovu sa forme.
// Vraća: nedeljni cilj i progress, mesečni cilj i progress, 30 dana promet za grafikon.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const store_id = url.searchParams.get("store_id");
  if (!store_id) {
    return NextResponse.json({ error: "store_id required." }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  const now = new Date();
  const week = currentWeekRange(now);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);
  const sourceMonth = `${monthStart.getFullYear()}-${String(
    monthStart.getMonth() + 1
  ).padStart(2, "0")}-01`;

  const from30 = new Date();
  from30.setDate(from30.getDate() - 29);
  const from30Str = from30.toISOString().slice(0, 10);

  const [{ data: weekly }, { data: settings }, { data: weekShifts }, { data: monthShifts }, { data: last30 }] =
    await Promise.all([
      supabase
        .from("weekly_goals")
        .select("*")
        .eq("store_id", store_id)
        .eq("week_start", week.start)
        .maybeSingle(),
      supabase
        .from("settings")
        .select("monthly_revenue_target")
        .eq("store_id", store_id)
        .maybeSingle(),
      supabase
        .from("shifts")
        .select("revenue,shift_date")
        .eq("store_id", store_id)
        .gte("shift_date", week.start)
        .lte("shift_date", week.end),
      supabase
        .from("shifts")
        .select("revenue,shift_date")
        .eq("store_id", store_id)
        .gte("shift_date", monthStartStr)
        .lte("shift_date", monthEndStr),
      supabase
        .from("shifts")
        .select("revenue,shift_date")
        .eq("store_id", store_id)
        .gte("shift_date", from30Str)
        .order("shift_date", { ascending: true }),
    ]);

  const weeklyGoal = Number(weekly?.goal_rsd ?? 0);
  const weeklyRevenue = (weekShifts ?? []).reduce(
    (s, r) => s + Number(r.revenue),
    0
  );
  const monthlyGoal = Number(settings?.monthly_revenue_target ?? 0);
  const monthlyRevenue = (monthShifts ?? []).reduce(
    (s, r) => s + Number(r.revenue),
    0
  );

  // Grupisi 30d po datumu
  const dailyMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(from30);
    d.setDate(d.getDate() + i);
    dailyMap.set(d.toISOString().slice(0, 10), 0);
  }
  (last30 ?? []).forEach((r) => {
    const k = r.shift_date as string;
    if (dailyMap.has(k)) dailyMap.set(k, (dailyMap.get(k) ?? 0) + Number(r.revenue));
  });
  const daily = Array.from(dailyMap.entries()).map(([date, revenue]) => ({
    date,
    revenue,
  }));

  return NextResponse.json({
    week: {
      start: week.start,
      end: week.end,
      goal_rsd: weeklyGoal,
      revenue_rsd: weeklyRevenue,
      progress_pct: weeklyGoal > 0 ? (weeklyRevenue / weeklyGoal) * 100 : 0,
      remaining_rsd: Math.max(0, weeklyGoal - weeklyRevenue),
    },
    month: {
      start: monthStartStr,
      end: monthEndStr,
      source_month: sourceMonth,
      goal_rsd: monthlyGoal,
      revenue_rsd: monthlyRevenue,
      progress_pct: monthlyGoal > 0 ? (monthlyRevenue / monthlyGoal) * 100 : 0,
      remaining_rsd: Math.max(0, monthlyGoal - monthlyRevenue),
    },
    daily,
  });
}
