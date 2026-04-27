import { createSupabaseServer } from "./supabase";
import type { Shift, Store, Worker } from "./types";

/**
 * Cross-store lift poredjenje radnica.
 *
 * Problem: ukupni promet je nefer jer radnje imaju razlicit segment, lokaciju i volumen.
 * Resenje: meri se "lift" — koliko je radnica iznad prosjeka SVOJE radnje u istom periodu.
 *
 * Tri dimenzije:
 *   - konverzija (kupci / ulasci)         tezina 50%
 *   - AOV (prosecna vrednost racuna)       tezina 30%
 *   - IPB (artikli po kupcu)               tezina 20%
 *
 * Composite = sum(weights * lift_per_dim).
 *
 * Lift = (worker_metric / store_metric) - 1.
 *   - 0    = isto kao prosek radnje
 *   - +0.2 = 20% iznad proseka radnje
 *   - -0.1 = 10% ispod proseka radnje
 *
 * Worker metrika koristi pro-rata atribuciju (1/N po smeni gde radi N radnica).
 * Store baseline koristi ukupne sume iz svih smena radnje (ground truth).
 *
 * Pra g: radnica mora imati >= MIN_SHIFTS_FOR_LIFT smena u rasponu.
 * Bez ovoga, jedna fenomenalna smena pravi laznog sampiona.
 */

export const MIN_SHIFTS_FOR_LIFT = 5;

export const LIFT_WEIGHTS = {
  conversion: 0.5,
  aov: 0.3,
  ipb: 0.2,
} as const;

export interface WorkerLiftRow {
  worker_id: string;
  initials: string;
  store_id: string;
  store_name: string;
  shifts_count: number;

  // Pro-rata udeli radnice
  entries_share: number;
  buyers_share: number;
  revenue_share: number;
  items_share: number;

  // Worker metrike (izvedene iz pro-rata udela)
  worker_conversion: number; // %
  worker_aov: number;
  worker_ipb: number;

  // Store baseline (ukupne sume / radnje)
  store_conversion: number;
  store_aov: number;
  store_ipb: number;

  // Lift — relativna razlika (procenat)
  conv_lift: number; // npr. 0.18 = +18%
  aov_lift: number;
  ipb_lift: number;

  // Composite indeks (ponderisana suma lift-ova)
  composite: number;

  eligible: boolean;
}

export interface CrossStoreLiftResult {
  start: string | null;
  end: string;
  total_shifts: number;
  ranked: WorkerLiftRow[]; // eligible, sortirano po composite desc
  insufficient: WorkerLiftRow[];
  store_baselines: Array<{
    store_id: string;
    store_name: string;
    shifts_count: number;
    conversion: number;
    aov: number;
    ipb: number;
  }>;
}

/**
 * @param start  YYYY-MM-DD ili null za "Cela istorija" (od prve smene do today)
 * @param end    YYYY-MM-DD; ako se izostavi, koristi se today
 */
