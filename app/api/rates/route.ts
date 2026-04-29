import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * GET /api/rates — vraća trenutne kurseve sa Frankfurter API.
 * Cache 1h. Vraća { usdEur, eurRsd, fetched_at }.
 */
export async function GET() {
  try {
    // Frankfurter API: https://www.frankfurter.app/docs/
    const [eurRes, usdRes] = await Promise.all([
      fetch("https://api.frankfurter.app/latest?base=EUR&symbols=RSD", {
        next: { revalidate: 3600 },
      }),
      fetch("https://api.frankfurter.app/latest?base=USD&symbols=EUR", {
        next: { revalidate: 3600 },
      }),
    ]);

    if (!eurRes.ok || !usdRes.ok) {
      throw new Error("Frankfurter API ne odgovara.");
    }

    const eurJson = (await eurRes.json()) as {
      rates?: { RSD?: number };
      date?: string;
    };
    const usdJson = (await usdRes.json()) as {
      rates?: { EUR?: number };
      date?: string;
    };

    const eurRsd = eurJson.rates?.RSD ?? null;
    const usdEur = usdJson.rates?.EUR ?? null;

    if (!eurRsd || !usdEur) {
      throw new Error("Kursevi nisu dostupni.");
    }

    return NextResponse.json({
      ok: true,
      usdEur: Number(usdEur),
      eurRsd: Number(eurRsd),
      fetched_at: new Date().toISOString(),
      source_date: eurJson.date ?? usdJson.date ?? null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Greška pri uzimanju kurseva.",
      },
      { status: 500 }
    );
  }
}
