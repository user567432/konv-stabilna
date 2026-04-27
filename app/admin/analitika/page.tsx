import { isAdminAuthed } from "@/lib/admin-auth";
import AdminGate from "../AdminGate";
import { firstShiftDate } from "@/lib/dashboard-data";
import AnalyticsClient from "./AnalyticsClient";
import { createSupabaseServer } from "@/lib/supabase";
import type { Settings, Store } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  if (!(await isAdminAuthed())) return <AdminGate />;

  const supabase = createSupabaseServer();
  const [fsd, { data: stores }, { data: settings }] = await Promise.all([
    firstShiftDate(),
    supabase.from("stores").select("*").order("id"),
    supabase.from("settings").select("*").is("store_id", null).maybeSingle(),
  ]);

  return (
    <AnalyticsClient
      firstShiftDate={fsd}
      stores={(stores ?? []) as Store[]}
      globalSettings={(settings as Settings | null) ?? null}
    />
  );
}
