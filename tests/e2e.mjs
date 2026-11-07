// Browser test of the real UI in Demo mode: student, merchant and HEP on separate pages, plus a
// pass with a fake Google Maps API key so the Google Maps code path is exercised.
// The student/merchant app is at BASE and the HEP admin dashboard (a separate site) at ADMIN.
// Usage: `npm run dev:demo` in one terminal, then `npm run test:e2e` in another.
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:5173/';
const ADMIN = process.env.ADMIN || new URL('admin/', BASE).href;
const shots = process.env.SHOTS || '/tmp/e2e';
fs.mkdirSync(shots, { recursive: true });
const adminEmail = /function bootstrapAdmins\(\) \{ return \['([^']+)'/.exec(fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'))[1];
const LAUNDRY = { latitude: 3.10994, longitude: 101.65856, accuracy: 10 }; // demo pin for Fresh Laundry
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1, geolocation: LAUNDRY, permissions: ['geolocation'] });
// map tiles come from the internet; serve a blank tile so the test runs offline
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
await ctx.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: TILE }));
const errors = [];
const watch = (p, who) => { p.on('pageerror', (e) => errors.push(`${who} pageerror: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${who} console: ${m.text()}`); }); };
let step = 0; const ok = (m) => console.log(`  ✓ ${++step}. ${m}`);
const login = async (p, email, site = BASE) => { await p.goto(site); await p.waitForSelector('#google', { timeout: 60000 }); await p.click(`[data-demo="${email}"]`); };
const pointsOf = async (p) => Number((await p.textContent('.pts-chip [data-bind=points]')).replace(/\D/g, ''));

// ---------- student
const stu = await ctx.newPage(); watch(stu, 'student');
await stu.goto(BASE); await stu.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
// Never run this test's writes against a real project.
await stu.reload(); await stu.waitForFunction(() => document.documentElement.dataset.backend, null, { timeout: 60000 });
if (await stu.evaluate(() => document.documentElement.dataset.backend) !== 'demo') { console.error('Stopped: the server is not in Demo mode. Use npm run dev:demo.'); await b.close(); process.exit(1); }
await login(stu, 'aina@siswa.um.edu.my'); await stu.waitForSelector('.kk-hero', { timeout: 90000 });
const pillars = await stu.locator('.kk-pillar').count();
if (pillars !== 4) throw new Error('expected 4 +Onz directory cards, got ' + pillars);
for (const route of ['explore', 'rewards', 'explore/deals', 'learn']) {
  if (await stu.locator(`.kk-pillars a[href="#/${route}"]`).count() !== 1) throw new Error('missing directory: ' + route);
}
for (const route of ['bayar', 'explore/idea']) {
  if (await stu.locator(`main a[href="#/${route}"]`).count() !== 0) throw new Error('unexpected homepage link: ' + route);
}
if (await stu.locator('.tabbar a[href="#/events"]').count() !== 1) throw new Error('missing Campus Events navigation');
if (await stu.locator('#to-mpp').count() !== 0) throw new Error('student app offers the HEP dashboard to a student');
const before = await pointsOf(stu);
await stu.screenshot({ path: `${shots}/01-home.png`, fullPage: true });
ok(`student home shows the +Onz hub (${pillars} directories) and ${before} points`);

await stu.goto(BASE + '#/explore'); await stu.waitForSelector('#cmap .kk-pin', { timeout: 20000 });
const pins = await stu.locator('#cmap .kk-pin').count(); const logos = await stu.locator('#cmap .kk-pin img').count();
const navHref = await stu.getAttribute('#clist .checkout-shop-action a', 'href');
if (pins < 4 || logos < 4 || !/google\.com\/maps\/dir\/.*destination=3\.1\d+,101\.6\d+/.test(navHref)) throw new Error(`pins ${pins}, logos ${logos}, nav ${navHref}`);
await stu.waitForSelector('#cmap .kk-me'); await stu.waitForSelector('#clist .nearby-distance');
const nearest = (await stu.textContent('#clist .checkout-shop h3')).trim();
if (nearest !== 'Fresh Laundry') throw new Error('nearest should be Fresh Laundry, got ' + nearest);
// Location centres the map on the nearby shop; the first marker in DOM order
// may be outside the map viewport. Exercise the visible shop at that location.
await stu.locator('#cmap .leaflet-marker-icon[title="Fresh Laundry"]').click(); await stu.waitForSelector('.mpop a[href*="google.com/maps/dir"]');
if (await stu.locator('.tabbar a.on[data-tab="explore"]').count() !== 1) throw new Error('directory footer tab is not active');
await stu.screenshot({ path: `${shots}/02-campus-shops.png` });
ok(`central directory shows ${pins} logo pins; live location puts ${nearest} first`);

