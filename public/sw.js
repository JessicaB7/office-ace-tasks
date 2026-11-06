// Service worker da app — só para notificações push.
// Sem cache offline: cada publicação nova é servida logo (nada de versões antigas).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Gestão CE", message: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Gestão CE";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.message || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.id || undefined,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of janelas) {
        if (new URL(c.url).origin === self.location.origin) {
          await c.focus();
          if (c.url !== target && "navigate" in c) {
            try { await c.navigate(target); } catch { /* ignora */ }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
