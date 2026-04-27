import { isAdminAuthed } from "@/lib/admin-auth";
import AdminGate from "../AdminGate";
import {
  loadCrossStoreLift,
  getFirstShiftDate,
} from "@/lib/worker-lift";
import PoredjenjeClient from "./PoredjenjeClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { range?: string; start?: string; end?: string };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function PoredjenjePage({ searchParams }: PageProps) {
  if (!(await isAdminAuthed())) return <AdminGate />;

  const today = new Date().toISOString().slice(0, 10);
  const range = searchParams.range ?? "30";

  // Range kontrola: "7" | "14" | "30" | "90" | "all"
  let start: string | null;
  let end: string;

  if (range === "all") {
    start = null;
    end = searchParams.end ?? today;
  } else {
    const days = ["7", "14", "30", "90"].includes(range)
      ? Number(range)
      : 30;
    start = searchParams.start ?? daysAgo(days - 1);
    end = searchParams.end ?? today;
  }

  const [data, firstShift] = await Promise.all([
    loadCrossStoreLift(start, end),
    range === "all" ? getFirstShiftDate() : Promise.resolve<string | null>(null),
  ]);

  return (
    <PoredjenjeClient
      data={data}
      activeRange={range}
      firstShiftDate={firstShift}
      today={today}
    />
  );
}