await stu.goto(BASE + '#/checkin');
await stu.waitForFunction(() => location.hash === '#/explore');
await stu.waitForSelector('#cmap .kk-me', { timeout: 20000 });
await stu.waitForSelector('#clist .nearby-distance');
const nearbyBalance = await pointsOf(stu);
if (await stu.locator('[data-ci], [data-tp], #checkout-action').count()) throw new Error('manual check-in action remains in discovery');
if ((await stu.textContent('#clist .checkout-shop h3')).trim() !== 'Fresh Laundry') throw new Error('discovery is not nearest-first');
await stu.getByRole('button', { name: 'Student Ventures', exact: true }).click();
await stu.waitForSelector('[data-ventures][aria-pressed="true"]');
await stu.getByRole('button', { name: 'All', exact: true }).click();
await stu.screenshot({ path: `${shots}/03-nearby.png`, fullPage: true });
if (await pointsOf(stu) !== nearbyBalance) throw new Error('map browsing awarded points');
const privateCtx = await b.newContext({ viewport: { width: 400, height: 860 } });
const noLocation = await privateCtx.newPage();
await login(noLocation, 'aina@siswa.um.edu.my');
await noLocation.goto(BASE + '#/checkin');
await noLocation.waitForSelector('#clist .checkout-shop');
if (await noLocation.locator('#cmap .kk-me').count()) throw new Error('location shown without permission');
await privateCtx.close();
ok('nearby discovery shows location only with permission, sorts shops by distance and awards no points');

await stu.goto(BASE + '#/avatar'); await stu.waitForSelector('#av-prev svg');
await stu.click('.av-opts [data-k="hair"][data-v="curly"]');
await stu.click('[data-t="glasses"]');
const skin = stu.locator('.av-range[data-k="skin"]');
await skin.focus(); await skin.press('Home');
for (let i = 0; i < 5; i++) await skin.press('ArrowRight');
await stu.click('[aria-controls="av-gear"]');
await stu.click('.av-opts [data-k="hat"][data-v="cap"]');
await stu.click('.av-swatches [data-k="outfitColor"][data-v="2"]');
const locked = await stu.locator('.av-opts [data-k="hat"][data-locked]').count();
await stu.screenshot({ path: `${shots}/05-avatar.png`, fullPage: true });
await stu.click('#av-save'); await stu.waitForSelector('.me-card');
const saved = await stu.evaluate(() => window.__umc.profile.avatar);
if (saved.hair !== 'curly' || saved.hat !== 'cap' || !saved.glasses || saved.skin !== 5) throw new Error('avatar not saved: ' + JSON.stringify(saved));
ok(`avatar saved (curly hair, cap, glasses); ${locked} hats still locked behind levels`);

for (const r of ['rewards', 'community', 'events', 'bayar', 'learn', 'deals', 'explore/idea', 'cafes']) {
  await stu.goto(BASE + '#/' + r); await stu.waitForTimeout(700);
  if (await stu.$('text=This page didn’t load')) throw new Error('student page failed: ' + r);
  await stu.screenshot({ path: `${shots}/s-${r.replace('/', '-')}.png`, fullPage: true });
}
await stu.goto(BASE + '#/learn'); await stu.waitForSelector('[data-lesson="2"]'); await stu.click('[data-lesson="2"]');
await stu.click('#sheet [data-a="1"]'); await stu.waitForSelector('#toast.show');
ok('all student screens rendered; lesson: ' + (await stu.textContent('#toast')));

// voucher
await stu.goto(BASE + '#/rewards'); await stu.waitForSelector('[data-redeem="kopi-rm3"]:not([disabled])');
await stu.click('[data-redeem="kopi-rm3"]'); await stu.click('#sheet [data-yes]');
await stu.waitForSelector('#vqr canvas', { state: 'attached', timeout: 10000 }); const vcode = (await stu.textContent('#sheet .code-text')).trim();
ok(`student swapped 300 points for voucher ${vcode}`);

