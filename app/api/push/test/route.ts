import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { isMasterAuthed, getWorkerSession } from "@/lib/auth";
import { sendPushTo, type PushSubscriptionRow } from "@/lib/push";

export const dynamic = "force-dynamic";

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * POST /api/push/test
 * Šalje test push na trenutno ulogovanog korisnika.
 * Korisno za proveru da li ceo push lanac radi.
 */
export async function POST() {
  let subject: string | null = null;
  if (await isMasterAuthed()) {
    subject = "master";
  } else {
    const w = await getWorkerSession();
    if (w?.workerId) subject = w.workerId;
  }
  if (!subject) {
    return NextResponse.json({ error: "Niste ulogovani." }, { status: 401 });
  }

  const supabase = createSupabaseServer();

  // 1. Queue push u bazi (radi za audit)
  const { error: queueErr } = await supabase.rpc("queue_push", {
    p_subject: subject,
    p_title: "Test obaveštenje",
    p_body: "Ako vidiš ovo, push radi. Vreme: " + new Date().toLocaleTimeString("sr-RS"),
    p_link: "/",
  });
  if (queueErr) {
    return NextResponse.json(
      { error: "queue_push: " + queueErr.message },
      { status: 500 }
    );
  }

  // 2. Povuci subscription-e za ovaj subject
  const { data: subsData, error: subsErr } = await supabase
    .rpc("get_push_subscriptions_for", { p_subject: subject })
    .returns<SubRow[]>();
  if (subsErr) {
    return NextResponse.json(
      { error: "get_subs: " + subsErr.message },
      { status: 500 }
    );
  }

  const subs: PushSubscriptionRow[] = (subsData ?? []) as PushSubscriptionRow[];

  if (subs.length === 0) {
    return NextResponse.json({
      ok: false,
      subject,
      queued: 1,
      subs: 0,
      hint: "Nemaš nijedan push subscription u bazi. Klikni 'Force enable' prvo.",
    });
  }

  // 3. Pošalji push direktno (sinhrono)
  let dispatch = { ok: 0, failed: 0, expired: 0, error: null as string | null };
  try {
    const r = await sendPushTo(subs, {
      title: "Test obaveštenje",
      body:
        "Ako vidiš ovo, push radi. Vreme: " +
        new Date().toLocaleTimeString("sr-RS"),
      link: "/",
      tag: "ds-test-" + Date.now(),
    });
    dispatch = {
      ok: r.ok,
      failed: r.failed,
      expired: r.expired.length,
      error: null,
    };
  } catch (e: unknown) {
    dispatch.error = e instanceof Error ? e.message : "unknown";
  }

  // 4. Označi pending kao sent (čišćenje queue-a)
  await supabase.rpc("fetch_pending_pushes").catch(() => null);

  return NextResponse.json({
    ok: true,
    subject,
    queued: 1,
    subs: subs.length,
    dispatch: {
      sent: dispatch.ok,
      failed: dispatch.failed,
      expired: dispatch.expired,
      error: dispatch.error,
    },
  });
}
