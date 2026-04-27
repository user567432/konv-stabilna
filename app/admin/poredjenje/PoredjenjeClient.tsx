"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Info,
  Users,
} from "lucide-react";
import clsx from "clsx";
import {
  formatRSD,
  formatPct,
  formatDateSr,
  STORE_LABELS_SHORT,
} from "@/lib/format";
import {
  type CrossStoreLiftResult,
  MIN_SHIFTS_FOR_LIFT,
  LIFT_WEIGHTS,
} from "@/lib/worker-lift";

interface Props {
  data: CrossStoreLiftResult;
  activeRange: string; // "7" | "14" | "30" | "90" | "all"
  firstShiftDate: string | null;
  today: string;
}

const RANGE_CHIPS: Array<{ key: string; label: string }> = [
  { key: "7", label: "Poslednjih 7 dana" },
  { key: "14", label: "Poslednjih 14 dana" },
  { key: "30", label: "Poslednjih 30 dana" },
  { key: "90", label: "Poslednjih 90 dana" },
  { key: "all", label: "Cela istorija" },
];

function liftLabel(lift: number): string {
  const sign = lift >= 0 ? "+" : "";
  return `${sign}${(lift * 100).toFixed(1).replace(".", ",")}%`;
}

function liftClass(lift: number): string {
  if (lift > 0.05) return "text-emerald-700";
  if (lift < -0.05) return "text-rose-700";
  return "text-ink-500";
}

function LiftIcon({ lift }: { lift: number }) {
  if (lift > 0.05) return <TrendingUp size={12} />;
  if (lift < -0.05) return <TrendingDown size={12} />;
  return <Minus size={12} />;
}