// ---------- merchant
const fresh = async (pg) => pg.addInitScript(() => { if (sessionStorage.getItem('umc-demo-session') === null) sessionStorage.setItem('umc-demo-session', ''); });
const mer = await ctx.newPage(); watch(mer, 'merchant'); await fresh(mer);
await login(mer, 'kopikolej@demo.my'); await mer.waitForSelector('#merchant-wallet .stat', { timeout: 30000 });
await mer.screenshot({ path: `${shots}/06-merchant-home.png`, fullPage: true });
ok('merchant home shows recorded voucher activity');
await mer.goto(BASE + '#/scan'); await mer.waitForSelector('#manual');
await mer.fill('#manual [name=code]', vcode); await mer.click('#manual button'); await mer.waitForSelector('#use');
await mer.click('#use'); await mer.waitForSelector('#toast.show'); ok('merchant redeemed the voucher');
await mer.goto(BASE + '#/shop'); await mer.waitForSelector('#pin-map .kk-pin', { timeout: 20000 });
await mer.click('#locate'); await mer.waitForFunction(() => document.querySelector('#pin-read').textContent.startsWith('3.10994'));
await mer.click('#pin-save'); await mer.waitForSelector('#toast.show');
if (!/Location saved/.test(await mer.textContent('#toast'))) throw new Error('pin not saved');
const png = fs.readFileSync(new URL('../app/shared/icons/icon-192.png', import.meta.url));
await mer.setInputFiles('#logo-form [name=logo]', { name: 'logo.png', mimeType: 'image/png', buffer: png });
await mer.waitForSelector('#logo-prev img'); await mer.click('#logo-save'); await mer.waitForSelector('#toast.show');
if (!/Logo saved/.test(await mer.textContent('#toast'))) throw new Error('logo not saved: ' + await mer.textContent('#toast'));
ok('merchant auto-detected its location and uploaded a new logo');
for (const r of ['promote', 'insights', 'poster', 'survey']) { await mer.goto(BASE + '#/' + r); await mer.waitForTimeout(800); await mer.screenshot({ path: `${shots}/m-${r}.png`, fullPage: true }); }
ok('all merchant screens rendered');

// a brand-new merchant must give a logo and an exact location
const nm = await ctx.newPage(); watch(nm, 'new merchant'); await fresh(nm);
await nm.goto(BASE); await nm.waitForSelector('#google', { timeout: 60000 }); await nm.click('#google');
await nm.fill('#gnew [name=email]', 'satay.stall@gmail.com'); await nm.click('#gnew button');
await nm.waitForSelector('#ob'); await nm.click('#ob [data-role="merchant"]').catch(() => {});
await nm.check('#ob input[value="merchant"]').catch(() => {}); await nm.check('#ob input[type=checkbox]').catch(() => {});
await nm.click('#ob button[type=submit]'); await nm.waitForSelector('a[href="#/shop"]', { timeout: 20000 });
await nm.goto(BASE + '#/shop'); await nm.waitForSelector('#app-form');
await nm.fill('#app-form [name=name]', 'Satay Siswa'); await nm.fill('#app-form [name=accountName]', 'Satay Siswa Enterprise'); await nm.fill('#app-form [name=location]', 'KK11 cafeteria');
await nm.setInputFiles('#app-form [name=qr]', { name: 'qr.png', mimeType: 'image/png', buffer: png });
await nm.evaluate(() => { document.querySelector('#app-form [name=logo]').removeAttribute('required'); document.querySelector('#app-form [name=qr]').removeAttribute('required'); });
await nm.click('#app-form button.primary'); await nm.waitForSelector('#toast.show');
const noLogo = await nm.textContent('#toast');
if (!/map first|logo/i.test(noLogo)) throw new Error('missing logo/pin not caught: ' + noLogo);
await nm.waitForTimeout(3500);
await nm.click('#locate'); await nm.waitForFunction(() => document.querySelector('#pin-read').textContent.startsWith('3.1'));
await nm.setInputFiles('#app-form [name=logo]', { name: 'logo.png', mimeType: 'image/png', buffer: png }); await nm.waitForSelector('#logo-prev img');
await nm.click('#app-form button.primary'); await nm.waitForSelector('text=Sent to HEP', { timeout: 15000 });
ok(`new merchant was asked for a pin and logo ("${noLogo.trim()}"), then sent the application`);

// ---------- the two websites keep to their own people
const sep = await ctx.newPage(); watch(sep, 'site separation'); await fresh(sep);
await sep.goto(BASE); await sep.waitForSelector('#google', { timeout: 60000 });
if (await sep.locator(`[data-demo="${adminEmail}"]`).count() !== 0) throw new Error('student app sign-in offers the HEP account');
const googleAs = async (p, email) => { await p.click('#google'); await p.fill('#gnew [name=email]', email); await p.click('#gnew button'); };
await sep.goto(ADMIN); await sep.waitForSelector('#google', { timeout: 60000 });
if (await sep.locator('[data-demo="aina@siswa.um.edu.my"]').count() !== 0) throw new Error('dashboard sign-in offers a student account');
await googleAs(sep, 'aina@siswa.um.edu.my'); await sep.waitForSelector('text=isn’t a HEP admin', { timeout: 30000 });
if (await sep.locator('#mpp-rail').count() !== 0) throw new Error('a student got into the HEP dashboard');
await sep.click('#out'); await sep.waitForSelector('#google');
await sep.goto(BASE); await sep.waitForSelector('#google'); await googleAs(sep, adminEmail);
await sep.waitForSelector('#to-admin', { timeout: 30000 });
if (await sep.getAttribute('#to-admin', 'href') !== '/admin/') throw new Error('HEP admin was not sent to the dashboard site');
await sep.close();
ok('a student is turned away from the HEP dashboard, and a HEP admin on the student app is sent to the dashboard');

