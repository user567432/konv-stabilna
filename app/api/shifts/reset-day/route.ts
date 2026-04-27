import { NextResponse } from "next/server";
import { isMasterAuthed } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/shifts/reset-day
 * Body: { date: "YYYY-MM-DD", store_id?: "D1" | "D2" | "D4" | "D5" | null }
 *
 * Koristi RPC funkciju `reset_shifts_for_day` (SECURITY DEFINER).
 * Samo MASTER (preko cookie provere) može da dođe do ovog endpoint-a.
 */
export async function DELETE(req: Request) {
  if (!(await isMasterAuthed())) {
    return NextResponse.json({ error: "Neovlašćen." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    date?: string;
    store_id?: string | null;
  };

  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json(
      { error: "Datum je obavezan (YYYY-MM-DD)." },
      { status: 400 }
    );
  }

  const MAX_BACK_DAYS = 7;
  const target = new Date(body.date);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays > MAX_BACK_DAYS) {
    return NextResponse.json(
      {
        error: `Ne mogu resetovati dan stariji od ${MAX_BACK_DAYS} dana. Kontaktiraj podršku.`,
      },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServer();
  const storeId =
    body.store_id && ["D1", "D2", "D4", "D5"].includes(body.store_id)
      ? body.store_id
      : null;

  const { data, error } = await supabase.rpc("reset_shifts_for_day", {
    p_date: body.date,
    p_store_id: storeId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: typeof data === "number" ? data : 0,
    date: body.date,
    store_id: storeId ?? "all",
  });
}
