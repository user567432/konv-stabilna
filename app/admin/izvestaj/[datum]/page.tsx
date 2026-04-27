import { isAdminAuthed } from "@/lib/admin-auth";
import AdminGate from "../../AdminGate";
import { createSupabaseServer } from "@/lib/supabase";
import { formatRSD, formatPct, formatDateSr, SHIFT_LABELS } from "@/lib/format";
import type { Shift, Worker, Store, Settings } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import PrintButton from "@/components/PrintButton";
import { loadCombinationProfile, MIN_PAIR_SHIFTS } from "@/lib/worker-stats";

export const dynamic = "force-dynamic";

interface Props {
  params: { datum: string };
}

export default async function DailyReportPage({ params }: Props) {
  if (!(await isAdminAuthed())) return <AdminGate />;

  const datum = params.datum;
  const supabase = createSupabaseServer();

  const [{ data: shifts }, { data: workers }, { data: stores }, { data: settings }] =
    await Promise.all([
      supabase.from("shifts").select("*").eq("shift_date", datum).order("store_id"),
      supabase.from("workers").select("*"),
      supabase.from("stores").select("*").order("id"),
      supabase.from("settings").select("*"),
    ]);

  const workerMap = new Map<string, Worker>();
  (workers ?? []).forEach((w) => workerMap.set(w.id, w));

  const settingsGlobal = (settings ?? []).find((s) => s.store_id === null) as
    | Settings
    | undefined;
  const settingsByStore = new Map<string, Settings>();
  (settings ?? []).forEach((s) => {
    if (s.store_id) settingsByStore.set(s.store_id, s as Settings);
  });

  const convTargetGlobal = Number(settingsGlobal?.conversion_target ?? 15);
  const aovTargetGlobal = Number(settingsGlobal?.aov_target ?? 3000);

  const rows = (shifts ?? []) as Shift[];
  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue), 0);
  const totalEntries = rows.reduce((s, r) => s + r.entries, 0);
  const totalBuyers = rows.reduce((s, r) => s + r.buyers, 0);
  const totalItems = rows.reduce((s, r) => s + r.items_sold, 0);
  const overallConv = totalEntries > 0 ? (totalBuyers / totalEntries) * 100 : 0;
  const overallAov = totalBuyers > 0 ? totalRevenue / totalBuyers : 0;

  // Group per store
  const perStore = (stores ?? []).map((s) => {
    const storeRows = rows.filter((r) => r.store_id === s.id);
    const storeRevenue = storeRows.reduce((sum, r) => sum + Number(r.revenue), 0);
    const storeEntries = storeRows.reduce((sum, r) => sum + r.entries, 0);
    const storeBuyers = storeRows.reduce((sum, r) => sum + r.buyers, 0);
    const storeItems = storeRows.reduce((sum, r) => sum + r.items_sold, 0);
    return {
      store: s as Store,
      rows: storeRows,
      revenue: storeRevenue,
      entries: storeEntries,
      buyers: storeBuyers,
      items: storeItems,
      conversion: storeEntries > 0 ? (storeBuyers / storeEntries) * 100 : 0,
      aov: storeBuyers > 0 ? storeRevenue / storeBuyers : 0,
    };
  });

  // --- Partner (combination) analiza: za svaku DISTINCT kombinaciju radnica
  //     koja je radila danas — izvadi 30-dnevni baseline te iste kombinacije.
  //     Ključ je sortirana lista worker_ids u smeni (uključujemo sve članove smene,
  //     ne samo parove — tako se poštuje stvarna kompozicija smene).
  function shiftWorkerIds(r: Shift): string[] {
    const ids = Array.isArray(r.worker_ids) ? r.worker_ids : [];
    if (ids.length > 0) return [...ids].sort();
    if (r.worker_id) return [r.worker_id];
    return [];
  }

  interface ComboToday {
    key: string;
    store_id: string;
    worker_ids: string[];
    initials: string[]; // sorted za stabilan prikaz
    today: {
      revenue: number;
      entries: number;
      buyers: number;
      conversion: number;
      aov: number;
      shifts_count: number;
    };
    baseline: {
      shifts_count: number;
      avg_conversion: number;
      avg_aov: number;
      avg_revenue: number;
      sufficient: boolean;
      min_required: number;
    } | null;
  }

  const combosMap = new Map<string, ComboToday>();
  for (const r of rows) {
    const ids = shiftWorkerIds(r);
    if (ids.length < 2) continue; // singlovi nisu kombinacija
    const key = `${r.store_id}::${ids.join(",")}`;
    let combo = combosMap.get(key);
    if (!combo) {
      combo = {
        key,
        store_id: r.store_id,
        worker_ids: ids,
        initials: ids
          .map((id) => workerMap.get(id)?.initials ?? "?")
          .sort((a, b) => a.localeCompare(b, "sr-RS")),
        today: {
          revenue: 0,
          entries: 0,
          buyers: 0,
          conversion: 0,
          aov: 0,
          shifts_count: 0,
        },
        baseline: null,
      };
      combosMap.set(key, combo);
    }
    combo.today.revenue += Number(r.revenue) || 0;
    combo.today.entries += r.entries;
    combo.today.buyers += r.buyers;
    combo.today.shifts_count += 1;
  }
  // izvedeni dnevni prosek po kombinaciji
  for (const c of combosMap.values()) {
    c.today.conversion =
      c.today.entries > 0 ? (c.today.buyers / c.today.entries) * 100 : 0;
    c.today.aov = c.today.buyers > 0 ? c.today.revenue / c.today.buyers : 0;
  }
  // paralelno učitaj baseline profile (30 dana)
  const comboList = Array.from(combosMap.values());
  const baselines = await Promise.all(
    comboList.map((c) => loadCombinationProfile(c.store_id, c.worker_ids, 30))
  );
  comboList.forEach((c, i) => {
    c.baseline = baselines[i] ?? null;
  });
  // group po radnji za lakši render
  const combosByStore = new Map<string, ComboToday[]>();
  for (const c of comboList) {
    const arr = combosByStore.get(c.store_id) ?? [];
    arr.push(c);
    combosByStore.set(c.store_id, arr);
  }

  // Best / worst
  const nonEmpty = perStore.filter((p) => p.rows.length > 0);
  const best = nonEmpty.length > 0
    ? [...nonEmpty].sort((a, b) => b.revenue - a.revenue)[0]
    : null;
  const worst = nonEmpty.length > 1
    ? [...nonEmpty].sort((a, b) => a.revenue - b.revenue)[0]
    : null;

  return (
    <main className="min-h-screen bg-ink-50/30 print:bg-white">
      <header className="bg-white border-b border-ink-100 print:hidden">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-ink-700 font-semibold"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <div className="flex gap-2">
            <PrintButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-6 print:py-4">
        <section>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Dnevni izveštaj
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
            {formatDateSr(datum)}
          </h1>
          <p className="mt-2 text-ink-500">
            Ukupno {rows.length} {rows.length === 1 ? "smena" : "smena"} iz{" "}
            {nonEmpty.length} / {stores?.length ?? 4} {nonEmpty.length === 1 ? "radnje" : "radnji"}.
          </p>
        </section>

        {/* Summary */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card">
            <div className="kpi-label">Ukupan promet</div>
            <div className="kpi-value">{formatRSD(totalRevenue)}</div>
          </div>
          <div className="card">
            <div className="kpi-label">Konverzija</div>
            <div className="kpi-value">{formatPct(overallConv)}</div>
            <div className="text-xs text-ink-500 mt-1">
              cilj {formatPct(convTargetGlobal)}
            </div>
          </div>
          <div className="card">
            <div className="kpi-label">Prosečna vrednost računa</div>
            <div className="kpi-value">{formatRSD(overallAov)}</div>
            <div className="text-xs text-ink-500 mt-1">
              cilj {formatRSD(aovTargetGlobal)}
            </div>
          </div>
          <div className="card">
            <div className="kpi-label">Ulasci · Broj računa · Artikli</div>
            <div className="kpi-value">
              {totalEntries} · {totalBuyers} · {totalItems}
            </div>
          </div>
        </section>

        {/* Insights */}
        {nonEmpty.length > 0 && (
          <section className="card-soft">
            <h3 className="font-bold text-ink-900 mb-3">Zaključak dana</h3>
            <ul className="space-y-2 text-ink-700">
              {best && (
                <li className="flex gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Najbolja radnja: <b>{best.store.id}</b> {best.store.name} ·{" "}
                    <b>{formatRSD(best.revenue)}</b> prometa · konverzija{" "}
                    <b>{formatPct(best.conversion)}</b>.
                  </span>
                </li>
              )}
              {worst && best && worst.store.id !== best.store.id && (
                <li className="flex gap-2">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Najslabija radnja: <b>{worst.store.id}</b> {worst.store.name} ·{" "}
                    <b>{formatRSD(worst.revenue)}</b> prometa · konverzija{" "}
                    <b>{formatPct(worst.conversion)}</b>. Razmotri da se proveri postavka
                    izloga i prisustvo tima na ulazu.
                  </span>
                </li>
              )}
              {overallConv < convTargetGlobal ? (
                <li className="flex gap-2">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Prosečna konverzija (<b>{formatPct(overallConv)}</b>) je ispod cilja (
                    <b>{formatPct(convTargetGlobal)}</b>). Gap:{" "}
                    <b>{(convTargetGlobal - overallConv).toFixed(1).replace(".", ",")}</b> p.p.
                  </span>
                </li>
              ) : (
                <li className="flex gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Konverzija je na ili iznad cilja (<b>{formatPct(convTargetGlobal)}</b>). Odlično.
                  </span>
                </li>
              )}
              {overallAov < aovTargetGlobal ? (
                <li className="flex gap-2">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Prosečna vrednost računa (<b>{formatRSD(overallAov)}</b>) je ispod cilja (
                    <b>{formatRSD(aovTargetGlobal)}</b>). Fokus na upsell i dodatne artikle.
                  </span>
                </li>
              ) : (
                <li className="flex gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>Prosečna vrednost računa je na cilju — tim uspešno prodaje više artikala po računu.</span>
                </li>
              )}
            </ul>
          </section>
        )}

        {/* Per-store breakdown */}
        {perStore.map((p) => (
          <section key={p.store.id} className="card-soft">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-ink-900 text-white px-2 py-0.5 rounded">
                    {p.store.id}
                  </span>
                  <h3 className="font-bold text-ink-900">{p.store.name}</h3>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums">{formatRSD(p.revenue)}</div>
                <div className="text-xs text-ink-500 tabular-nums">
                  {p.entries} ulaza · {p.buyers} računa · {formatPct(p.conversion)}
                </div>
              </div>
            </div>

            {p.rows.length === 0 ? (
              <p className="text-sm text-ink-400 italic">
                Nema unesenih smena za ovaj dan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-ink-500 font-semibold uppercase">
                      <th className="text-left py-2">Smena</th>
                      <th className="text-left py-2">Član tima</th>
                      <th className="text-right py-2">Ulasci</th>
                      <th className="text-right py-2">Broj računa</th>
                      <th className="text-right py-2">Konverzija</th>
                      <th className="text-right py-2">Pr. vr. rač.</th>
                      <th className="text-right py-2">Artikli</th>
                      <th className="text-right py-2">Promet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {p.rows.map((r) => {
                      const ids = shiftWorkerIds(r);
                      const initialsList = ids
                        .map((id) => workerMap.get(id)?.initials ?? "?")
                        .sort((a, b) => a.localeCompare(b, "sr-RS"))
                        .join(" + ");
                      return (
                        <tr key={r.id}>
                          <td className="py-2 text-ink-500">
                            {SHIFT_LABELS[r.shift_type]}
                          </td>
                          <td className="py-2 font-semibold">
                            {initialsList || "?"}
                          </td>
                          <td className="py-2 text-right tabular-nums">{r.entries}</td>
                          <td className="py-2 text-right tabular-nums">{r.buyers}</td>
                          <td className="py-2 text-right tabular-nums">
                            {formatPct(Number(r.conversion_pct))}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatRSD(Number(r.aov))}
                          </td>
                          <td className="py-2 text-right tabular-nums">{r.items_sold}</td>
                          <td className="py-2 text-right tabular-nums font-bold">
                            {formatRSD(Number(r.revenue))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {p.rows.some((r) => r.note) && (
                  <div className="mt-4 pt-3 border-t border-ink-100">
                    <div className="text-xs font-bold text-ink-500 uppercase mb-2">
                      Napomene
                    </div>
                    <ul className="space-y-1 text-sm text-ink-700">
                      {p.rows
                        .filter((r) => r.note)
                        .map((r) => {
                          const ids = shiftWorkerIds(r);
                          const label = ids
                            .map((id) => workerMap.get(id)?.initials ?? "?")
                            .sort((a, b) => a.localeCompare(b, "sr-RS"))
                            .join(" + ");
                          return (
                            <li key={r.id}>
                              <b>{label || "?"}:</b> {r.note}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}

                {/* Partner (kombinacija) analiza: danas vs 30-dnevni prosek */}
                {(combosByStore.get(p.store.id) ?? []).length > 0 && (
                  <div className="mt-4 pt-3 border-t border-ink-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Users size={16} className="text-ink-500" />
                      <div className="text-xs font-bold text-ink-500 uppercase">
                        Kombinacije danas · 30-dnevni prosek
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(combosByStore.get(p.store.id) ?? []).map((c) => {
                        const base = c.baseline;
                        const delta =
                          base && base.sufficient
                            ? c.today.conversion - base.avg_conversion
                            : null;
                        const deltaPositive = delta !== null && delta >= 0;
                        return (
                          <div
                            key={c.key}
                            className="rounded-lg bg-ink-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono font-bold text-ink-900">
                                {c.initials.join(" + ")}
                              </span>
                              <span className="text-xs text-ink-500">
                                {c.today.shifts_count}{" "}
                                {c.today.shifts_count === 1 ? "smena" : "smene"} danas
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="tabular-nums">
                                Danas:{" "}
                                <b className="text-ink-900">
                                  {formatPct(c.today.conversion)}
                                </b>
                              </span>
                              {base && base.sufficient ? (
                                <>
                                  <span className="tabular-nums text-ink-500">
                                    30d prosek:{" "}
                                    <b className="text-ink-700">
                                      {formatPct(base.avg_conversion)}
                                    </b>{" "}
                                    <span className="text-ink-400">
                                      ({base.shifts_count} sm.)
                                    </span>
                                  </span>
                                  {delta !== null && (
                                    <span
                                      className={
                                        deltaPositive
                                          ? "tabular-nums font-bold text-emerald-700"
                                          : "tabular-nums font-bold text-rose-700"
                                      }
                                    >
                                      {deltaPositive ? "+" : ""}
                                      {delta.toFixed(1).replace(".", ",")} p.p.
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-ink-400 italic">
                                  Nedovoljno istorije (min {MIN_PAIR_SHIFTS} zajedničkih
                                  smena u 30 dana)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
