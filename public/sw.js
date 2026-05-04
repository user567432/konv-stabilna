/* Dušan Stil Service Worker — Web Push handler
 *
 * Prima push događaje od server-a i prikazuje native notifikaciju.
 * Klik na notifikaciju otvori (ili fokusira) URL iz `data.link`.
 */

const CACHE_NAME = "ds-shell-v1";

self.addEventListener("install", (event) => {
  // Aktiviraj odmah, ne čekaj sledeću posetu
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Preuzmi kontrolu nad svim klijentima
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Dušan Stil", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Dušan Stil";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { link: data.link || "/" },
    vibrate: [120, 60, 120],
    tag: data.tag || "ds-notif",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Pokušaj da nađe već otvoren tab i fokusira ga
        for (const c of clients) {
          if (c.url.includes(link) && "focus" in c) return c.focus();
        }
        // Ako nije otvoren, otvori novi tab
        if (self.clients.openWindow) return self.clients.openWindow(link);
      })
  );
});
