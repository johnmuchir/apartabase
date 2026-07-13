const CACHE_NAME = 'apartabase-cache-v2'; // Bumped cache version to invalidate old cache
const ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
  // Note: We intentionally do NOT cache '/' or '/index.html' in the static asset list
  // to avoid cache-lock issues where users get stuck on old HTML files pointing to dead asset hashes.
];

// Install Event
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force active activation of the new service worker
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key); // Clear old caches
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Take control of all clients immediately
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Network-First for HTML/navigation requests (always get fresh index.html with new asset hashes)
  if (
    e.request.mode === 'navigate' || 
    e.request.headers.get('accept')?.includes('text/html') || 
    url.pathname === '/' || 
    url.pathname.endsWith('.html')
  ) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Dynamically cache the fresh HTML
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(e.request) || caches.match('/index.html');
        })
    );
    return;
  }

  // Cache-First for static assets (icons, manifest, etc.)
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((response) => {
        // Dynamically cache versioned build assets (js/css) or images
        if (response.status === 200 && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icon-'))) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
