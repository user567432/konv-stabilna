"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X, Smartphone } from "lucide-react";

/**
 * PushSetup — diskretan banner koji se prikaže kad korisnik:
 * (a) ima browser sa Web Push podrškom
 * (b) još nije dao permission ili nije subscribe-ovan
 *
 * Klik "Uključi obaveštenja" registruje SW, traži permission, kreira subscription
 * i šalje na /api/push/subscribe.
 *
 * Stanja:
 *  - ne podržava: ne prikazuje ništa
 *  - već dozvoljeno + subscribe-ovan: ne prikazuje ništa
 *  - dozvoljeno ali nije subscribe-ovan: pokušava silently subscribe
 *  - default (nije pitao): prikazuje banner
 *  - denied: prikazuje "uključi u podešavanjima"
 */
export default function PushSetup() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null
  );
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    setPermission(Notification.permission);

    // Registruj SW + check da li već imamo subscription
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
        // Ako ima subscription ali nije sinhronizovan na server-u, pošalji ga
        if (sub && Notification.permission === "granted") {
          // Best-effort sinhronizacija (npr. ako je server izgubio zapis)
          void syncToServer(sub);
        }
      } catch {
        // ignore
      }
    })();

    // Sakriven dismiss (sesija)
    const dis = sessionStorage.getItem("ds-push-dismissed");
    if (dis === "1") setDismissed(true);
  }, []);

  async function enable() {
    setBusy(true);
    setErr(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setErr("Niste dozvolili obaveštenja u browser-u.");
        return;
      }
      const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!pubKey) {
        setErr("VAPID public key nije konfigurisan na server-u.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pubKey),
      });
      const ok = await syncToServer(sub);
      if (!ok) throw new Error("Server nije prihvatio subscription.");
      setSubscribed(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Greška pri uključivanju.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    sessionStorage.setItem("ds-push-dismissed", "1");
    setDismissed(true);
  }

  if (!supported || dismissed) return null;
  if (permission === "granted" && subscribed) return null;

  // Denied — kratak info, dismissable
  if (permission === "denied") {
    return (
      <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900 flex items-start gap-3">
        <BellOff size={18} className="shrink-0 mt-0.5 text-rose-700" />
        <div className="flex-1">
          <div className="font-bold">Obaveštenja su isključena</div>
          <div className="text-xs mt-0.5">
            Da bi dobijala notifikacije, uključi ih u podešavanjima browser-a
            (klikni na ikonu katanca u adresnoj liniji).
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="p-1 rounded hover:bg-rose-100 text-rose-700"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
      <Bell size={18} className="shrink-0 mt-0.5 text-amber-700" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-amber-900">
          Uključi obaveštenja na ovom uređaju
        </div>
        <div className="text-xs text-amber-800 mt-0.5 leading-relaxed">
          Za zahteve odmora, raspored i druge važne stvari. Radi i kad
          aplikacija nije otvorena.
          <span className="hidden sm:inline">
            {" "}
            Na iPhone-u prvo dodaj app na home screen pa onda uključi.
          </span>
        </div>
        {err && (
          <div className="mt-1.5 text-xs text-rose-800 font-semibold">
            {err}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="h-9 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Smartphone size={12} />
          {busy ? "Uključujem…" : "Uključi"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="text-[11px] text-ink-600 hover:text-ink-900 font-semibold"
        >
          Kasnije
        </button>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

async function syncToServer(sub: PushSubscription): Promise<boolean> {
  try {
    const json = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    out[i] = rawData.charCodeAt(i);
  }
  return out;
}
