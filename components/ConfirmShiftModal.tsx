"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, CheckCircle2, User } from "lucide-react";
import type { Worker } from "@/lib/types";
import { formatRSD, formatPct, SHIFT_LABELS } from "@/lib/format";

export interface SummaryRow {
  shift_type: "prva" | "druga" | "dvokratna";
  worker_ids: string[];
  entries: number;
  buyers: number;
  revenue: number;
  items_sold: number;
  note: string | null;
  anomaly?: { isAnomaly: boolean; reasons: string[] };
}

interface Props {
  storeId: string;
  shiftDate: string;
  rows: SummaryRow[];
  workers: Worker[];
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (closingWorkerId: string) => void;
}

export default function ConfirmShiftModal({
  storeId,
  shiftDate,
  rows,
  workers,
  submitting,
  onCancel,
  onConfirm,
}: Props) {
  const [closingWorkerId, setClosingWorkerId] = useState<string>("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);

  // Kandidati za „ko zatvara smenu" — sve radnice iz radnje koje su barem u jednoj smeni
  const candidateIds = new Set<string>();
  rows.forEach((r) => r.worker_ids.forEach((id) => candidateIds.add(id)));
  const candidates = workers.filter((w) => candidateIds.has(w.id));

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalEntries = rows.reduce((s, r) => s + r.entries, 0);
  const totalBuyers = rows.reduce((s, r) => s + r.buyers, 0);
  const totalItems = rows.reduce((s, r) => s + r.items_sold, 0);
  const totalConv = totalEntries > 0 ? (totalBuyers / totalEntries) * 100 : 0;
  const totalAov = totalBuyers > 0 ? totalRevenue / totalBuyers : 0;

  const anomalies = rows.filter((r) => r.anomaly?.isAnomaly);

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold text-ink-900">
              Proverite cifre, zatvorite smenu
            </h3>
            <p className="text-xs text-ink-500">
              {storeId} · {shiftDate}
            </p>
          </div>
          {!submitting && (
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded hover:bg-ink-100"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Anomaly upozorenje */}
          {anomalies.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">
                    Neki brojevi izgledaju neobično
                  </div>
                  <p className="text-sm">
                    Proveri da li je slučajno dopisana nula ili nedostaje cifra (npr. 1.000.000 umesto 100.000).
                  </p>
                  <ul className="list-disc pl-5 mt-1 text-sm space-y-0.5">
                    {anomalies.flatMap((a) =>
                      (a.anomaly?.reasons ?? []).map((r, i) => (
                        <li key={`${a.shift_type}-${i}`}>
                          <span className="font-semibold uppercase tracking-wide">
                            {SHIFT_LABELS[a.shift_type]}:
                          </span>{" "}
                          {r}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Pregled smena */}
          <div className="space-y-2">
            {rows.map((r) => {
              const initials = r.worker_ids
                .map((id) => workers.find((w) => w.id === id)?.initials ?? "?")
                .join(", ");
              return (
                <div
                  key={r.shift_type}
                  className="rounded-xl border border-ink-100 bg-ink-50/40 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-ink-900">
                      {SHIFT_LABELS[r.shift_type]}
                    </div>
                    <div className="text-xs text-ink-500 font-semibold">
                      {initials}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-sm">
                    <div>
                      <div className="text-[10px] uppercase text-ink-500">Ulasci</div>
                      <div className="font-semibold tabular-nums">
                        {r.entries}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-ink-500">Računi</div>
                      <div className="font-semibold tabular-nums">
                        {r.buyers}
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <div className="text-[10px] uppercase text-ink-500">Promet</div>
                      <div className="font-semibold tabular-nums break-words">
                        {formatRSD(r.revenue)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-ink-500">Artikli</div>
                      <div className="font-semibold tabular-nums">
                        {r.items_sold}
                      </div>
                    </div>
                  </div>
                  {r.note && (
                    <div className="mt-2 text-xs text-ink-500 italic">
                      Napomena: {r.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="rounded-xl bg-ink-900 text-white p-4">
            <div className="text-xs uppercase tracking-wider font-bold opacity-70 mb-2">
              Ukupno za ceo dan
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] uppercase opacity-70">Ulasci</div>
                <div className="text-lg font-bold tabular-nums">
                  {totalEntries}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase opacity-70">Računi</div>
                <div className="text-lg font-bold tabular-nums">
                  {totalBuyers}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase opacity-70">Promet</div>
                <div className="text-lg font-bold tabular-nums break-words">
                  {formatRSD(totalRevenue)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase opacity-70">Artikli</div>
                <div className="text-lg font-bold tabular-nums">
                  {totalItems}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/15">
              <div>
                <div className="text-[10px] uppercase opacity-70">Konverzija</div>
                <div className="text-base font-bold tabular-nums">
                  {formatPct(totalConv)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase opacity-70">Pr. vr. rač.</div>
                <div className="text-base font-bold tabular-nums">
                  {formatRSD(totalAov)}
                </div>
              </div>
            </div>
          </div>

          {/* Ko zatvara smenu */}
          <div className="rounded-xl border border-ink-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <User size={16} />
              <div className="text-sm font-semibold">
                Ko zatvara smenu? (inicijali)
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {candidates.length === 0 ? (
                <span className="text-xs text-ink-400">
                  Nema izabranih radnica.
                </span>
              ) : (
                candidates.map((w) => {
                  const selected = closingWorkerId === w.id;
                  return (
                    <button
                      type="button"
                      key={w.id}
                      onClick={() => setClosingWorkerId(w.id)}
                      className={`px-3 py-1.5 rounded-full border text-sm font-semibold ${
                        selected
                          ? "bg-ink-900 text-white border-ink-900"
                          : "bg-white text-ink-700 border-ink-200 hover:border-ink-400"
                      }`}
                    >
                      {w.initials}
                    </button>
                  );
                })
              )}
            </div>
            {!closingWorkerId && (
              <p className="text-xs text-ink-500 mt-2">
                Izaberi svoje inicijale da zatvoriš smenu.
              </p>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-ink-100 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-ghost"
          >
            Nazad, da proverim
          </button>
          <button
            type="button"
            onClick={() => onConfirm(closingWorkerId)}
            disabled={!closingWorkerId || submitting}
            className="btn-primary"
          >
            <CheckCircle2 size={16} />
            {submitting ? "Šaljem..." : "Potvrđujem zatvaranje smene"}
          </button>
        </div>
      </div>
    </div>
  );
}
