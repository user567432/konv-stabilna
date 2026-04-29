"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ArrowLeft,
  Wallet,
  Save,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Wand2,
} from "lucide-react";
import clsx from "clsx";
import { createSupabaseBrowser } from "@/lib/supabase";
import { formatRSD, STORE_LABELS_SHORT } from "@/lib/format";
import LogoutButton from "../../LogoutButton";
import type { Worker } from "@/lib/types";
import type { SalaryRow } from "./page";

interface Props {
  workers: Worker[];
  salaries: SalaryRow[];
  baseSalaries: Record<string, number | null>;
  activeStore: string;
  endYear: number;
  endMonth: number;
  monthsVisible: number;
}

const STORES = [
  { id: "D1", label: "D1" },
  { id: "D2", label: "D2" },
  { id: "D4", label: "D4" },
  { id: "D5", label: "D5" },
];

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Maj",
  "Jun",
  "Jul",
  "Avg",
  "Sep",
  "Okt",
  "Nov",
  "Dec",
];

const MONTH_NAMES_FULL = [
  "Januar",
  "Februar",
  "Mart",
  "April",
  "Maj",
  "Jun",
  "Jul",
  "Avgust",
  "Septembar",
  "Oktobar",
  "Novembar",
  "Decembar",
];

interface Period {
  year: number;
  month: number;
}

function buildPeriods(endYear: number, endMonth: number, count: number): Period[] {
  const out: Period[] = [];
  for (let i = 0; i < count; i++) {
    let total = endYear * 12 + (endMonth - 1) - i;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    out.push({ year: y, month: m });
  }
  return out;
}

