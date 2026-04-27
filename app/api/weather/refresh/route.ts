import { NextResponse } from "next/server";
import { fetchAndCacheWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

/**
 * POST /api/weather/refresh — dohvata Open-Meteo + kešira.
 * Može da se poziva iz UI dugmeta (MASTER) ili iz Vercel Cron-a.
 */
export async function POST() {
  try {
    const n = await fetchAndCacheWeather(14, 7);
    return NextResponse.json({ ok: true, updated: n });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Greška." },
      { status: 500 }
    );
  }
}

// GET varijanta — da Vercel Cron može direktno preko GET-a (jednostavnije)
export async function GET() {
  return POST();
}
