const CACHE_NAME = 'src-d2-cache-v1';
const URLS_TO_CACHE = [
    '/SRC-D2/',
    '/SRC-D2/index.html',
    '/SRC-D2/manifest.json'
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

// Fetch Phase: Network-First, fallback to Cache
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).then(response => {
            // If online, return response and update cache
            return caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, response.clone());
                return response;
            });
        }).catch(() => {
            // If offline, retrieve from cache
            return caches.match(event.request);
        })
    );
});
