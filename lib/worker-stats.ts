import { createSupabaseServer } from "./supabase";
import type { Shift, Store, Worker } from "./types";

/**
 * Nivo-1 pro-rata atribucija:
 * Svaka smena ima worker_ids dužine N. Svaka radnica dobija 1/N udela:
 *  - prometa
 *  - broja kupaca (buyers)
 *  - broja ulazaka (entries)
 *  - broja artikala (items_sold)
 *  - jedne smene (shifts_share)
 *
 * Konverzija radnice = (buyers_udeo / entries_udeo) * 100.
 * AOV radnice = revenue_udeo / buyers_udeo.
 *
 * Ograničenja: rang prikazujemo samo za radnice sa >= MIN_SHIFTS_FOR_RANK
 * CELIH smena u rasponu (shifts_count, ne shifts_share). Ostale idu u „Nedovoljno podataka".
 * Partner prikaz (najbolji/najslabiji par) zahteva >= MIN_PAIR_SHIFTS zajedničkih smena.
 */

export const MIN_SHIFTS_FOR_RANK = 5;
export const MIN_PAIR_SHIFTS = 5;

export interface WorkerRankRow {
  worker_id: string;
  initials: string;
  store_id: string;
  // pro-rata udeli
  entries_share: number;
  buyers_share: number;
  revenue_share: number;
  items_share: number;
  shifts_share: number;      // zbir 1/N
  // cele smene u kojima je učestvovala
  shifts_count: number;
  // izvedene metrike
  conversion: number;        // %
  aov: number;               // RSD po kupcu (iz pro-rata udela)
  // istorijski ekstremi — max/min promet SMENE u kojoj je učestvovala
  // (pun promet smene, ne pro-rata udeo — master pita „kada su njene smene bile najbolje/najgore")
  best_shift_revenue: number;
  best_shift_date: string | null;
  worst_shift_revenue: number;
  worst_shift_date: string | null;
  // partneri
  best_partner: PairSummary | null;
  worst_partner: PairSummary | null;
  // za transparentnost: da li radnica ispunjava minimum
  eligible_for_rank: boolean;
}

export interface PairSummary {
  partner_id: string;
  partner_initials: string;
  shifts_count: number;          // koliko zajedničkih smena
  avg_conversion: number;        // prosek konverzije njihovih zajedničkih smena
  avg_aov: number;
  avg_revenue_per_shift: number;
}

export interface StoreRanking {
  store_id: string;
  store_name: string;
  ranked: WorkerRankRow[];                 // ispunjava prag, sortirano po konverziji desc
  insufficient_data: WorkerRankRow[];      // ne ispunjava prag
  total_shifts_in_range: number;
}

