// Service worker for the glasses apps. Added 2026-08-18 alongside Meta's v127
// `add-offline` guidance.
//
// Why this exists: the apps are served from GitHub Pages, so with no signal
// they simply do not load. That is exactly the situation they are needed in,
// standing on set in a studio with bad reception, wanting the workout list.
//
// STRATEGY: network-first, cache as fallback.
// NOT cache-first, deliberately. These app shells get edited and pushed often
// (the workout changes most days), and cache-first would serve yesterday's
// session until the cache expired. Network-first means a live connection always
// wins and the cache only steps in when the network fails.
//
// NEVER CACHED: the Jarvis gateway. Those are live calls to the Mac for brief,
// mail and status. A stale brief is worse than no brief, and the responses are
// personal, so they must not sit in a cache on the device.

const CACHE = 'glasses-v1';

// Shells worth having available offline. Relative so this works regardless of
// whether the site is served from the domain root or a /glasses-apps/ subpath.
const SHELLS = [
  './',
  './index.html',
  './workout/',
  './workout/index.html',
  './daily-dash/',
  './daily-dash/index.html',
  './drill-timer/',
  './drill-timer/index.html',
  './line-runner/',
  './line-runner/index.html',
  './jarvis/',
  './jarvis/index.html',
  './scratch/',
  './scratch/index.html',
  './clip/',
  './clip/index.html',
  './warden/',
  './warden/index.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll is atomic: one 404 throws the whole install away. These are
      // static shells that should all exist, but a missing app must not stop
      // the others being cached, so add them individually.
      .then((c) => Promise.all(SHELLS.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // Only GETs, and only our own origin. Everything else, including every
  // Jarvis gateway call, goes straight to the network untouched.
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // Cache a copy of anything good that came back.
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(
          (hit) =>
            hit ||
            // Navigations that miss the cache fall back to the launcher rather
            // than the browser's offline error page.
            (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
        )
      )
  );
});
