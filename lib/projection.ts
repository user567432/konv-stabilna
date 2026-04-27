import { createSupabaseServer } from "./supabase";

/**
 * Projekcija mesečnog cilja na bazi trenutnog tempa.
 *
 * Učitava: sve smene za trenutni mesec + monthly_revenue_target iz settings.
 * Računa za svaku radnju + ukupno:
 *   - postignuto do sada (revenue MTD)
 *   - broj radnih dana proteklih u mesecu (dani sa smenama)
 *   - broj preostalih kalendarskih dana u mesecu
 *   - run rate (postignuto / proteklih dana)
 *   - projekcija za kraj meseca (run rate × ukupnih dana u mesecu)
 *   - potrebni dnevni tempo da bi se cilj pogodio (gap / preostali dani)
 *   - % completion
 *
 * Ako radnja nema `monthly_revenue_target` — projekcija i dalje radi (koristi globalni cilj
 * ili null-uje polja koja zavise od cilja).
 */

export interface StoreProjection {
  store_id: string;
  store_name: string;
  mtd_revenue: number;
  days_worked: number;          // dani sa bar jednom smenom
  days_passed: number;          // kalendarski dani do juče (inkluzivno)
  days_remaining: number;       // preostali dani u mesecu (uklj. danas)
  days_in_month: number;
  run_rate_daily: number;       // prosek po prošlim radnim danima
  projected_month: number;      // projekcija za kraj meseca (po run rate-u)
  target: number | null;
  pct_of_target: number | null; // 0..100+
  gap_to_target: number | null; // pozitivno = fali, negativno = preko
  required_daily_pace: number | null; // koliko dnevno do kraja meseca da bi se cilj pogodio
  on_pace: boolean | null;      // projected_month >= target
}

export interface ProjectionSummary {
  month_label: string;
  per_store: StoreProjection[];
  total: StoreProjection;
  computed_at: string;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function loadProjection(): Promise<ProjectionSummary> {
  const supabase = createSupabaseServer();
  const now = new Date();
  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);
  const startStr = isoDate(mStart);
  const endStr = isoDate(mEnd);

  const [{ data: stores }, { data: shifts }, { data: settings }] = await Promise.all([
    supabase.from("stores").select("id, name").order("id"),
    supabase
      .from("shifts")
      .select("store_id, shift_date, revenue")
      .gte("shift_date", startStr)
      .lte("shift_date", endStr),
    supabase.from("settings").select("store_id, monthly_revenue_target"),
  ]);

  const daysInMonth = mEnd.getDate();
  const todayDay = now.getDate();
  const daysPassed = Math.max(todayDay - 1, 0); // proteklo do juče
  const daysRemaining = daysInMonth - daysPassed;

  const targetByStore = new Map<string | null, number | null>();
  (settings ?? []).forEach((s) => {
    targetByStore.set(
      s.store_id,
      s.monthly_revenue_target ? Number(s.monthly_revenue_target) : null
    );
  });

  const projections: StoreProjection[] = [];
  let totalMTD = 0;
  let totalDaysWorked = new Set<string>();
  let totalTarget = 0;
  let anyTarget = false;

  for (const store of stores ?? []) {
    const storeRows = (shifts ?? []).filter((r) => r.store_id === store.id);
    const mtd = storeRows.reduce((s, r) => s + Number(r.revenue || 0), 0);
    const daysWorkedSet = new Set(storeRows.map((r) => r.shift_date));
    const daysWorked = daysWorkedSet.size;
    const runRate = daysWorked > 0 ? mtd / daysWorked : 0;
    const projected = runRate * daysInMonth;
    const target =
      targetByStore.get(store.id) ?? targetByStore.get(null) ?? null;

    const pct = target ? (projected / target) * 100 : null;
    const gap = target ? target - mtd : null;
    const requiredDaily =
      target !== null && daysRemaining > 0
        ? Math.max(0, target - mtd) / daysRemaining
        : null;

    projections.push({
      store_id: store.id,
      store_name: store.name,
      mtd_revenue: mtd,
      days_worked: daysWorked,
      days_passed: daysPassed,
      days_remaining: daysRemaining,
      days_in_month: daysInMonth,
      run_rate_daily: runRate,
      projected_month: projected,
      target,
      pct_of_target: pct,
      gap_to_target: gap,
      required_daily_pace: requiredDaily,
      on_pace: target !== null ? projected >= target : null,
    });

    totalMTD += mtd;
    storeRows.forEach((r) => totalDaysWorked.add(r.shift_date));
    if (target !== null) {
      totalTarget += target;
      anyTarget = true;
    }
  }

  const totalRunRate =
    totalDaysWorked.size > 0 ? totalMTD / totalDaysWorked.size : 0;
  const totalProjected = totalRunRate * daysInMonth;
  const totalReqDaily =
    anyTarget && daysRemaining > 0
      ? Math.max(0, totalTarget - totalMTD) / daysRemaining
      : null;

  const total: StoreProjection = {
    store_id: "TOTAL",
    store_name: "Ukupno sve 4 radnje",
    mtd_revenue: totalMTD,
    days_worked: totalDaysWorked.size,
    days_passed: daysPassed,
    days_remaining: daysRemaining,
    days_in_month: daysInMonth,
    run_rate_daily: totalRunRate,
    projected_month: totalProjected,
    target: anyTarget ? totalTarget : null,
    pct_of_target: anyTarget && totalTarget > 0 ? (totalProjected / totalTarget) * 100 : null,
    gap_to_target: anyTarget ? totalTarget - totalMTD : null,
    required_daily_pace: totalReqDaily,
    on_pace: anyTarget ? totalProjected >= totalTarget : null,
  };

  const monthLabel = now.toLocaleDateString("sr-RS", {
    month: "long",
    year: "numeric",
  });

  return {
    month_label: monthLabel,
    per_store: projections,
    total,
    computed_at: new Date().toISOString(),
  };
}