export interface TeamRankingResult {
  start: string;
  end: string;
  per_store: StoreRanking[];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function loadTeamRanking(
  start?: string,
  end?: string
): Promise<TeamRankingResult> {
  const supabase = createSupabaseServer();
  const startDate = start ?? daysAgo(30);
  const endDate = end ?? new Date().toISOString().slice(0, 10);

  const [{ data: rawShifts }, { data: stores }, { data: workers }] =
    await Promise.all([
      supabase
        .from("shifts")
        .select("*")
        .gte("shift_date", startDate)
        .lte("shift_date", endDate)
        .order("shift_date", { ascending: true }),
      supabase.from("stores").select("*").order("id"),
      supabase.from("workers").select("*"),
    ]);

  const shifts = (rawShifts ?? []) as Shift[];
  const storeList = (stores ?? []) as Store[];
  const workerList = (workers ?? []) as Worker[];
  const workerMap = new Map<string, Worker>();
  workerList.forEach((w) => workerMap.set(w.id, w));

  const per_store: StoreRanking[] = storeList.map((store) => {
    const storeShifts = shifts.filter((s) => s.store_id === store.id);
    const storeWorkers = workerList.filter((w) => w.store_id === store.id);

    // Inicijalizacija akumulatora po radnici
    const acc = new Map<string, WorkerRankRow>();
    storeWorkers.forEach((w) => {
      acc.set(w.id, {
        worker_id: w.id,
        initials: w.initials,
        store_id: store.id,
        entries_share: 0,
        buyers_share: 0,
        revenue_share: 0,
        items_share: 0,
        shifts_share: 0,
        shifts_count: 0,
        conversion: 0,
        aov: 0,
        best_shift_revenue: 0,
        best_shift_date: null,
        worst_shift_revenue: 0,
        worst_shift_date: null,
        best_partner: null,
        worst_partner: null,
        eligible_for_rank: false,
      });
    });

    // Pro-rata atribucija i best/worst po smeni
    for (const shift of storeShifts) {
      const ids = Array.isArray(shift.worker_ids) && shift.worker_ids.length > 0
        ? shift.worker_ids
        : [shift.worker_id];
      if (ids.length === 0) continue;
      const n = ids.length;
      const rev = Number(shift.revenue) || 0;

      for (const wid of ids) {
        const row = acc.get(wid);
        if (!row) continue; // radnica možda premeštena/deaktivirana — preskoči
        row.entries_share += shift.entries / n;
        row.buyers_share += shift.buyers / n;
        row.revenue_share += rev / n;
        row.items_share += shift.items_sold / n;
        row.shifts_share += 1 / n;
        row.shifts_count += 1;

        // istorijski ekstremi (pun promet smene)
        if (row.shifts_count === 1 || rev > row.best_shift_revenue) {
          row.best_shift_revenue = rev;
          row.best_shift_date = shift.shift_date;
        }
        if (row.shifts_count === 1 || rev < row.worst_shift_revenue) {
          row.worst_shift_revenue = rev;
          row.worst_shift_date = shift.shift_date;
        }
      }
    }

    // Partner matrica: za svaki neuređen par (a,b) — zbir konverzija, AOV i prometa po zajedničkoj smeni
    interface PairAcc {
      a: string;
      b: string;
      shifts: number;
      sum_conversion: number;
      sum_aov: number;
      sum_revenue: number;
    }
    const pairMap = new Map<string, PairAcc>();
    const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

    for (const shift of storeShifts) {
      const ids = Array.isArray(shift.worker_ids) && shift.worker_ids.length > 0
        ? shift.worker_ids
        : [shift.worker_id];
      if (ids.length < 2) continue;
      const conv =
        shift.entries > 0 ? (shift.buyers / shift.entries) * 100 : 0;
      const rev = Number(shift.revenue) || 0;
      const aov = shift.buyers > 0 ? rev / shift.buyers : 0;

      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = pairKey(ids[i], ids[j]);
          let p = pairMap.get(key);
          if (!p) {
            const [a, b] = key.split("|");
            p = {
              a,
              b,
              shifts: 0,
              sum_conversion: 0,
              sum_aov: 0,
              sum_revenue: 0,
            };
            pairMap.set(key, p);
          }
          p.shifts += 1;
          p.sum_conversion += conv;
          p.sum_aov += aov;
          p.sum_revenue += rev;
        }
      }
    }

    // Izvedene metrike i partner enrichment
    const rows: WorkerRankRow[] = [];
    for (const row of acc.values()) {
      row.conversion =
        row.entries_share > 0
          ? (row.buyers_share / row.entries_share) * 100
          : 0;
      row.aov = row.buyers_share > 0 ? row.revenue_share / row.buyers_share : 0;
      row.eligible_for_rank = row.shifts_count >= MIN_SHIFTS_FOR_RANK;

      // Partneri: skupi sve parove gde figuriše ovaj worker_id
      const partners: PairSummary[] = [];
      for (const p of pairMap.values()) {
        if (p.shifts < MIN_PAIR_SHIFTS) continue;
        let partner_id: string | null = null;
        if (p.a === row.worker_id) partner_id = p.b;
        else if (p.b === row.worker_id) partner_id = p.a;
        if (!partner_id) continue;
        const partnerW = workerMap.get(partner_id);
        if (!partnerW) continue;
        partners.push({
          partner_id,
          partner_initials: partnerW.initials,
          shifts_count: p.shifts,
          avg_conversion: p.sum_conversion / p.shifts,
          avg_aov: p.sum_aov / p.shifts,
          avg_revenue_per_shift: p.sum_revenue / p.shifts,
        });
      }
      if (partners.length > 0) {
        const sortedByConv = [...partners].sort(
          (x, y) => y.avg_conversion - x.avg_conversion
        );
        row.best_partner = sortedByConv[0];
        row.worst_partner = sortedByConv[sortedByConv.length - 1];
        // ako ima samo jedan par, best i worst su isti — to je ok (transparentnost)
      }

      rows.push(row);
    }

    const ranked = rows
      .filter((r) => r.eligible_for_rank)
      .sort((a, b) => b.conversion - a.conversion);
    const insufficient_data = rows
      .filter((r) => !r.eligible_for_rank)
      .sort((a, b) => b.shifts_count - a.shifts_count);

    return {
      store_id: store.id,
      store_name: store.name,
      ranked,
      insufficient_data,
      total_shifts_in_range: storeShifts.length,
    };
  });

  return { start: startDate, end: endDate, per_store };
}

