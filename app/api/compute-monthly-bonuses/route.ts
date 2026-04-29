import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { isMasterAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Body {
  year?: number;
  month?: number;
}

/**
 * POST /api/compute-monthly-bonuses — automatska prerada plata za zadat
 * mesec (ili tekuci ako se ne prosledi). Za svaku radnicu:
 *   fixed_amount = workers.base_salary
 *   variable_amount = (bonus_pool radnje za njenu kategoriju × ostvaren tier) / br_aktivnih_radnica
 *
 * Pristup:
 *   - Uloguj se kao MASTER → POST poziv ide pravo
 *   - Vercel cron (1. svakog meseca) → poziv sa Authorization: Bearer <CRON_SECRET>
 *
 * Vraca listu radnica i njihove novoizracunate plate (za pregled / debugging).
 */
export async function POST(req: Request) {
  // Auth: MASTER session ILI Vercel cron header
  const isCron =
    req.headers.get("authorization") ===
    `Bearer ${process.env.CRON_SECRET ?? "NEVERMATCH"}`;
  if (!isCron && !(await isMasterAuthed())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const today = new Date();
  // Default: prethodni mesec (cron radi 1. u mesecu, racuna za prosli)
  const defaultDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const year = Number(body.year) || defaultDate.getFullYear();
  const month = Number(body.month) || defaultDate.getMonth() + 1;

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "Mesec mora biti 1-12." }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const { data, error } = await supabase.rpc("compute_monthly_bonuses", {
    p_year: year,
    p_month: month,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    year,
    month,
    updated: (data ?? []).length,
    rows: data ?? [],
  });
}

export async function GET(req: Request) {
  // Cron job moze biti GET ili POST — Vercel salje GET na cron rute
  return POST(req);
}
