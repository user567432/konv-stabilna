import { isAdminAuthed } from "@/lib/admin-auth";
import { createSupabaseServer } from "@/lib/supabase";
import AdminGate from "../AdminGate";
import SviUnosiClient from "./SviUnosiClient";
import type { Shift, Worker } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const WINDOW_DAYS = 90;

interface PageProps {
  searchParams: {
    store?: string;
    start?: string;
    end?: string;
    worker?: string;
    page?: string;
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function SviUnosiPage({ searchParams }: PageProps) {
  if (!(await isAdminAuthed())) return <AdminGate />;

  const supabase = createSupabaseServer();

  // Filteri sa default-ima — poslednjih 90 dana, sve radnje, svi radnici
  const today = new Date().toISOString().slice(0, 10);
  const defaultStart = daysAgo(WINDOW_DAYS - 1);
  const start = searchParams.start || defaultStart;
  const end = searchParams.end || today;
  const storeFilter = searchParams.store && searchParams.store !== "ALL" ? searchParams.store : null;
  const workerFilter = searchParams.worker && searchParams.worker !== "ALL" ? searchParams.worker : null;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Workers (svi, aktivni i neaktivni — da bi se neaktivne smene prikazale)
  const { data: workersData } = await supabase
    .from("workers")
    .select("*")
    .order("store_id")
    .order("initials");
  const workers: Worker[] = (workersData ?? []) as Worker[];
  const workerMap = new Map(workers.map((w) => [w.id, w]));

  // Query shifts sa filterima i count
  let query = supabase
    .from("shifts")
    .select("*", { count: "exact" })
    .gte("shift_date", start)
    .lte("shift_date", end);

  if (storeFilter) {
    query = query.eq("store_id", storeFilter);
  }
  if (workerFilter) {
    query = query.contains("worker_ids", [workerFilter]);
  }

  query = query
    .order("shift_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data: shiftsData, count } = await query;
  const shifts: Shift[] = (shiftsData ?? []) as Shift[];

  // Obogati shift-ove inicijalima
  const enriched = shifts.map((s) => {
    const ids = s.worker_ids && s.worker_ids.length > 0 ? s.worker_ids : [s.worker_id];
    const initials = ids
      .map((id) => workerMap.get(id)?.initials ?? "?")
      .join(" + ");
    return { ...s, worker_initials: initials };
  });

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <SviUnosiClient
      rows={enriched}
      workers={workers}
      filters={{
        store: storeFilter ?? "ALL",
        start,
        end,
        worker: workerFilter ?? "ALL",
        page,
      }}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        total: totalCount,
        totalPages,
      }}
      windowDays={WINDOW_DAYS}
    />
  );
}
