self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'FitClash', body: '', url: '/notifications' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try {
      data.body = event.data ? event.data.text() : '';
    } catch {
      /* ignore */
    }
  }
  const origin = self.location.origin;
  const path = data.url || '/notifications';
  const url = path.startsWith('http') ? path : `${origin}${path}`;
  event.waitUntil(
    self.registration.showNotification(data.title || 'FitClash', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-32.png',
      vibrate: [120, 80, 120],
      data: { url, notification_id: data.notification_id },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || `${self.location.origin}/notifications`;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});
