"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Database,
  AlertTriangle,
} from "lucide-react";
import clsx from "clsx";
import { formatRSD, formatPct, formatDateSr, SHIFT_LABELS, STORE_LABELS_SHORT } from "@/lib/format";
import type { Shift, Worker } from "@/lib/types";
import ShiftEditModal from "@/components/ShiftEditModal";

type Row = Shift & { worker_initials: string };

interface Filters {
  store: string;   // "ALL" | "D1" | ...
  start: string;   // YYYY-MM-DD
  end: string;     // YYYY-MM-DD
  worker: string;  // "ALL" | worker uuid
  page: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STORES = ["D1", "D2", "D4", "D5"] as const;

export default function SviUnosiClient({
  rows,
  workers,
  filters,
  pagination,
  windowDays,
}: {
  rows: Row[];
  workers: Worker[];
  filters: Filters;
  pagination: Pagination;
  windowDays: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Lokalna kopija redova za optimistic update
  const [localRows, setLocalRows] = useState<Row[]>(rows);
  useEffect(() => setLocalRows(rows), [rows]);

  const [editing, setEditing] = useState<Shift | null>(null);

  // Lokalni state za filter-formu (commit u URL na "Primeni")
  const [draftStore, setDraftStore] = useState(filters.store);
  const [draftStart, setDraftStart] = useState(filters.start);
  const [draftEnd, setDraftEnd] = useState(filters.end);
  const [draftWorker, setDraftWorker] = useState(filters.worker);
  useEffect(() => {
    setDraftStore(filters.store);
    setDraftStart(filters.start);
    setDraftEnd(filters.end);
    setDraftWorker(filters.worker);
  }, [filters.store, filters.start, filters.end, filters.worker]);

  // Lista radnica filtrirana po izabranoj radnji (ako je izabrana)
  const visibleWorkers = useMemo(() => {
    const w = draftStore === "ALL" ? workers : workers.filter((x) => x.store_id === draftStore);
    return w.sort((a, b) => {
      if (a.store_id !== b.store_id) return a.store_id.localeCompare(b.store_id);
      return a.initials.localeCompare(b.initials);
    });
  }, [workers, draftStore]);

  function applyFilters() {
    // Reset page-a na 1 pri svakoj promeni filtera
    pushFilters({
      store: draftStore,
      start: draftStart,
      end: draftEnd,
      worker: draftWorker,
      page: 1,
    });
  }

  function resetFilters() {
    const today = new Date().toISOString().slice(0, 10);
    const defaultStart = (() => {
      const d = new Date();
      d.setDate(d.getDate() - (windowDays - 1));
      return d.toISOString().slice(0, 10);
    })();
    setDraftStore("ALL");
    setDraftStart(defaultStart);
    setDraftEnd(today);
    setDraftWorker("ALL");
    pushFilters({
      store: "ALL",
      start: defaultStart,
      end: today,
      worker: "ALL",
      page: 1,
    });
  }

  function pushFilters(f: Filters) {
    const sp = new URLSearchParams();
    if (f.store !== "ALL") sp.set("store", f.store);
    sp.set("start", f.start);
    sp.set("end", f.end);
    if (f.worker !== "ALL") sp.set("worker", f.worker);
    if (f.page > 1) sp.set("page", String(f.page));
    router.push(`${pathname}?${sp.toString()}`);
  }

  function changePage(newPage: number) {
    pushFilters({ ...filters, page: newPage });
  }

  // Sumacija (na trenutnoj stranici)
  const summary = useMemo(() => {
    const total = localRows.reduce(
      (acc, r) => {
        acc.entries += r.entries;
        acc.buyers += r.buyers;
        acc.revenue += Number(r.revenue);
        return acc;
      },
      { entries: 0, buyers: 0, revenue: 0 }
    );
    const conv = total.entries > 0 ? (total.buyers / total.entries) * 100 : 0;
    return { ...total, conv };
  }, [localRows]);

  const filtersActive =
    filters.store !== "ALL" ||
    filters.worker !== "ALL" ||
    filters.start !== defaultStartFor(windowDays) ||
    filters.end !== new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-ink-50/30">
      {/* Header */}
      <header className="bg-white border-b border-ink-100 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Nazad na dashboard
            </Link>
          </div>
          <div className="text-sm text-ink-500">
            {pagination.total.toLocaleString("sr-RS")} ukupno smena u rasponu
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Database className="w-8 h-8 text-ink-700" />
            Svi unosi
          </h1>
          <p className="mt-1 text-ink-500">
            Sve smene iz poslednjih {windowDays} dana. Klikni olovku za izmenu ili brisanje.
          </p>
        </section>

        {/* Filteri */}
        <section className="card-soft">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
              <Filter size={16} /> Filteri
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
              >
                <X size={12} /> Resetuj
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="label">Radnja</label>
              <select
                className="input"
                value={draftStore}
                onChange={(e) => {
                  setDraftStore(e.target.value);
                  // Ako se menja radnja, resetuj radnika ako ne pripada novoj radnji
                  if (e.target.value !== "ALL" && draftWorker !== "ALL") {
                    const w = workers.find((x) => x.id === draftWorker);
                    if (w && w.store_id !== e.target.value) setDraftWorker("ALL");
                  }
                }}
              >
                <option value="ALL">Sve radnje</option>
                {STORES.map((s) => (
                  <option key={s} value={s}>
                    {STORE_LABELS_SHORT[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Od datuma</label>
              <input
                type="date"
                className="input"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Do datuma</label>
              <input
                type="date"
                className="input"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Radnica</label>
              <select
                className="input"
                value={draftWorker}
                onChange={(e) => setDraftWorker(e.target.value)}
              >
                <option value="ALL">Sve radnice</option>
                {visibleWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.store_id} · {w.initials}
                    {!w.active ? " (neaktivna)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button type="button" onClick={applyFilters} className="btn-primary w-full">
                Primeni
              </button>
            </div>
          </div>
        </section>

        {/* Sumacija */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryTile label="Smena na stranici" value={localRows.length.toLocaleString("sr-RS")} />
          <SummaryTile label="Ulasci (zbir)" value={summary.entries.toLocaleString("sr-RS")} />
          <SummaryTile label="Promet (zbir)" value={formatRSD(summary.revenue)} />
          <SummaryTile
            label="Konverzija (zbir)"
            value={formatPct(summary.conv)}
            tone={summary.conv >= 15 ? "good" : "neutral"}
          />
        </section>

        {/* Tabela */}
        <section className="card-soft">
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ink-500 font-semibold uppercase tracking-wide border-b border-ink-100">
                  <th className="text-left pl-6 py-2">Datum</th>
                  <th className="text-left py-2">Radnja</th>
                  <th className="text-left py-2">Tim</th>
                  <th className="text-left py-2">Smena</th>
                  <th className="text-right py-2">Ulasci</th>
                  <th className="text-right py-2">Računa</th>
                  <th className="text-right py-2">Konverzija</th>
                  <th className="text-right py-2">Pr. vr. rač.</th>
                  <th className="text-right py-2">Promet</th>
                  <th className="text-left py-2">Napomena</th>
                  <th className="text-right pr-6 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {localRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-ink-400">
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle size={20} />
                        <div>Nijedna smena ne odgovara filterima.</div>
                        {filtersActive && (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="text-xs text-ink-700 underline"
                          >
                            Resetuj filtere
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  localRows.map((r) => (
                    <tr key={r.id} className="hover:bg-ink-50">
                      <td className="pl-6 py-2.5 text-ink-700 tabular-nums whitespace-nowrap">
                        {formatDateSr(r.shift_date)}
                      </td>
                      <td className="py-2.5">
                        <span className="text-xs font-bold text-ink-900">{r.store_id}</span>
                      </td>
                      <td className="py-2.5 font-mono font-semibold text-ink-900 whitespace-nowrap">
                        {r.worker_initials}
                      </td>
                      <td className="py-2.5 text-ink-500 whitespace-nowrap">
                        {SHIFT_LABELS[r.shift_type] ?? r.shift_type}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{r.entries}</td>
                      <td className="py-2.5 text-right tabular-nums">{r.buyers}</td>
                      <td
                        className={clsx(
                          "py-2.5 text-right tabular-nums font-semibold",
                          Number(r.conversion_pct) >= 15 ? "text-emerald-700" : "text-ink-700"
                        )}
                      >
                        {formatPct(Number(r.conversion_pct))}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatRSD(Number(r.aov))}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-bold text-ink-900 whitespace-nowrap">
                        {formatRSD(Number(r.revenue))}
                      </td>
                      <td className="py-2.5 text-ink-500 max-w-[200px] truncate">
                        {r.note ?? <span className="text-ink-300">—</span>}
                      </td>
                      <td className="pr-6 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(r)}
                          className="p-1.5 rounded hover:bg-ink-100"
                          title="Izmeni / obriši smenu"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginacija */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-4">
              <div className="text-xs text-ink-500">
                Strana <b>{pagination.page}</b> / {pagination.totalPages} ·{" "}
                {pagination.total.toLocaleString("sr-RS")} smena ukupno
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => changePage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-sm font-semibold bg-white border border-ink-200 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} /> Prethodna
                </button>
                <button
                  type="button"
                  onClick={() => changePage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-sm font-semibold bg-white border border-ink-200 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Sledeća <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {editing && (
        <ShiftEditModal
          shift={editing}
          onClose={() => setEditing(null)}
          onSaved={(payload) => {
            if (payload.deleted) {
              setLocalRows((rs) => rs.filter((r) => r.id !== payload.id));
            } else {
              setLocalRows((rs) =>
                rs.map((r) =>
                  r.id === payload.shift.id ? { ...r, ...payload.shift } : r
                )
              );
            }
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "neutral";
}) {
  return (
    <div className="card-soft">
      <div className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-1">
        {label}
      </div>
      <div
        className={clsx(
          "text-xl md:text-2xl font-bold tabular-nums",
          tone === "good" ? "text-emerald-700" : "text-ink-900"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function defaultStartFor(windowDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (windowDays - 1));
  return d.toISOString().slice(0, 10);
}
