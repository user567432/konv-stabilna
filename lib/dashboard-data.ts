import { createSupabaseServer } from "./supabase";
import type { Shift, Store, Worker, Settings } from "./types";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface DashboardSummary {
  today: PeriodAgg;
  period: PeriodAgg;                    // last 7 days
  previousPeriod: PeriodAgg;            // 7 days before that
  daily: DailyPoint[];                  // last 30 days
  perStoreToday: StoreToday[];
  perStorePeriod: StorePeriod[];
  perWorkerPeriod: WorkerPeriod[];
  recentShifts: (Shift & { worker_initials: string })[];
  stores: Store[];
  globalSettings: Settings | null;
}

export interface PeriodAgg {
  entries: number;
  buyers: number;
  revenue: number;
  items: number;
  shifts: number;
  conversion: number; // %
  aov: number;        // RSD
}

export interface DailyPoint {
  date: string;       // YYYY-MM-DD
  revenue: number;
  entries: number;
  buyers: number;
  conversion: number;
  aov: number;
}

export interface StoreToday {
  store_id: string;
  store_name: string;
  entries: number;
  buyers: number;
  revenue: number;
  conversion: number;
  aov: number;
  shifts: number;
}

export type StorePeriod = StoreToday;

export interface WorkerPeriod {
  worker_id: string;
  worker_initials: string;
  store_id: string;
  shifts: number;
  entries: number;
  buyers: number;
  revenue: number;
  conversion: number;
  aov: number;
}

function aggregate(rows: Shift[]): PeriodAgg {
  const entries = rows.reduce((s, r) => s + r.entries, 0);
  const buyers = rows.reduce((s, r) => s + r.buyers, 0);
  const revenue = rows.reduce((s, r) => s + Number(r.revenue), 0);
  const items = rows.reduce((s, r) => s + r.items_sold, 0);
  return {
    entries,
    buyers,
    revenue,
    items,
    shifts: rows.length,
    conversion: entries > 0 ? (buyers / entries) * 100 : 0,
    aov: buyers > 0 ? revenue / buyers : 0,
  };
}

export async function loadDashboard(storeFilter?: string): Promise<DashboardSummary> {
  const supabase = createSupabaseServer();

  const from30 = daysAgo(30);
  const from14 = daysAgo(14);
  const today = todayStr();

  // Base queries run in parallel
  const shiftsQ = supabase
    .from("shifts")
    .select("*")
    .gte("shift_date", from30)
    .order("shift_date", { ascending: false })
    .order("created_at", { ascending: false });

  const shiftsRes = storeFilter
    ? await shiftsQ.eq("store_id", storeFilter)
    : await shiftsQ;

  const [
    { data: stores },
    { data: workers },
    { data: globalSettings },
  ] = await Promise.all([
    supabase.from("stores").select("*").order("id"),
    supabase.from("workers").select("*"),
    supabase.from("settings").select("*").is("store_id", null).maybeSingle(),
  ]);

  const allShifts = (shiftsRes.data ?? []) as Shift[];
  const workerMap = new Map<string, Worker>();
  (workers ?? []).forEach((w) => workerMap.set(w.id, w));

  const todayShifts = allShifts.filter((s) => s.shift_date === today);
  const last7 = allShifts.filter((s) => s.shift_date >= daysAgo(6));
  const prev7 = allShifts.filter(
    (s) => s.shift_date >= daysAgo(13) && s.shift_date < daysAgo(6)
  );

  // Daily points (last 30 days)
  const dailyMap = new Map<string, Shift[]>();
  for (let i = 29; i >= 0; i--) {
    dailyMap.set(daysAgo(i), []);
  }
  allShifts.forEach((s) => {
    if (dailyMap.has(s.shift_date)) {
      dailyMap.get(s.shift_date)!.push(s);
    }
  });
  const daily: DailyPoint[] = Array.from(dailyMap.entries()).map(([date, rows]) => {
    const agg = aggregate(rows);
    return {
      date,
      revenue: agg.revenue,
      entries: agg.entries,
      buyers: agg.buyers,
      conversion: agg.conversion,
      aov: agg.aov,
    };
  });

  // Per-store today
  const storeList = (stores ?? []) as Store[];
  const perStoreToday: StoreToday[] = storeList.map((s) => {
    const rows = todayShifts.filter((x) => x.store_id === s.id);
    const agg = aggregate(rows);
    return {
      store_id: s.id,
      store_name: s.name,
      entries: agg.entries,
      buyers: agg.buyers,
      revenue: agg.revenue,
      conversion: agg.conversion,
      aov: agg.aov,
      shifts: agg.shifts,
    };
  });
  const perStorePeriod: StorePeriod[] = storeList.map((s) => {
    const rows = last7.filter((x) => x.store_id === s.id);
    const agg = aggregate(rows);
    return {
      store_id: s.id,
      store_name: s.name,
      entries: agg.entries,
      buyers: agg.buyers,
      revenue: agg.revenue,
      conversion: agg.conversion,
      aov: agg.aov,
      shifts: agg.shifts,
    };
  });

  // Per-worker (last 14 days by default, otherwise last7)
  const workerAgg = new Map<string, Shift[]>();
  last7.forEach((s) => {
    const arr = workerAgg.get(s.worker_id) ?? [];
    arr.push(s);
    workerAgg.set(s.worker_id, arr);
  });
  const perWorkerPeriod: WorkerPeriod[] = [];
  for (const [wid, rows] of workerAgg.entries()) {
    const w = workerMap.get(wid);
    if (!w) continue;
    const agg = aggregate(rows);
    perWorkerPeriod.push({
      worker_id: wid,
      worker_initials: w.initials,
      store_id: w.store_id,
      shifts: agg.shifts,
      entries: agg.entries,
      buyers: agg.buyers,
      revenue: agg.revenue,
      conversion: agg.conversion,
      aov: agg.aov,
    });
  }
  perWorkerPeriod.sort((a, b) => b.revenue - a.revenue);

  // Recent shifts (last 25)
  const recentShifts = allShifts.slice(0, 25).map((s) => ({
    ...s,
    worker_initials: workerMap.get(s.worker_id)?.initials ?? "?",
  }));

  // Touch from14 to silence unused warning and reserve for future 14d stats
  void from14;

  return {
    today: aggregate(todayShifts),
    period: aggregate(last7),
    previousPeriod: aggregate(prev7),
    daily,
    perStoreToday,
    perStorePeriod,
    perWorkerPeriod,
    recentShifts,
    stores: storeList,
    globalSettings: (globalSettings as Settings | null) ?? null,
  };
}

