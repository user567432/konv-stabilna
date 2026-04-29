"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  Save,
  Clock3,
} from "lucide-react";
import clsx from "clsx";
import { STORE_LABELS_SHORT, formatDateSr } from "@/lib/format";
import { createSupabaseBrowser } from "@/lib/supabase";
import type { Worker, Store } from "@/lib/types";
import type { ScheduleSlot } from "./page";

type ShiftType = "prva" | "druga" | "dvokratna";

const SHIFT_TYPES: ShiftType[] = ["prva", "druga", "dvokratna"];
const SHIFT_LABELS_FULL: Record<ShiftType, string> = {
  prva: "Prva (preuzme jutrom)",
  druga: "Druga (popodne)",
  dvokratna: "Dvokratna (ceo dan)",
};
const SHIFT_LABELS_SHORT: Record<ShiftType, string> = {
  prva: "Prva",
  druga: "Druga",
  dvokratna: "Dvokratna",
};

const DAY_LABELS = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

function dayOfMonth(dateStr: string): number {
  return Number(dateStr.slice(8, 10));
}

function slotKey(storeId: string, date: string, type: ShiftType): string {
  return `${storeId}|${date}|${type}`;
}

type ShiftDistribution = {
  prva: number;
  druga: number;
  dvokratna: number;
};

interface Props {
  stores: Store[];
  workers: Worker[];
  thisWeek: ScheduleSlot[];
  prevWeek: ScheduleSlot[];
  weekStart: string;
  activeStore: string;
  shiftDistribution: Record<string, ShiftDistribution>;
  rotationWindowWeeks: number;
}

interface EditingSlot {
  storeId: string;
  date: string;
  type: ShiftType;
  workerIds: string[];
  note: string;
}

