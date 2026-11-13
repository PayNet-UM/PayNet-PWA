// Render the built roles with the real data layer and demo rules. This catches
// template failures and stale attendance controls without a browser connection.
// Run through npm run test:views, which builds fresh demo artifacts first.
import fs from 'node:fs';
import assert from 'node:assert/strict';
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.MutationObserver = class { observe() {} takeRecords() { return []; } };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.document = { documentElement: { lang: 'en' }, addEventListener() {}, querySelectorAll: () => [], body: {} };
const D = await import('../dist/client/js/data.js');
const sdk = await import('../dist/client/js/fake/fakefb.js');
const S = await import('../dist/client/js/views/student.js');
const M = await import('../dist/client/js/views/merchant.js');
const H = await import('../dist/admin/js/views/mpp.js');
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
sdk.configureFake({ rulesSource: rules, storage: null, session: null }); sdk.resetDemoData();
const adminEmail = /function bootstrapAdmins\(\) \{ return \['([^']+)'/.exec(rules)[1];
const context = (uid, email) => ({ uid, email, sdk, db: sdk._testDb(sdk._testAuth({ uid, email, emailVerified: true })) });
const hep = context('hep', adminEmail), student = context('student', 'student@siswa.um.edu.my'), merchant = context('merchant', 'merchant@demo.my');
await D.initProgramme(hep);
// Every feature on, so each screen renders in full. tests/scenarios.mjs and tests/e2e.mjs cover them switched off.
await D.saveConfig(hep, 'rules', { features: Object.fromEntries(D.FEATURES.map(([k]) => [k, true])) });
const featureRules = await D.getRules(hep);
await D.createProfile(student, { role: 'student', name: 'Test Student', matric: 'TEST12345', college: 'KK3', faculty: 'Faculty of Science' });
await D.createProfile(merchant, { role: 'merchant', name: 'Test Merchant' });
const makeApp = async (ctx) => ({ ctx, user: { uid: ctx.uid, email: ctx.email }, role: ctx === merchant ? 'merchant' : ctx === student ? 'student' : 'mpp', backend: { sdk, db: ctx.db, mode: 'demo' }, profile: await D.getProfile(ctx),
  rules: featureRules, ledger: [],
  get visits() { throw new Error('An active view still depends on attendance records'); },
  merchant: { id: 'merchant', name: 'Test Shop', status: 'verified', ready: true, lat: 3.12, lng: 101.65 } });
