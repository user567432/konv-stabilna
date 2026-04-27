import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { buildShiftFeedback } from "@/lib/feedback";
import { detectAnomaly, type StoreBaseline } from "@/lib/anomaly";

export const dynamic = "force-dynamic";

interface PayloadRow {
  shift_type: "prva" | "druga" | "dvokratna";
  worker_ids: string[];   // može biti više radnica u istoj smeni
  entries: number;
  buyers: number;
  revenue: number;
  items_sold: number;
  note?: string | null;
}

interface Payload {
  store_id: string;
  shift_date: string; // YYYY-MM-DD
  rows: PayloadRow[];
  closed_by?: string; // worker id ko je zatvorio smenu
}

export async function POST(req: Request) {
  const body = (await req.json()) as Payload;

  if (!body.store_id || !body.shift_date || !Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json(
      { error: "Nedostaju radnja, datum ili bar jedna smena." },
      { status: 400 }
    );
  }

  // Validate each row
  for (const r of body.rows) {
    if (!r.shift_type) {
      return NextResponse.json({ error: "Nedostaje tip smene u redu." }, { status: 400 });
    }
    if (!Array.isArray(r.worker_ids) || r.worker_ids.length === 0) {
      return NextResponse.json(
        { error: "Mora biti izabrana bar jedna radnica po smeni." },
        { status: 400 }
      );
    }
    if (r.entries == null || r.buyers == null || r.revenue == null || r.items_sold == null) {
      return NextResponse.json(
        { error: `Nedostaju brojevi za smenu "${r.shift_type}".` },
        { status: 400 }
      );
    }
    if (r.buyers > r.entries) {
      return NextResponse.json(
        { error: `Broj računa ne može biti veći od broja ulazaka (smena ${r.shift_type}).` },
        { status: 400 }
      );
    }
    if (r.entries < 0 || r.buyers < 0 || r.revenue < 0 || r.items_sold < 0) {
      return NextResponse.json(
        { error: "Svi brojevi moraju biti 0 ili više." },
        { status: 400 }
      );
    }
  }

  // Check for duplicate shift_type u istom payload-u
  const shiftTypes = body.rows.map((r) => r.shift_type);
  const uniqueShiftTypes = new Set(shiftTypes);
  if (uniqueShiftTypes.size !== shiftTypes.length) {
    return NextResponse.json(
      { error: "Ne može se uneti ista smena dva puta za isti dan." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServer();

  // Load settings (per-store first, then global) jednom za sve redove
  const [{ data: perStore }, { data: globalSettings }] = await Promise.all([
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
    globalSettings ?? { conversion_target: 15, aov_target: 3000 };

  // Historical averages za ovu radnju (poslednjih 30 dana), jednom, pre insert-a
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: history } = await supabase
    .from("shifts")
    .select("entries, buyers, revenue, items_sold")
    .eq("store_id", body.store_id)
    .gte("shift_date", thirtyDaysAgo.toISOString().slice(0, 10));

  let historyAvgConv = 0;
  let historyAvgAov = 0;
  const baseline: StoreBaseline = {
    avg_entries: 0,
    avg_buyers: 0,
    avg_revenue: 0,
    avg_items: 0,
    sample_size: 0,
  };
  if (history && history.length > 0) {
    const totalEntries = history.reduce((s, r) => s + (r.entries ?? 0), 0);
    const totalBuyers = history.reduce((s, r) => s + (r.buyers ?? 0), 0);
    const totalRevenue = history.reduce(
      (s, r) => s + Number(r.revenue ?? 0),
      0
    );
    const totalItems = history.reduce(
      (s, r) => s + Number((r as { items_sold?: number }).items_sold ?? 0),
      0
    );
    historyAvgConv = totalEntries > 0 ? (totalBuyers / totalEntries) * 100 : 0;
    historyAvgAov = totalBuyers > 0 ? totalRevenue / totalBuyers : 0;
    baseline.sample_size = history.length;
    baseline.avg_entries = totalEntries / history.length;
    baseline.avg_buyers = totalBuyers / history.length;
    baseline.avg_revenue = totalRevenue / history.length;
    baseline.avg_items = totalItems / history.length;
  }

  // Izračunaj anomaly_flag po redu pre insert-a
  const anomaliesByShiftType = new Map<string, boolean>();
  for (const r of body.rows) {
    const res = detectAnomaly(
      {
        entries: r.entries,
        buyers: r.buyers,
        revenue: r.revenue,
        items_sold: r.items_sold,
      },
      baseline
    );
    anomaliesByShiftType.set(r.shift_type, res.isAnomaly);
  }

  // Bulk insert — prva radnica iz liste ide u worker_id, sve idu u worker_ids
  const { data: inserted, error: insertErr } = await supabase
    .from("shifts")
    .insert(
      body.rows.map((r) => ({
        store_id: body.store_id,
        worker_id: r.worker_ids[0],
        worker_ids: r.worker_ids,
        shift_date: body.shift_date,
        shift_type: r.shift_type,
        entries: r.entries,
        buyers: r.buyers,
        revenue: r.revenue,
        items_sold: r.items_sold,
        note: r.note ?? null,
        anomaly_flag: anomaliesByShiftType.get(r.shift_type) ?? false,
        closed_by: body.closed_by ?? null,
      }))
    )
    .select();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Greška pri čuvanju smena." },
      { status: 500 }
    );
  }

  // Build feedback za svaki insertovani red
  const results = inserted.map((row) => {
    const feedback = buildShiftFeedback({
      current: {
        entries: row.entries,
        buyers: row.buyers,
        revenue: Number(row.revenue),
        items_sold: row.items_sold,
        conversion_pct: Number(row.conversion_pct),
        aov: Number(row.aov),
      },
      settings: {
        conversion_target: Number(settings.conversion_target),
        aov_target: Number(settings.aov_target),
      },
      historyAvgConv,
      historyAvgAov,
    });
    const anomaly = detectAnomaly(
      {
        entries: row.entries,
        buyers: row.buyers,
        revenue: Number(row.revenue),
        items_sold: row.items_sold,
      },
      baseline
    );
    return {
      shift_id: row.id,
      shift_type: row.shift_type,
      worker_ids: row.worker_ids as string[],
      feedback,
      anomaly,
    };
  });

  return NextResponse.json({ results });
}
