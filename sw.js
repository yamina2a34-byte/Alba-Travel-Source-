const CACHE_NAME = 'alba-travel-shell-v1';
const MAP_CACHE_NAME = 'alba-map-tiles-v1';
const MAX_CACHED_MAP_TILES = 80;
const APP_SHELL = ['./index.html', './manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME && key !== MAP_CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  // Cache cartographique volontairement plafonné : les tuiles déjà consultées
  // restent parfois disponibles hors-ligne sans remplir le stockage du téléphone.
  if (url.hostname === 'tile.openstreetmap.org' || url.hostname.endsWith('.tile.openstreetmap.org')) {
    event.respondWith((async () => {
      const cache = await caches.open(MAP_CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          if (keys.length > MAX_CACHED_MAP_TILES) {
            await Promise.all(keys.slice(0, keys.length - MAX_CACHED_MAP_TILES).map(key => cache.delete(key)));
          }
        }
        return response;
      } catch (error) {
        return cached || Response.error();
      }
    })());
    return;
  }
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
