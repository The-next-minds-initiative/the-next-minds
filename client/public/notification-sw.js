self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", event => {
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action || "open";
  notification.close();
  if (action === "dismiss") return;

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const targetUrl = data.url || "/admin";
    const existing = clients.find(client => "focus" in client);
    if (existing) {
      await existing.navigate(targetUrl);
      await existing.focus();
      if ((action === "accept" || action === "reject") && data.registrationId) {
        existing.postMessage({
          type: "REGISTRATION_NOTIFICATION_ACTION",
          action,
          registrationId: data.registrationId,
        });
      }
      return;
    }

    const query = action === "accept" || action === "reject"
      ? `?notificationAction=${action}&registrationId=${data.registrationId}`
      : "";
    await self.clients.openWindow(`${targetUrl}${query}`);
  })());
});

self.addEventListener("notificationclose", () => {});
