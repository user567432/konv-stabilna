import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sun,
} from "lucide-react";
import {
  getWorkerSession,
  isMasterAuthed,
  getTimStore,
} from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import { STORE_LABELS_SHORT, formatDateSr } from "@/lib/format";
import type { Worker } from "@/lib/types";
import LogoutButton from "../LogoutButton";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { week?: string };
}

const SHIFT_LABELS: Record<string, string> = {
  prva: "1. smena",
  druga: "2. smena",
  dvokratna: "Dvokratna",
};

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOfWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const labels = [
    "Nedelja",
    "Ponedeljak",
    "Utorak",
    "Sreda",
    "Četvrtak",
    "Petak",
    "Subota",
  ];
  return labels[d.getDay()];
}

interface ScheduleEntry {
  shift_date: string;
  shift_type: "prva" | "druga" | "dvokratna";
  store_id: string;
  worker_ids: string[];
  note: string | null;
}

export default async function MojRasporedPage({ searchParams }: PageProps) {
  if (await isMasterAuthed()) redirect("/master");
  if (await getTimStore()) redirect("/unos");
  const session = await getWorkerSession();
  if (!session) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const weekStart = getMondayOf(searchParams.week ?? today);
  const weekEnd = addDays(weekStart, 6);

  const supabase = createSupabaseServer();

  // Sve workers (za rezolviranje inicijala koleginica u smeni)
  const { data: workersData } = await supabase
    .from("workers")
    .select("id, initials, store_id, full_name, active");
  const workerById = new Map<string, Worker>(
    ((workersData ?? []) as Worker[]).map((w) => [w.id, w])
  );

  // Raspored radnice ove nedelje
  const { data: scheduleData } = await supabase.rpc("get_worker_schedule", {
    p_worker_id: session.worker_id,
    p_from: weekStart,
    p_to: weekEnd,
  });

  const myShifts = (
    (scheduleData ?? []) as Array<{
      shift_date: string;
      shift_type: "prva" | "druga" | "dvokratna";
      store_id: string;
      worker_ids: string[];
      note: string | null;
    }>
  ).map<ScheduleEntry>((r) => ({
    shift_date: r.shift_date,
    shift_type: r.shift_type,
    store_id: r.store_id,
    worker_ids: r.worker_ids ?? [],
    note: r.note ?? null,
  }));

  // Grupisi po danu
  const byDate = new Map<string, ScheduleEntry[]>();
  for (let i = 0; i < 7; i++) {
    byDate.set(addDays(weekStart, i), []);
  }
  myShifts.forEach((s) => {
    const arr = byDate.get(s.shift_date);
    if (arr) arr.push(s);
  });

  return (
    <main className="min-h-screen bg-ink-50/40">
      <header className="bg-white border-b border-ink-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/moj-profil"
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft size={14} /> Profil
            </Link>
            <span className="text-ink-300">/</span>
            <span className="text-sm font-semibold text-ink-900">Raspored</span>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <section>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-ink-700" />
            Moj raspored
          </h1>
          <p className="mt-1 text-ink-500">
            Tvoja nedelja u radnji{" "}
            <b>{STORE_LABELS_SHORT[session.store_id] ?? session.store_id}</b>
          </p>
        </section>

        {/* Week nav */}
        <section className="card-soft">
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/moj-profil/raspored?week=${addDays(weekStart, -7)}`}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 text-sm font-semibold"
            >
              <ChevronLeft size={16} /> Prethodna
            </Link>
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">
                Nedelja
              </div>
              <div className="text-base font-bold text-ink-900 tabular-nums">
                {formatDateSr(weekStart)} — {formatDateSr(addDays(weekStart, 6))}
              </div>
            </div>
            <Link
              href={`/moj-profil/raspored?week=${addDays(weekStart, 7)}`}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-white border border-ink-200 hover:bg-ink-50 text-sm font-semibold"
            >
              Sledeća <ChevronRight size={16} />
            </Link>
          </div>
        </section>

        {/* Days */}
        <section className="space-y-3">
          {Array.from(byDate.entries()).map(([date, shifts]) => {
            const isTodayClass =
              date === today
                ? "border-2 border-ink-900"
                : "border border-ink-100";
            const isFreeDay = shifts.length === 0;

            return (
              <div
                key={date}
                className={`bg-white rounded-2xl ${isTodayClass} p-5`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <div className="text-base font-bold text-ink-900">
                      {dayOfWeekLabel(date)}
                      {date === today && (
                        <span className="ml-2 text-[11px] uppercase tracking-wider font-semibold text-ink-900 bg-amber-100 px-1.5 py-0.5 rounded">
                          danas
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-500 tabular-nums">
                      {formatDateSr(date)}
                    </div>
                  </div>
                </div>

                {isFreeDay ? (
                  <div className="flex items-center gap-2 text-emerald-700 mt-2">
                    <Sun size={18} />
                    <span className="font-semibold text-sm">Slobodan dan</span>
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {shifts.map((s, i) => {
                      const koleginice = s.worker_ids
                        .filter((id) => id !== session.worker_id)
                        .map((id) => workerById.get(id)?.initials)
                        .filter(Boolean);

                      return (
                        <div
                          key={i}
                          className="rounded-xl bg-ink-50/80 border border-ink-100 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-bold text-ink-900">
                              {SHIFT_LABELS[s.shift_type] ?? s.shift_type}
                            </div>
                            <span className="text-[11px] font-bold bg-ink-900 text-white px-1.5 py-0.5 rounded">
                              {s.store_id}
                            </span>
                          </div>
                          {koleginice.length > 0 ? (
                            <div className="mt-1.5 text-xs text-ink-700">
                              <span className="text-ink-500">Sa: </span>
                              {koleginice.map((init, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block font-mono font-bold ml-1 px-1.5 py-0.5 rounded bg-white border border-ink-200"
                                >
                                  {init}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-1.5 text-xs text-ink-500 italic">
                              Sama u smeni
                            </div>
                          )}
                          {s.note && (
                            <div className="mt-1.5 text-xs text-amber-900 bg-amber-50 px-2 py-1 rounded">
                              <b>Napomena:</b> {s.note}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="text-xs text-ink-500 leading-relaxed">
          Ako vidiš da raspored nije dobar, javi šefu. „Slobodan dan" znači da
          tog dana nemaš zakazanu smenu.
        </section>
      </div>
    </main>
  );
}
