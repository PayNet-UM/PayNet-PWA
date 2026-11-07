import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D from '../app/shared/js/data.js';
import * as sdk from '../app/shared/js/fake/fakefb.js';
import { startDailyAppActivity } from '../app/shared/js/app-activity.js';

const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
let now = Date.UTC(2026, 10, 7, 15, 59);
sdk.configureFake({ rulesSource: rules, storage: null, session: null, now: () => now }); sdk.resetDemoData();
const context = (uid, email) => ({ sdk, db: sdk._testDb(sdk._testAuth({ uid, email, emailVerified: true })), uid, email, now: () => now });
const admin = context('admin', /function bootstrapAdmins\(\) \{ return \['([^']+)'/.exec(rules)[1]);
const a = context('a', 'a@siswa.um.edu.my'), b = context('b', 'b@siswa.um.edu.my');
await D.initProgramme(admin);
for (const ctx of [a, b]) {
  await D.createProfile(ctx, { role: 'student', name: 'Student ' + ctx.uid, matric: 'DAILY00' + ctx.uid.toUpperCase(), college: 'KK3' });
  ctx.profile = await D.getProfile(ctx);
}
class Surface extends EventTarget { visibilityState = 'visible'; }
const doc = new Surface(), host = new Surface();
const errors = [];
const stop = startDailyAppActivity(a, { doc, host, now: () => now, onError: (error) => errors.push(error) });
const flush = () => new Promise((resolve) => setImmediate(resolve));
const days = async () => (await sdk.getDocs(sdk.collection(a.db, 'users', 'a', 'appDays'))).docs.map((s) => s.data());
let passed = 0;
async function test(label, fn) { await fn(); passed++; console.log('  ✓ ' + label); }
await flush();
await test('opening the signed-in app starts a streak without a lesson or points', async () => {
  assert.equal(D.dailyStreak(await days(), now).current, 1);
  assert.equal((await D.getProfile(a)).points, 0);
  assert.equal([...sdk._rawDocs().keys()].some((p) => p.includes('/activityDays/')), false);
});
await test('reopening or interacting on the same day cannot count twice or rewrite the record', async () => {
  const first = (await days())[0].openedAt.toMillis(); now += 1000;
  host.dispatchEvent(new Event('focus')); doc.dispatchEvent(new Event('pointerdown')); await flush();
  assert.equal(await D.recordAppDay(a), 'already');
  assert.equal((await days()).length, 1); assert.equal((await days())[0].openedAt.toMillis(), first);
});
await test('an idle background app cannot count a new day', async () => {
  now += 60000; doc.visibilityState = 'hidden';
  host.dispatchEvent(new Event('focus')); doc.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal((await days()).length, 1);
});
await test('resuming after Malaysia midnight counts the new day once', async () => {
  assert.equal(D.dayKey(now), '2026-11-08'); doc.visibilityState = 'visible';
  doc.dispatchEvent(new Event('visibilitychange')); host.dispatchEvent(new Event('pageshow')); await flush();
  assert.equal((await days()).length, 2); assert.equal(D.dailyStreak(await days(), now).current, 2);
  assert.equal((await D.getProfile(a)).points, 0);
});
await test('using an already-open app on another day counts without a manual button', async () => {
  now += 86400000; doc.dispatchEvent(new Event('keydown')); await flush();
  assert.equal(D.dailyStreak(await days(), now).current, 3);
});
await test('a missed day resets the streak; continued use starts it again', async () => {
  now += 2 * 86400000;
  assert.equal(D.dailyStreak(await days(), now).current, 0);
  host.dispatchEvent(new Event('focus')); await flush();
  assert.equal(D.dailyStreak(await days(), now).current, 1);
});
await test('future dates, past dates and record edits are denied', async () => {
  for (const day of ['2026-11-07', '2026-11-12', D.dayKey(now)]) await assert.rejects(sdk.setDoc(sdk.doc(a.db, 'users', 'a', 'appDays', day), {
    day, openedAt: sdk.serverTimestamp(),
  }), { code: 'permission-denied' });
});
await test('students cannot read or write another student’s app activity', async () => {
  const day = D.dayKey(now);
  await assert.rejects(sdk.getDoc(sdk.doc(b.db, 'users', 'a', 'appDays', day)), { code: 'permission-denied' });
  await assert.rejects(sdk.setDoc(sdk.doc(b.db, 'users', 'a', 'appDays', day), { day, openedAt: sdk.serverTimestamp() }), { code: 'permission-denied' });
});
await test('lesson completion is independent of the app streak and still awards points once', async () => {
  const before = (await days()).length;
  assert.equal(await D.answerLesson(b, 0, 1, D.DEFAULT_RULES), 'correct');
  assert.equal((await D.getProfile(b)).points, 50);
  assert.equal((await sdk.getDocs(sdk.collection(b.db, 'users', 'b', 'appDays'))).docs.length, 0);
  assert.equal((await days()).length, before);
});
await test('app use writes no merchant attendance, GPS presence or point ledger', async () => {
  assert.equal([...sdk._rawDocs().keys()].some((p) => /^(visits|checkins|presence)\//.test(p)), false);
  assert.equal([...sdk._rawDocs().keys()].some((p) => p.startsWith('users/a/ledger/')), false);
  assert.equal(errors.length, 0);
});
await test('sign-out cleanup stops activity from being recorded', async () => {
  stop(); const before = (await days()).length; now += 86400000;
  host.dispatchEvent(new Event('focus')); doc.dispatchEvent(new Event('pointerdown')); await flush();
  assert.equal((await days()).length, before);
});
console.log(`\n${passed} passed, 0 failed`);
