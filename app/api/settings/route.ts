import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

interface Payload {
  store_id: string | null;
  conversion_target: number;
  aov_target: number;
  revenue_target?: number | null;
  monthly_revenue_target?: number | null;
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await req.json()) as Payload;
  const supabase = createSupabaseServer();

  // Idu kroz SECURITY DEFINER RPC zato sto settings tabela ima public_read policy
  // ali NEMA insert/update za anon — direktno pisanje preko anon klienta tiho pada.
  const { error } = await supabase.rpc("upsert_store_settings", {
    p_store_id: body.store_id,
    p_conversion_target: body.conversion_target,
    p_aov_target: body.aov_target,
    p_revenue_target: body.revenue_target ?? null,
    p_monthly_revenue_target: body.monthly_revenue_target ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
