// Exercise the discovery view's real render/mount with maps and permissions
// adapters. No browser, location service or database writes are required.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalPath } from '../app/client/js/student-paths.js';
const source = fs.readFileSync(new URL('../app/client/js/views/student.js', import.meta.url), 'utf8');
const start = source.indexOf('function directoryCategory(');
const end = source.indexOf('\nasync function rewardsRender(app)', start);
const shops = [{ id: 'far', name: 'Far Café', lat: 3.15, lng: 101.65, type: 'Food & drinks', location: 'KK1' },
  { id: 'near', name: 'Near Café', lat: 3.12, lng: 101.65, type: 'Food & drinks', location: 'KK3', venture: true },
  { id: 'unmapped', name: 'Unmapped Print', type: 'Printing', location: 'Library', zone: 'Central campus' }];
const selectors = new Map();
const el = (selector) => {
  if (!selectors.has(selector)) selectors.set(selector, { innerHTML: '', textContent: '', hidden: true, classList: { toggle() {} } });
  return selectors.get(selector);
};
const filters = [false, true].map((venture) => ({ dataset: { type: venture ? 'Student ventures' : 'All' }, setAttribute() {}, classList: { toggle() {} } }));
filters.push({ dataset: { type: 'Printing' }, setAttribute() {}, classList: { toggle() {} } });
let permissionListener, watch, watchCalls = 0, stopped = 0, removed = false, clearedTimer = false;
const permission = { state: 'prompt', addEventListener: (_, cb) => { permissionListener = cb; }, removeEventListener: () => { permissionListener = null; } };
const map = { position: null, pins: [], setMe(p) { this.position = p; }, setPins(pins, opts) { this.pins = pins; this.popup = opts.popup; }, setView() {}, fit() {}, remove() { removed = true; } };
const D = new Proxy({ featureOn: () => true, listVerifiedMerchants: async () => shops, approvedDeals: async () => [], dealOverview: async () => [], hhmm: String }, {
  get(target, key) { if (!(key in target)) throw new Error('Discovery accessed unexpected data operation: ' + key); return target[key]; },
});
const names = ['D', '$', '$$', 'hasPin', 'icon', 'esc', 'cashlessSteps', 'merchantLogo', 'isIdea', 'directionsUrl', 'distanceM', 'fmtDistance', 'watchLocation', 'createMap', 'UM_CENTER', 'navigator', 'setInterval', 'clearInterval', 'hereNowSection', 'cafeListings', 'mountHereNow', 'n'];
const values = [D, (selector) => el(selector), () => filters, (m) => Number.isFinite(m.lat) && Number.isFinite(m.lng), (name) => `<i>${name}</i>`, String, () => '',
  () => '', (shop) => shop.venture, (shop) => `https://maps.example/${shop.id}`, (a, b) => Math.abs(a.lat - b.lat) * 100000, (d) => `${d} m away`,
  (onPos, onErr) => { watchCalls++; watch = { onPos, onErr }; return () => { stopped++; }; }, async () => map, [3.12, 101.65],
  { permissions: { query: async () => permission } }, () => 1, () => { clearedTimer = true; }, () => '', () => '', () => ({ stop() {}, redraw() {} }), String];
const { directoryRender, directoryMount } = new Function(...names, source.slice(start, end) + '\nreturn { directoryRender, directoryMount };')(...values);
const flush = () => new Promise((resolve) => setImmediate(resolve));
let passed = 0;
async function test(label, fn) { await fn(); passed++; console.log('  ✓ ' + label); }
const app = { ctx: {}, backend: { mode: 'demo' }, profile: {} };
await test('render contains a map and nearby browsing, without attendance or points-claim controls', async () => {
  const html = await directoryRender(app);
  assert.ok(html.includes('id="cmap"') && html.includes('id="nearby-locate"'));
  assert.ok(!/data-ci|data-tp|checkout-action|checkout-reward|checkout-limits/.test(html));
});
await test('legacy checkout, deal and café bookmarks resolve into the central directory', async () => {
  for (const [path, expected] of [['checkin', 'explore'], ['checkin/near', 'explore/near'], ['deals', 'explore/deals'],
    ['cafes', 'explore/cafes'], ['explore/idea', 'explore/idea'], ['merchant/near', 'merchant/near'],
    ['friends', 'community/friends'], ['community/welfare', 'community/welfare']]) assert.equal(canonicalPath(path), expected);
});
const cleanup = directoryMount({}, app, []);
await flush();
await test('campus shops remain available without requesting location automatically', async () => {
  assert.equal(watchCalls, 0); assert.equal(map.pins.length, 2);
  assert.equal(map.position, null); assert.ok(!el('#clist').innerHTML.includes('nearby-distance'));
  assert.ok(map.popup(shops[0]).includes('#/merchant/far'));
  assert.ok(el('#clist').innerHTML.includes('Unmapped Print'), 'unpinned merchants must stay in the directory');
});
await test('explicit location request shows the position and nearest-first distances', async () => {
  el('#nearby-locate').onclick(); assert.equal(watchCalls, 1);
  watch.onPos({ lat: 3.1201, lng: 101.65, accuracy: 10 });
  assert.equal(map.position.lat, 3.1201);
  const html = el('#clist').innerHTML;
  assert.ok(html.indexOf('Near Café') < html.indexOf('Far Café'));
  assert.ok(html.includes('nearby-distance')); assert.equal(el('#nearby-location-key').hidden, false);
});
await test('student venture filter updates map pins and the nearby list', async () => {
  filters[1].onclick(); assert.equal(map.pins.length, 1);
  assert.ok(el('#clist').innerHTML.includes('Near Café'));
  assert.ok(!el('#clist').innerHTML.includes('Far Café'));
  filters[0].onclick(); assert.equal(map.pins.length, 2);
});
await test('search and category filters include unpinned shops without invalid directions', async () => {
  filters[2].onclick();
  assert.equal(map.pins.length, 0);
  assert.ok(el('#clist').innerHTML.includes('Unmapped Print'));
  assert.ok(!el('#clist').innerHTML.includes('nearby-distance'));
  assert.ok(!el('#clist').innerHTML.includes('https://maps.example/unmapped'));
  filters[0].onclick();
  el('#q').oninput({ target: { value: 'Library' } });
  assert.ok(el('#clist').innerHTML.includes('Unmapped Print'));
  assert.ok(!el('#clist').innerHTML.includes('Near Café'));
  el('#q').oninput({ target: { value: '' } });
});
await test('revoked permission removes the marker, distances and location legend', async () => {
  permission.state = 'denied'; permissionListener();
  assert.equal(map.position, null); assert.equal(el('#nearby-location-key').hidden, true);
  assert.ok(!el('#clist').innerHTML.includes('nearby-distance'));
  assert.equal(el('#loc-h').textContent, 'Location is off');
  watch.onPos({ lat: 3.12, lng: 101.65, accuracy: 10 });
  assert.equal(map.position, null, 'stale location callback must be ignored');
});
await test('granted permission resumes location and leaving the page releases tracking', async () => {
  permission.state = 'granted'; permissionListener();
  watch.onPos({ lat: 3.12, lng: 101.65, accuracy: 200 });
  assert.equal(el('#loc-h').textContent, 'Location is approximate');
  cleanup(); assert.ok(stopped >= 2 && removed && clearedTimer); assert.equal(permissionListener, null);
  const before = el('#loc-h').textContent;
  watch.onErr(new Error('late error')); assert.equal(el('#loc-h').textContent, before);
});
console.log(`\n${passed} passed, 0 failed`);
