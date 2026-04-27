"use client";

import { useMemo, useState } from "react";
import type { Store, Worker } from "@/lib/types";
import type { ShiftFeedback } from "@/lib/feedback";
import { formatRSD, formatPct, formatDecimal } from "@/lib/format";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCcw,
  Phone,
} from "lucide-react";
import WorkerProgress from "@/components/WorkerProgress";
import ConfirmShiftModal, {
  type SummaryRow,
} from "@/components/ConfirmShiftModal";

interface Props {
  stores: Store[];
  workers: Worker[];
  /** Ako je zadat, radnja je zaključana (TIM ulaz po radnji) i select se ne prikazuje. */
  lockedStoreId?: string;
}

type ShiftKey = "prva" | "druga" | "dvokratna";

interface ShiftRow {
  enabled: boolean;
  worker_ids: string[];
  entries: string;
  buyers: string;
  revenue: string;
  items: string;
  note: string;
}

interface ShiftMeta {
  key: ShiftKey;
  label: string;
  hours: string;
}

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftsForStore(storeId: string): ShiftMeta[] {
  const hasDvokratna = storeId === "D1" || storeId === "D2";
  const base: ShiftMeta[] = [
    { key: "prva", label: "Prva smena", hours: "9–17 časova" },
    { key: "druga", label: "Druga smena", hours: "13–21 časova" },
  ];
  if (hasDvokratna) {
    base.push({ key: "dvokratna", label: "Dvokratna", hours: "9–13 i 17–21 časova" });
  }
  return base;
}

function emptyRow(): ShiftRow {
  return {
    enabled: false,
    worker_ids: [],
    entries: "",
    buyers: "",
    revenue: "",
    items: "",
    note: "",
  };
}

interface AnomalyPayload {
  isAnomaly: boolean;
  reasons: string[];
}

interface SubmittedRow {
  shift_key: ShiftKey;
  shift_label: string;
  worker_initials_list: string[];
  feedback: ShiftFeedback;
  anomaly: AnomalyPayload;
  entries: number;
  buyers: number;
  revenue: number;
  items_sold: number;
}

