import { redirect } from "next/navigation";
import {
  getWorkerSession,
  isMasterAuthed,
  getTimStore,
} from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";
import OdmoriClient from "./OdmoriClient";

export const dynamic = "force-dynamic";

export interface MyLeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  review_note: string | null;
  requested_at: string;
}

export interface LeaveBalance {
  total_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
}

export default async function MojOdmoriPage() {
  if (await isMasterAuthed()) redirect("/master");
  if (await getTimStore()) redirect("/unos");
  const session = await getWorkerSession();
  if (!session) redirect("/login");

  const currentYear = new Date().getFullYear();
  const supabase = createSupabaseServer();

  const [{ data: requests }, { data: balanceRows }] = await Promise.all([
    supabase.rpc("list_my_leave_requests", {
      p_worker_id: session.worker_id,
    }),
    supabase
      .rpc("get_leave_balance", {
        p_worker_id: session.worker_id,
        p_year: currentYear,
      })
      .single<LeaveBalance>(),
  ]);

  return (
    <OdmoriClient
      workerId={session.worker_id}
      initialRequests={(requests ?? []) as MyLeaveRequest[]}
      balance={
        balanceRows ?? {
          total_days: 20,
          used_days: 0,
          pending_days: 0,
          remaining_days: 20,
        }
      }
      year={currentYear}
    />
  );
}
