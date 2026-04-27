"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRSD, formatPct, formatDateSr, SHIFT_LABELS } from "@/lib/format";
import type { Shift } from "@/lib/types";
import clsx from "clsx";
import { Pencil, AlertTriangle } from "lucide-react";
import ShiftEditModal from "./ShiftEditModal";

type Row = Shift & { worker_initials: string; anomaly_flag?: boolean };

export default function RecentShiftsTable({
  rows,
  conversionTarget,
}: {
  rows: Row[];
  conversionTarget: number;
}) {
  const [editing, setEditing] = useState<Shift | null>(null);
  // Lokalni state za optimistic update — sinhronizuje se sa props kad
  // dodje server refresh (router.refresh).
  const [localRows, setLocalRows] = useState<Row[]>(rows);
  useEffect(() => setLocalRows(rows), [rows]);
  const router = useRouter();

  return (
    <div className="card-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-ink-900">Poslednji unosi</h3>
          <p className="text-sm text-ink-500">Live - osvežava se automatski.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
          <span className="relative flex w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          LIVE
        </span>
      </div>

      <div className="overflow-x-auto -mx-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ink-500 font-semibold uppercase tracking-wide">
              <th className="text-left pl-6 py-2">Datum</th>
              <th className="text-left py-2">Radnja</th>
              <th className="text-left py-2">Član tima</th>
              <th className="text-left py-2">Smena</th>
              <th className="text-right py-2">Ulasci</th>
              <th className="text-right py-2">Broj računa</th>
              <th className="text-right py-2">Konverzija</th>
              <th className="text-right py-2">Pr. vr. rač.</th>
              <th className="text-right py-2">Promet</th>
              <th className="text-right pr-6 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-ink-400">
                  Još nema unosa — čim tim upiše smenu, biće ovde.
                </td>
              </tr>
            ) : (
              localRows.map((r) => (
                <tr
                  key={r.id}
                  className={clsx(
                    "hover:bg-ink-50",
                    r.anomaly_flag && "bg-amber-50/50"
                  )}
                >
                  <td className="pl-6 py-2.5 text-ink-700 tabular-nums">
                    {formatDateSr(r.shift_date)}
                  </td>
                  <td className="py-2.5">
                    <span className="text-xs font-bold text-ink-900">
                      {r.store_id}
                    </span>
                  </td>
                  <td className="py-2.5 font-semibold text-ink-900">
                    <span className="inline-flex items-center gap-1.5">
                      {r.worker_initials}
                      {r.anomaly_flag && (
                        <AlertTriangle
                          size={13}
                          className="text-amber-600"
                          aria-label="Neobična vrednost"
                        />
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 text-ink-500">
                    {SHIFT_LABELS[r.shift_type]}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{r.entries}</td>
                  <td className="py-2.5 text-right tabular-nums">{r.buyers}</td>
                  <td
                    className={clsx(
                      "py-2.5 text-right tabular-nums font-semibold",
                      Number(r.conversion_pct) >= conversionTarget
                        ? "text-emerald-700"
                        : "text-ink-700"
                    )}
                  >
                    {formatPct(Number(r.conversion_pct))}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {formatRSD(Number(r.aov))}
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-bold text-ink-900">
                    {formatRSD(Number(r.revenue))}
                  </td>
                  <td className="pr-6 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="p-1.5 rounded hover:bg-ink-100"
                      title="Izmeni smenu"
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

      {editing && (
        <ShiftEditModal
          shift={editing}
          onClose={() => setEditing(null)}
          onSaved={(payload) => {
            // Optimistic update — momentalno menjamo lokalni red,
            // pa server-refresh (router.refresh) sustize za par sekundi.
            if (payload.deleted) {
              setLocalRows((rs) => rs.filter((r) => r.id !== payload.id));
            } else {
              setLocalRows((rs) =>
                rs.map((r) =>
                  r.id === payload.shift.id
                    ? { ...r, ...payload.shift }
                    : r
                )
              );
            }
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
