/**
 * Web Push helper — server-side slanje push notifikacija
 *
 * Treba env-vars na Vercel-u:
 *   VAPID_PUBLIC_KEY  — generisan jednom (`npx web-push generate-vapid-keys`)
 *   VAPID_PRIVATE_KEY — pandan public-u
 *   VAPID_SUBJECT     — npr "mailto:tvoj@email.com"
 *
 * Plus NEXT_PUBLIC_VAPID_PUBLIC_KEY (isti kao VAPID_PUBLIC_KEY) izložen
 * klijentu za subscribe.
 */

import webpush from "web-push";

let configured = false;

function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT || "mailto:contact@dusanstil.rs";
  if (!pub || !priv) {
    throw new Error(
      "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env-vars nisu postavljeni."
    );
  }
  webpush.setVapidDetails(sub, pub, priv);
  configured = true;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body?: string;
  link?: string;
  tag?: string;
}

/** Pošalje push svim subscription-ima za dati subject. Vrati broj uspešnih. */
export async function sendPushTo(
  subs: PushSubscriptionRow[],
  payload: PushPayload
): Promise<{ ok: number; failed: number; expired: string[] }> {
  configure();
  let ok = 0;
  let failed = 0;
  const expired: string[] = [];
  const json = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          json
        );
        ok += 1;
      } catch (err: unknown) {
        // 404/410 = subscription expired — treba da se obriše iz baze
        const e = err as { statusCode?: number };
        if (e.statusCode === 404 || e.statusCode === 410) {
          expired.push(s.endpoint);
        }
        failed += 1;
      }
    })
  );

  return { ok, failed, expired };
}
