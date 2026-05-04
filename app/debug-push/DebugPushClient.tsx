"use client";

import { useEffect, useState } from "react";

type Status = "ok" | "fail" | "warn" | "info";

interface Line {
  status: Status;
  text: string;
}

export default function DebugPushClient({ subject }: { subject: string | null }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  function log(status: Status, text: string) {
    setLines((arr) => [...arr, { status, text }]);
    console.log(`[push-debug ${status}]`, text);
  }

  function reset() {
    setLines([]);
  }

  useEffect(() => {
    runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runDiagnostics() {
    reset();
    log("info", "=== DIJAGNOSTIKA ===");

    // 1. Browser feature check
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) {
      log("fail", "navigator.serviceWorker NIJE podržan");
      return;
    }
    log("ok", "navigator.serviceWorker — OK");
    if (!("PushManager" in window)) {
      log("fail", "window.PushManager NIJE podržan");
      return;
    }
    log("ok", "window.PushManager — OK");
    if (!("Notification" in window)) {
      log("fail", "window.Notification NIJE podržan");
      return;
    }
    log("ok", "window.Notification — OK");

    // 2. Standalone mode check (iOS)
    const standalone =
      // @ts-expect-error — Apple-specific iOS Safari flag
      navigator.standalone ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (standalone) {
      log("ok", "PWA standalone mode — OK (otvoreno sa home screen)");
    } else {
      log(
        "warn",
        "NIJE u standalone mode — na iOS push neće raditi! Otvori app sa home screen ikone, ne iz Safari-ja."
      );
    }

    // 3. Notification permission
    log("info", `Notification.permission = ${Notification.permission}`);
    if (Notification.permission === "denied") {
      log(
        "fail",
        "Permission je DENIED — moraš da ručno uključiš u podešavanjima telefona"
      );
    }

    // 4. VAPID public key prisutan
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!pub) {
      log(
        "fail",
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY env-var NIJE postavljen u Vercel-u (build koji je deploy-ovan ne vidi public key)"
      );
    } else {
      log(
        "ok",
        `NEXT_PUBLIC_VAPID_PUBLIC_KEY postoji (${pub.slice(0, 10)}…)`
      );
    }

    // 5. Service worker registration
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      log("ok", `SW registrovan: scope=${reg.scope}`);
      await navigator.serviceWorker.ready;
      log("ok", "SW ready");

      // 6. Subscription status
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        log("ok", `Subscription POSTOJI: ${sub.endpoint.slice(0, 60)}…`);
      } else {
        log("warn", "Subscription NE POSTOJI — klikni dugme ispod");
      }
    } catch (e: unknown) {
      log(
        "fail",
        `SW registracija pukla: ${e instanceof Error ? e.message : "unknown"}`
      );
    }

    log("info", "=== KRAJ ===");
  }

  async function forceEnable() {
    setBusy(true);
    log("info", "→ Force enable…");
    try {
      const perm = await Notification.requestPermission();
      log(
        perm === "granted" ? "ok" : "fail",
        `Notification.requestPermission() → ${perm}`
      );
      if (perm !== "granted") return;

      const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!pub) {
        log("fail", "Nema NEXT_PUBLIC_VAPID_PUBLIC_KEY — Vercel env je problem");
        return;
      }

      const reg = await navigator.serviceWorker.ready;

      // Brisanje stare subscription ako postoji (čisto pokretanje)
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        log("info", "Stari subscription unsubscribe-ovan");
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pub),
      });
      log("ok", `Novi subscription: ${sub.endpoint.slice(0, 60)}…`);

      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          userAgent: navigator.userAgent,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        log("fail", `POST /api/push/subscribe → ${res.status}: ${j.error ?? "?"}`);
      } else {
        log("ok", `POST /api/push/subscribe → 200, subject = ${j.subject}`);
      }
    } catch (e: unknown) {
      log(
        "fail",
        `Force enable pukao: ${e instanceof Error ? e.message : "unknown"}`
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendTestPush() {
    setBusy(true);
    log("info", "→ Šaljem test push na sebe…");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        log("fail", `POST /api/push/test → ${res.status}: ${j.error ?? "?"}`);
      } else {
        log(
          "ok",
          `Test poslat: queued=${j.queued}, dispatch.sent=${j.dispatch?.sent}, dispatch.failed=${j.dispatch?.failed}, subscriptions_for_subject=${j.subs}`
        );
        if (j.dispatch?.sent === 0 && j.subs > 0) {
          log(
            "warn",
            "0 push-eva poslato iako ima subscription-a — verovatno VAPID server-side problem"
          );
        }
      }
    } catch (e: unknown) {
      log(
        "fail",
        `Test fetch pukao: ${e instanceof Error ? e.message : "unknown"}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-soft font-mono text-xs leading-relaxed bg-ink-900 text-ink-100 p-4 max-h-[400px] overflow-y-auto">
        {lines.length === 0 ? (
          <div className="text-ink-400 italic">Učitavam…</div>
        ) : (
          lines.map((l, i) => (
            <div
              key={i}
              className={
                l.status === "ok"
                  ? "text-emerald-400"
                  : l.status === "fail"
                    ? "text-rose-400"
                    : l.status === "warn"
                      ? "text-amber-400"
                      : "text-ink-300"
              }
            >
              {iconFor(l.status)} {l.text}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={runDiagnostics}
          disabled={busy}
          className="h-10 px-4 rounded-lg bg-ink-900 text-white text-sm font-semibold disabled:opacity-50"
        >
          Pokreni dijagnostiku
        </button>
        <button
          type="button"
          onClick={forceEnable}
          disabled={busy}
          className="h-10 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-50"
        >
          Force enable
        </button>
        <button
          type="button"
          onClick={sendTestPush}
          disabled={busy}
          className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
        >
          Pošalji test push
        </button>
      </div>

      <div className="text-xs text-ink-500 leading-relaxed">
        <p>
          <b>Force enable</b> — silom traži permission, pravi novi subscription i
          šalje na server. Pokazuje tačan razlog ako pukne.
        </p>
        <p>
          <b>Pošalji test push</b> — server queue-uje notifikaciju i odmah pokuša da
          je pošalje samo tebi. Ako VAPID env-vars nisu OK, ovde će biti vidljivo.
        </p>
      </div>
    </div>
  );
}

function iconFor(s: Status): string {
  return s === "ok" ? "✓" : s === "fail" ? "✗" : s === "warn" ? "⚠" : "·";
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
