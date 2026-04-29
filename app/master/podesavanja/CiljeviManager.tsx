"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SettingsForm from "@/app/admin/podesavanja/SettingsForm";
import WeeklyGoalsEditor from "@/app/admin/podesavanja/WeeklyGoalsEditor";
import { STORE_LABELS_SHORT } from "@/lib/format";
import type { Store, Settings } from "@/lib/types";

interface Props {
  stores: Store[];
  settingsByStore: Map<string, Settings>;
}

const MONTH_NAMES = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

function formatMonthStr(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function shiftMonth(year: number, month: number, delta: number): { y: number; m: number } {
  const total = year * 12 + (month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m };
}

export default function CiljeviManager({ stores, settingsByStore }: Props) {
  const [activeStore, setActiveStore] = useState<string>("D1");
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);

  const activeStoreObj = stores.find((s) => s.id === activeStore);
  const monthStr = useMemo(() => formatMonthStr(year, month), [year, month]);

  function shiftMonths(delta: number) {
    const p = shiftMonth(year, month, delta);
    setYear(p.y);
    setMonth(p.m);
  }

  function jumpToCurrent() {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth() + 1);
  }

  const isCurrent =
    year === today.getFullYear() && month === today.getMonth() + 1;

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-ink-500 leading-relaxed">
        Za svaku radnju biraš tab gore. Bazni ciljevi su konstantni (KPI),
        nedeljni razrada se pravi mesec po mesec — možeš ići i u buduće mesece
        da unapred postaviš plan.
      </p>

      {/* Store tabs */}
      <div className="flex gap-1 flex-wrap">
        {stores.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveStore(s.id)}
            className={
              activeStore === s.id
                ? "px-3 py-2 rounded-lg bg-ink-900 text-white text-sm font-bold"
                : "px-3 py-2 rounded-lg bg-white border border-ink-200 text-sm text-ink-700 hover:bg-ink-100"
            }
          >
            <span className="font-bold">{s.id}</span>{" "}
            <span className="opacity-70">
              {STORE_LABELS_SHORT[s.id]?.replace(`${s.id} `, "") ?? ""}
            </span>
          </button>
        ))}
      </div>

      {activeStoreObj && (
        <div className="space-y-5">
          <div className="rounded-xl bg-white border border-ink-100 p-4">
            <div className="text-xs uppercase tracking-wider font-bold text-ink-500 mb-3">
              Bazni ciljevi (KPI + mesečni promet)
            </div>
            <SettingsForm
              key={activeStoreObj.id}
              store_id={activeStoreObj.id}
              store_name={activeStoreObj.name}
              settings={settingsByStore.get(activeStoreObj.id)}
            />
          </div>

          <div className="rounded-xl bg-white border border-ink-100 p-4">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="text-xs uppercase tracking-wider font-bold text-ink-500">
                Nedeljni ciljevi po mesecu
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => shiftMonths(-1)}
                  className="h-9 w-9 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 inline-flex items-center justify-center"
                  title="Prethodni mesec"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-sm font-bold text-ink-900 tabular-nums min-w-[140px] text-center">
                  {MONTH_NAMES[month - 1]} {year}
                </div>
                <button
                  type="button"
                  onClick={() => shiftMonths(1)}
                  className="h-9 w-9 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 inline-flex items-center justify-center"
                  title="Sledeći mesec"
                >
                  <ChevronRight size={16} />
                </button>
                {!isCurrent && (
                  <button
                    type="button"
                    onClick={jumpToCurrent}
                    className="text-xs h-9 px-2.5 rounded-lg bg-ink-900 text-white font-semibold ml-1"
                  >
                    Sada
                  </button>
                )}
              </div>
            </div>
            <WeeklyGoalsEditor
              key={activeStoreObj.id + "-" + monthStr}
              storeId={activeStoreObj.id}
              storeName={activeStoreObj.name}
              month={monthStr}
            />
          </div>
        </div>
      )}
    </div>
  );
}