export default function RasporedClient({
  stores,
  workers,
  thisWeek,
  prevWeek,
  weekStart,
  activeStore,
  shiftDistribution,
  rotationWindowWeeks,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Lokalni state za optimistic update.
  // Resetuje se SAMO kada user navigira na drugu nedelju ili radnju
  // (tada weekStart/activeStore promene). Inace, optimistic update u
  // saveSlot() ostaje stabilan — router.refresh() ne brise ga.
  const [slots, setSlots] = useState<Map<string, ScheduleSlot>>(() => {
    const m = new Map<string, ScheduleSlot>();
    thisWeek.forEach((s) =>
      m.set(slotKey(s.store_id, s.shift_date, s.shift_type), s)
    );
    return m;
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = new Map<string, ScheduleSlot>();
    thisWeek.forEach((s) =>
      m.set(slotKey(s.store_id, s.shift_date, s.shift_type), s)
    );
    setSlots(m);
  }, [weekStart, activeStore]);

  const [saveError, setSaveError] = useState<string | null>(null);

  const prevSlotsMap = useMemo(() => {
    const m = new Map<string, ScheduleSlot>();
    prevWeek.forEach((s) =>
      m.set(slotKey(s.store_id, s.shift_date, s.shift_type), s)
    );
    return m;
  }, [prevWeek]);

  const workerById = useMemo(() => {
    const m = new Map<string, Worker>();
    workers.forEach((w) => m.set(w.id, w));
    return m;
  }, [workers]);

  const workersByStore = useMemo(() => {
    const m = new Map<string, Worker[]>();
    workers.forEach((w) => {
      const arr = m.get(w.store_id) ?? [];
      arr.push(w);
      m.set(w.store_id, arr);
    });
    return m;
  }, [workers]);

  // Sedam datuma u nedelji
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Editor state
  const [editing, setEditing] = useState<EditingSlot | null>(null);

  function gotoWeek(newStart: string) {
    const sp = new URLSearchParams();
    sp.set("week", newStart);
    sp.set("store", activeStore);
    router.push(`${pathname}?${sp.toString()}`);
  }

  function gotoStore(storeId: string) {
    const sp = new URLSearchParams();
    sp.set("week", weekStart);
    sp.set("store", storeId);
    router.push(`${pathname}?${sp.toString()}`);
  }

  function openSlot(date: string, type: ShiftType) {
    const key = slotKey(activeStore, date, type);
    const existing = slots.get(key);
    setEditing({
      storeId: activeStore,
      date,
      type,
      workerIds: existing?.worker_ids ?? [],
      note: existing?.note ?? "",
    });
  }

  async function saveSlot() {
    if (!editing) return;
    const key = slotKey(editing.storeId, editing.date, editing.type);
    const prevSlots = slots;

    // Optimistic update
    const newSlot: ScheduleSlot = {
      store_id: editing.storeId,
      shift_date: editing.date,
      shift_type: editing.type,
      worker_ids: editing.workerIds,
      note: editing.note.trim() || null,
    };
    const next = new Map(slots);
    if (newSlot.worker_ids.length === 0 && !newSlot.note) {
      next.delete(key);
    } else {
      next.set(key, newSlot);
    }
    setSlots(next);
    setSaveError(null);
    setEditing(null);

    // Server save
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.rpc("upsert_schedule_slot", {
        p_store_id: editing.storeId,
        p_shift_date: editing.date,
        p_shift_type: editing.type,
        p_worker_ids: editing.workerIds,
        p_note: editing.note.trim() || null,
      });
      if (error) {
        throw new Error(error.message);
      }
      // NEMA router.refresh() jer bi resetovao optimistic state preko stale server data.
      // Server je istina pri sledecoj navigaciji (drugu nedelju, druga radnja, F5).
    } catch (e: unknown) {
      console.error("Schedule save failed", e);
      setSaveError(
        e instanceof Error
          ? `Snimanje nije uspelo: ${e.message}`
          : "Snimanje nije uspelo."
      );
      // Vrati u prethodno stanje
      setSlots(prevSlots);
    }
  }

  function clearSlot() {
    if (!editing) return;
    setEditing({ ...editing, workerIds: [], note: "" });
  }

  function toggleWorker(id: string) {
    if (!editing) return;
    const isIn = editing.workerIds.includes(id);
    setEditing({
      ...editing,
      workerIds: isIn
        ? editing.workerIds.filter((x) => x !== id)
        : [...editing.workerIds, id],
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const isCurrentWeek = today >= weekStart && today <= addDays(weekStart, 6);

  // Prosla nedelja (referenca u editoru)
  const prevSlotForEditor: ScheduleSlot | null = editing
    ? prevSlotsMap.get(
        slotKey(editing.storeId, addDays(editing.date, -7), editing.type)
      ) ?? null
    : null;

  const storeWorkersForEditor = editing
    ? workersByStore.get(editing.storeId) ?? []
    : [];

  return (
    <main className="min-h-screen bg-ink-50/40">
      {/* Header */}
      <header className="bg-white border-b border-ink-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/master/hr"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> HR
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900">Raspored</span>
          </div>
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => gotoWeek(addMondayOf(today))}
              className="text-xs h-9 px-3 rounded-lg bg-ink-900 text-white font-semibold"
            >
              Idi na ovu nedelju
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-ink-700" />
            Raspored
          </h1>
          <p className="mt-1 text-ink-500">
            Planiraj smene po radnji za nedelju. Klikni na ćeliju da postaviš
            radnice. Prošla nedelja se prikazuje kao referenca u editoru.
          </p>
        </section>

        {/* Save error banner */}
        {saveError && (
          <section className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900 flex items-start gap-2">
            <span className="font-semibold">Greška:</span>
            <span>{saveError}</span>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="ml-auto text-rose-700 hover:text-rose-900 text-xs font-semibold"
            >
              Zatvori
            </button>
          </section>
        )}

        {/* Week navigation */}
        <section className="card-soft">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => gotoWeek(addDays(weekStart, -7))}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 text-sm font-semibold"
            >
              <ChevronLeft size={16} /> Prethodna
            </button>
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">
                Nedelja
              </div>
              <div className="text-base font-bold text-ink-900 tabular-nums">
                {formatDateSr(weekStart)} — {formatDateSr(addDays(weekStart, 6))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => gotoWeek(addDays(weekStart, 7))}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 text-sm font-semibold"
            >
              Sledeća <ChevronRight size={16} />
            </button>
          </div>
        </section>

        {/* Store tabs */}
        <section className="flex gap-2 flex-wrap">
          {stores.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => gotoStore(s.id)}
              className={
                activeStore === s.id
                  ? "px-4 py-2.5 rounded-xl bg-ink-900 text-white text-sm font-semibold"
                  : "px-4 py-2.5 rounded-xl bg-white border border-ink-200 text-sm text-ink-700 hover:bg-ink-100"
              }
            >
              <span className="font-bold">{s.id}</span>{" "}
              <span className="opacity-70">
                {STORE_LABELS_SHORT[s.id]?.replace(`${s.id} `, "") ?? ""}
              </span>
            </button>
          ))}
        </section>

        {/* Schedule grid */}
        <section className="card-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 px-2 text-xs font-semibold uppercase tracking-wider text-ink-500 w-28">
                  Smena
                </th>
                {weekDays.map((d, i) => (
                  <th
                    key={d}
                    className={clsx(
                      "py-2 px-2 text-center text-xs font-semibold uppercase tracking-wider",
                      isToday(d) ? "text-ink-900" : "text-ink-500"
                    )}
                  >
                    <div>{DAY_LABELS[i]}</div>
                    <div
                      className={clsx(
                        "text-[11px] tabular-nums mt-0.5",
                        isToday(d) ? "font-bold text-ink-900" : "text-ink-400"
                      )}
                    >
                      {dayOfMonth(d)}.
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SHIFT_TYPES.map((type) => (
                <tr key={type} className="border-t border-ink-100">
                  <td className="py-2 px-2 text-xs font-bold text-ink-700">
                    {SHIFT_LABELS_SHORT[type]}
                  </td>
                  {weekDays.map((date) => {
                    const key = slotKey(activeStore, date, type);
                    const slot = slots.get(key);
                    const prevSlot = prevSlotsMap.get(
                      slotKey(activeStore, addDays(date, -7), type)
                    );
                    const isEmpty = !slot || slot.worker_ids.length === 0;

                    return (
                      <td key={date} className="py-1.5 px-1.5 align-top">
                        <button
                          type="button"
                          onClick={() => openSlot(date, type)}
                          className={clsx(
                            "w-full min-h-[68px] rounded-lg border text-left p-2 text-xs transition group",
                            isEmpty
                              ? "border-dashed border-ink-200 hover:border-ink-400 hover:bg-ink-50"
                              : "border-ink-200 bg-ink-50 hover:bg-ink-100"
                          )}
                        >
                          {isEmpty ? (
                            <div className="text-ink-400 text-center pt-3.5">
                              {prevSlot && prevSlot.worker_ids.length > 0 ? (
                                <span className="text-[10px]">
                                  + dodaj
                                  <br />
                                  <span className="opacity-60">
                                    pr.ned.: {prevSlot.worker_ids.length}
                                  </span>
                                </span>
                              ) : (
                                <span>+ dodaj</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {slot.worker_ids.map((wid) => {
                                const w = workerById.get(wid);
                                return (
                                  <span
                                    key={wid}
                                    className="inline-block px-1.5 py-0.5 rounded font-mono font-bold bg-white border border-ink-200 text-ink-900"
                                  >
                                    {w?.initials ?? "?"}
                                  </span>
                                );
                              })}
                              {slot.note && (
                                <span
                                  className="inline-block px-1 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900"
                                  title={slot.note}
                                >
                                  📝
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="text-xs text-ink-500 leading-relaxed">
          Klik na ćeliju otvara editor sa listom radnica iz radnje{" "}
          <b>{activeStore}</b>. Štikliraš ko radi tu smenu, opciono ostavljaš
          napomenu (npr. „dolazi u 10h"), pa snimaš. „pr.ned." u praznoj ćeliji
          znači da je prošle nedelje u istoj smeni neko bio raspoređen — otvori
          ćeliju da vidiš ko.
        </section>
      </div>

      {/* === EDITOR MODAL === */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-ink-900">
                  {SHIFT_LABELS_FULL[editing.type]}
                </h3>
                <p className="text-xs text-ink-500">
                  {editing.storeId} · {formatDateSr(editing.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded hover:bg-ink-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Prosla nedelja referenca */}
              {prevSlotForEditor && prevSlotForEditor.worker_ids.length > 0 && (
                <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <Clock3
                      size={14}
                      className="text-sky-700 mt-0.5 shrink-0"
                    />
                    <div className="flex-1">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-sky-700 mb-1">
                        Prošla nedelja, ista smena
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {prevSlotForEditor.worker_ids.map((wid) => {
                          const w = workerById.get(wid);
                          return (
                            <span
                              key={wid}
                              className="inline-block px-2 py-0.5 rounded font-mono font-bold bg-white border border-sky-200 text-sky-900 text-xs"
                            >
                              {w?.initials ?? "?"}
                            </span>
                          );
                        })}
                      </div>
                      {prevSlotForEditor.note && (
                        <div className="text-xs text-sky-800 mt-1.5 italic">
                          „{prevSlotForEditor.note}"
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            workerIds: [...prevSlotForEditor.worker_ids],
                          })
                        }
                        className="mt-2 text-[11px] font-semibold text-sky-700 hover:text-sky-900 underline"
                      >
                        Kopiraj prošlu nedelju →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Worker multiselect */}
              <div>
                <div className="flex items-baseline justify-between">
                  <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                    Radnice u smeni
                  </label>
                  <span className="text-[10px] text-ink-400 font-mono">
                    P/D/Dv = poslednjih {rotationWindowWeeks} nedelja
                  </span>
                </div>
                <div className="mt-1.5 mb-2 text-[10px] text-ink-500 leading-relaxed">
                  <span className="text-emerald-700 font-semibold">●</span> nije
                  bila u ovoj smeni 4 nedelje (idealno za rotaciju){" "}
                  <span className="text-amber-700 font-semibold ml-2">●</span>{" "}
                  bila 2× ovde{" "}
                  <span className="text-rose-700 font-semibold ml-2">●</span>{" "}
                  3+× ovde (razmisli o promeni)
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {storeWorkersForEditor.length === 0 && (
                    <div className="col-span-2 text-sm text-ink-400 text-center py-4">
                      Nema aktivnih radnica u radnji {editing.storeId}.
                      Dodaj ih u Podešavanjima.
                    </div>
                  )}
                  {storeWorkersForEditor.map((w) => {
                    const active = editing.workerIds.includes(w.id);
                    const dist = shiftDistribution[w.id] ?? {
                      prva: 0,
                      druga: 0,
                      dvokratna: 0,
                    };
                    const totalPast = dist.prva + dist.druga + dist.dvokratna;
                    const inThisShiftType = dist[editing.type];
                    // Hint logika: ako je puno bila u istom tipu smene poslednjih
                    // 4 nedelje → upozori. Ako uopste nije bila u ovom tipu →
                    // pohvali ("dobar predlog za rotaciju").
                    let hintColor:
                      | "muted"
                      | "amber"
                      | "rose"
                      | "emerald" = "muted";
                    let hintText = "";
                    if (totalPast === 0) {
                      hintText = "nije radila pos. 4 ned.";
                      hintColor = "muted";
                    } else if (inThisShiftType >= 3) {
                      hintText = `${inThisShiftType}× ovde u 4 ned.`;
                      hintColor = "rose";
                    } else if (inThisShiftType >= 2) {
                      hintText = `${inThisShiftType}× ovde u 4 ned.`;
                      hintColor = "amber";
                    } else if (inThisShiftType === 0) {
                      hintText = "nije bila ovde 4 ned.";
                      hintColor = "emerald";
                    } else {
                      hintText = "1× ovde u 4 ned.";
                      hintColor = "muted";
                    }

                    return (
                      <button
                        type="button"
                        key={w.id}
                        onClick={() => toggleWorker(w.id)}
                        className={clsx(
                          "px-3 py-2.5 rounded-xl border-2 text-left transition",
                          active
                            ? "border-ink-900 bg-ink-900 text-white"
                            : "border-ink-200 bg-white hover:border-ink-400"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-sm">
                            {w.initials}
                          </span>
                          {totalPast > 0 && (
                            <span
                              className={clsx(
                                "text-[9px] font-mono tabular-nums px-1 py-0.5 rounded",
                                active
                                  ? "bg-white/20 text-white/90"
                                  : "bg-ink-100 text-ink-500"
                              )}
                              title={`Past 4 nedelje: ${dist.prva}× prva, ${dist.druga}× druga, ${dist.dvokratna}× dvokratna`}
                            >
                              {dist.prva}/{dist.druga}/{dist.dvokratna}
                            </span>
                          )}
                        </div>
                        {w.full_name && (
                          <div
                            className={clsx(
                              "text-[10px] mt-0.5",
                              active ? "text-white/70" : "text-ink-500"
                            )}
                          >
                            {w.full_name}
                          </div>
                        )}
                        <div
                          className={clsx(
                            "text-[10px] mt-1 font-medium",
                            active && "opacity-80",
                            !active && hintColor === "rose" && "text-rose-700",
                            !active &&
                              hintColor === "amber" &&
                              "text-amber-700",
                            !active &&
                              hintColor === "emerald" &&
                              "text-emerald-700",
                            !active && hintColor === "muted" && "text-ink-400",
                            active &&
                              hintColor === "rose" &&
                              "text-rose-200",
                            active &&
                              hintColor === "amber" &&
                              "text-amber-200",
                            active &&
                              hintColor === "emerald" &&
                              "text-emerald-200"
                          )}
                        >
                          {hintText}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  Napomena (opciono)
                </label>
                <textarea
                  rows={2}
                  className="input mt-2"
                  value={editing.note}
                  onChange={(e) =>
                    setEditing({ ...editing, note: e.target.value })
                  }
                  placeholder="Npr. dolazi u 10h, ne radi popodne"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-ink-100 flex items-center justify-between gap-2 bg-ink-50/40 sticky bottom-0">
              <button
                type="button"
                onClick={clearSlot}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                Isprazni
              </button>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="btn-ghost"
                >
                  Otkaži
                </button>
                <button
                  type="button"
                  onClick={saveSlot}
                  className="btn-primary"
                >
                  <Save size={16} /> Sačuvaj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Helper koji koristi gotoWeek za "ovu nedelju"
function addMondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
