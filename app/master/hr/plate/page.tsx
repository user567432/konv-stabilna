import { redirect } from "next/navigation";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import PlateClient from "./PlateClient";
import type { Worker } from "@/lib/types";

export const dynamic = "force-dynamic";

export interface SalaryRow {
  worker_id: string;
  initials: string;
  store_id: string;
  year: number | null;
  month: number | null;
  fixed_amount: number | null;
  variable_amount: number | null;
  amount: number | null;
}

interface WorkerWithBaseSalary extends Worker {
  base_salary: number | null;
}

interface PageProps {
  searchParams: {
    store?: string;
    end_year?: string;
    end_month?: string;
  };
}

const MONTHS_VISIBLE = 6;

function clampMonth(m: number): number {
  return Math.max(1, Math.min(12, m));
}

function shiftMonth(year: number, month: number, delta: number): { y: number; m: number } {
  let total = year * 12 + (month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m };
}

export default async function PlatePage({ searchParams }: PageProps) {
  if (!(await isMasterAuthed())) redirect("/login");

  const today = new Date();
  const defaultStore = "D1";
  const activeStore = ["D1", "D2", "D4", "D5"].includes(searchParams.store ?? "")
    ? (searchParams.store as string)
    : defaultStore;

  const endYear = Number(searchParams.end_year) || today.getFullYear();
  const endMonth = clampMonth(Number(searchParams.end_month) || today.getMonth() + 1);

  // 6-mesecni window: end_month je najnoviji, idemo unazad
  const start = shiftMonth(endYear, endMonth, -(MONTHS_VISIBLE - 1));

  const supabase = createSupabaseServer();

  const [{ data: workersData }, { data: gridData }] = await Promise.all([
    supabase
      .from("workers")
      .select("*")
      .eq("active", true)
      .order("store_id")
      .order("initials"),
    supabase.rpc("list_salaries_grid_range", {
      p_from_year: start.y,
      p_from_month: start.m,
      p_to_year: endYear,
      p_to_month: endMonth,
    }),
  ]);

  const baseSalaryMap = new Map<string, number | null>();
  ((workersData ?? []) as WorkerWithBaseSalary[]).forEach((w) => {
    baseSalaryMap.set(w.id, w.base_salary != null ? Number(w.base_salary) : null);
  });

  const salaries: SalaryRow[] = (
    (gridData ?? []) as Array<Record<string, unknown>>
  ).map((r) => ({
    worker_id: r.worker_id as string,
    initials: r.initials as string,
    store_id: r.store_id as string,
    year: (r.year as number | null) ?? null,
    month: (r.month as number | null) ?? null,
    fixed_amount: r.fixed_amount != null ? Number(r.fixed_amount) : null,
    variable_amount: r.variable_amount != null ? Number(r.variable_amount) : null,
    amount: r.amount != null ? Number(r.amount) : null,
  }));

  return (
    <PlateClient
      workers={(workersData ?? []) as Worker[]}
      salaries={salaries}
      baseSalaries={Object.fromEntries(baseSalaryMap)}
      activeStore={activeStore}
      endYear={endYear}
      endMonth={endMonth}
      monthsVisible={MONTHS_VISIBLE}
    />
  );
}