// ---------- HEP on desktop, on the dashboard site
const mpp = await ctx.newPage(); watch(mpp, 'mpp'); await fresh(mpp); await mpp.setViewportSize({ width: 1360, height: 900 });
await login(mpp, adminEmail, ADMIN);
await mpp.waitForSelector('#mpp-rail', { timeout: 30000 });
if (await mpp.locator('script[src*="views/student"], .tabbar').count() !== 0) throw new Error('dashboard loaded the student app');
await mpp.goto(ADMIN + '#/merchants'); await mpp.waitForSelector('[data-review]'); await mpp.click('[data-review]');
await mpp.waitForSelector('#sheet img.logo'); for (const c of await mpp.$$('#rv [name=c]')) await c.check(); await mpp.click('#rv [data-s="verified"]');
await mpp.waitForSelector('#toast.show'); ok('HEP reviewed a merchant with its logo and pin: ' + (await mpp.textContent('#toast')));
for (const r of ['overview', 'merchants', 'approvals', 'paynet', 'recon', 'rewards', 'campaigns', 'kpis', 'people', 'settings']) {
  await mpp.goto(ADMIN + '#/' + r); await mpp.waitForTimeout(900); await mpp.screenshot({ path: `${shots}/p-${r}.png`, fullPage: true });
  if (await mpp.$('text=This page didn’t load')) throw new Error('HEP page failed: ' + r);
}
const ci = (await mpp.textContent('#view')).match(/Campus visits\s*([\d,]+)/);
ok('all HEP screens rendered' + (ci ? `; KPI campus visits = ${ci[1]}` : ''));
const [dl] = await Promise.all([mpp.waitForEvent('download', { timeout: 30000 }), (async () => { await mpp.goto(ADMIN + '#/paynet'); await mpp.waitForSelector('#xlsx1'); await mpp.click('#xlsx1'); })()]);
await dl.saveAs(`${shots}/Lampiran1.xlsx`); ok('Lampiran 1 Excel exported: ' + dl.suggestedFilename());

// ---------- Google Maps path (fake API key + stub script)
const gctx = await b.newContext({ viewport: { width: 400, height: 860 }, geolocation: LAUNDRY, permissions: ['geolocation'], serviceWorkers: 'block' });
await gctx.route('**/js/firebase-config.js', async (r) => { const res = await r.fetch(); const body = (await res.text()).replace("googleMapsApiKey = ''", "googleMapsApiKey = 'TEST_KEY'"); await r.fulfill({ response: res, body }); });
const stub = fs.readFileSync(new URL('./google-maps-stub.js', import.meta.url), 'utf8');
let mapsUrl = '';
await gctx.route(/maps\.googleapis\.com\/maps\/api\/js/, (r) => { mapsUrl = r.request().url(); r.fulfill({ status: 200, contentType: 'text/javascript', body: stub }); });
const gp = await gctx.newPage(); watch(gp, 'google-maps');
await login(gp, 'aina@siswa.um.edu.my'); await gp.waitForSelector('.kk-hero', { timeout: 90000 });
await gp.goto(BASE + '#/explore'); await gp.waitForSelector('#cmap .gm-stub .kk-pin', { timeout: 20000 });
const gpins = await gp.locator('#cmap .gm-stub-marker .kk-pin').count();
await gp.locator('#cmap .gm-stub-marker').first().click(); await gp.waitForSelector('.gm-stub-info .mpop a[href*="google.com/maps/dir"]');
await gp.click('#nearby-locate'); await gp.waitForSelector('#cmap .kk-me');
if (!/key=TEST_KEY/.test(mapsUrl) || !/libraries=marker/.test(mapsUrl)) throw new Error('Maps script URL: ' + mapsUrl);
await gp.screenshot({ path: `${shots}/07-google-maps-path.png` });
ok(`with a Google Maps key the app loads Google Maps (${gpins} pins, info window, live location)`);
await gctx.close();

