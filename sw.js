const CACHE_NAME = 'src-d2-cache-v5-1'; // Aligned with V5.1 update
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

// Activate Phase: Clean up legacy caches
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
        })
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
        // Try network first, update cache, fallback to cache on offline
        event.respondWith(
            fetch(event.request)
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
