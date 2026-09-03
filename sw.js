// ════════════════════════════════════════════════════════════════
//  SRC-D2 Service Worker — v6-2 (hardened)
//  Aggressive offline cache. Atomic install. Never stale on the shell.
// ════════════════════════════════════════════════════════════════

const CACHE_NAME = 'src-d2-cache-v6-3'; // bumped: flushes every stale v6-0/v6-1 install

// App shell — must precache atomically. If any of these 404s, install
// correctly fails, because a broken shell is worse than no shell.
const SHELL = [
    './',
    './index.html',
    './manifest.json'
];

// Static assets + docs — precache opportunistically. A missing icon or
// optional page must NEVER abort the install the way the old all-or-
// nothing addAll did. allSettled lets each fail or succeed independently.
const OPTIONAL = [
    './privacy.html',
    './whatsnew.html',
    './icon-192.png',
    './icon-512.png'
];

// ── Install ─────────────────────────────────────────────────────
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            // Core shell — atomic. One 404 here and install fails, which is
            // the correct behavior: you do not want a half-installed shell.
            await cache.addAll(SHELL);
            // Optional assets — resilient. A missing icon or doc never
            // aborts the install again.
            await Promise.allSettled(OPTIONAL.map(u => cache.add(u)));
        })
    );
});

// ── Activate ────────────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames =>
            Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
                })
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch ───────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const req = event.request;
    // Only handle GET; let the browser deal with everything else.
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Same-origin only — never intercept or cache cross-origin calls.
    if (url.origin !== self.location.origin) {
        // Cross-origin (ipify, Piston, Pyodide CDN, fonts): network-only.
        // Never cached, always live, always subject to the ᚾ killswitch.
        return; // falls through to the browser's default network handling
    }

    // Match against the cached list using the pathname tail, so './index.html'
    // and '/' and '/index.html' all resolve to the same cached entry.
    const isShell = SHELL.some(s => {
        const t = s === './' ? '/index.html' : s.replace('./', '/');
        return url.pathname === t || url.pathname.endsWith(t);
    });
    const isOptional = OPTIONAL.some(s => {
        const t = s.replace('./', '/');
        return url.pathname === t || url.pathname.endsWith(t);
    });

    // 1. APP SHELL — network-first with cache fallback.
    //    cache:'no-cache' bypasses the browser HTTP cache too, so a stale
    //    index.html served from the HTTP cache cannot sneak through. Fresh
    //    when online, served from cache when offline. The app is always
    //    available AND always current the moment a connection exists.
    if (isShell) {
        event.respondWith(
            fetch(req, { cache: 'no-cache' })
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, clone));
                    return response;
                })
                .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
        );
        return;
    }

    // 2. OPTIONAL CACHED ASSETS — stale-while-revalidate.
    //    Serve instantly from cache, update in the background. Maximally
    //    offline-capable for docs/icons, kept current without blocking.
    if (isOptional) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async cache => {
                const cached = await cache.match(req);
                const network = fetch(req, { cache: 'no-cache' })
                    .then(response => {
                        cache.put(req, response.clone());
                        return response;
                    })
                    .catch(() => cached);
                return cached || network;
            })
        );
        return;
    }

    // 3. EVERYTHING ELSE SAME-ORIGIN — network-only (same as before).
    //    The reachability probe path lives here deliberately — it must
    //    throw when offline so the link-status check reads honestly.
    event.respondWith(fetch(req, { cache: 'no-cache' }));
});
