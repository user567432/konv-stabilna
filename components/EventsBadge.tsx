import { PartyPopper, Ban } from "lucide-react";

export interface CalendarEvent {
  id: string;
  date_from: string;
  date_to: string;
  kind: "holiday" | "event";
  scope: "all" | "delta" | "dusanova" | "D1" | "D2" | "D4" | "D5";
  title: string;
  note: string | null;
}

const SCOPE_LABEL: Record<CalendarEvent["scope"], string> = {
  all: "Sve 4",
  delta: "Delta Planet",
  dusanova: "Dušanova",
  D1: "D1",
  D2: "D2",
  D4: "D4",
  D5: "D5",
};

export default function EventsBadge({
  events,
  title = "Danas",
}: {
  events: CalendarEvent[];
  title?: string;
}) {
  if (events.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {events.map((e) => {
        const isHoliday = e.kind === "holiday";
        const cls = isHoliday
          ? "bg-rose-50 border-rose-200 text-rose-900"
          : "bg-amber-50 border-amber-200 text-amber-900";
        const Icon = isHoliday ? Ban : PartyPopper;
        return (
          <div
            key={e.id}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm ${cls}`}
            title={e.note ?? undefined}
          >
            <Icon size={14} />
            <span className="font-semibold">{e.title}</span>
            <span className="text-xs opacity-80">· {SCOPE_LABEL[e.scope]}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Filtriraj događaje za konkretan dan.
 */
export function eventsForDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((e) => e.date_from <= date && e.date_to >= date);
}

/**
 * Filter scope — za prikaz po radnji: prolazi ako scope === 'all' ili matchuje store.
 */
export function matchesScope(
  e: CalendarEvent,
  storeId: string | null
): boolean {
  if (e.scope === "all") return true;
  if (!storeId) return true;
  if (e.scope === storeId) return true;
  if (e.scope === "delta" && (storeId === "D4" || storeId === "D5")) return true;
  if (e.scope === "dusanova" && (storeId === "D1" || storeId === "D2")) return true;
  return false;
}
