import Link from "next/link";
import { ArrowLeft, Trophy, AlertCircle, Users, Lock } from "lucide-react";
import {
  loadTeamRanking,
  MIN_SHIFTS_FOR_RANK,
  MIN_PAIR_SHIFTS,
} from "@/lib/worker-stats";
import { formatRSD, formatPct, formatDateSr, STORE_LABELS_SHORT } from "@/lib/format";
import { getTimStore, isMasterAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { start?: string; end?: string };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function quickPreset(days: number) {
  return {
    label:
      days === 7
        ? "Poslednjih 7 dana"
        : days === 14
        ? "Poslednjih 14 dana"
        : days === 30
        ? "Poslednjih 30 dana"
        : days === 90
        ? "Poslednjih 90 dana"
        : `Poslednjih ${days} dana`,
    start: daysAgo(days - 1),
    end: new Date().toISOString().slice(0, 10),
  };
}

export default async function TimRangPage({ searchParams }: PageProps) {
  const presets = [7, 14, 30, 90].map(quickPreset);
  const defaultRange = presets[2]; // 30 dana
  const start = searchParams.start ?? defaultRange.start;
  const end = searchParams.end ?? defaultRange.end;

  const data = await loadTeamRanking(start, end);

  // Ako je TIM ulogovan na ovom uredjaju (i nije MASTER), prikazi samo njegovu radnju.
  // MASTER vidi sve.
  const masterAuthed = await isMasterAuthed();
  const timStore = masterAuthed ? null : await getTimStore();
  const filteredPerStore = timStore
    ? data.per_store.filter((s) => s.store_id === timStore)
    : data.per_store;

  return (
    <div className="min-h-screen bg-ink-50 py-8">
      <div className="container-app">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-sm text-ink-500 hover:text-ink-900 mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Nazad na početnu
            </Link>
            <h1 className="text-3xl font-black tracking-tight text-ink-900 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-500" />
              Tim rang
            </h1>
            <p className="text-ink-500 mt-1">
              Raspon:{" "}
              <span className="font-semibold text-ink-900">
                {formatDateSr(start)} — {formatDateSr(end)}
              </span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {presets.map((p) => {
              const isActive = start === p.start && end === p.end;
              return (
                <Link
                  key={p.label}
                  href={`/tim-rang?start=${p.start}&end=${p.end}`}
                  className={
                    isActive
                      ? "px-3 py-2 rounded-xl bg-ink-900 text-white text-sm font-semibold"
                      : "px-3 py-2 rounded-xl bg-white border border-ink-200 text-sm text-ink-700 hover:bg-ink-100"
                  }
                >
                  {p.label}
                </Link>
              );
            })}
          </div>
        </div>

        {timStore && (
          <div className="card-soft mb-4 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <div className="font-semibold mb-0.5">
                  Vidiš samo rang za radnju {STORE_LABELS_SHORT[timStore] ?? timStore}
                </div>
                <div>
                  Ulogovan/a si kao TIM ove radnje, pa ti je rang ograničen.
                  MASTER može da vidi sve radnje.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Napomena o metodologiji */}
        <div className="card-soft mb-6 bg-sky-50 border-sky-200">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-sky-900">
              <div className="font-semibold mb-1">
                Kako čitati ove brojke (transparentno za sve)
              </div>
              <div>
                Kako radi najmanje 2 člana tima po smeni, pojedinačni doprinos
                ne može tačno da se izmeri. Brojke su{" "}
                <strong>pro-rata udeo po smeni</strong>: ako u smeni rade 2
                radnice, svaka dobija 1/2 prometa i kupaca; ako su 3 radnice,
                svaka 1/3. Konverzija se računa iz tih udela. Rang se prikazuje
                samo za radnice sa {MIN_SHIFTS_FOR_RANK}+ smena u rasponu. Par
                „najbolji / najslabiji" zahteva {MIN_PAIR_SHIFTS}+ zajedničkih
                smena. Ovo je statistička procena, ne mera lične zasluge.
              </div>
            </div>
          </div>
        </div>

        {/* Kartice po radnji (1 ako je TIM ulogovan, 4 inace) */}
        <div className="space-y-6">
          {filteredPerStore.map((store) => (
            <div key={store.store_id} className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-ink-900">
                  {STORE_LABELS_SHORT[store.store_id] ?? store.store_name}
                </h2>
                <div className="text-sm text-ink-500">
                  {store.total_shifts_in_range} smena u rasponu
                </div>
              </div>

              {store.ranked.length === 0 ? (
                <div className="py-6 text-center text-ink-500 text-sm">
                  Nijedna radnica nema {MIN_SHIFTS_FOR_RANK}+ smena u ovom
                  rasponu. Pokušaj širi vremenski period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wider text-ink-500">
                        <th className="pb-2 pr-3">Rang</th>
                        <th className="pb-2 pr-3">Inicijali</th>
                        <th className="pb-2 pr-3 text-right">Konverzija</th>
                        <th className="pb-2 pr-3 text-right">Promet (udeo)</th>
                        <th className="pb-2 pr-3 text-right">Pr.vr.rač</th>
                        <th className="pb-2 pr-3 text-right">Smene</th>
                        <th className="pb-2 pr-3">Najbolji par</th>
                        <th className="pb-2 pr-3">Najslabiji par</th>
                        <th className="pb-2 pr-3 text-right">Max smena</th>
                        <th className="pb-2 text-right">Min smena</th>
                      </tr>
                    </thead>
                    <tbody>
                      {store.ranked.map((r, idx) => (
                        <tr
                          key={r.worker_id}
                          className={
                            idx === 0
                              ? "bg-amber-50 border-b border-ink-100"
                              : "border-b border-ink-100"
                          }
                        >
                          <td className="py-3 pr-3 font-bold text-ink-900">
                            {idx === 0 ? (
                              <span className="inline-flex items-center gap-1">
                                <Trophy className="w-4 h-4 text-amber-500" />1.
                              </span>
                            ) : (
                              `${idx + 1}.`
                            )}
                          </td>
                          <td className="py-3 pr-3 font-mono font-bold text-ink-900">
                            {r.initials}
                          </td>
                          <td className="py-3 pr-3 text-right font-semibold text-emerald-700">
                            {formatPct(r.conversion)}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">
                            {formatRSD(r.revenue_share)}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">
                            {formatRSD(r.aov)}
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums">
                            {r.shifts_count}
                          </td>
                          <td className="py-3 pr-3 text-xs">
                            {r.best_partner ? (
                              <span>
                                <span className="font-mono font-bold">
                                  {r.best_partner.partner_initials}
                                </span>{" "}
                                <span className="text-emerald-700">
                                  {formatPct(r.best_partner.avg_conversion)}
                                </span>{" "}
                                <span className="text-ink-500">
                                  ({r.best_partner.shifts_count} sm.)
                                </span>
                              </span>
                            ) : (
                              <span className="text-ink-400">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-xs">
                            {r.worst_partner &&
                            r.worst_partner.partner_id !==
                              r.best_partner?.partner_id ? (
                              <span>
                                <span className="font-mono font-bold">
                                  {r.worst_partner.partner_initials}
                                </span>{" "}
                                <span className="text-rose-700">
                                  {formatPct(r.worst_partner.avg_conversion)}
                                </span>{" "}
                                <span className="text-ink-500">
                                  ({r.worst_partner.shifts_count} sm.)
                                </span>
                              </span>
                            ) : (
                              <span className="text-ink-400">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-right text-xs">
                            <div className="tabular-nums text-ink-900">
                              {formatRSD(r.best_shift_revenue)}
                            </div>
                            <div className="text-ink-500">
                              {r.best_shift_date
                                ? formatDateSr(r.best_shift_date)
                                : "—"}
                            </div>
                          </td>
                          <td className="py-3 text-right text-xs">
                            <div className="tabular-nums text-ink-900">
                              {formatRSD(r.worst_shift_revenue)}
                            </div>
                            <div className="text-ink-500">
                              {r.worst_shift_date
                                ? formatDateSr(r.worst_shift_date)
                                : "—"}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {store.insufficient_data.length > 0 && (
                <div className="mt-4 pt-4 border-t border-ink-100">
                  <div className="flex items-start gap-2 text-xs text-ink-500">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold mb-1">
                        Nedovoljno podataka (manje od {MIN_SHIFTS_FOR_RANK}{" "}
                        smena u rasponu)
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {store.insufficient_data.map((r) => (
                          <span key={r.worker_id}>
                            <span className="font-mono font-bold text-ink-700">
                              {r.initials}
                            </span>{" "}
                            ({r.shifts_count} sm.)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Zaključak za Master + Tim */}
              {store.ranked.length >= 2 && (
                <div className="mt-4 pt-4 border-t border-ink-100">
                  <div className="text-xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
                    Zaključak
                  </div>
                  <StoreConclusion store={store} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StoreConclusion({
  store,
}: {
  store: Awaited<ReturnType<typeof loadTeamRanking>>["per_store"][number];
}) {
  const top = store.ranked[0];
  const bottom = store.ranked[store.ranked.length - 1];
  const delta = top.conversion - bottom.conversion;
  const bestPair = store.ranked
    .map((r) => r.best_partner)
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.avg_conversion - a.avg_conversion)[0];

  return (
    <div className="text-sm text-ink-700 space-y-1">
      <div>
        Najveća konverzija:{" "}
        <span className="font-mono font-bold text-ink-900">
          {top.initials}
        </span>{" "}
        sa <span className="font-semibold text-emerald-700">{formatPct(top.conversion)}</span>{" "}
        ({top.shifts_count} smena, pro-rata promet{" "}
        {formatRSD(top.revenue_share)}).
      </div>
      {bottom.worker_id !== top.worker_id && (
        <div>
          Najmanja konverzija:{" "}
          <span className="font-mono font-bold text-ink-900">
            {bottom.initials}
          </span>{" "}
          sa <span className="font-semibold text-rose-700">{formatPct(bottom.conversion)}</span>{" "}
          (razlika od vrha: {formatPct(delta)}).
        </div>
      )}
      {bestPair && (
        <div>
          Najjača kombinacija u radnji: par sa{" "}
          <span className="font-mono font-bold text-ink-900">
            {bestPair.partner_initials}
          </span>{" "}
          ostvaruje prosek{" "}
          <span className="font-semibold text-emerald-700">
            {formatPct(bestPair.avg_conversion)}
          </span>{" "}
          konverzije u {bestPair.shifts_count} zajedničkih smena.
        </div>
      )}
    </div>
  );
}