export async function loadCrossStoreLift(
  start: string | null,
  end?: string
): Promise<CrossStoreLiftResult> {
  const supabase = createSupabaseServer();
  const endDate = end ?? new Date().toISOString().slice(0, 10);

  let shiftsQuery = supabase.from("shifts").select("*").lte("shift_date", endDate);
  if (start) {
    shiftsQuery = shiftsQuery.gte("shift_date", start);
  }
  shiftsQuery = shiftsQuery.order("shift_date", { ascending: true });

  const [{ data: rawShifts }, { data: storesData }, { data: workersData }] =
    await Promise.all([
      shiftsQuery,
      supabase.from("stores").select("*").order("id"),
      supabase.from("workers").select("*"),
    ]);

  const shifts = (rawShifts ?? []) as Shift[];
  const stores = (storesData ?? []) as Store[];
  const workers = (workersData ?? []) as Worker[];
  const storeMap = new Map(stores.map((s) => [s.id, s]));
  const workerMap = new Map(workers.map((w) => [w.id, w]));

  // 1) Store baseline-ovi — agregat po radnji (ground truth)
  const storeAgg = new Map<
    string,
    {
      entries: number;
      buyers: number;
      revenue: number;
      items: number;
      shifts: number;
    }
  >();
  for (const s of stores) {
    storeAgg.set(s.id, { entries: 0, buyers: 0, revenue: 0, items: 0, shifts: 0 });
  }
  for (const sh of shifts) {
    const a = storeAgg.get(sh.store_id);
    if (!a) continue;
    a.entries += sh.entries;
    a.buyers += sh.buyers;
    a.revenue += Number(sh.revenue) || 0;
    a.items += sh.items_sold;
    a.shifts += 1;
  }

  const store_baselines = stores.map((s) => {
    const a = storeAgg.get(s.id)!;
    return {
      store_id: s.id,
      store_name: s.name,
      shifts_count: a.shifts,
      conversion: a.entries > 0 ? (a.buyers / a.entries) * 100 : 0,
      aov: a.buyers > 0 ? a.revenue / a.buyers : 0,
      ipb: a.buyers > 0 ? a.items / a.buyers : 0,
    };
  });

  // 2) Pro-rata atribucija po radnici
  interface WorkerAcc {
    worker_id: string;
    initials: string;
    store_id: string;
    store_name: string;
    entries_share: number;
    buyers_share: number;
    revenue_share: number;
    items_share: number;
    shifts_count: number;
  }
  const workerAcc = new Map<string, WorkerAcc>();
  for (const w of workers) {
    const st = storeMap.get(w.store_id);
    workerAcc.set(w.id, {
      worker_id: w.id,
      initials: w.initials,
      store_id: w.store_id,
      store_name: st?.name ?? w.store_id,
      entries_share: 0,
      buyers_share: 0,
      revenue_share: 0,
      items_share: 0,
      shifts_count: 0,
    });
  }

  for (const sh of shifts) {
    const ids =
      Array.isArray(sh.worker_ids) && sh.worker_ids.length > 0
        ? sh.worker_ids
        : sh.worker_id
          ? [sh.worker_id]
          : [];
    if (ids.length === 0) continue;
    const n = ids.length;
    const rev = Number(sh.revenue) || 0;

    for (const wid of ids) {
      const acc = workerAcc.get(wid);
      if (!acc) continue;
      acc.entries_share += sh.entries / n;
      acc.buyers_share += sh.buyers / n;
      acc.revenue_share += rev / n;
      acc.items_share += sh.items_sold / n;
      acc.shifts_count += 1;
    }
  }

  // 3) Spoj worker udela sa store baseline-om i izracunaj lift + composite
  const baselineMap = new Map(store_baselines.map((b) => [b.store_id, b]));

  const allRows: WorkerLiftRow[] = [];
  for (const acc of workerAcc.values()) {
    const baseline = baselineMap.get(acc.store_id);
    if (!baseline) continue;

    const worker_conversion =
      acc.entries_share > 0 ? (acc.buyers_share / acc.entries_share) * 100 : 0;
    const worker_aov =
      acc.buyers_share > 0 ? acc.revenue_share / acc.buyers_share : 0;
    const worker_ipb =
      acc.buyers_share > 0 ? acc.items_share / acc.buyers_share : 0;

    // Lift: ako je baseline 0, lift je 0 (izbjegavamo deljenje nulom)
    const conv_lift =
      baseline.conversion > 0 ? worker_conversion / baseline.conversion - 1 : 0;
    const aov_lift = baseline.aov > 0 ? worker_aov / baseline.aov - 1 : 0;
    const ipb_lift = baseline.ipb > 0 ? worker_ipb / baseline.ipb - 1 : 0;

    const composite =
      LIFT_WEIGHTS.conversion * conv_lift +
      LIFT_WEIGHTS.aov * aov_lift +
      LIFT_WEIGHTS.ipb * ipb_lift;

    allRows.push({
      worker_id: acc.worker_id,
      initials: acc.initials,
      store_id: acc.store_id,
      store_name: acc.store_name,
      shifts_count: acc.shifts_count,
      entries_share: acc.entries_share,
      buyers_share: acc.buyers_share,
      revenue_share: acc.revenue_share,
      items_share: acc.items_share,
      worker_conversion,
      worker_aov,
      worker_ipb,
      store_conversion: baseline.conversion,
      store_aov: baseline.aov,
      store_ipb: baseline.ipb,
      conv_lift,
      aov_lift,
      ipb_lift,
      composite,
      eligible: acc.shifts_count >= MIN_SHIFTS_FOR_LIFT,
    });
  }

  const ranked = allRows
    .filter((r) => r.eligible)
    .sort((a, b) => b.composite - a.composite);
  const insufficient = allRows
    .filter((r) => !r.eligible)
    .sort((a, b) => b.shifts_count - a.shifts_count);

  return {
    start,
    end: endDate,
    total_shifts: shifts.length,
    ranked,
    insufficient,
    store_baselines,
  };
}

/**
 * Vraca datum prve smene u bazi (za prikaz "Cela istorija").
 * Ako nema smena, vraca null.
 */
export async function getFirstShiftDate(): Promise<string | null> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("shifts")
    .select("shift_date")
    .order("shift_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.shift_date as string | undefined) ?? null;
}