/**
 * Za dati niz worker_id-ova (iz jedne konkretne smene) vrati istorijski profil
 * te kombinacije u poslednjih `days` dana: broj smena, prosek konverzije, AOV.
 * Ako kombinacija ima manje od MIN_PAIR_SHIFTS zajedničkih smena → vraća null
 * (nedovoljno podataka).
 *
 * Koristi se u /admin/izvestaj/[datum] i za /unos widget.
 */
export async function loadCombinationProfile(
  storeId: string,
  workerIds: string[],
  days = 30
): Promise<{
  shifts_count: number;
  avg_conversion: number;
  avg_aov: number;
  avg_revenue: number;
  sufficient: boolean;
  min_required: number;
} | null> {
  if (workerIds.length < 2) return null;
  const supabase = createSupabaseServer();
  const from = daysAgo(days);

  const { data } = await supabase
    .from("shifts")
    .select("worker_ids, entries, buyers, revenue, shift_date")
    .eq("store_id", storeId)
    .gte("shift_date", from);

  const rows = (data ?? []) as Array<{
    worker_ids: string[];
    entries: number;
    buyers: number;
    revenue: number;
    shift_date: string;
  }>;

  // Filtriraj na smene koje sadrže SVE date worker_id-ove (bar kao podskup)
  const wanted = new Set(workerIds);
  const matching = rows.filter((r) => {
    const ids = Array.isArray(r.worker_ids) ? r.worker_ids : [];
    if (ids.length < workerIds.length) return false;
    for (const w of wanted) if (!ids.includes(w)) return false;
    return true;
  });

  if (matching.length === 0) {
    return {
      shifts_count: 0,
      avg_conversion: 0,
      avg_aov: 0,
      avg_revenue: 0,
      sufficient: false,
      min_required: MIN_PAIR_SHIFTS,
    };
  }

  let sumConv = 0;
  let sumAov = 0;
  let sumRev = 0;
  for (const r of matching) {
    const conv = r.entries > 0 ? (r.buyers / r.entries) * 100 : 0;
    const rev = Number(r.revenue) || 0;
    const aov = r.buyers > 0 ? rev / r.buyers : 0;
    sumConv += conv;
    sumAov += aov;
    sumRev += rev;
  }
  const n = matching.length;
  return {
    shifts_count: n,
    avg_conversion: sumConv / n,
    avg_aov: sumAov / n,
    avg_revenue: sumRev / n,
    sufficient: n >= MIN_PAIR_SHIFTS,
    min_required: MIN_PAIR_SHIFTS,
  };
}
