import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { buildShiftFeedback } from "@/lib/feedback";

export const dynamic = "force-dynamic";

interface Payload {
  store_id: string;
  worker_id: string;
  shift_date: string;     // YYYY-MM-DD
  shift_type: "prva" | "druga" | "dvokratna";
  entries: number;
  buyers: number;
  revenue: number;
  items_sold: number;
  note?: string | null;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Payload;

  // Basic validation
  if (
    !body.store_id ||
    !body.worker_id ||
    !body.shift_date ||
    !body.shift_type ||
    body.entries == null ||
    body.buyers == null ||
    body.revenue == null ||
    body.items_sold == null
  ) {
    return NextResponse.json({ error: "Nedostaju obavezna polja." }, { status: 400 });
  }
  if (body.buyers > body.entries) {
    return NextResponse.json(
      { error: "Broj kupaca ne može biti veći od broja ulazaka." },
      { status: 400 }
    );
  }
  if (body.entries < 0 || body.buyers < 0 || body.revenue < 0 || body.items_sold < 0) {
    return NextResponse.json(
      { error: "Svi brojevi moraju biti 0 ili više." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServer();

  // Insert the shift
  const { data: inserted, error: insertErr } = await supabase
    .from("shifts")
    .insert({
      store_id: body.store_id,
      worker_id: body.worker_id,
      shift_date: body.shift_date,
      shift_type: body.shift_type,
      entries: body.entries,
      buyers: body.buyers,
      revenue: body.revenue,
      items_sold: body.items_sold,
      note: body.note ?? null,
    })
    .select()
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Greška pri čuvanju." },
      { status: 500 }
    );
  }

  // Load settings (per-store first, then global)
  const [{ data: perStore }, { data: global }] = await Promise.all([
    supabase
      .from("settings")
      .select("conversion_target, aov_target")
      .eq("store_id", body.store_id)
      .maybeSingle(),
    supabase
      .from("settings")
      .select("conversion_target, aov_target")
      .is("store_id", null)
      .maybeSingle(),
  ]);
  const settings = perStore ??
    global ?? { conversion_target: 15, aov_target: 3000 };

  // Historical averages for this store (last 30 days, excluding today's inserted record)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: history } = await supabase
    .from("shifts")
    .select("entries, buyers, revenue")
    .eq("store_id", body.store_id)
    .gte("shift_date", thirtyDaysAgo.toISOString().slice(0, 10))
    .neq("id", inserted.id);

  let historyAvgConv = 0;
  let historyAvgAov = 0;
  if (history && history.length > 0) {
    const totalEntries = history.reduce((s, r) => s + (r.entries ?? 0), 0);
    const totalBuyers = history.reduce((s, r) => s + (r.buyers ?? 0), 0);
    const totalRevenue = history.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
    historyAvgConv = totalEntries > 0 ? (totalBuyers / totalEntries) * 100 : 0;
    historyAvgAov = totalBuyers > 0 ? totalRevenue / totalBuyers : 0;
  }

  const feedback = buildShiftFeedback({
    current: {
      entries: inserted.entries,
      buyers: inserted.buyers,
      revenue: Number(inserted.revenue),
      items_sold: inserted.items_sold,
      conversion_pct: Number(inserted.conversion_pct),
      aov: Number(inserted.aov),
    },
    settings: {
      conversion_target: Number(settings.conversion_target),
      aov_target: Number(settings.aov_target),
    },
    historyAvgConv,
    historyAvgAov,
  });

  return NextResponse.json({ shift: inserted, feedback });
}
