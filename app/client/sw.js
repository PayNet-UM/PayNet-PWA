/* +Onz service worker (student and merchant app): app shell cached for fast start and offline launch.
   Firebase and Google requests always go to the network. The HEP dashboard is a separate site with no
   service worker; on the dev server it lives at /admin/ on this address, so this worker leaves it alone. */
const VERSION = 'umc-__VERSION__';
const SHELL = [
  './', 'index.html', 'offline.html', 'manifest.webmanifest', 'firestore.rules',
  'css/app.css?v=__VERSION__', 'css/onz.css?v=__VERSION__', 'css/merchant.css?v=__VERSION__', 'css/feskum.css?v=__VERSION__', 'css/event-carousel.css?v=__VERSION__', 'js/main.js?v=__VERSION__',
  'js/backend.js', 'js/firebase-config.js', 'js/data.js', 'js/ui.js', 'js/icons.js', 'js/cafes.js', 'js/feskum.js', 'js/event-carousel.js', 'js/demo-seed.js', 'js/i18n.js', 'js/terms.js', 'js/i18n-ms.js', 'js/map.js', 'js/avatar.js', 'js/herenow.js', 'js/friends.js',
  'js/views/auth.js', 'js/views/student.js', 'js/views/merchant.js', 'js/views/close.js', 'js/avatar-backgrounds.js', 'js/directory-art.js', 'js/merchant-ui.js', 'js/deal-flow.js', 'js/live-deals.js', 'js/student-paths.js', 'js/app-activity.js',
  'js/fake/fakefb.js', 'js/fake/rules-engine.js',
  'vendor/firebase.js', 'vendor/qrcode.min.js', 'vendor/jsQR.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'fonts/montserrat-latin-500-normal.woff2', 'fonts/montserrat-latin-600-normal.woff2',
  'fonts/montserrat-latin-700-normal.woff2', 'fonts/montserrat-latin-800-normal.woff2',
  'assets/feskum-2026/identity-01.jpg', 'assets/feskum-2026/feed-03.jpg', 'assets/feskum-2026/feed-04.jpg', 'assets/feskum-2026/feed-05.jpg', 'assets/feskum-2026/feed-06.jpg', 'assets/feskum-2026/feed-07.jpg', 'assets/feskum-2026/feed-08.jpg', 'assets/feskum-2026/feed-09.jpg', 'assets/feskum-2026/feed-10.jpg', 'assets/feskum-2026/feed-11.jpg', 'assets/feskum-2026/feed-12.jpg', 'assets/feskum-2026/feed-13.jpg',
  'assets/onz-directory-art.png', 'icons/onz-logo.svg', 'icons/onz-logo-dark.svg', 'icons/onz-mark.svg', 'icons/onz-icon-192.png', 'icons/onz-icon-512.png', 'icons/onz-maskable-512.png', 'icons/onz-apple-touch-icon.png', 'icons/onz-favicon-48.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('umc-') && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/__/')) return; // Firebase Hosting reserved URLs
  if (url.pathname.startsWith('/admin/')) return; // dev server: the HEP dashboard, a separate site
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); return r; })
      .catch(async () => (await caches.match('index.html')) || caches.match('offline.html')));
    return;
  }
  // Network first (revalidating the browser's HTTP cache) so a new deploy is picked up immediately; the cache is only the offline fallback.
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => {
    if (r.ok && !url.pathname.endsWith('exceljs.min.js')) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return r;
  }).catch(async () => (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true })) || Response.error()));
});