export default function PoredjenjeClient({
  data,
  activeRange,
  firstShiftDate,
  today,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function selectRange(key: string) {
    const sp = new URLSearchParams();
    sp.set("range", key);
    router.push(`${pathname}?${sp.toString()}`);
  }

  const rangeLabel =
    activeRange === "all"
      ? firstShiftDate
        ? `${formatDateSr(firstShiftDate)} — ${formatDateSr(data.end)}`
        : `do ${formatDateSr(data.end)}`
      : data.start
        ? `${formatDateSr(data.start)} — ${formatDateSr(data.end)}`
        : "—";

  return (
    <main className="min-h-screen bg-ink-50/30">
      {/* Header */}
      <header className="bg-white border-b border-ink-100 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Nazad na dashboard
          </Link>
          <div className="text-sm text-ink-500">
            {data.total_shifts.toLocaleString("sr-RS")} smena u rasponu
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 space-y-6">
        {/* Naslov */}
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500" />
            Poređenje radnica preko radnji
          </h1>
          <p className="mt-1 text-ink-500">
            Cross-store rang baziran na lift-u nad sopstvenom radnjom · Period:{" "}
            <span className="font-semibold text-ink-900">{rangeLabel}</span>
          </p>
        </section>

        {/* Range chips */}
        <section className="flex gap-2 flex-wrap">
          {RANGE_CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => selectRange(c.key)}
              className={
                activeRange === c.key
                  ? "px-3 py-2 rounded-xl bg-ink-900 text-white text-sm font-semibold"
                  : "px-3 py-2 rounded-xl bg-white border border-ink-200 text-sm text-ink-700 hover:bg-ink-100"
              }
            >
              {c.label}
            </button>
          ))}
        </section>

        {/* Metodologija */}
        <section className="card-soft bg-sky-50 border-sky-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-sky-900">
              <div className="font-semibold mb-1">Kako se računa lift indeks</div>
              <div className="space-y-1.5">
                <div>
                  Za svaku radnicu računa se njen pro-rata udeo (1/N po smeni gde je radilo
                  N članova tima), pa se njena <b>konverzija</b>, <b>AOV</b> i{" "}
                  <b>artikli/kupac</b> porede sa <b>prosekom njene radnje</b> u istom periodu.
                </div>
                <div>
                  Lift = (radnica / radnja) − 1. Pozitivan lift znači iznad proseka
                  radnje, negativan ispod.
                </div>
                <div>
                  Composite indeks ={" "}
                  <span className="font-mono">
                    {LIFT_WEIGHTS.conversion} × konv.lift +{" "}
                    {LIFT_WEIGHTS.aov} × AOV.lift + {LIFT_WEIGHTS.ipb} × IPB.lift
                  </span>
                  . Tako se uporedjuju radnice iz različitih radnji bez nelojalne prednosti
                  veće radnje ili skupljeg segmenta.
                </div>
                <div>
                  Prikaz zahteva ≥ {MIN_SHIFTS_FOR_LIFT} smena u periodu. Ostale idu u
                  „Nedovoljno podataka".
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Store baselines (background context) */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-3">
            Prosek po radnji (referentne vrednosti za lift)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.store_baselines.map((b) => (
              <div key={b.store_id} className="card-soft">
                <div className="text-xs font-bold text-ink-900 mb-2">
                  {STORE_LABELS_SHORT[b.store_id] ?? b.store_name}
                </div>
                <div className="text-xs text-ink-500 grid grid-cols-2 gap-x-2 gap-y-1">
                  <span>Konverzija</span>
                  <span className="text-ink-900 font-semibold tabular-nums text-right">
                    {formatPct(b.conversion)}
                  </span>
                  <span>AOV</span>
                  <span className="text-ink-900 font-semibold tabular-nums text-right">
                    {formatRSD(b.aov)}
                  </span>
                  <span>Art./kupac</span>
                  <span className="text-ink-900 font-semibold tabular-nums text-right">
                    {b.ipb.toFixed(2).replace(".", ",")}
                  </span>
                  <span>Smena</span>
                  <span className="text-ink-900 font-semibold tabular-nums text-right">
                    {b.shifts_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Glavna lift tabela */}
        <section className="card-soft">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-ink-900">Cross-store rang</h2>
              <p className="text-sm text-ink-500">
                Sortirano po composite lift indeksu (visi je bolji)
              </p>
            </div>
            <div className="text-xs text-ink-500">
              {data.ranked.length} radnica u rangu
            </div>
          </div>

          {data.ranked.length === 0 ? (
            <div className="py-12 text-center text-ink-400">
              <Users className="mx-auto mb-2" size={20} />
              Nijedna radnica nema {MIN_SHIFTS_FOR_LIFT}+ smena u ovom rasponu.
              Pokušaj „Cela istorija" ili širi period.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-ink-500 font-semibold uppercase tracking-wide border-b border-ink-100">
                    <th className="text-left pl-6 py-2">Rang</th>
                    <th className="text-left py-2">Radnica</th>
                    <th className="text-left py-2">Radnja</th>
                    <th className="text-right py-2">Smena</th>
                    <th className="text-right py-2">
                      <div>Konverzija</div>
                      <div className="text-[10px] text-ink-400">radnica · radnja</div>
                    </th>
                    <th className="text-right py-2">
                      <div>AOV</div>
                      <div className="text-[10px] text-ink-400">radnica · radnja</div>
                    </th>
                    <th className="text-right py-2">
                      <div>Art./kupac</div>
                      <div className="text-[10px] text-ink-400">radnica · radnja</div>
                    </th>
                    <th className="text-right pr-6 py-2">
                      <div>Composite indeks</div>
                      <div className="text-[10px] text-ink-400">ponderisani lift</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {data.ranked.map((r, idx) => (
                    <tr
                      key={r.worker_id}
                      className={clsx(
                        idx === 0 ? "bg-amber-50/60" : "hover:bg-ink-50"
                      )}
                    >
                      <td className="pl-6 py-3 font-bold text-ink-900">
                        {idx === 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            1.
                          </span>
                        ) : (
                          `${idx + 1}.`
                        )}
                      </td>
                      <td className="py-3 font-mono font-bold text-ink-900">
                        {r.initials}
                      </td>
                      <td className="py-3 text-xs text-ink-700">
                        <span className="font-bold text-ink-900">
                          {r.store_id}
                        </span>{" "}
                        <span className="text-ink-500">
                          {STORE_LABELS_SHORT[r.store_id]?.replace(
                            `${r.store_id} `,
                            ""
                          ) ?? ""}
                        </span>
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {r.shifts_count}
                      </td>
                      <td className="py-3 text-right">
                        <div className="tabular-nums font-semibold text-ink-900">
                          {formatPct(r.worker_conversion)}
                        </div>
                        <div
                          className={clsx(
                            "text-[11px] tabular-nums inline-flex items-center gap-0.5 justify-end",
                            liftClass(r.conv_lift)
                          )}
                        >
                          <LiftIcon lift={r.conv_lift} /> {liftLabel(r.conv_lift)}
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="tabular-nums font-semibold text-ink-900">
                          {formatRSD(r.worker_aov)}
                        </div>
                        <div
                          className={clsx(
                            "text-[11px] tabular-nums inline-flex items-center gap-0.5 justify-end",
                            liftClass(r.aov_lift)
                          )}
                        >
                          <LiftIcon lift={r.aov_lift} /> {liftLabel(r.aov_lift)}
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="tabular-nums font-semibold text-ink-900">
                          {r.worker_ipb.toFixed(2).replace(".", ",")}
                        </div>
                        <div
                          className={clsx(
                            "text-[11px] tabular-nums inline-flex items-center gap-0.5 justify-end",
                            liftClass(r.ipb_lift)
                          )}
                        >
                          <LiftIcon lift={r.ipb_lift} /> {liftLabel(r.ipb_lift)}
                        </div>
                      </td>
                      <td className="pr-6 py-3 text-right">
                        <span
                          className={clsx(
                            "inline-block px-2.5 py-1 rounded-lg font-bold tabular-nums text-sm",
                            r.composite > 0.1
                              ? "bg-emerald-100 text-emerald-900"
                              : r.composite > 0.02
                                ? "bg-emerald-50 text-emerald-800"
                                : r.composite < -0.05
                                  ? "bg-rose-50 text-rose-800"
                                  : "bg-ink-100 text-ink-800"
                          )}
                        >
                          {liftLabel(r.composite)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.insufficient.length > 0 && (
            <div className="mt-4 pt-4 border-t border-ink-100">
              <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
                Nedovoljno podataka (manje od {MIN_SHIFTS_FOR_LIFT} smena)
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
                {data.insufficient.map((r) => (
                  <span key={r.worker_id}>
                    <span className="font-bold text-ink-700">{r.store_id}</span>{" "}
                    <span className="font-mono font-bold text-ink-700">
                      {r.initials}
                    </span>{" "}
                    ({r.shifts_count} sm.)
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {data.ranked.length >= 3 && (
          <section className="card-soft">
            <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
              Tumačenje
            </div>
            <Tumacenje data={data} />
          </section>
        )}
      </div>
    </main>
  );
}

function Tumacenje({ data }: { data: CrossStoreLiftResult }) {
  const top = data.ranked[0];
  const bottom = data.ranked[data.ranked.length - 1];
  if (!top) return null;

  // Najbolji u svakoj dimenziji
  const byConv = [...data.ranked].sort((a, b) => b.conv_lift - a.conv_lift)[0];
  const byAov = [...data.ranked].sort((a, b) => b.aov_lift - a.aov_lift)[0];
  const byIpb = [...data.ranked].sort((a, b) => b.ipb_lift - a.ipb_lift)[0];

  return (
    <div className="text-sm text-ink-700 space-y-1">
      <div>
        Ukupno najbolja:{" "}
        <span className="font-mono font-bold text-ink-900">
          {top.initials}
        </span>{" "}
        ({top.store_id}) sa composite lift indeksom{" "}
        <span className="font-bold text-emerald-700">
          {liftLabel(top.composite)}
        </span>{" "}
        nad sopstvenom radnjom u {top.shifts_count} smena.
      </div>
      {bottom.worker_id !== top.worker_id && (
        <div>
          Najslabija u rangu:{" "}
          <span className="font-mono font-bold text-ink-900">
            {bottom.initials}
          </span>{" "}
          ({bottom.store_id}) sa{" "}
          <span className="font-bold text-rose-700">
            {liftLabel(bottom.composite)}
          </span>
          .
        </div>
      )}
      <div>
        Najveći lift po dimenzijama:{" "}
        <span className="font-mono font-bold">{byConv.initials}</span> (
        {byConv.store_id}) za konverziju (
        <span className="text-emerald-700 font-semibold">
          {liftLabel(byConv.conv_lift)}
        </span>
        ),{" "}
        <span className="font-mono font-bold">{byAov.initials}</span> (
        {byAov.store_id}) za AOV (
        <span className="text-emerald-700 font-semibold">
          {liftLabel(byAov.aov_lift)}
        </span>
        ),{" "}
        <span className="font-mono font-bold">{byIpb.initials}</span> (
        {byIpb.store_id}) za artikle po kupcu (
        <span className="text-emerald-700 font-semibold">
          {liftLabel(byIpb.ipb_lift)}
        </span>
        ).
      </div>
    </div>
  );
}
