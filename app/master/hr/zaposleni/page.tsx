import { redirect } from "next/navigation";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import ZaposleniClient from "./ZaposleniClient";

export const dynamic = "force-dynamic";

export interface WorkerProfile {
  id: string;
  initials: string;
  store_id: string;
  full_name: string | null;
  status: "junior" | "medior" | "senior" | null;
  employment_until: string | null;
  hire_date: string | null;
  base_salary: number | null;
  active: boolean;
}

export default async function ZaposleniPage() {
  if (!(await isMasterAuthed())) redirect("/login");

  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("workers")
    .select(
      "id, initials, store_id, full_name, status, employment_until, hire_date, base_salary, active"
    )
    .eq("active", true)
    .order("store_id")
    .order("initials");

  const workers = ((data ?? []) as Array<Record<string, unknown>>).map<
    WorkerProfile
  >((w) => ({
    id: w.id as string,
    initials: w.initials as string,
    store_id: w.store_id as string,
    full_name: (w.full_name as string | null) ?? null,
    status: (w.status as WorkerProfile["status"]) ?? null,
    employment_until: (w.employment_until as string | null) ?? null,
    hire_date: (w.hire_date as string | null) ?? null,
    base_salary: w.base_salary != null ? Number(w.base_salary) : null,
    active: (w.active as boolean) ?? true,
  }));

  return <ZaposleniClient initialWorkers={workers} />;
}
