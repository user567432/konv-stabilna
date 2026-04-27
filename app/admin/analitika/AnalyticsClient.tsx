"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingDown, TrendingUp, Minus } from "lucide-react";
import DateRangePicker from "@/components/DateRangePicker";
import RevenueChart from "@/components/RevenueChart";
import ConversionChart from "@/components/ConversionChart";
import StoreCards from "@/components/StoreCards";
import {
  type DateRange,
  type ComparePreset,
  last7Days,
  previousPeriodOf,
  previousYearOf,
} from "@/lib/date-ranges";
import type { RangeAgg } from "@/lib/dashboard-data";
import type { Settings, Store } from "@/lib/types";
import { formatRSD, formatPct, formatNumber } from "@/lib/format";

interface Props {
  firstShiftDate: string | null;
  stores: Store[];
  globalSettings: Settings | null;
}

interface Slot {
  loading: boolean;
  data: RangeAgg | null;
}

function emptySlot(): Slot {
  return { loading: false, data: null };
}

export default function AnalyticsClient({
  firstShiftDate,
  stores,
  globalSettings,
}: Props) {
  const [range, setRange] = useState<DateRange>(last7Days());
  const [compare, setCompare] = useState<ComparePreset>("none");
  const [primary, setPrimary] = useState<Slot>(emptySlot());
  const [secondary, setSecondary] = useState<Slot>(emptySlot());

  const convTarget = Number(globalSettings?.conversion_target ?? 15);
  const aovTarget = Number(globalSettings?.aov_target ?? 3000);

  async function fetchRange(r: DateRange): Promise<RangeAgg | null> {
    const res = await fetch(`/api/range?start=${r.start}&end=${r.end}`);
    if (!res.ok) return null;
    const j = await res.json();
    return j.data as RangeAgg;
  }

  useEffect(() => {
    setPrimary({ loading: true, data: null });
    fetchRange(range).then((d) => setPrimary({ loading: false, data: d }));

    const compareRange =
      compare === "previous_period"
        ? previousPeriodOf(range)
        : compare === "previous_year"
        ? previousYearOf(range)
        : null;

    if (compareRange) {
      setSecondary({ loading: true, data: null });
      fetchRange(compareRange).then((d) =>
        setSecondary({ loading: false, data: d })
      );
    } else {
      setSecondary(emptySlot());
    }
  }, [range.start, range.end, compare]);

  function deltaPct(a: number, b: number): number {
    if (b === 0) return 0;
    return ((a - b) / b) * 100;
  }

  function Delta({ value }: { value: number }) {
    if (Math.abs(value) < 0.05) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500">
          <Minus size={12} /> 0%
        </span>
      );
    }
    if (value > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <TrendingUp size={12} /> +{value.toFixed(1).replace(".", ",")}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
        <TrendingDown size={12} /> {value.toFixed(1).replace(".", ",")}%
      </span>
    );
  }

  const compareRange =
    compare === "previous_period"
      ? previousPeriodOf(range)
      : compare === "previous_year"
      ? previousYearOf(range)
      : null;

  return (
    <main className="min-h-screen bg-ink-50/30">
      <header className="bg-white border-b border-ink-100 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-ink-700 font-semibold"
          >
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <DateRangePicker
            range={range}
            compare={compare}
            firstShiftDate={firstShiftDate}
            onChange={(r, c) => {
              setRange(r);
              setCompare(c);
            }}
          />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-8">
        <section>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500">
            Analitika
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">
            {range.label}
          </h1>
          <p className="mt-1 text-ink-500 tabular-nums text-sm">
            {range.start} — {range.end}
            {compareRange && (
              <>
                {" · vs "}
                <span className="font-semibold text-ink-700">
                  {compareRange.start} — {compareRange.end}
                </span>
              </>
            )}
          </p>
        </section>

        {primary.loading && !primary.data ? (
          <div className="card-soft text-ink-500 italic">Učitavam podatke...</div>
        ) : !primary.data ? (
          <div className="card-soft text-rose-700">Greška pri učitavanju.</div>
        ) : (
          <>
            {/* KPI kartice */}
            <section>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiBlock
                  label="Promet"
                  value={formatRSD(primary.data.total.revenue)}
                  compareValue={
                    secondary.data
                      ? formatRSD(secondary.data.total.revenue)
                      : undefined
                  }
                  delta={
                    secondary.data
                      ? deltaPct(
                          primary.data.total.revenue,
                          secondary.data.total.revenue
                        )
                      : undefined
                  }
                  DeltaComp={Delta}
                />
                <KpiBlock
                  label="Konverzija"
                  value={formatPct(primary.data.total.conversion)}
                  target={formatPct(convTarget)}
                  targetHit={primary.data.total.conversion >= convTarget}
                  compareValue={
                    secondary.data
                      ? formatPct(secondary.data.total.conversion)
                      : undefined
                  }
                  delta={
                    secondary.data
                      ? primary.data.total.conversion -
                        secondary.data.total.conversion
                      : undefined
                  }
                  deltaIsPP
                  DeltaComp={Delta}
                />
                <KpiBlock
                  label="Prosečna vrednost računa"
                  value={formatRSD(primary.data.total.aov)}
                  target={formatRSD(aovTarget)}
                  targetHit={primary.data.total.aov >= aovTarget}
                  compareValue={
                    secondary.data
                      ? formatRSD(secondary.data.total.aov)
                      : undefined
                  }
                  delta={
                    secondary.data
                      ? deltaPct(primary.data.total.aov, secondary.data.total.aov)
                      : undefined
                  }
                  DeltaComp={Delta}
                />
                <KpiBlock
                  label="Ulasci · Računi · Smene"
                  value={`${formatNumber(primary.data.total.entries)} · ${formatNumber(
                    primary.data.total.buyers
                  )} · ${formatNumber(primary.data.total.shifts)}`}
                  compareValue={
                    secondary.data
                      ? `${formatNumber(secondary.data.total.entries)} · ${formatNumber(
                          secondary.data.total.buyers
                        )} · ${formatNumber(secondary.data.total.shifts)}`
                      : undefined
                  }
                />
              </div>
            </section>

            {/* Po radnjama */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-3">
                Po radnjama
              </h2>
              <StoreCards
                rows={primary.data.perStore}
                conversionTarget={convTarget}
                aovTarget={aovTarget}
              />
            </section>

            {/* Grafikoni */}
            <section>
              <RevenueChart data={primary.data.daily} />
            </section>
            <section>
              <ConversionChart data={primary.data.daily} target={convTarget} />
            </section>

            {/* Compare tabela po radnjama */}
            {secondary.data && (
              <section className="card-soft">
                <h3 className="font-bold text-ink-900 mb-3">Poređenje po radnjama</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-ink-500 font-semibold uppercase border-b border-ink-100">
                        <th className="text-left py-2">Radnja</th>
                        <th className="text-right py-2">Promet (aktuelno)</th>
                        <th className="text-right py-2">Promet (pretho.)</th>
                        <th className="text-right py-2">Delta</th>
                        <th className="text-right py-2">Konv. aktu.</th>
                        <th className="text-right py-2">Konv. pret.</th>
                        <th className="text-right py-2">Δ p.p.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {stores.map((st) => {
                        const p = primary.data!.perStore.find(
                          (r) => r.store_id === st.id
                        );
                        const s = secondary.data!.perStore.find(
                          (r) => r.store_id === st.id
                        );
                        if (!p || !s) return null;
                        const revDelta = deltaPct(p.revenue, s.revenue);
                        const convDeltaPP = p.conversion - s.conversion;
                        return (
                          <tr key={st.id}>
                            <td className="py-2.5">
                              <span className="text-xs font-bold bg-ink-900 text-white px-2 py-0.5 rounded mr-2">
                                {st.id}
                              </span>
                              {st.name}
                            </td>
                            <td className="py-2.5 text-right tabular-nums font-semibold">
                              {formatRSD(p.revenue)}
                            </td>
                            <td className="py-2.5 text-right tabular-nums text-ink-500">
                              {formatRSD(s.revenue)}
                            </td>
                            <td className="py-2.5 text-right">
                              <Delta value={revDelta} />
                            </td>
                            <td className="py-2.5 text-right tabular-nums">
                              {formatPct(p.conversion)}
                            </td>
                            <td className="py-2.5 text-right tabular-nums text-ink-500">
                              {formatPct(s.conversion)}
                            </td>
                            <td className="py-2.5 text-right tabular-nums">
                              <span
                                className={
                                  convDeltaPP >= 0
                                    ? "text-emerald-700 font-semibold"
                                    : "text-rose-700 font-semibold"
                                }
                              >
                                {convDeltaPP >= 0 ? "+" : ""}
                                {convDeltaPP.toFixed(2).replace(".", ",")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function KpiBlock({
  label,
  value,
  target,
  targetHit,
  compareValue,
  delta,
  deltaIsPP,
  DeltaComp,
}: {
  label: string;
  value: string;
  target?: string;
  targetHit?: boolean;
  compareValue?: string;
  delta?: number;
  deltaIsPP?: boolean;
  DeltaComp?: (props: { value: number }) => JSX.Element;
}) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {target && (
        <div
          className={`text-xs mt-1 font-semibold ${
            targetHit ? "text-emerald-700" : "text-ink-500"
          }`}
        >
          cilj {target} {targetHit && "✓"}
        </div>
      )}
      {compareValue !== undefined && (
        <div className="mt-2 pt-2 border-t border-ink-100 flex items-center justify-between gap-2">
          <span className="text-xs text-ink-500 tabular-nums">
            vs {compareValue}
          </span>
          {delta !== undefined &&
            DeltaComp &&
            (deltaIsPP ? (
              <span
                className={`text-xs font-semibold tabular-nums ${
                  delta >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(2).replace(".", ",")} p.p.
              </span>
            ) : (
              <DeltaComp value={delta} />
            ))}
        </div>
      )}
    </div>
  );
}
