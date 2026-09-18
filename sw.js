// ════════════════════════════════════════════════════════════════
//  SRC-D2 Service Worker — v6-4 (offline launch fixed)
//  Aggressive offline cache. Atomic install. Never stale on the shell.
// ════════════════════════════════════════════════════════════════
//
//  CHANGED FROM v6-3, and why:
//
//  1. A REQUEST FOR "/" WAS NOT TREATED AS THE SHELL.
//     SHELL listed './', which the matcher mapped to '/index.html'. A request
//     for the root has pathname '/', which is neither equal to nor ends with
//     '/index.html' — so it fell through to the network-only branch. The
//     manifest's start_url IS '/', so the installed app launched offline to a
//     network error rather than to the dashboard. Navigation requests are now
//     matched by REQUEST MODE, which is what actually identifies them.
//
//  2. NOTHING CHECKED response.ok BEFORE CACHING.
//     A 404 or a 502 has a body, clones fine, and caches fine. Once one is in,
//     every offline load serves the error page — and the shell branch would
//     have cached a 404 index.html over the good one.
//
//  3. SAME-ORIGIN ASSETS OUTSIDE THE TWO LISTS WERE NETWORK-ONLY.
//     Every module and rack — twenty-five files — fell there. Deployed on one
//     origin, none of them opened offline. They are now cached AS THEY ARE
//     USED, which is the only sane strategy for a set that large and changing.
//
//  WHAT DELIBERATELY DID NOT CHANGE: the reachability probes must still fail
//  when offline, or the link-status readout lies. Both carry a query string
//  ('/favicon.ico?t=…') or a path that exists nowhere ('/__srcd2…'), so the
//  rule is simple and total: ANYTHING WITH A QUERY STRING IS NEVER CACHED AND
//  NEVER SERVED FROM CACHE.

const CACHE_NAME = 'src-d2-cache-v6-4'; // bumped: flushes every stale v6-x install

// App shell — must precache atomically. If any of these 404s, install
// correctly fails, because a broken shell is worse than no shell.
const SHELL = [
    './',
    './index.html',
    './manifest.json'
];

// Static assets + docs — precache opportunistically. A missing icon or
// optional page must NEVER abort the install the way an all-or-nothing
// addAll would. allSettled lets each fail or succeed independently.
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
            await cache.addAll(SHELL);
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

// ── Helpers ─────────────────────────────────────────────────────

// Only a response the server actually succeeded with is worth keeping. 'basic'
// excludes opaque cross-origin responses, which cannot be inspected and whose
// status always reads 0 — caching one means caching something unreadable.
const worthCaching = res => res && res.ok && res.type === 'basic';

const putIfGood = (cache, req, res) => {
    if (worthCaching(res)) {
        try { cache.put(req, res.clone()); } catch (_) {}
    }
    return res;
};

// ── Fetch ───────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Cross-origin (ipify, Piston, Pyodide CDN, fonts): network-only.
    // Never cached, always live, always subject to the ᚾ killswitch.
    if (url.origin !== self.location.origin) return;

    // ═ THE PROBES MUST STILL FAIL OFFLINE ═
    // The reachability checks append a cache-busting query. If any of them were
    // served from cache the link-status readout would report a connection that
    // does not exist, which is worse than no readout at all.
    if (url.search) {
        event.respondWith(fetch(req, { cache: 'no-cache' }));
        return;
    }

    // ═ A NAVIGATION IS THE SHELL, WHATEVER PATH IT ASKS FOR ═
    // '/', '/index.html', or any route the app is opened at. Matching by
    // request mode is what identifies a navigation; matching by pathname is
    // what missed '/' entirely in v6-3.
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req, { cache: 'no-cache' })
                .then(res => caches.open(CACHE_NAME).then(c => putIfGood(c, req, res)))
                .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
        );
        return;
    }

    const tail = p => (p === './' ? '/index.html' : p.replace('./', '/'));
    const isShell = SHELL.some(s => url.pathname === tail(s) || url.pathname.endsWith(tail(s)));
    const isOptional = OPTIONAL.some(s => url.pathname === tail(s) || url.pathname.endsWith(tail(s)));

    // 1. APP SHELL — network-first with cache fallback.
    //    cache:'no-cache' bypasses the browser HTTP cache too, so a stale
    //    index.html cannot sneak through. Fresh when online, served from cache
    //    when offline.
    if (isShell) {
        event.respondWith(
            fetch(req, { cache: 'no-cache' })
                .then(res => caches.open(CACHE_NAME).then(c => putIfGood(c, req, res)))
                .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
        );
        return;
    }

    // 2. OPTIONAL CACHED ASSETS — stale-while-revalidate.
    //    Serve instantly from cache, refresh in the background.
    if (isOptional) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async cache => {
                const cached = await cache.match(req);
                const network = fetch(req, { cache: 'no-cache' })
                    .then(res => putIfGood(cache, req, res))
                    .catch(() => cached);
                return cached || network;
            })
        );
        return;
    }

    // 3. EVERYTHING ELSE SAME-ORIGIN — network-first, cached as it is used.
    //    The modules and racks live here: twenty-five files that change often
    //    and are far too many to precache without making every install a large
    //    download of things the operator may never open. Caching on first use
    //    means whatever they have actually opened works offline, and nothing
    //    they have not costs them anything.
    //
    //    Network-FIRST rather than cache-first, because a module is edited far
    //    more often than the shell is, and serving a stale worklet while the
    //    file on disk has moved on is the confusing kind of wrong.
    event.respondWith(
        fetch(req, { cache: 'no-cache' })
            .then(res => caches.open(CACHE_NAME).then(c => putIfGood(c, req, res)))
            .catch(() => caches.match(req).then(r => r || Response.error()))
    );
});
