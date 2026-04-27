"use client";

import { formatRSD, formatPct } from "@/lib/format";
import clsx from "clsx";

interface Row {
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

export default function WorkerLeaderboard({
  rows,
  conversionTarget,
}: {
  rows: Row[];
  conversionTarget: number;
}) {
  return (
    <div className="card-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-ink-900">TIM · poslednjih 7 dana</h3>
          <p className="text-sm text-ink-500">Rangirano po prometu.</p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-ink-500 font-semibold uppercase tracking-wide">
              <th className="text-left pl-6 py-2">#</th>
              <th className="text-left py-2">Član tima</th>
              <th className="text-left py-2">Radnja</th>
              <th className="text-right py-2">Smene</th>
              <th className="text-right py-2">Ulasci</th>
              <th className="text-right py-2">Broj računa</th>
              <th className="text-right py-2">Konverzija</th>
              <th className="text-right py-2">Pr. vr. rač.</th>
              <th className="text-right pr-6 py-2">Promet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-ink-400">
                  Nema unosa u poslednjih 7 dana.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.worker_id} className="hover:bg-ink-50">
                  <td className="pl-6 py-2.5 text-ink-400 tabular-nums">{i + 1}</td>
                  <td className="py-2.5 font-semibold text-ink-900">{r.worker_initials}</td>
                  <td className="py-2.5 text-ink-500">{r.store_id}</td>
                  <td className="py-2.5 text-right tabular-nums">{r.shifts}</td>
                  <td className="py-2.5 text-right tabular-nums">{r.entries}</td>
                  <td className="py-2.5 text-right tabular-nums">{r.buyers}</td>
                  <td
                    className={clsx(
                      "py-2.5 text-right tabular-nums font-semibold",
                      r.conversion >= conversionTarget ? "text-emerald-700" : "text-ink-700"
                    )}
                  >
                    {formatPct(r.conversion)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{formatRSD(r.aov)}</td>
                  <td className="pr-6 py-2.5 text-right tabular-nums font-bold text-ink-900">
                    {formatRSD(r.revenue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
