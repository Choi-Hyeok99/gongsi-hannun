self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "새 중요 공시가 도착했습니다." };
  }

  const title = payload.title || "공시한눈 새 알림";
  const options = {
    body: payload.body || "관심기업의 중요 공시를 확인해 보세요.",
    icon: "/gongsi-hannun-app-icon.png",
    badge: "/gongsi-hannun-app-icon.png",
    tag: payload.tag || "gongsi-hannun-disclosure",
    renotify: false,
    data: { url: payload.url || "/notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
