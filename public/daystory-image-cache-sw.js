const DAYSTORY_IMAGE_CACHE = 'daystory-image-cache-v1';
const MAX_IMAGE_CACHE_ENTRIES = 180;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function shouldCacheImage(request) {
  if (!request || request.method !== 'GET') return false;

  try {
    const { hostname } = new URL(request.url);
    if (hostname.includes('firebasestorage.googleapis.com') ||
        hostname.includes('firebasestorage.app')) return false;
  } catch { /* invalid URL — fall through */ }

  if (request.destination === 'image') return true;

  try {
    const url = new URL(request.url);
    return /\.(avif|webp|png|jpe?g|gif|svg)(\?|$)/i.test(url.pathname + url.search);
  } catch {
    return false;
  }
}

async function trimImageCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_IMAGE_CACHE_ENTRIES) return;

  const overflow = keys.length - MAX_IMAGE_CACHE_ENTRIES;
  await Promise.all(keys.slice(0, overflow).map((key) => cache.delete(key)));
}

async function cacheFirstImage(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cacheable = response && (response.ok || response.type === 'opaque');
  if (cacheable) {
    const cache = await caches.open(DAYSTORY_IMAGE_CACHE);
    await cache.put(request, response.clone());
    await trimImageCache(cache);
  }

  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!shouldCacheImage(request)) return;

  event.respondWith(cacheFirstImage(request));
});