// ---------- feature switches, using the real Settings form
const off = await ctx.newPage(); watch(off, 'switches'); await fresh(off); await off.setViewportSize({ width: 1360, height: 900 });
await login(off, adminEmail, ADMIN); await off.waitForSelector('#mpp-rail', { timeout: 30000 });
await off.goto(ADMIN + '#/settings'); await off.waitForSelector('#features');
if (await off.locator('#features input[type=checkbox]').count() !== 4) throw new Error('expected 4 feature switches');
for (const c of await off.$$('#features input[type=checkbox]')) await c.uncheck();
await off.click('#features button'); await off.waitForSelector('#toast.show');
ok('HEP turned every feature off in Settings');
const offStu = await ctx.newPage(); watch(offStu, 'student, switches off'); await fresh(offStu);
await login(offStu, 'aina@siswa.um.edu.my'); await offStu.waitForSelector('.kk-hero', { timeout: 30000 });
if (await offStu.locator('.tabbar a[href="#/explore"]').count() !== 0) throw new Error('nav still shows Overview');
for (const route of ['explore', 'explore/deals']) if (await offStu.locator(`.kk-pillars a[href="#/${route}"]`).count() !== 0) throw new Error('home still links to ' + route);
for (const route of ['explore', 'deals', 'cafes', 'checkin', 'bayar', 'merchant/mer1']) {
  await offStu.goto(BASE + '#/' + route); await offStu.waitForTimeout(500);
  if (await offStu.locator('.kk-hero').count() !== 1) throw new Error('typed #/' + route + ' did not go home');
}
for (const route of ['events', 'friends', 'rewards', 'community', 'learn', 'me', 'survey', 'avatar']) {
  await offStu.goto(BASE + '#/' + route); await offStu.waitForTimeout(500);
  if (await offStu.locator('text=This page didn’t load').count()) throw new Error('page failed with switches off: ' + route);
  if (await offStu.locator('main a[href="#/explore"], main a[href="#/bayar"], main a[href^="#/explore/"]').count()) throw new Error(route + ' still links to a hidden page');
}
ok('with switches off, students see no Overview, deals or Pay Cashless, and typed links go home');
const offMer = await ctx.newPage(); watch(offMer, 'merchant, switches off'); await fresh(offMer);
await login(offMer, 'kopikolej@demo.my'); await offMer.waitForSelector('#coming-soon', { timeout: 30000 });
ok('with switches off, a merchant account sees Coming soon');
await offMer.evaluate(async () => { const { sdk, auth } = window.__umc.backend; await sdk.signOut(auth); await sdk.createUserWithEmailAndPassword(auth, 'switchtest@shop.my', 'demo1234'); });
await offMer.waitForSelector('#ob', { timeout: 30000 });
if (await offMer.locator('input[value=merchant]').count() !== 0) throw new Error('sign-up still offers merchant');
if (/check in at shops|your check-ins/i.test(await offMer.locator('body').innerText())) throw new Error('sign-up still advertises check-ins');
ok('with switches off, sign-up has no merchant option');
await off.check('#features input[name=overview]'); await off.click('#features button'); await off.waitForTimeout(600);
await offStu.goto(BASE); await offStu.reload(); await offStu.waitForSelector('.kk-hero', { timeout: 30000 });
if (await offStu.locator('.tabbar a[href="#/explore"]').count() !== 1) throw new Error('turning Overview on did not bring it back');
await offStu.goto(BASE + '#/explore'); await offStu.waitForSelector('#cmap', { timeout: 20000 });
if (await offStu.locator('#directory-deals').isVisible()) throw new Error('Live deals shown while its switch is off');
await offStu.locator('#clist h3 a[href^="#/merchant/"]').first().click(); await offStu.waitForSelector('text=Visit this shop', { timeout: 20000 });
if (await offStu.locator('text=Pay cashless if you buy').count() !== 0) throw new Error('shop page shows the cashless step while its switch is off');
ok('HEP turned Overview back on, and the directory returned without Live deals');
// Leaving a map straight after it opens must not leave work running against the removed map.
await offStu.evaluate(async () => { const { createMap } = await import(new URL('js/map.js', location.href).href); const el = document.createElement('div'); el.style.cssText = 'width:200px;height:200px'; document.body.append(el); const m = await createMap(el); m.remove(); el.remove(); await new Promise((r) => setTimeout(r, 300)); });
ok('a map closed straight after opening leaves nothing running');

console.log(errors.length ? '\nErrors:\n' + errors.join('\n') : '\nNo page errors.');
await b.close();
process.exit(errors.length ? 1 : 0);
