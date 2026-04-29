import { redirect } from "next/navigation";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import RasporedClient from "./RasporedClient";
import type { Worker, Store } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { week?: string; store?: string };
}

/**
 * Vraca datum prvog dana (ponedeljka) u nedelji za dati datum.
 * Lokalna konverzija — radi sa YYYY-MM-DD bez timezones.
 */
function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay(); // 0=ned, 1=pon, ..., 6=sub
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ScheduleSlot {
  store_id: string;
  shift_date: string;
  shift_type: "prva" | "druga" | "dvokratna";
  worker_ids: string[];
  note: string | null;
}

export default async function RasporedPage({ searchParams }: PageProps) {
  if (!(await isMasterAuthed())) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const weekStart = getMondayOf(searchParams.week ?? today);
  const weekEnd = addDays(weekStart, 6);
  const prevWeekStart = addDays(weekStart, -7);
  const prevWeekEnd = addDays(weekStart, -1);
  const activeStore = searchParams.store ?? "D1";

  // Rotacioni opseg — 4 nedelje pre tekuce, za nagovestaj distribucije po smenama
  const rotationFrom = addDays(weekStart, -28);
  const rotationTo = addDays(weekStart, -1);

  const supabase = createSupabaseServer();

  const [
    { data: stores },
    { data: workers },
    { data: thisWeek },
    { data: prevWeek },
    { data: distribution },
  ] = await Promise.all([
    supabase.from("stores").select("*").order("id"),
    supabase
      .from("workers")
      .select("*")
      .eq("active", true)
      .order("store_id")
      .order("initials"),
    supabase
      .from("shift_schedule")
      .select("*")
      .gte("shift_date", weekStart)
      .lte("shift_date", weekEnd),
    supabase
      .from("shift_schedule")
      .select("*")
      .gte("shift_date", prevWeekStart)
      .lte("shift_date", prevWeekEnd),
    supabase.rpc("get_workers_shift_distribution", {
      p_store_id: activeStore,
      p_from_date: rotationFrom,
      p_to_date: rotationTo,
    }),
  ]);

  const stripSlot = (rows: unknown[]): ScheduleSlot[] =>
    (rows as Array<Record<string, unknown>>).map((r) => ({
      store_id: r.store_id as string,
      shift_date: r.shift_date as string,
      shift_type: r.shift_type as ScheduleSlot["shift_type"],
      worker_ids: (r.worker_ids as string[]) ?? [],
      note: (r.note as string | null) ?? null,
    }));

  // Map worker_id -> { prva, druga, dvokratna }
  const distMap = new Map<
    string,
    { prva: number; druga: number; dvokratna: number }
  >();
  ((distribution ?? []) as Array<{
    worker_id: string;
    shift_type: "prva" | "druga" | "dvokratna";
    count: number;
  }>).forEach((row) => {
    const cur = distMap.get(row.worker_id) ?? {
      prva: 0,
      druga: 0,
      dvokratna: 0,
    };
    cur[row.shift_type] = row.count;
    distMap.set(row.worker_id, cur);
  });

  return (
    <RasporedClient
      stores={(stores ?? []) as Store[]}
      workers={(workers ?? []) as Worker[]}
      thisWeek={stripSlot(thisWeek ?? [])}
      prevWeek={stripSlot(prevWeek ?? [])}
      weekStart={weekStart}
      activeStore={activeStore}
      shiftDistribution={Object.fromEntries(distMap)}
      rotationWindowWeeks={4}
    />
  );
}
