"use client";

import { formatRSD, formatPct } from "@/lib/format";
import clsx from "clsx";
import { Store, Users } from "lucide-react";

interface StoreToday {
  store_id: string;
  store_name: string;
  entries: number;
  buyers: number;
  revenue: number;
  conversion: number;
  aov: number;
  shifts: number;
}

export default function StoreCards({
  rows,
  conversionTarget,
  aovTarget,
}: {
  rows: StoreToday[];
  conversionTarget: number;
  aovTarget: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {rows.map((r) => {
        const convHit = r.conversion >= conversionTarget;
        const aovHit = r.aov >= aovTarget;
        const hasData = r.shifts > 0;
        return (
          <div
            key={r.store_id}
            className={clsx(
              "card-soft transition",
              hasData ? "" : "opacity-60"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-ink-900 text-white flex items-center justify-center text-xs font-bold">
                  {r.store_id}
                </div>
                <div className="text-xs text-ink-500">Danas</div>
              </div>
              <div className="text-xs text-ink-400 tabular-nums">
                {r.shifts} {r.shifts === 1 ? "smena" : "smene"}
              </div>
            </div>

            <h3 className="mt-3 text-sm font-semibold text-ink-900 leading-tight">
              {r.store_name}
            </h3>

            <div className="mt-4 pt-3 border-t border-ink-100 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-ink-500">Promet</span>
                <span className="text-lg font-bold tabular-nums">{formatRSD(r.revenue)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-ink-500">Konverzija</span>
                <span
                  className={clsx(
                    "text-sm font-bold tabular-nums",
                    convHit ? "text-emerald-700" : "text-ink-700"
                  )}
                >
                  {formatPct(r.conversion)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-ink-500">Pr. vr. rač.</span>
                <span
                  className={clsx(
                    "text-sm font-bold tabular-nums",
                    aovHit ? "text-emerald-700" : "text-ink-700"
                  )}
                >
                  {formatRSD(r.aov)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-ink-500">Ulasci · Broj računa</span>
                <span className="text-sm text-ink-700 tabular-nums">
                  {r.entries} · {r.buyers}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
