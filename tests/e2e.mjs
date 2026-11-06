// Browser test of the real UI in Demo mode: student, merchant and HEP on separate pages, plus a
// pass with a fake Google Maps API key so the Google Maps code path is exercised.
// Usage: `npm run dev:demo` in one terminal, then `npm run test:e2e` in another.
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:5173/';
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
const login = async (p, email) => { await p.goto(BASE); await p.waitForSelector('#google', { timeout: 60000 }); await p.click(`[data-demo="${email}"]`); };
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
for (const route of ['explore', 'rewards', 'community', 'learn']) {
  if (await stu.locator(`.kk-pillars a[href="#/${route}"]`).count() !== 1) throw new Error('missing directory: ' + route);
}
for (const route of ['bayar', 'explore/idea']) {
  if (await stu.locator(`main a[href="#/${route}"]`).count() !== 0) throw new Error('unexpected homepage link: ' + route);
}
if (await stu.locator('.tabbar a[href="#/events"]').count() !== 1) throw new Error('missing Campus Events navigation');
const before = await pointsOf(stu);
await stu.screenshot({ path: `${shots}/01-home.png`, fullPage: true });
ok(`student home shows the +Onz hub (${pillars} directories) and ${before} points`);

await stu.goto(BASE + '#/explore'); await stu.waitForSelector('#mmap .kk-pin', { timeout: 20000 });
const pins = await stu.locator('#mmap .kk-pin').count(); const logos = await stu.locator('#mmap .kk-pin img').count();
const navHref = await stu.getAttribute('.mcard-wrap .mnav', 'href');
if (pins < 4 || logos < 4 || !/google\.com\/maps\/dir\/.*destination=3\.1\d+,101\.6\d+/.test(navHref)) throw new Error(`pins ${pins}, logos ${logos}, nav ${navHref}`);
await stu.click('#near'); await stu.waitForSelector('#mmap .kk-me'); await stu.waitForSelector('#mlist .dist');
const nearest = (await stu.textContent('#mlist .mcard h3')).trim();
if (nearest !== 'Fresh Laundry') throw new Error('nearest should be Fresh Laundry, got ' + nearest);
await stu.locator('#mmap .leaflet-marker-icon:has(.kk-pin)').first().click(); await stu.waitForSelector('.mpop a[href*="google.com/maps/dir"]');
await stu.screenshot({ path: `${shots}/02-niaga-map.png` });
ok(`Niaga Kita map shows ${pins} logo pins; live location puts ${nearest} first`);

await stu.goto(BASE + '#/checkin'); await stu.waitForSelector('[data-ci]', { timeout: 20000 });
await stu.getByText('Pay Cashless', { exact: true }).click();
await stu.getByText('Scan the merchant’s DuitNow QR', { exact: true }).waitFor();
await stu.getByRole('button', { name: 'Student Ventures', exact: true }).click();
await stu.waitForSelector('[data-ventures][aria-pressed="true"]');
await stu.getByRole('button', { name: 'All', exact: true }).click();
await stu.screenshot({ path: `${shots}/03-checkin.png`, fullPage: true });
await stu.click('[data-ci]'); await stu.waitForSelector('#sheet .kk-celebrate', { timeout: 15000 });
const gained = Number((await stu.textContent('#sheet .amount-big')).replace(/\D/g, ''));
if (gained !== 10) throw new Error('expected +10, got ' + gained);
await stu.screenshot({ path: `${shots}/04-checked-in.png` });
await stu.click('#sheet [data-close]'); await stu.waitForSelector('text=Again at');
ok('student checked in at Fresh Laundry (+10) and the shop now shows a cooldown');

await stu.goto(BASE + '#/avatar'); await stu.waitForSelector('#av-prev svg');
await stu.click('.av-opts [data-k="hair"][data-v="curly"]');
await stu.click('[data-t="glasses"]');
await stu.locator('.av-range[data-k="skin"]').fill('5');
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
await login(mer, 'kopikolej@demo.my'); await mer.waitForSelector('#feed .item', { timeout: 30000 });
await mer.screenshot({ path: `${shots}/06-merchant-home.png`, fullPage: true });
ok('merchant home lists visitors: ' + (await mer.textContent('#feed .item h3')).trim());
await mer.goto(BASE + '#/scan'); await mer.waitForSelector('#manual');
await mer.fill('#manual [name=code]', vcode); await mer.click('#manual button'); await mer.waitForSelector('#use');
await mer.click('#use'); await mer.waitForSelector('#toast.show'); ok('merchant redeemed the voucher');
await mer.goto(BASE + '#/shop'); await mer.waitForSelector('#pin-map .kk-pin', { timeout: 20000 });
await mer.click('#locate'); await mer.waitForFunction(() => document.querySelector('#pin-read').textContent.startsWith('3.10994'));
await mer.click('#pin-save'); await mer.waitForSelector('#toast.show');
if (!/Location saved/.test(await mer.textContent('#toast'))) throw new Error('pin not saved');
const png = fs.readFileSync(new URL('../app/icons/icon-192.png', import.meta.url));
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

