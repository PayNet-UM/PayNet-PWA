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
  ['Student', S, await makeApp(student), ['home', 'rewards', 'me', 'community', 'explore', 'delete-account']],
  ['Merchant', M, await makeApp(merchant), ['home', 'insights', 'promote', 'delete-account']],
  ['HEP', H, await makeApp(hep), ['overview', 'approvals', 'recon', 'kpis', 'closures', 'settings']],
]) {
  for (const route of routes) {
    const html = await mod.routes[route].render(app, []);
    assert.ok(html.length > 100, `${role} ${route} did not render`);
    assert.ok(!/Daily check in points|Check-ins|check in when|check-outs|data-ci=|data-mission=|name="checkinPoints"|check in here/i.test(html), `${role} ${route} still presents attendance controls`);
    assert.ok(!/\bNaN\b|\bundefined\b/.test(html), `${role} ${route} has a broken value`);
    console.log(`  ✓ ${role} ${route} renders without an attendance dependency`); passed++;
  }
}
console.log(`\n${passed} passed, 0 failed`);
