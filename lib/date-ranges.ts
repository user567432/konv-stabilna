// Pomoćne funkcije za rad sa datumima i rasponima (srpski, nedelja počinje ponedeljkom).

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  label: string;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

export function today(): string {
  return ymd(new Date());
}

export function last7Days(): DateRange {
  const end = new Date();
  const start = addDays(end, -6);
  return { start: ymd(start), end: ymd(end), label: "Poslednjih 7 dana" };
}

export function last14Days(): DateRange {
  const end = new Date();
  const start = addDays(end, -13);
  return { start: ymd(start), end: ymd(end), label: "Poslednjih 14 dana" };
}

export function last30Days(): DateRange {
  const end = new Date();
  const start = addDays(end, -29);
  return { start: ymd(start), end: ymd(end), label: "Poslednjih 30 dana" };
}

export function thisMonth(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: ymd(start), end: ymd(end), label: "Ovaj mesec" };
}

export function lastMonth(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: ymd(start), end: ymd(end), label: "Prethodni mesec" };
}

export function quarter(q: 1 | 2 | 3 | 4, year?: number): DateRange {
  const y = year ?? new Date().getFullYear();
  const startMonth = (q - 1) * 3; // 0, 3, 6, 9
  const start = new Date(y, startMonth, 1);
  const end = new Date(y, startMonth + 3, 0);
  return { start: ymd(start), end: ymd(end), label: `Q${q} ${y}` };
}

export function yearToDate(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return { start: ymd(start), end: ymd(now), label: `${now.getFullYear()}` };
}

export function maximum(firstShiftDate: string | null): DateRange {
  const end = today();
  const start = firstShiftDate ?? ymd(addDays(new Date(), -365));
  return { start, end, label: "Maksimum" };
}

// Izračunaj „prethodni period" iste dužine — za compare.
export function previousPeriodOf(range: DateRange): DateRange {
  const span = diffDays(range.start, range.end); // 0 ako je isti dan
  const newEnd = addDays(new Date(range.start + "T00:00:00"), -1);
  const newStart = addDays(newEnd, -span);
  return {
    start: ymd(newStart),
    end: ymd(newEnd),
    label: `Prethodni period (${span + 1} ${span + 1 === 1 ? "dan" : "dana"})`,
  };
}

// Izračunaj isti raspon prošle godine — drugi način za compare.
export function previousYearOf(range: DateRange): DateRange {
  const s = new Date(range.start + "T00:00:00");
  const e = new Date(range.end + "T00:00:00");
  s.setFullYear(s.getFullYear() - 1);
  e.setFullYear(e.getFullYear() - 1);
  return {
    start: ymd(s),
    end: ymd(e),
    label: `Ista nedelja ${s.getFullYear()}`,
  };
}

export type ComparePreset = "none" | "previous_period" | "previous_year";

export function resolveCompare(range: DateRange, preset: ComparePreset): DateRange | null {
  if (preset === "none") return null;
  if (preset === "previous_year") return previousYearOf(range);
  return previousPeriodOf(range);
}

export const QUICK_RANGES: { key: string; build: () => DateRange }[] = [
  { key: "today", build: () => ({ start: today(), end: today(), label: "Danas" }) },
  {
    key: "yesterday",
    build: () => {
      const d = addDays(new Date(), -1);
      return { start: ymd(d), end: ymd(d), label: "Juče" };
    },
  },
  { key: "last7", build: last7Days },
  { key: "last14", build: last14Days },
  { key: "last30", build: last30Days },
  { key: "this_month", build: thisMonth },
  { key: "last_month", build: lastMonth },
  { key: "q1", build: () => quarter(1) },
  { key: "q2", build: () => quarter(2) },
  { key: "q3", build: () => quarter(3) },
  { key: "q4", build: () => quarter(4) },
  { key: "ytd", build: yearToDate },
];