// ---------- HEP on desktop
const mpp = await ctx.newPage(); watch(mpp, 'mpp'); await fresh(mpp); await mpp.setViewportSize({ width: 1360, height: 900 });
await login(mpp, adminEmail);
await mpp.waitForSelector('#mpp-rail', { timeout: 30000 });
await mpp.goto(BASE + '#/merchants'); await mpp.waitForSelector('[data-review]'); await mpp.click('[data-review]');
await mpp.waitForSelector('#sheet img.logo'); for (const c of await mpp.$$('#rv [name=c]')) await c.check(); await mpp.click('#rv [data-s="verified"]');
await mpp.waitForSelector('#toast.show'); ok('HEP reviewed a merchant with its logo and pin: ' + (await mpp.textContent('#toast')));
for (const r of ['overview', 'merchants', 'approvals', 'paynet', 'recon', 'rewards', 'campaigns', 'kpis', 'people', 'settings']) {
  await mpp.goto(BASE + '#/' + r); await mpp.waitForTimeout(900); await mpp.screenshot({ path: `${shots}/p-${r}.png`, fullPage: true });
  if (await mpp.$('text=This page didn’t load')) throw new Error('HEP page failed: ' + r);
}
const ci = (await mpp.textContent('#view')).match(/Campus visits\s*([\d,]+)/);
ok('all HEP screens rendered' + (ci ? `; KPI campus visits = ${ci[1]}` : ''));
const [dl] = await Promise.all([mpp.waitForEvent('download', { timeout: 30000 }), (async () => { await mpp.goto(BASE + '#/paynet'); await mpp.waitForSelector('#xlsx1'); await mpp.click('#xlsx1'); })()]);
await dl.saveAs(`${shots}/Lampiran1.xlsx`); ok('Lampiran 1 Excel exported: ' + dl.suggestedFilename());

// ---------- Google Maps path (fake API key + stub script)
const gctx = await b.newContext({ viewport: { width: 400, height: 860 }, geolocation: LAUNDRY, permissions: ['geolocation'], serviceWorkers: 'block' });
await gctx.route('**/js/firebase-config.js', async (r) => { const res = await r.fetch(); const body = (await res.text()).replace("googleMapsApiKey = ''", "googleMapsApiKey = 'TEST_KEY'"); await r.fulfill({ response: res, body }); });
const stub = fs.readFileSync(new URL('./google-maps-stub.js', import.meta.url), 'utf8');
let mapsUrl = '';
await gctx.route(/maps\.googleapis\.com\/maps\/api\/js/, (r) => { mapsUrl = r.request().url(); r.fulfill({ status: 200, contentType: 'text/javascript', body: stub }); });
const gp = await gctx.newPage(); watch(gp, 'google-maps');
await login(gp, 'aina@siswa.um.edu.my'); await gp.waitForSelector('.kk-hero', { timeout: 90000 });
await gp.goto(BASE + '#/explore'); await gp.waitForSelector('#mmap .gm-stub .kk-pin', { timeout: 20000 });
const gpins = await gp.locator('#mmap .gm-stub-marker .kk-pin').count();
await gp.locator('#mmap .gm-stub-marker').first().click(); await gp.waitForSelector('.gm-stub-info .mpop a[href*="google.com/maps/dir"]');
await gp.click('#near'); await gp.waitForSelector('#mmap .kk-me');
if (!/key=TEST_KEY/.test(mapsUrl) || !/libraries=marker/.test(mapsUrl)) throw new Error('Maps script URL: ' + mapsUrl);
await gp.screenshot({ path: `${shots}/07-google-maps-path.png` });
ok(`with a Google Maps key the app loads Google Maps (${gpins} pins, info window, live location)`);
await gctx.close();

console.log(errors.length ? '\nErrors:\n' + errors.join('\n') : '\nNo page errors.');
await b.close();
process.exit(errors.length ? 1 : 0);
