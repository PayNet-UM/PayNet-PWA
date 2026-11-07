import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D from '../app/shared/js/data.js';
import * as sdk from '../app/shared/js/fake/fakefb.js';

const source = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
let now = Date.UTC(2026, 10, 7, 15, 59); // 7 Nov, 23:59 MYT
sdk.configureFake({ rulesSource: source, storage: null, session: null, now: () => now });
sdk.resetDemoData();
const context = (uid, email) => ({ sdk, db: sdk._testDb(sdk._testAuth({ uid, email, emailVerified: true })), uid, email, now: () => now });
const admin = context('admin', /function bootstrapAdmins\(\) \{ return \['([^']+)'/.exec(source)[1]);
const a = context('a', 'a@siswa.um.edu.my'), b = context('b', 'b@siswa.um.edu.my');
await D.initProgramme(admin);
for (const user of [a, b]) {
  await D.createProfile(user, { role: 'student', name: 'Student ' + user.uid, matric: 'LEARN00' + user.uid.toUpperCase(), college: 'KK3' });
  user.profile = await D.getProfile(user);
}
const records = async () => (await sdk.getDocs(sdk.collection(a.db, 'users', a.uid, 'activityDays'))).docs.map((d) => d.data());
const points = async () => (await D.getProfile(a)).points;
let passed = 0;
async function test(label, fn) { await fn(); passed++; console.log('  ✓ ' + label); }
await test('a correct new lesson awards points once and records its completion date', async () => {
  assert.equal(await D.answerLesson(a, 0, 1, D.DEFAULT_RULES), 'correct');
  assert.equal(await points(), 50);
  assert.equal((await records()).length, 1);
  assert.equal((await records())[0].day, '2026-11-07');
});
await test('correct practice counts without repeating the lesson reward', async () => {
  const previous = await D.getProfile(a);
  assert.equal(await D.practiceLesson(a, 0, 1, D.DEFAULT_RULES), 'practised');
  assert.equal(await points(), 50);
  assert.equal((await D.getProfile(a)).lastTx, previous.lastTx);
  assert.equal((await records()).length, 1);
});
await test('multiple lessons in one calendar day share one learning-history record', async () => {
  assert.equal(await D.answerLesson(a, 1, 0, D.DEFAULT_RULES), 'correct');
  assert.equal(await points(), 100);
  assert.equal((await records()).length, 1);
  assert.equal((await records()).length, 1);
});
await test('wrong practice does not update activity or award points', async () => {
  const before = await records();
  assert.equal(await D.practiceLesson(a, 0, 0, D.DEFAULT_RULES), 'wrong');
  assert.deepEqual(await records(), before); assert.equal(await points(), 100);
});
await test('Malaysia midnight starts a new eligible day', async () => {
  now += 60000;
  assert.equal(D.dayKey(now), '2026-11-08');
  await D.practiceLesson(a, 0, 1, D.DEFAULT_RULES);
  assert.equal((await records()).length, 2);
  assert.equal(await points(), 100);
});
await test('daily practice remains available without repeating reward points', async () => {
  now += 86400000;
  await D.practiceLesson(a, 1, 0, D.DEFAULT_RULES);
  assert.equal((await records()).length, 3);
  assert.equal(await points(), 100);
});
await test('rules reject future/backdated activity and updates to past days', async () => {
  for (const day of ['2026-11-07', '2026-11-10']) await assert.rejects(sdk.setDoc(sdk.doc(a.db, 'users', 'a', 'activityDays', day), {
    day, lesson: 'lesson0', answer: 1, completedAt: sdk.serverTimestamp(),
  }), { code: 'permission-denied' });
});
await test('rules require a correct lesson answer rather than a page view', async () => {
  await assert.rejects(sdk.setDoc(sdk.doc(a.db, 'users', 'a', 'activityDays', D.dayKey(now)), {
    day: D.dayKey(now), lesson: 'page-view', answer: 1, completedAt: sdk.serverTimestamp(),
  }), { code: 'permission-denied' });
});
await test('students cannot read or write another student’s learning days', async () => {
  const day = D.dayKey(now);
  await assert.rejects(sdk.getDoc(sdk.doc(b.db, 'users', 'a', 'activityDays', day)), { code: 'permission-denied' });
  await assert.rejects(sdk.setDoc(sdk.doc(b.db, 'users', 'a', 'activityDays', day), { day, lesson: 'lesson0', answer: 1, completedAt: sdk.serverTimestamp() }), { code: 'permission-denied' });
});
await test('learning practice creates no attendance, visit or presence records', async () => {
  assert.equal([...sdk._rawDocs().keys()].some((path) => /^(checkins|visits|presence)\//.test(path)), false);
});
console.log(`\n${passed} passed, 0 failed`);
