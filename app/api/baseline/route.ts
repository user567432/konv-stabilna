import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import type { StoreBaseline } from "@/lib/anomaly";

export const dynamic = "force-dynamic";

// GET /api/baseline?store_id=D1&shift_type=prva
// Vraća prosečne vrednosti te radnje (opciono i te smene) za poslednjih 30 dana.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const store_id = url.searchParams.get("store_id");
  const shift_type = url.searchParams.get("shift_type");
  if (!store_id) {
    return NextResponse.json({ error: "store_id required." }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fromStr = from.toISOString().slice(0, 10);

  let q = supabase
    .from("shifts")
    .select("entries,buyers,revenue,items_sold,shift_type")
    .eq("store_id", store_id)
    .gte("shift_date", fromStr);

  if (shift_type) q = q.eq("shift_type", shift_type);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const n = rows.length;
  const baseline: StoreBaseline =
    n === 0
      ? {
          avg_entries: 0,
          avg_buyers: 0,
          avg_revenue: 0,
          avg_items: 0,
          sample_size: 0,
        }
      : {
          avg_entries: rows.reduce((s, r) => s + Number(r.entries), 0) / n,
          avg_buyers: rows.reduce((s, r) => s + Number(r.buyers), 0) / n,
          avg_revenue: rows.reduce((s, r) => s + Number(r.revenue), 0) / n,
          avg_items: rows.reduce((s, r) => s + Number(r.items_sold), 0) / n,
          sample_size: n,
        };

  return NextResponse.json({ baseline });
}
