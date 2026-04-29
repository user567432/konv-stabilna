import { redirect } from "next/navigation";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import OdmoriClient from "./OdmoriClient";

export const dynamic = "force-dynamic";

export interface LeaveRequestRow {
  id: string;
  worker_id: string;
  worker_initials: string;
  worker_store_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  review_note: string | null;
  requested_at: string;
}

interface PageProps {
  searchParams: { status?: string };
}

export default async function OdmoriPage({ searchParams }: PageProps) {
  if (!(await isMasterAuthed())) redirect("/login");

  const filter = searchParams.status; // "pending" | "approved" | "rejected" | undefined

  const supabase = createSupabaseServer();
  const { data } = await supabase.rpc("list_leave_requests", {
    p_status: filter && ["pending", "approved", "rejected"].includes(filter)
      ? filter
      : null,
  });

  const rows: LeaveRequestRow[] = (data ?? []) as LeaveRequestRow[];

  return <OdmoriClient initialRows={rows} activeFilter={filter ?? "all"} />;
}