function shiftPeriod(year: number, month: number, delta: number): Period {
  const total = year * 12 + (month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { year: y, month: m };
}

function periodKey(workerId: string, year: number, month: number): string {
  return `${workerId}|${year}|${month}`;
}

interface CellValues {
  fixed: number;
  variable: number;
}

export default function PlateClient({
  workers,
  salaries,
  baseSalaries,
  activeStore,
  endYear,
  endMonth,
  monthsVisible,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const periods = useMemo(
    () => buildPeriods(endYear, endMonth, monthsVisible),
    [endYear, endMonth, monthsVisible]
  );

  const [cellMap, setCellMap] = useState<Map<string, CellValues>>(() => {
    const m = new Map<string, CellValues>();
    salaries.forEach((s) => {
      if (s.year != null && s.month != null) {
        m.set(periodKey(s.worker_id, s.year, s.month), {
          fixed: s.fixed_amount ?? 0,
          variable: s.variable_amount ?? 0,
        });
      }
    });
    return m;
  });

  const [editing, setEditing] = useState<{
    workerId: string;
    initials: string;
    year: number;
    month: number;
    fixed: string;
    variable: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const storeWorkers = useMemo(
    () => workers.filter((w) => w.store_id === activeStore),
    [workers, activeStore]
  );

  function gotoStore(storeId: string) {
    const sp = new URLSearchParams();
    sp.set("store", storeId);
    sp.set("end_year", String(endYear));
    sp.set("end_month", String(endMonth));
    router.push(`${pathname}?${sp.toString()}`);
  }

  function shiftMonths(delta: number) {
    const p = shiftPeriod(endYear, endMonth, delta);
    const sp = new URLSearchParams();
    sp.set("store", activeStore);
    sp.set("end_year", String(p.year));
    sp.set("end_month", String(p.month));
    router.push(`${pathname}?${sp.toString()}`);
  }

  function jumpToCurrent() {
    const today = new Date();
    const sp = new URLSearchParams();
    sp.set("store", activeStore);
    sp.set("end_year", String(today.getFullYear()));
    sp.set("end_month", String(today.getMonth() + 1));
    router.push(`${pathname}?${sp.toString()}`);
  }

  function openEdit(worker: Worker, year: number, month: number) {
    const existing = cellMap.get(periodKey(worker.id, year, month));
    const fallbackBase = baseSalaries[worker.id];
    const initialFixed =
      existing?.fixed != null && existing.fixed > 0
        ? String(existing.fixed).replace(".", ",")
        : fallbackBase != null
          ? String(fallbackBase).replace(".", ",")
          : "";
    const initialVar =
      existing?.variable != null && existing.variable > 0
        ? String(existing.variable).replace(".", ",")
        : "";
    setEditing({
      workerId: worker.id,
      initials: worker.initials,
      year,
      month,
      fixed: initialFixed,
      variable: initialVar,
    });
    setErr(null);
  }

  async function saveEdit() {
    if (!editing) return;
    const parse = (s: string): number | null => {
      const cleaned = s.trim().replace(",", ".");
      if (cleaned === "") return 0;
      const n = Number(cleaned);
      if (!Number.isFinite(n) || n < 0) return null;
      return n;
    };
    const f = parse(editing.fixed);
    const v = parse(editing.variable);
    if (f === null || v === null) {
      setErr("Iznosi moraju biti broj (ne negativan).");
      return;
    }

    const key = periodKey(editing.workerId, editing.year, editing.month);
    const prev = cellMap.get(key);
    setBusy(true);
    setErr(null);

    const next = new Map(cellMap);
    next.set(key, { fixed: f, variable: v });
    setCellMap(next);

    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("upsert_monthly_salary", {
        p_worker_id: editing.workerId,
        p_year: editing.year,
        p_month: editing.month,
        p_fixed_amount: f,
        p_variable_amount: v,
        p_paid_at: null,
        p_note: null,
      });
      if (error) throw new Error(error.message);
      setEditing(null);
    } catch (e: unknown) {
      const back = new Map(cellMap);
      if (prev) back.set(key, prev);
      else back.delete(key);
      setCellMap(back);
      setErr(
        e instanceof Error ? `Snimanje neuspešno: ${e.message}` : "Snimanje neuspešno."
      );
    } finally {
      setBusy(false);
    }
  }

  // Sumacije po koloni za store-workers
  function totalForMonth(year: number, month: number, kind: "fixed" | "variable" | "total"): number {
    let sum = 0;
    for (const w of storeWorkers) {
      const cell = cellMap.get(periodKey(w.id, year, month));
      if (!cell) continue;
      if (kind === "fixed") sum += cell.fixed;
      else if (kind === "variable") sum += cell.variable;
      else sum += cell.fixed + cell.variable;
    }
    return sum;
  }

  const today = new Date();
  const isCurrent =
    endYear === today.getFullYear() && endMonth === today.getMonth() + 1;

  const [autoBusy, setAutoBusy] = useState(false);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);

  async function autoCompute() {
    if (!confirm(
      `Auto-popuni plate za ${MONTH_NAMES_FULL[endMonth - 1]} ${endYear}? ` +
      `Sistem će:\n\n• Postaviti F = fiksna plata radnice\n• Izračunati V iz % targeta radnje × kategorija meseca\n\n` +
      `Ručno upisane vrednosti će se prepisati. Nastavi?`
    )) return;
    setAutoBusy(true);
    setAutoMsg(null);
    try {
      const res = await fetch("/api/compute-monthly-bonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: endYear, month: endMonth }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Greška.");
      setAutoMsg(`Ažurirano ${j.updated ?? 0} radnica za ${MONTH_NAMES_SHORT[endMonth - 1]} ${endYear}. Osveži stranicu da vidiš.`);
      // Hard refresh za prikaz novih vrednosti
      setTimeout(() => router.refresh(), 800);
    } catch (e: unknown) {
      setAutoMsg(
        e instanceof Error ? `Greška: ${e.message}` : "Auto-popuna nije uspela."
      );
    } finally {
      setAutoBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/master/hr"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> HR
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900">Plate</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Wallet className="w-8 h-8 text-ink-700" />
            Plate
          </h1>
          <p className="mt-1 text-ink-500">
            6-mesečni pregled po radnji. Za svaki mesec uneseš F (fiksnu) i V
            (varijabilnu) zasebno. Ukupno = F + V.
          </p>
        </section>

        {/* Store tabs */}
        <section className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 flex-wrap">
            {STORES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => gotoStore(s.id)}
                className={
                  activeStore === s.id
                    ? "px-4 py-2.5 rounded-xl bg-ink-900 text-white text-sm font-bold"
                    : "px-4 py-2.5 rounded-xl bg-white border border-ink-200 text-sm text-ink-700 hover:bg-ink-100"
                }
              >
                <span className="font-bold">{s.id}</span>{" "}
                <span className="opacity-70">
                  {STORE_LABELS_SHORT[s.id]?.replace(`${s.id} `, "") ?? ""}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Month navigation */}
        <section className="card-soft">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => shiftMonths(-1)}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 text-sm font-semibold"
            >
              <ChevronLeft size={16} /> Stariji
            </button>
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">
                Pregled
              </div>
              <div className="text-base font-bold text-ink-900 tabular-nums">
                {MONTH_NAMES_SHORT[periods[periods.length - 1].month - 1]}{" "}
                {periods[periods.length - 1].year} —{" "}
                {MONTH_NAMES_SHORT[periods[0].month - 1]} {periods[0].year}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isCurrent && (
                <button
                  type="button"
                  onClick={jumpToCurrent}
                  className="text-xs h-10 px-3 rounded-lg bg-ink-900 text-white font-semibold"
                >
                  Idi na sada
                </button>
              )}
              <button
                type="button"
                onClick={() => shiftMonths(1)}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 text-sm font-semibold"
              >
                Noviji <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {err && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{err}</span>
            <button
              type="button"
              onClick={() => setErr(null)}
              className="ml-auto text-rose-700 hover:text-rose-900 text-xs font-semibold"
            >
              Zatvori
            </button>
          </div>
        )}

        {/* Auto-compute akcija */}
        <section className="card-soft bg-amber-50/50 border-amber-100">
          <div className="flex items-start gap-3">
            <Wand2 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-ink-900">
                Auto-popuna plata za{" "}
                {MONTH_NAMES_FULL[endMonth - 1]} {endYear}
              </div>
              <div className="text-xs text-ink-500 mt-0.5 leading-relaxed">
                Klikom sistem postavlja F = fiksna plata svake radnice, V = bonus
                pool radnje (po targetu i kategoriji) ÷ broj aktivnih radnica.
                Cron radi 1. svakog meseca u 06:00 za prethodni mesec.
              </div>
              {autoMsg && (
                <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                  {autoMsg}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={autoCompute}
              disabled={autoBusy}
              className="h-10 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {autoBusy ? "Računam…" : <><Wand2 size={14} /> Auto-popuni</>}
            </button>
          </div>
        </section>


        {/* Tabela radnja */}
        <section className="card-soft">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wider font-bold text-ink-500">
                Radnja
              </div>
              <div className="font-bold text-ink-900">
                {STORE_LABELS_SHORT[activeStore] ?? activeStore}
              </div>
            </div>
            <div className="text-xs text-ink-500">
              {storeWorkers.length} radnica · klikni ćeliju za izmenu
            </div>
          </div>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-2 text-xs font-semibold uppercase tracking-wider text-ink-500 sticky left-0 bg-white z-10 border-b border-ink-100 min-w-[80px]">
                    Radnica
                  </th>
                  {periods.map((p) => (
                    <th
                      key={`${p.year}-${p.month}`}
                      className="py-2 px-2 text-center text-xs font-semibold text-ink-500 border-b border-ink-100 min-w-[140px]"
                    >
                      <div className="text-[12px] font-bold text-ink-900 normal-case">
                        {MONTH_NAMES_SHORT[p.month - 1]}{" "}
                        <span className="opacity-50">
                          {String(p.year).slice(2)}
                        </span>
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-ink-400 mt-0.5">
                        F / V / Σ
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {storeWorkers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={periods.length + 1}
                      className="py-8 text-center text-ink-400 text-sm italic"
                    >
                      Nema aktivnih radnica u radnji {activeStore}.
                    </td>
                  </tr>
                ) : (
                  storeWorkers.map((w) => (
                    <tr key={w.id} className="border-t border-ink-100">
                      <td className="py-2.5 px-2 sticky left-0 bg-white z-10">
                        <span className="font-mono font-bold text-ink-900">
                          {w.initials}
                        </span>
                      </td>
                      {periods.map((p) => {
                        const cell = cellMap.get(
                          periodKey(w.id, p.year, p.month)
                        );
                        const hasValue = cell != null;
                        const total = cell ? cell.fixed + cell.variable : 0;
                        return (
                          <td
                            key={`${w.id}-${p.year}-${p.month}`}
                            className="py-1.5 px-1.5 text-right"
                          >
                            <button
                              type="button"
                              onClick={() => openEdit(w, p.year, p.month)}
                              className={clsx(
                                "w-full min-h-[58px] px-2 py-1.5 rounded-md text-right tabular-nums text-xs transition group flex flex-col justify-center",
                                hasValue
                                  ? "bg-white hover:bg-ink-50 border border-transparent hover:border-ink-200"
                                  : "border border-dashed border-ink-200 hover:border-ink-400 hover:bg-ink-50 text-ink-400"
                              )}
                            >
                              {hasValue ? (
                                <>
                                  <div className="text-[10px] text-ink-500 font-medium">
                                    F:{" "}
                                    {cell.fixed > 0
                                      ? formatRSD(cell.fixed).replace(" RSD", "")
                                      : "—"}
                                  </div>
                                  <div className="text-[10px] text-ink-500 font-medium">
                                    V:{" "}
                                    {cell.variable > 0
                                      ? formatRSD(cell.variable).replace(" RSD", "")
                                      : "—"}
                                  </div>
                                  <div className="text-sm font-bold text-ink-900 mt-0.5 border-t border-ink-100 pt-0.5">
                                    {formatRSD(total).replace(" RSD", "")}
                                  </div>
                                </>
                              ) : (
                                <span className="text-xs">+ unesi</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
                {storeWorkers.length > 0 && (
                  <tr className="border-t-2 border-ink-200 bg-ink-50/40">
                    <td className="py-2.5 px-2 text-xs font-bold uppercase tracking-wider text-ink-700 sticky left-0 bg-ink-50/40 z-10">
                      Ukupno
                    </td>
                    {periods.map((p) => {
                      const tF = totalForMonth(p.year, p.month, "fixed");
                      const tV = totalForMonth(p.year, p.month, "variable");
                      const tT = tF + tV;
                      return (
                        <td
                          key={`tot-${p.year}-${p.month}`}
                          className="py-2.5 px-2 text-right tabular-nums text-xs"
                        >
                          <div className="text-[10px] text-ink-500">
                            F: {tF > 0 ? formatRSD(tF).replace(" RSD", "") : "—"}
                          </div>
                          <div className="text-[10px] text-ink-500">
                            V: {tV > 0 ? formatRSD(tV).replace(" RSD", "") : "—"}
                          </div>
                          <div className="font-bold text-ink-900 border-t border-ink-200 pt-0.5 mt-0.5">
                            {tT > 0 ? formatRSD(tT).replace(" RSD", "") : "—"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="text-xs text-ink-500 leading-relaxed">
          F = fiksna plata, V = varijabilna (bonus). Iznosi u RSD. Strelice
          gore vode 1 mesec u prošlost / budućnost. „Idi na sada" vraća na
          tekući mesec.
        </section>
      </div>

      {/* Editor modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setEditing(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-ink-900">
                  Plata za <span className="font-mono">{editing.initials}</span>
                </h3>
                <p className="text-xs text-ink-500">
                  {MONTH_NAMES_FULL[editing.month - 1]} {editing.year}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={busy}
                className="p-1.5 rounded hover:bg-ink-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  F — Fiksna plata (RSD)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input mt-2 text-lg font-mono tabular-nums"
                  value={editing.fixed}
                  onChange={(e) =>
                    setEditing({ ...editing, fixed: e.target.value })
                  }
                  placeholder="65000"
                  autoFocus
                />
                {(() => {
                  const baseSal = baseSalaries[editing.workerId];
                  const existingHasValue =
                    editing.fixed.trim() !== "" || editing.variable.trim() !== "";
                  if (baseSal == null || existingHasValue) return null;
                  return (
                    <p className="mt-1.5 text-[11px] text-sky-700">
                      Predlog iz fiksne plate radnice:{" "}
                      <b className="tabular-nums">
                        {baseSal.toLocaleString("sr-RS")} RSD
                      </b>
                    </p>
                  );
                })()}
              </div>

              <div>
                <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  V — Varijabilna / bonus (RSD)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input mt-2 text-lg font-mono tabular-nums"
                  value={editing.variable}
                  onChange={(e) =>
                    setEditing({ ...editing, variable: e.target.value })
                  }
                  placeholder="20000"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveEdit();
                    }
                  }}
                />
              </div>

              {(() => {
                const f = Number(editing.fixed.replace(",", ".")) || 0;
                const v = Number(editing.variable.replace(",", ".")) || 0;
                const t = f + v;
                if (t === 0) return null;
                return (
                  <div className="rounded-xl bg-ink-50 border border-ink-100 px-3 py-2.5 text-sm flex items-center justify-between">
                    <span className="text-ink-500 font-semibold uppercase tracking-wider text-xs">
                      Ukupno
                    </span>
                    <span className="font-bold text-ink-900 tabular-nums text-base">
                      {formatRSD(t)}
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="px-5 py-4 border-t border-ink-100 flex items-center justify-end gap-2 bg-ink-50/40">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={busy}
                className="btn-ghost"
              >
                Otkaži
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={busy}
                className="btn-primary"
              >
                {busy ? (
                  "Snimam…"
                ) : (
                  <>
                    <Save size={16} /> Sačuvaj
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
