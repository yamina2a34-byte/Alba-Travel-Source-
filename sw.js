const CACHE_NAME = 'alba-travel-shell-v10';
const APP_SHELL = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then(cached => {
      const network = fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
        return response;
      }).catch(() => cached);
      return cached || network;
    }));
    return;
  }
  // Les tuiles cartographiques restent gérées par le cache HTTP natif du navigateur.
  // Ne pas créer de cache hors-ligne dédié sur le serveur public tile.openstreetmap.org.
  if (url.origin === self.location.origin || ['cdn.jsdelivr.net','unpkg.com','fonts.googleapis.com','fonts.gstatic.com'].some(host => url.hostname === host || url.hostname.endsWith('.'+host))) {
    event.respondWith(caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response && (response.ok || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    }));
  }
});

// Deploy trigger: 2026-11-14T14:24Z


self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || 'ALBA · Rappel de voyage';
  const options = {
    body: data.body || 'Un rappel pour ton voyage est arrivé.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'alba-trip-reminder',
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => 'focus' in client);
    return existing ? existing.focus() : self.clients.openWindow(event.notification.data?.url || './');
  }));
});