export default function ShiftForm({ stores, workers, lockedStoreId }: Props) {
  const [storeId, setStoreId] = useState<string>(lockedStoreId ?? "");
  const [shiftDate, setShiftDate] = useState<string>(today());
  const [rows, setRows] = useState<Record<ShiftKey, ShiftRow>>({
    prva: emptyRow(),
    druga: emptyRow(),
    dvokratna: emptyRow(),
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SubmittedRow[] | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [summaryForConfirm, setSummaryForConfirm] = useState<SummaryRow[]>([]);

  const storeWorkers = useMemo(
    () => workers.filter((w) => w.store_id === storeId),
    [workers, storeId]
  );

  const shifts = useMemo(() => shiftsForStore(storeId), [storeId]);

  function updateRow(key: ShiftKey, patch: Partial<ShiftRow>) {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function toggleWorker(key: ShiftKey, workerId: string) {
    setRows((prev) => {
      const cur = prev[key];
      const set = new Set(cur.worker_ids);
      if (set.has(workerId)) {
        set.delete(workerId);
      } else {
        set.add(workerId);
      }
      return { ...prev, [key]: { ...cur, worker_ids: Array.from(set) } };
    });
  }

  const totals = useMemo(() => {
    let entries = 0;
    let buyers = 0;
    let revenue = 0;
    let items = 0;
    shifts.forEach((s) => {
      const r = rows[s.key];
      if (!r.enabled) return;
      entries += Number(r.entries) || 0;
      buyers += Number(r.buyers) || 0;
      revenue += Number(r.revenue) || 0;
      items += Number(r.items) || 0;
    });
    const conversion = entries > 0 ? (buyers / entries) * 100 : 0;
    const aov = buyers > 0 ? revenue / buyers : 0;
    const itemsPerBuyer = buyers > 0 ? items / buyers : 0;
    return { entries, buyers, revenue, items, conversion, aov, itemsPerBuyer };
  }, [rows, shifts]);

  function rowIsValid(r: ShiftRow): boolean {
    if (!r.enabled) return true;
    if (r.worker_ids.length === 0) return false;
    if (r.entries === "" || r.buyers === "" || r.revenue === "" || r.items === "") {
      return false;
    }
    const e = Number(r.entries);
    const b = Number(r.buyers);
    const rev = Number(r.revenue);
    const it = Number(r.items);
    if (b > e) return false;
    if (e < 0 || b < 0 || rev < 0 || it < 0) return false;
    return true;
  }

  const anyEnabled = shifts.some((s) => rows[s.key].enabled);
  const allRowsValid = shifts.every((s) => rowIsValid(rows[s.key]));
  const canSubmit = Boolean(storeId && shiftDate && anyEnabled && allRowsValid && !submitting);

  // Korak 1: otvara modal za potvrdu (sa anomaly provere)
  async function openConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Prikupi redove i pozovi baseline za svaki
    const enabledRows = shifts
      .filter((s) => rows[s.key].enabled)
      .map((s) => {
        const r = rows[s.key];
        return {
          shift_type: s.key,
          worker_ids: r.worker_ids,
          entries: Number(r.entries),
          buyers: Number(r.buyers),
          revenue: Number(r.revenue),
          items_sold: Number(r.items),
          note: r.note.trim() || null,
        } as SummaryRow;
      });

    try {
      // Pozovi baseline API i izračunaj anomaly lokalno
      const res = await fetch(`/api/baseline?store_id=${storeId}`);
      const j = res.ok ? await res.json() : { baseline: null };
      const baseline = j.baseline as {
        avg_entries: number;
        avg_buyers: number;
        avg_revenue: number;
        avg_items: number;
        sample_size: number;
      } | null;

      const withAnomaly: SummaryRow[] = enabledRows.map((r) => {
        if (!baseline || baseline.sample_size < 3) {
          return { ...r, anomaly: { isAnomaly: false, reasons: [] } };
        }
        const reasons: string[] = [];
        const MULT_HI = 3.0;
        const MULT_LO = 1 / 3;
        function check(
          name: string,
          value: number,
          avg: number,
          unit = ""
        ) {
          if (avg <= 0) return;
          if (value > avg * MULT_HI) {
            reasons.push(
              `${name}: ${value}${unit} je više od 3× proseka (${Math.round(
                avg
              )}${unit}). Proveri da nije dopisana nula.`
            );
          } else if (value < avg * MULT_LO && value > 0) {
            reasons.push(
              `${name}: ${value}${unit} je manje od trećine proseka (${Math.round(
                avg
              )}${unit}). Da li nedostaje cifra?`
            );
          }
        }
        check("Ulasci", r.entries, baseline.avg_entries);
        check("Broj računa", r.buyers, baseline.avg_buyers);
        check("Promet", r.revenue, baseline.avg_revenue, " RSD");
        check("Broj artikala", r.items_sold, baseline.avg_items);
        return {
          ...r,
          anomaly: { isAnomaly: reasons.length > 0, reasons },
        };
      });

      setSummaryForConfirm(withAnomaly);
      setShowConfirm(true);
    } catch {
      // Ako baseline ne prolazi, svejedno otvaramo modal bez anomaly provere
      setSummaryForConfirm(
        enabledRows.map((r) => ({
          ...r,
          anomaly: { isAnomaly: false, reasons: [] },
        }))
      );
      setShowConfirm(true);
    }
  }

  // Korak 2: stvarni submit nakon potvrde (sa inicijalima zatvoritelja)
  async function doSubmit(closingWorkerId: string) {
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        store_id: storeId,
        shift_date: shiftDate,
        closed_by: closingWorkerId,
        rows: summaryForConfirm.map((r) => ({
          shift_type: r.shift_type,
          worker_ids: r.worker_ids,
          entries: r.entries,
          buyers: r.buyers,
          revenue: r.revenue,
          items_sold: r.items_sold,
          note: r.note ?? null,
        })),
      };

      const res = await fetch("/api/shift/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Greška pri čuvanju.");

      const submitted: SubmittedRow[] = (json.results as Array<{
        shift_type: ShiftKey;
        worker_ids: string[];
        feedback: ShiftFeedback;
        anomaly?: AnomalyPayload;
      }>).map((r) => {
        const shiftMeta = shifts.find((s) => s.key === r.shift_type);
        const initialsList = r.worker_ids.map(
          (wid) => workers.find((x) => x.id === wid)?.initials ?? "?"
        );
        // Pronadji odgovarajuce inpute iz summaryForConfirm radi totals
        const src = summaryForConfirm.find((s) => s.shift_type === r.shift_type);
        return {
          shift_key: r.shift_type,
          shift_label: shiftMeta?.label ?? r.shift_type,
          worker_initials_list: initialsList,
          feedback: r.feedback,
          anomaly: r.anomaly ?? { isAnomaly: false, reasons: [] },
          entries: src?.entries ?? 0,
          buyers: src?.buyers ?? 0,
          revenue: src?.revenue ?? 0,
          items_sold: src?.items_sold ?? 0,
        };
      });
      setResults(submitted);
      setShowConfirm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Greška.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setResults(null);
    setSummaryForConfirm([]);
    setRows({
      prva: emptyRow(),
      druga: emptyRow(),
      dvokratna: emptyRow(),
    });
  }

  // ------- RESULTS / FEEDBACK VIEW -------
  if (results) {
    const toneStyles: Record<string, string> = {
      success: "bg-emerald-50 border-emerald-200 text-emerald-900",
      warning: "bg-rose-50 border-rose-200 text-rose-900",
      neutral: "bg-ink-50 border-ink-200 text-ink-900",
    };

    // TOTAL skroz dole
    const totEntries = results.reduce((s, r) => s + r.entries, 0);
    const totBuyers = results.reduce((s, r) => s + r.buyers, 0);
    const totRevenue = results.reduce((s, r) => s + r.revenue, 0);
    const totItems = results.reduce((s, r) => s + r.items_sold, 0);
    const totConv = totEntries > 0 ? (totBuyers / totEntries) * 100 : 0;
    const totAov = totBuyers > 0 ? totRevenue / totBuyers : 0;

    return (
      <div className="space-y-5">
        <div className="card">
          <h2 className="text-xl font-bold text-ink-900">
            Sačuvano {results.length} {results.length === 1 ? "smena" : "smena"}
          </h2>
          <p className="text-sm text-ink-500 mt-1">
            Ispod je zaključak za svaku unetu smenu.
          </p>
        </div>

        {results.map((r, idx) => {
          const fb = r.feedback;
          const toneIcon =
            fb.tone === "success" ? (
              <CheckCircle2 size={20} />
            ) : fb.tone === "warning" ? (
              <AlertTriangle size={20} />
            ) : (
              <Info size={20} />
            );
          return (
            <div key={idx} className="space-y-3">
              <div className={`rounded-2xl border p-5 ${toneStyles[fb.tone]}`}>
                <div className="flex items-start gap-3">
                  {toneIcon}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider opacity-70">
                      {r.shift_label} · {r.worker_initials_list.join(", ")}
                    </div>
                    <h3 className="text-lg font-bold mt-0.5">{fb.headline}</h3>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="card">
                  <div className="kpi-label">Konverzija</div>
                  <div className="kpi-value">
                    {formatPct(fb.stats.conversion.value)}
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    cilj {formatPct(fb.stats.conversion.target)}
                  </div>
                </div>
                <div className="card">
                  <div className="kpi-label">Pr. vr. rač.</div>
                  <div className="kpi-value">{formatRSD(fb.stats.aov.value)}</div>
                  <div className="mt-1 text-xs text-ink-500">
                    cilj {formatRSD(fb.stats.aov.target)}
                  </div>
                </div>
              </div>

              {r.anomaly.isAnomaly && (
                <div className="card border-amber-300 bg-amber-50">
                  <div className="flex items-start gap-2 text-amber-900">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm">
                        Neobični brojevi
                      </div>
                      <ul className="mt-1 text-xs space-y-0.5 list-disc pl-4">
                        {r.anomaly.reasons.map((rs, i) => (
                          <li key={i}>{rs}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {fb.bullets.length > 0 && (
                <div className="card">
                  <h4 className="font-bold text-ink-900 mb-2 text-sm">
                    Zaključak
                  </h4>
                  <ul className="space-y-1.5 text-ink-700 text-sm">
                    {fb.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-ink-300 mt-0.5">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {fb.recommendations.length > 0 && (
                <div className="card">
                  <h4 className="font-bold text-ink-900 mb-2 text-sm">
                    Preporuke za poboljšanje
                  </h4>
                  <ul className="space-y-1.5 text-ink-700 text-sm">
                    {fb.recommendations.map((rec, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-ink-900 font-bold mt-0.5">→</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}

        {/* TOTAL SKROZ DOLE */}
        <div className="card bg-ink-900 text-white">
          <div className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">
            TOTAL — zbir svih sačuvanih smena za ovaj dan
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4">
            <div className="min-w-0">
              <div className="text-xs opacity-70">Ulasci</div>
              <div className="text-xl font-bold tabular-nums">{totEntries}</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs opacity-70">Broj računa</div>
              <div className="text-xl font-bold tabular-nums">{totBuyers}</div>
            </div>
            <div className="col-span-2 md:col-span-1 min-w-0">
              <div className="text-xs opacity-70">Ukupan promet</div>
              <div className="text-xl font-bold tabular-nums break-words">
                {formatRSD(totRevenue)}
              </div>
            </div>
            <div className="col-span-2 md:col-span-1 min-w-0">
              <div className="text-xs opacity-70">Broj artikala</div>
              <div className="text-xl font-bold tabular-nums">{totItems}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/15">
            <div className="min-w-0">
              <div className="text-xs opacity-70">Konverzija za ceo dan</div>
              <div className="text-lg font-bold tabular-nums">
                {formatPct(totConv)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs opacity-70">Pr. vr. rač. za dan</div>
              <div className="text-lg font-bold tabular-nums break-words">
                {formatRSD(totAov)}
              </div>
            </div>
          </div>
        </div>

        {/* POGREŠILI STE? */}
        <div className="card border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3 text-amber-900">
            <Phone size={18} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">POGREŠILI STE?</div>
              <p className="text-sm mt-1">
                Obratite se administratoru da promeni unos. Sistem čuva istoriju svake izmene 60 dana.
              </p>
            </div>
          </div>
        </div>

        <button onClick={resetAll} className="btn-ghost w-full">
          <RefreshCcw size={16} /> Upiši još jedan dan
        </button>
      </div>
    );
  }

  // ------- FORM VIEW -------
  return (
    <form onSubmit={openConfirm} className="space-y-5">
      {/* Radnja i datum */}
      <div className="card space-y-4">
        <div className={lockedStoreId ? "" : "grid md:grid-cols-2 gap-4"}>
          {!lockedStoreId && (
            <div>
              <label className="label">Radnja</label>
              <select
                className="select"
                value={storeId}
                onChange={(e) => {
                  setStoreId(e.target.value);
                  setRows({
                    prva: emptyRow(),
                    druga: emptyRow(),
                    dvokratna: emptyRow(),
                  });
                }}
                required
              >
                <option value="">— izaberi radnju —</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} · {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Datum</label>
            <input
              type="date"
              className="input"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {/* Worker progress (nedeljni, mesečni, 30d grafikon) */}
      {storeId && <WorkerProgress storeId={storeId} />}

      {/* Tabela smena */}
      {storeId ? (
        <div className="card space-y-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-ink-500">
              Smene za ovaj dan
            </div>
            <p className="text-sm text-ink-500 mt-1">
              Označi koje su smene radile i popuni brojeve. Jedna smena može imati više članica tima. Redovi bez kvačice se ne snimaju.
            </p>
          </div>

          {shifts.map((s) => {
            const r = rows[s.key];
            const e = Number(r.entries) || 0;
            const b = Number(r.buyers) || 0;
            const rev = Number(r.revenue) || 0;
            const it = Number(r.items) || 0;
            const rowConv = e > 0 ? (b / e) * 100 : 0;
            const rowAov = b > 0 ? rev / b : 0;
            const rowItemsPerBuyer = b > 0 ? it / b : 0;
            const overBuyers = b > e && r.enabled;

            return (
              <div
                key={s.key}
                className={`rounded-xl border p-4 space-y-3 transition ${
                  r.enabled
                    ? "border-ink-300 bg-white"
                    : "border-ink-100 bg-ink-50/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-ink-300 accent-ink-900"
                      checked={r.enabled}
                      onChange={(e) =>
                        updateRow(s.key, { enabled: e.target.checked })
                      }
                    />
                    <span className="font-bold text-ink-900">{s.label}</span>
                    <span className="text-xs text-ink-500">({s.hours})</span>
                  </label>
                </div>

                <div className={r.enabled ? "" : "opacity-40 pointer-events-none"}>
                  <div className="label text-xs mb-2">
                    TIM u smeni (izaberi jednu ili više)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {storeWorkers.length === 0 ? (
                      <span className="text-xs text-ink-400">Nema članica tima za ovu radnju.</span>
                    ) : (
                      storeWorkers.map((w) => {
                        const selected = r.worker_ids.includes(w.id);
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => toggleWorker(s.key, w.id)}
                            disabled={!r.enabled}
                            className={`px-3 py-1.5 rounded-full border text-sm font-semibold tabular-nums transition ${
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
                  {r.enabled && r.worker_ids.length === 0 && (
                    <p className="text-xs text-rose-700 mt-2 font-semibold">
                      Izaberi bar jednu radnicu za ovu smenu.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="label text-xs">Ulasci</label>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="input !h-10"
                      placeholder="0"
                      value={r.entries}
                      onChange={(e) =>
                        updateRow(s.key, { entries: e.target.value })
                      }
                      disabled={!r.enabled}
                      required={r.enabled}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Broj računa</label>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="input !h-10"
                      placeholder="0"
                      value={r.buyers}
                      onChange={(e) =>
                        updateRow(s.key, { buyers: e.target.value })
                      }
                      disabled={!r.enabled}
                      required={r.enabled}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Ukupan promet u dinarima</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      className="input !h-10"
                      placeholder="0,00"
                      value={r.revenue}
                      onChange={(e) =>
                        updateRow(s.key, { revenue: e.target.value })
                      }
                      disabled={!r.enabled}
                      required={r.enabled}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Broj artikala</label>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="input !h-10"
                      placeholder="0"
                      value={r.items}
                      onChange={(e) =>
                        updateRow(s.key, { items: e.target.value })
                      }
                      disabled={!r.enabled}
                      required={r.enabled}
                    />
                  </div>
                </div>

                {r.enabled && (
                  <>
                    <div>
                      <label className="label text-xs">Napomena (opciono)</label>
                      <input
                        type="text"
                        className="input !h-10 text-sm"
                        placeholder="npr. reklamacija, veliki gosti sa turizma..."
                        value={r.note}
                        onChange={(e) =>
                          updateRow(s.key, { note: e.target.value })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-ink-100">
                      <div>
                        <div className="text-[11px] text-ink-500 uppercase font-semibold">
                          Konverzija
                        </div>
                        <div className="text-sm font-bold tabular-nums">
                          {formatPct(rowConv)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-ink-500 uppercase font-semibold">
                          Pr. vr. rač.
                        </div>
                        <div className="text-sm font-bold tabular-nums">
                          {formatRSD(rowAov)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-ink-500 uppercase font-semibold">
                          Artikala po računu
                        </div>
                        <div className="text-sm font-bold tabular-nums">
                          {formatDecimal(rowItemsPerBuyer)}
                        </div>
                      </div>
                    </div>

                    {overBuyers && (
                      <p className="text-sm text-rose-700 font-semibold">
                        Broj računa ne može biti veći od broja ulazaka.
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card bg-ink-50/40 text-center text-ink-500 text-sm py-8">
          Prvo izaberi radnju da bi se prikazale smene.
        </div>
      )}

      {/* Total po danu */}
      {storeId && anyEnabled && (
        <div className="card bg-ink-900 text-white">
          <div className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">
            Ukupno po danu (zbir označenih smena)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4">
            <div className="min-w-0">
              <div className="text-xs opacity-70">Ulasci</div>
              <div className="text-xl font-bold tabular-nums">
                {totals.entries}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs opacity-70">Broj računa</div>
              <div className="text-xl font-bold tabular-nums">
                {totals.buyers}
              </div>
            </div>
            <div className="col-span-2 md:col-span-1 min-w-0">
              <div className="text-xs opacity-70">Ukupan promet</div>
              <div className="text-xl font-bold tabular-nums break-words">
                {formatRSD(totals.revenue)}
              </div>
            </div>
            <div className="col-span-2 md:col-span-1 min-w-0">
              <div className="text-xs opacity-70">Broj artikala</div>
              <div className="text-xl font-bold tabular-nums">
                {totals.items}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/15">
            <div className="min-w-0">
              <div className="text-xs opacity-70">Konverzija za ceo dan</div>
              <div className="text-lg font-bold tabular-nums">
                {formatPct(totals.conversion)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs opacity-70">Pr. vr. računa za dan</div>
              <div className="text-lg font-bold tabular-nums break-words">
                {formatRSD(totals.aov)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs opacity-70">Artikala po računu</div>
              <div className="text-lg font-bold tabular-nums">
                {formatDecimal(totals.itemsPerBuyer)}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 p-4 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={!canSubmit}
      >
        Nastavi, proveri cifre
      </button>

      {!anyEnabled && storeId && (
        <p className="text-center text-xs text-ink-500">
          Označi bar jednu smenu da bi se dugme aktiviralo.
        </p>
      )}

      {showConfirm && (
        <ConfirmShiftModal
          storeId={storeId}
          shiftDate={shiftDate}
          rows={summaryForConfirm}
          workers={workers}
          submitting={submitting}
          onCancel={() => setShowConfirm(false)}
          onConfirm={doSubmit}
        />
      )}
    </form>
  );
}
