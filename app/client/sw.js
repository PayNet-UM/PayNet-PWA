/* +Onz service worker (student and merchant app): app shell cached for fast start and offline launch.
   Firebase and Google requests always go to the network. The Admin dashboard is a separate site with no
   service worker; on the dev server it lives at /admin/ on this address, so this worker leaves it alone. */
const VERSION = 'umc-__VERSION__';
const SHELL = [
  'css/event-submissions.css?v=__VERSION__','js/event-submissions-data.js','js/event-submissions-ui.js',
  'css/event-gallery.css?v=__VERSION__','js/event-gallery.js','js/event-calendar.js','js/event-categories.js','js/event-catalog.js','js/event-reactions.js',
  'css/motion.css?v=__VERSION__', 'js/motion.js',
  'css/usability.css?v=__VERSION__',
  'css/oz-tokens.css?v=__VERSION__', 'css/oz-legacy.css?v=__VERSION__', 'css/oz-type.css?v=__VERSION__', 'css/oz-components.css?v=__VERSION__', 'css/oz-shell.css?v=__VERSION__', 'css/oz-home.css?v=__VERSION__', 'css/oz-rewards.css?v=__VERSION__', 'css/oz-events.css?v=__VERSION__', 'css/oz-bridge.css?v=__VERSION__', 'css/oz-community.css?v=__VERSION__', 'css/oz-me.css?v=__VERSION__', 'css/oz-wardrobe.css?v=__VERSION__',
  'assets/onz/hats/beanie.svg', 'assets/onz/hats/cap.svg', 'assets/onz/hats/crown.svg', 'assets/onz/hats/grad.svg', 'assets/onz/hats/mushroom.svg', 'assets/onz/hats/songkok.svg', 'assets/onz/skins/blue/badge.svg', 'assets/onz/skins/blue/body.svg', 'assets/onz/skins/blue/ears.svg', 'assets/onz/skins/blue/mane.svg', 'assets/onz/skins/blue/tail.svg', 'assets/onz/skins/green/badge.svg', 'assets/onz/skins/green/body.svg', 'assets/onz/skins/green/ears.svg', 'assets/onz/skins/green/mane.svg', 'assets/onz/skins/green/tail.svg', 'assets/onz/skins/orange/badge.svg', 'assets/onz/skins/orange/body.svg', 'assets/onz/skins/orange/ears.svg', 'assets/onz/skins/orange/mane.svg', 'assets/onz/skins/orange/tail.svg', 'assets/onz/skins/red/badge.svg', 'assets/onz/skins/red/body.svg', 'assets/onz/skins/red/ears.svg', 'assets/onz/skins/red/mane.svg', 'assets/onz/skins/red/tail.svg', 'assets/onz/skins/teal/badge.svg', 'assets/onz/skins/teal/body.svg', 'assets/onz/skins/teal/ears.svg', 'assets/onz/skins/teal/mane.svg', 'assets/onz/skins/teal/tail.svg', 'assets/onz/skins/yellow/badge.svg', 'assets/onz/skins/yellow/body.svg', 'assets/onz/skins/yellow/ears.svg', 'assets/onz/skins/yellow/mane.svg', 'assets/onz/skins/yellow/tail.svg', 'assets/onz/stage/accents.svg', 'assets/onz/stage/clouds.svg', 'assets/onz/stage/contact.svg', 'assets/onz/stage/ground.svg', 'assets/onz/streak/flame.svg', 'js/oz-icons.js', 'js/oz-ui.js',
  'assets/onz/hero/body.svg', 'assets/onz/hero/ears.svg', 'assets/onz/hero/flame.svg', 'assets/onz/hero/ground-shadow.svg', 'assets/onz/hero/mane.svg', 'assets/onz/hero/medal.svg', 'assets/onz/hero/nose.svg', 'assets/onz/hero/plus-badge.svg', 'assets/onz/hero/smile.svg', 'assets/onz/hero/tail-stem.svg', 'assets/onz/hero/tail-tuft.svg', 'assets/onz/lion/body.svg', 'assets/onz/lion/ears.svg', 'assets/onz/lion/mane.svg', 'assets/onz/lion/nose.svg', 'assets/onz/lion/plus-badge.svg', 'assets/onz/lion/tail.svg', 'assets/onz/toast/error.svg', 'assets/onz/toast/info.svg', 'assets/onz/toast/success.svg', 'icons/oz/solid/bell.svg', 'icons/oz/solid/check.svg', 'icons/oz/solid/clock.svg', 'icons/oz/solid/coin.svg', 'icons/oz/solid/community.svg', 'icons/oz/solid/edit.svg', 'icons/oz/solid/events.svg', 'icons/oz/solid/friend-add.svg', 'icons/oz/solid/hat.svg', 'icons/oz/solid/heart.svg', 'icons/oz/solid/home.svg', 'icons/oz/solid/info.svg', 'icons/oz/solid/leagues.svg', 'icons/oz/solid/learn.svg', 'icons/oz/solid/lock.svg', 'icons/oz/solid/map-pin.svg', 'icons/oz/solid/me.svg', 'icons/oz/solid/medal.svg', 'icons/oz/solid/rewards.svg', 'icons/oz/solid/scan.svg', 'icons/oz/solid/search.svg', 'icons/oz/solid/settings.svg', 'icons/oz/solid/share.svg', 'icons/oz/solid/stall.svg', 'icons/oz/solid/streak.svg', 'icons/oz/solid/voucher.svg', 'icons/oz/solid/wallet.svg', 'icons/oz/stroke/bell.svg', 'icons/oz/stroke/camera.svg', 'icons/oz/stroke/check.svg', 'icons/oz/stroke/chevron-left.svg', 'icons/oz/stroke/chevron-right.svg', 'icons/oz/stroke/clock.svg', 'icons/oz/stroke/close.svg', 'icons/oz/stroke/coin.svg', 'icons/oz/stroke/community.svg', 'icons/oz/stroke/copy.svg', 'icons/oz/stroke/deals.svg', 'icons/oz/stroke/edit.svg', 'icons/oz/stroke/events.svg', 'icons/oz/stroke/friend-add.svg', 'icons/oz/stroke/fund.svg', 'icons/oz/stroke/hat.svg', 'icons/oz/stroke/heart.svg', 'icons/oz/stroke/history.svg', 'icons/oz/stroke/home.svg', 'icons/oz/stroke/info.svg', 'icons/oz/stroke/language.svg', 'icons/oz/stroke/leagues.svg', 'icons/oz/stroke/learn.svg', 'icons/oz/stroke/live.svg', 'icons/oz/stroke/lock.svg', 'icons/oz/stroke/logout.svg', 'icons/oz/stroke/map-pin.svg', 'icons/oz/stroke/me.svg', 'icons/oz/stroke/plus.svg', 'icons/oz/stroke/rewards.svg', 'icons/oz/stroke/scan.svg', 'icons/oz/stroke/search.svg', 'icons/oz/stroke/settings.svg', 'icons/oz/stroke/share.svg', 'icons/oz/stroke/stall.svg', 'icons/oz/stroke/streak.svg', 'icons/oz/stroke/torch.svg', 'icons/oz/stroke/trash.svg', 'icons/oz/stroke/voucher.svg', 'icons/oz/stroke/wallet.svg',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-500-normal.woff2', 'fonts/inter-latin-600-normal.woff2', 'fonts/inter-latin-700-normal.woff2',
  'fonts/bricolage-grotesque-latin-700-normal.woff2', 'fonts/bricolage-grotesque-latin-800-normal.woff2',
  './', 'index.html', 'offline.html', 'manifest.webmanifest', 'firestore.rules',
  'css/app.css?v=__VERSION__', 'css/onz.css?v=__VERSION__', 'css/merchant.css?v=__VERSION__', 'css/feskum.css?v=__VERSION__', 'css/event-carousel.css?v=__VERSION__', 'css/guide.css?v=__VERSION__', 'css/feedback.css?v=__VERSION__', 'css/information.css?v=__VERSION__', 'css/points.css?v=__VERSION__', 'js/main.js?v=__VERSION__',
  'js/backend.js', 'js/firebase-config.js', 'js/data.js', 'js/ui.js', 'js/icons.js', 'js/cafes.js', 'js/feskum.js', 'js/feskum-kps.js', 'js/feskum-kps-data.js', 'js/event-carousel.js', 'js/demo-seed.js', 'js/i18n.js', 'js/terms.js', 'js/i18n-ms.js', 'js/map.js', 'js/avatar.js', 'js/herenow.js', 'js/friends.js',
  'js/views/auth.js', 'js/views/student.js', 'js/views/merchant.js', 'js/views/close.js', 'js/avatar-backgrounds.js', 'js/directory-art.js', 'js/merchant-ui.js', 'js/deal-flow.js', 'js/live-deals.js', 'js/student-paths.js', 'js/app-activity.js', 'js/guide.js', 'js/feedback.js', 'js/information.js', 'js/points-policy.js', 'js/points-guide.js',
  'js/fake/fakefb.js', 'js/fake/rules-engine.js',
  'vendor/firebase.js', 'vendor/qrcode.min.js', 'vendor/jsQR.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'fonts/montserrat-latin-500-normal.woff2', 'fonts/montserrat-latin-600-normal.woff2',
  'fonts/montserrat-latin-700-normal.woff2', 'fonts/montserrat-latin-800-normal.woff2',
  'assets/feskum-2026/identity-01.jpg', 'assets/feskum-2026/tapak-kps-base.svg', 'assets/feskum-2026/tapak-kps-plan.pdf', 'assets/feskum-2026/feed-03.jpg', 'assets/feskum-2026/feed-04.jpg', 'assets/feskum-2026/feed-05.jpg', 'assets/feskum-2026/feed-06.jpg', 'assets/feskum-2026/feed-07.jpg', 'assets/feskum-2026/feed-08.jpg', 'assets/feskum-2026/feed-09.jpg', 'assets/feskum-2026/feed-10.jpg', 'assets/feskum-2026/feed-11.jpg', 'assets/feskum-2026/feed-12.jpg', 'assets/feskum-2026/feed-13.jpg',
  'assets/about/core-team.png', 'assets/about/instagram.svg', 'assets/about/tiktok.svg',
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
  if (url.pathname.startsWith('/admin/')) return; // dev server: the Admin dashboard, a separate site
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
