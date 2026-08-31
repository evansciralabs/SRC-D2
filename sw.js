const CACHE_NAME = 'src-d2-cache-v6-1'; // Bumped from v6-0: flushes the stale index.html the old SW held
const URLS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './privacy.html',
    './whatsnew.html',
    './icon-192.png', // Added for offline OS rendering
    './icon-512.png'  // Added for offline OS rendering
];

// Install Phase: Pre-cache core assets
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(URLS_TO_CACHE))
    );
});

// Activate Phase: Clean up legacy caches and claim clients immediately
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Phase: Network-First for App Shell, Network-Only for APIs
self.addEventListener('fetch', event => {
    // 1. Determine if the request is for a cached static asset
    const requestUrl = new URL(event.request.url);
    const isAppShell = URLS_TO_CACHE.some(url => {
        // Handle the root './' mapping
        const target = url === './' ? './index.html' : url;
        return requestUrl.pathname.endsWith(target.replace('./', ''));
    });

    if (isAppShell) {
        // NETWORK-FIRST STRATEGY:
        // cache:'no-cache' bypasses the browser's HTTP cache too, so a stale
        // index.html served from the HTTP cache can't sneak through. Try network,
        // update cache on success, fallback to cache on offline.
        event.respondWith(
            fetch(event.request, { cache: 'no-cache' })
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    } else {
        // NETWORK-ONLY STRATEGY:
        // Skip cache entirely for API calls (ipify), BLE streams, Blobs, and Net Sentry
        event.respondWith(fetch(event.request));
    }
});