// --- Ad-hoc period loader za date range picker + compare ---
export interface RangeAgg {
  total: PeriodAgg;
  perStore: StoreToday[];
  perWorker: WorkerPeriod[];
  daily: DailyPoint[];
}

export async function loadRange(
  start: string,
  end: string
): Promise<RangeAgg> {
  const supabase = createSupabaseServer();
  const [{ data: rawShifts }, { data: stores }, { data: workers }] =
    await Promise.all([
      supabase
        .from("shifts")
        .select("*")
        .gte("shift_date", start)
        .lte("shift_date", end)
        .order("shift_date", { ascending: true }),
      supabase.from("stores").select("*").order("id"),
      supabase.from("workers").select("*"),
    ]);

  const rows = (rawShifts ?? []) as Shift[];
  const workerMap = new Map<string, Worker>();
  (workers ?? []).forEach((w) => workerMap.set(w.id, w));
  const storeList = (stores ?? []) as Store[];

  // Dani u rasponu (inkluzivno)
  const dailyMap = new Map<string, Shift[]>();
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, []);
  }
  rows.forEach((r) => {
    if (dailyMap.has(r.shift_date)) {
      dailyMap.get(r.shift_date)!.push(r);
    }
  });

  const daily: DailyPoint[] = Array.from(dailyMap.entries()).map(([date, rs]) => {
    const agg = aggregate(rs);
    return {
      date,
      revenue: agg.revenue,
      entries: agg.entries,
      buyers: agg.buyers,
      conversion: agg.conversion,
      aov: agg.aov,
    };
  });

  const perStore: StoreToday[] = storeList.map((st) => {
    const r = rows.filter((x) => x.store_id === st.id);
    const agg = aggregate(r);
    return {
      store_id: st.id,
      store_name: st.name,
      entries: agg.entries,
      buyers: agg.buyers,
      revenue: agg.revenue,
      conversion: agg.conversion,
      aov: agg.aov,
      shifts: agg.shifts,
    };
  });

  const workerAgg = new Map<string, Shift[]>();
  rows.forEach((r) => {
    const arr = workerAgg.get(r.worker_id) ?? [];
    arr.push(r);
    workerAgg.set(r.worker_id, arr);
  });
  const perWorker: WorkerPeriod[] = [];
  for (const [wid, rs] of workerAgg.entries()) {
    const w = workerMap.get(wid);
    if (!w) continue;
    const agg = aggregate(rs);
    perWorker.push({
      worker_id: wid,
      worker_initials: w.initials,
      store_id: w.store_id,
      shifts: agg.shifts,
      entries: agg.entries,
      buyers: agg.buyers,
      revenue: agg.revenue,
      conversion: agg.conversion,
      aov: agg.aov,
    });
  }
  perWorker.sort((a, b) => b.revenue - a.revenue);

  return {
    total: aggregate(rows),
    perStore,
    perWorker,
    daily,
  };
}

export async function firstShiftDate(): Promise<string | null> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("shifts")
    .select("shift_date")
    .order("shift_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.shift_date as string | undefined) ?? null;
}