let passed = 0;
for (const [role, mod, app, routes] of [
  ['Student', S, await makeApp(student), ['home', 'rewards', 'me', 'community', 'leagues', 'explore', 'delete-account']],
  ['Merchant', M, await makeApp(merchant), ['home', 'scan', 'shop', 'insights', 'promote', 'poster', 'survey', 'delete-account']],
  ['HEP', H, await makeApp(hep), ['overview', 'merchants', 'approvals', 'paynet', 'recon', 'rewards', 'campaigns', 'kpis', 'people', 'closures', 'activity', 'settings']],
]) {
  for (const route of routes) {
    const html = await mod.routes[route].render(app, []);
    assert.ok(html.length > 100, `${role} ${route} did not render`);
    assert.ok(!/Daily check in points|Check-ins|check in when|check-outs|data-ci=|data-mission=|name="checkinPoints"|check in here/i.test(html), `${role} ${route} still presents attendance controls`);
    assert.ok(!/\bNaN\b|\bundefined\b/.test(html), `${role} ${route} has a broken value`);
    if (role === 'Merchant') {
      assert.equal((html.match(/<h1\b/g) || []).length, 1, `${route} needs one page heading`);
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
      assert.equal(new Set(ids).size, ids.length, `${route} has duplicate form IDs`);
      const controls = { scan: [], shop: ['app-form', 'logo-form', 'pin-form', 'ready-form'], promote: ['seats', 'new-deal'] }[route] || [];
      for (const id of controls) assert.ok(ids.includes(id), `Merchant ${route} lost its ${id} control`);
    }
    if (role === 'HEP') {
      assert.equal((html.match(/<h1\b/g) || []).length, 1, `HEP ${route} needs one page heading`);
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
      assert.equal(new Set(ids).size, ids.length, `HEP ${route} has duplicate form IDs`);
      const controls = { overview: ['month'], paynet: ['month', 'csv1', 'xlsx1', 'add2', 'xlsx2'], recon: ['month', 'imp', 'exp'],
        rewards: ['alloc', 'new-rw', 'vfind'], campaigns: ['new'], kpis: ['month', 'kcsv', 'scsv'], people: ['pq', 'pt', 'rel'],
        settings: ['features', 'rules', 'access', 'readiness-update'] }[route] || [];
      for (const id of controls) assert.ok(ids.includes(id), `HEP ${route} lost its ${id} control`);
    }
    if (role === 'Student' && route === 'home') {
      const directories = html.match(/<nav class="kk-pillars"[\s\S]*?<\/nav>/)[0];
      assert.deepEqual([...directories.matchAll(/href="#\/([^"]+)"/g)].map((match) => match[1]), ['explore', 'community', 'explore/deals', 'learn']);
    }
    if (role === 'Student' && route === 'community') {
      for (const id of ['friend-search', 'friend-lists', 'community-welfare', 'donate', 'request-welfare']) {
        assert.ok(html.includes(`id="${id}"`), `Community is missing ${id}`);
      }
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
      assert.equal(new Set(ids).size, ids.length, 'Combined page has duplicate IDs');
      assert.equal((html.match(/<h1\b/g) || []).length, 1, 'Community should have one page heading');
      assert.ok(!S.routes.friends, 'Friends should use the combined Community route');
    }
    if (role === 'Student' && route === 'community') assert.ok(!html.includes('id="community-league"') && html.includes('href="#/leagues"'), 'KK League has its own Leagues page');
    if (role === 'Student' && route === 'leagues') {
      for (const id of ['league-kk', 'league-faculty', 'league-referrals', 'referral-list']) assert.ok(html.includes(`id="${id}"`), `Leagues is missing ${id}`);
      assert.equal((html.match(/<h1\b/g) || []).length, 1, 'Leagues should have one page heading');
    }
    if (role === 'Student' && route === 'me') assert.ok(!html.includes('id="inv"'), 'Referral codes can only be entered at sign-up');
    console.log(`  ✓ ${role} ${route} renders without an attendance dependency`); passed++;
  }
}
sdk._rawUpdate((docs, Timestamp) => {
  docs.set('merchants/merchant', { name: 'Test Shop', status: 'verified', ready: true, lat: 3.12, lng: 101.65, seats: 40, occupied: 12 });
  for (const [id, status, enabled] of [['live', 'approved', true], ['paused', 'approved', false], ['pending', 'pending', true]]) {
    docs.set('deals/' + id, { merchantId: 'merchant', title: '<Study break> ' + id, status, enabled, startMin: 0, endMin: 1440, threshold: 60, bonus: 0, limit: 1, createdAt: Timestamp.now() });
  }
  docs.set('offers/free-item', { merchantId: 'merchant', title: 'Free iced tea', type: 'Free item', status: 'pending', endDate: '2026-12-31', createdAt: Timestamp.now() });
});
const readyApp = await makeApp(merchant);
const completedHome = await M.routes.home.render(readyApp, []);
assert.ok(!completedHome.includes('mer-setup-title'), 'Completed readiness should leave the homepage');
assert.ok(completedHome.includes('is-ready'), 'Quick actions should fill the released space');
readyApp.rules = { ...readyApp.rules, merchantReadinessUpdate: { message: 'Review <the new counter poster>.', publishedAt: sdk.Timestamp.fromMillis(1000) } };
const updatedHome = await M.routes.home.render(readyApp, []);
assert.ok(updatedHome.includes('mer-setup-title') && updatedHome.includes('Review update') && updatedHome.includes('Review &lt;the new counter poster&gt;.'), 'A published requirement should restore readiness with an escaped message');
readyApp.merchant.readyAt = sdk.Timestamp.fromMillis(2000);
assert.ok(!(await M.routes.home.render(readyApp, [])).includes('mer-setup-title'), 'Confirming the new update should hide readiness again');
console.log('  ✓ Completed shop readiness hides, returns for a new HEP update, and hides after confirmation'); passed++;

const promotion = await M.routes.promote.render(await makeApp(merchant), []);
assert.ok(promotion.includes('28 seats free') && promotion.includes('--progress:30%'), 'Occupancy visual should use recorded seats');
assert.ok(promotion.includes('Live now') && promotion.includes('Paused') && promotion.includes('Ready to publish'), 'Deal states should remain distinct');
assert.ok(promotion.includes('data-toggle="live" data-en="0"') && promotion.includes('data-toggle="paused" data-en="1"'), 'Pause/resume controls should retain their intent');
assert.ok(promotion.includes('href="#/scan/live"') && promotion.includes('&lt;Study break&gt;') && !promotion.includes('new-offer'), 'Live-deal QR and escaping should replace standalone offers');
console.log('  ✓ Merchant promotion visuals use recorded occupancy and preserve approval, pause and offer controls'); passed++;

const liveQR = await import('../dist/client/js/live-deals.js');
const qrView = await M.routes.scan.render(await makeApp(merchant), []);
assert.ok(qrView.includes('data-deal-qr="live"') && !qrView.includes('id="manual"'), 'Merchant should show deal QRs instead of scanning vouchers');
const claimingStudent = await makeApp(student);
const scanView = await S.routes['claim-deal'].render(claimingStudent, ['live']);
assert.ok(scanView.includes('id="deal-cam"') && scanView.includes('id="start-deal-scan"'), 'Student should scan the selected deal QR');
const session = await liveQR.issueDealQR(merchant, 'live');
await liveQR.claimDealQR(student, session.code, 'live');
const confirmation = await S.routes['claim-deal'].render(claimingStudent, ['live']);
assert.ok(confirmation.includes('id="deal-confirmation"') && !confirmation.includes('id="deal-cam"'), 'A recorded claim should replace the scanner');
console.log('  ✓ Merchant QR → student scanner → recorded confirmation renders through the real data layer'); passed++;

const studentApp = await makeApp(student);
studentApp.rules = { ...featureRules, features: { overview: false, dealsAndPay: false } };
const disabledHome = await S.routes.home.render(studentApp, []);
const disabledDirectories = disabledHome.match(/<nav class="kk-pillars"[\s\S]*?<\/nav>/)[0];
assert.equal((disabledDirectories.match(/class="kk-pillar(?: |")/g) || []).length, 4, 'All four homepage directories should stay visible');
assert.equal((disabledDirectories.match(/aria-disabled="true"/g) || []).length, 2);
assert.ok(!/href="#\/explore(?:\/deals)?"/.test(disabledDirectories), 'Disabled features must not be linked');
console.log('  ✓ Overview and Live deals remain visible while respecting feature switches'); passed++;

