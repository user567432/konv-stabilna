// Raspodela mesečnog cilja po ISO nedeljama.
// Logika:
//  - Dušanove radnje (D1, D2): pon-pet = težina 1.0, sub = 0.5, ned = 0
//  - Delta (D4, D5): svi dani = 1.0
//  - Mesečni cilj se deli na sumu svih pondera meseca, svaka nedelja dobija svoj deo

export type StoreKind = "dusan" | "delta";

export function kindForStore(storeId: string): StoreKind {
  return storeId === "D1" || storeId === "D2" ? "dusan" : "delta";
}

function dayWeight(date: Date, kind: StoreKind): number {
  const dow = date.getDay(); // 0 = nedelja, 1 = pon, ..., 6 = sub
  if (kind === "delta") return 1.0;
  // dusan
  if (dow === 0) return 0;      // nedelja
  if (dow === 6) return 0.5;    // subota
  return 1.0;                    // pon-pet
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ISO ponedeljak za dati datum (lokalno vreme)
function isoMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = date.getDay(); // 0 = ned
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + diff);
  return date;
}

export interface WeekSlice {
  week_start: string; // YYYY-MM-DD (ponedeljak)
  week_end: string;   // YYYY-MM-DD (nedelja)
  goal_rsd: number;
  source_month: string; // YYYY-MM-01
}

// Glavna funkcija: za dati mesec (any date in month) i store, vrati niz nedelja sa ciljevima.
// Mesečni cilj se deli proporcionalno po pondera koji pripadaju tom mesecu (ISO nedelje mogu
// da prelaze granicu meseca, pa se deli samo deo nedelje koji pada u target mesec).
export function distributeMonthlyGoal(
  storeId: string,
  monthlyGoal: number,
  anyDateInMonth: Date
): WeekSlice[] {
  if (monthlyGoal <= 0) return [];
  const kind = kindForStore(storeId);

  const year = anyDateInMonth.getFullYear();
  const month = anyDateInMonth.getMonth(); // 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Prolazim dan po dan kroz mesec, akumuliram pondere
  let totalWeight = 0;
  const perDay: { date: Date; weight: number }[] = [];
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const w = dayWeight(new Date(d), kind);
    perDay.push({ date: new Date(d), weight: w });
    totalWeight += w;
  }

  if (totalWeight === 0) return [];
  const rsdPerUnit = monthlyGoal / totalWeight;

  // Grupisanje po ISO nedelji (pon-ned). Nedelja može da pređe granicu meseca.
  const buckets = new Map<string, { start: Date; end: Date; weight: number }>();
  for (const p of perDay) {
    const mon = isoMonday(p.date);
    const key = ymd(mon);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    const existing = buckets.get(key);
    if (existing) {
      existing.weight += p.weight;
    } else {
      buckets.set(key, { start: mon, end: sun, weight: p.weight });
    }
  }

  const sourceMonth = ymd(firstDay);
  const result: WeekSlice[] = [];
  for (const [, b] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    result.push({
      week_start: ymd(b.start),
      week_end: ymd(b.end),
      goal_rsd: Math.round(b.weight * rsdPerUnit),
      source_month: sourceMonth,
    });
  }
  return result;
}

// Za prikaz: pronađi trenutnu nedelju za dati datum
export function currentWeekRange(d: Date = new Date()): { start: string; end: string } {
  const mon = isoMonday(d);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return { start: ymd(mon), end: ymd(sun) };
}
