import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { sendPushTo, type PushSubscriptionRow } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface PendingRow {
  id: string;
  subject: string;
  title: string;
  body: string | null;
  link: string | null;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * POST /api/push/dispatch
 * Bez auth-a (interni endpoint, zaštićen Vercel cron secret-om opciono).
 * Može se zvati i odmah posle akcije (best-effort) bez čekanja crona.
 *
 * 1. Povuče sve `pending_pushes` (atomski označi kao sent)
 * 2. Za svaki, povuče subscription-e za subject
 * 3. Pošalje push svima
 * 4. Briše expired subscription-e iz baze
 */
export async function POST() {
  const supabase = createSupabaseServer();

  // Atomski povuče sve unsent
  const { data: pending, error: fetchErr } = await supabase.rpc(
    "fetch_pending_pushes"
  );
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const items = (pending ?? []) as PendingRow[];
  if (items.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let totalOk = 0;
  let totalFailed = 0;
  const allExpired: string[] = [];

  for (const it of items) {
    const { data: subsData } = await supabase
      .rpc("get_push_subscriptions_for", { p_subject: it.subject })
      .returns<SubRow[]>();
    const subs: PushSubscriptionRow[] = (subsData ?? []) as PushSubscriptionRow[];
    if (subs.length === 0) continue;
    try {
      const r = await sendPushTo(subs, {
        title: it.title,
        body: it.body ?? undefined,
        link: it.link ?? undefined,
        tag: `ds-${it.id}`,
      });
      totalOk += r.ok;
      totalFailed += r.failed;
      allExpired.push(...r.expired);
    } catch (e: unknown) {
      // Nedostaju VAPID env-vars ili druga greška — ne padaj, samo loguj
      console.error(
        "Push send fail:",
        e instanceof Error ? e.message : "unknown"
      );
    }
  }

  // Pokušaj da obrišeš expired (ne blokiramo na grešci)
  if (allExpired.length > 0) {
    try {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", allExpired);
    } catch {
      // ignore
    }
  }

  return NextResponse.json({
    ok: true,
    items: items.length,
    sent: totalOk,
    failed: totalFailed,
    expired: allExpired.length,
  });
}

// GET varijanta za Vercel cron (cron mora GET)
export async function GET() {
  return POST();
}