const { ensureDemoData } = await import('../dist/client/js/demo-seed.js');
const profileBefore = await D.getProfile(student);
sdk._rawUpdate((docs) => {
  docs.set('stats/campus', {}); docs.set('stats/demoFriends', { version: 1 });
  const rules = { ...docs.get('config/rules') }; delete rules.features; docs.set('config/rules', rules);
});
await ensureDemoData({ sdk });
assert.ok(D.FEATURES.every(([key]) => D.featureOn(sdk._rawDocs().get('config/rules'), key)), 'Older demos should receive enabled feature defaults');
assert.deepEqual(await D.getProfile(student), profileBefore, 'Migration must preserve student data');
sdk._rawUpdate((docs) => {
  const rules = docs.get('config/rules');
  docs.set('config/rules', { ...rules, features: { overview: false, dealsAndPay: false } });
});
await ensureDemoData({ sdk }); await ensureDemoData({ sdk });
const migrated = sdk._rawDocs().get('config/rules');
assert.equal(migrated.features.overview, false); assert.equal(migrated.features.dealsAndPay, false);
assert.equal(migrated.features.merchantTools, true);
console.log('  ✓ Saved demos gain missing settings without resetting explicit HEP choices or student data'); passed++;
console.log(`\n${passed} passed, 0 failed`);
