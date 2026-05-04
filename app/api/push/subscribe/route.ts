import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { isMasterAuthed, getWorkerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface BodyShape {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

/**
 * POST /api/push/subscribe
 * Body: { endpoint, keys: { p256dh, auth }, userAgent? }
 *
 * Klijent (browser) dobije subscription preko Notification API + PushManager
 * pa pošalje na ovaj endpoint. Server odredi "subject" iz auth cookie-a:
 * - Ako je master, subject = 'master'
 * - Ako je radnik, subject = worker.id
 * - Inače 401
 */
export async function POST(req: Request) {
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

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Nevažeći JSON." }, { status: 400 });
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json(
      { error: "Nedostaju subscription polja." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServer();
  const { error } = await supabase.rpc("upsert_push_subscription", {
    p_subject: subject,
    p_endpoint: body.endpoint,
    p_p256dh: body.keys.p256dh,
    p_auth: body.keys.auth,
    p_user_agent: body.userAgent ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, subject });
}
