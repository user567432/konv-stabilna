export type ShiftType = "prva" | "druga" | "dvokratna";

export interface Store {
  id: string;
  name: string;
  location: string;
  segment: "Zenska" | "Muska";
  created_at: string;
}

export interface Worker {
  id: string;
  store_id: string;
  initials: string;
  full_name: string | null;
  active: boolean;
  created_at: string;
}

export interface Shift {
  id: string;
  store_id: string;
  worker_id: string;      // glavna radnica (prva selektovana) — zadržano radi kompatibilnosti
  worker_ids: string[];   // sve radnice koje su radile u smeni
  shift_date: string;
  shift_type: ShiftType;
  entries: number;
  buyers: number;
  revenue: number;
  items_sold: number;
  note: string | null;
  conversion_pct: number;
  aov: number;
  items_per_buyer: number;
  created_at: string;
}

export interface Settings {
  id: string;
  store_id: string | null;
  conversion_target: number;
  aov_target: number;
  revenue_target: number | null;
  monthly_revenue_target: number | null;
  updated_at: string;
}

export interface WeeklyGoal {
  id: string;
  store_id: string;
  week_start: string; // YYYY-MM-DD (ponedeljak)
  week_end: string;   // YYYY-MM-DD (nedelja)
  goal_rsd: number;
  manual_override: boolean;
  source_month: string | null; // YYYY-MM-01
  created_at: string;
  updated_at: string;
}

export interface ShiftEditLog {
  id: string;
  shift_id: string | null;
  action: "update" | "delete";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actor: string | null;
  created_at: string;
}

export interface DailyStoreSummary {
  store_id: string;
  shift_date: string;
  total_entries: number;
  total_buyers: number;
  total_revenue: number;
  total_items: number;
  conversion_pct: number;
  aov: number;
  shifts_count: number;
}
