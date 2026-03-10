// Scale Army · Guess The Hobby — Service Worker
const APP_CACHE   = 'scalearmy-app-v1';
const VIDEO_CACHE = 'scalearmy-videos-v1';

// Cache the app shell on install
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE).then(cache =>
      cache.addAll(['/', '/index.html', '/admin.html', '/manifest.json'])
        .catch(() => {}) // ignore if some assets aren't available
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Cache Supabase Storage video files — cache-first, fallback to network
  if (url.hostname.includes('supabase') && url.pathname.includes('/storage/')) {
    event.respondWith(cacheFirstVideo(event.request));
    return;
  }

  // App shell — network-first, fallback to cache (keeps app up to date)
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstApp(event.request));
    return;
  }
});

async function cacheFirstVideo(request) {
  const cache  = await caches.open(VIDEO_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      // Only cache full (non-range) responses
      if (!request.headers.get('range')) {
        cache.put(request, response.clone());
      }
    }
    return response;
  } catch {
    return new Response('Video unavailable offline', { status: 503 });
  }
}

async function networkFirstApp(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}
