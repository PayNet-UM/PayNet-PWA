import assert from 'node:assert/strict';
import fs from 'node:fs';
import { leagueContribution, syncLeagueStudent } from '../functions/league.js';
import * as sdk from '../app/shared/js/fake/fakefb.js';
import * as D from '../app/shared/js/data.js';

let passed = 0;
async function check(label, fn) { await fn(); passed++; console.log('  ✓ ' + label); }
// Minimal Admin SDK adapter for the actual server reconciliation. Transactions
// execute against the latest documents on every call, including duplicate events.
const docs = new Map();
function ref(path) {
  return { path, collection: (name) => ({ where: () => ({ queryPrefix: `${path}/${name}/` }) }) };
}
const snapshot = (path) => ({ exists: docs.has(path), data: () => structuredClone(docs.get(path)) });
const db = { doc: ref, runTransaction: async (fn) => {
  const writes = [];
  await fn({ get: async (r) => r.queryPrefix
    ? { docs: [...docs].filter(([p]) => p.startsWith(r.queryPrefix)).map(([p]) => snapshot(p)) } : snapshot(r.path),
  set: (r, value) => writes.push([r.path, value]) });
  for (const [path, value] of writes) docs.set(path, value);
} };
docs.set('users/a', { role: 'student', college: 'KK1', points: 25 });
docs.set('users/b', { role: 'student', college: 'KK1', points: 50 });
docs.set('users/c', { role: 'student', college: 'KK2', points: 900 });
for (const [uid, entries] of Object.entries({ a: [100, 20, -50, -45], b: [50], c: [900] })) {
  entries.forEach((delta, i) => docs.set(`users/${uid}/ledger/${i}`, { delta }));
}
await check('server backfill includes historical credits from every student in a KK', async () => {
  for (const uid of ['a', 'b', 'c']) await syncLeagueStudent(db, uid);
  assert.deepEqual(docs.get('stats/league').colleges, { KK1: 170, KK2: 900 });
});
await check('duplicate and out-of-order deliveries do not double count', async () => {
  await syncLeagueStudent(db, 'a'); await syncLeagueStudent(db, 'a');
  assert.equal(docs.get('stats/league').colleges.KK1, 170);
});
await check('a new credit counts once and spending does not subtract league points', async () => {
  docs.set('users/a/ledger/bonus', { delta: 40 });
  docs.set('users/a/ledger/spend', { delta: -10 });
  await syncLeagueStudent(db, 'a');
  assert.equal(docs.get('stats/league').colleges.KK1, 210);
});
await check('a college change transfers the student contribution without duplicating it', async () => {
  docs.get('users/a').college = 'KK2'; await syncLeagueStudent(db, 'a');
  assert.deepEqual(docs.get('stats/league').colleges, { KK1: 50, KK2: 1060 });
});
await check('deleted students are reconciled out of their college', async () => {
  docs.delete('users/a'); await syncLeagueStudent(db, 'a');
  assert.deepEqual(docs.get('stats/league').colleges, { KK1: 50, KK2: 900 });
});
await check('merchants, off-campus accounts and invalid credit amounts do not inflate KK scores', async () => {
  assert.deepEqual(leagueContribution({ role: 'merchant', college: 'KK1' }, [{ delta: 500 }]), { college: '', earned: 0 });
  assert.deepEqual(leagueContribution({ role: 'student', college: 'OFF' }, [{ delta: 500 }]), { college: '', earned: 0 });
  assert.equal(leagueContribution({ role: 'student', college: 'KK1' }, [{ delta: '100' }, { delta: -10 }, { delta: 5 }]).earned, 5);
});

const source = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
sdk.configureFake({ rulesSource: source, storage: null, session: null });
sdk.resetDemoData();
const context = (uid, email) => ({ sdk, db: sdk._testDb(sdk._testAuth({ uid, email, emailVerified: true })), uid, email });
const admin = context('admin', /function bootstrapAdmins\(\) \{ return \['([^']+)'/.exec(source)[1]);
await D.initProgramme(admin);
const a = context('a', 'a@siswa.um.edu.my'), b = context('b', 'b@siswa.um.edu.my');
for (const user of [a, b]) {
  await D.createProfile(user, { role: 'student', name: 'Student ' + user.uid, matric: 'TEST00' + user.uid.toUpperCase(), college: 'KK3' });
  user.profile = await D.getProfile(user);
}
const league = async () => (await sdk.getDoc(sdk.doc(a.db, 'stats', 'league'))).data().colleges;
await check('demo updates aggregate points from both students through real earning operations', async () => {
  await D.adjustPoints(admin, 'a', 1000, 'Demo earned points'); await D.adjustPoints(admin, 'b', 250, 'Demo earned points');
  assert.deepEqual(await league(), { KK3: 1250 });
});
await check('demo redemption and welfare donations preserve cumulative earned points', async () => {
  const reward = (await D.listRewards(a)).find((r) => r.active && r.cost <= 1000);
  await D.redeemReward(a, reward); await D.donatePoints(a, 20);
  assert.deepEqual(await league(), { KK3: 1250 });
  assert.equal((await D.getProfile(a)).points, 1000 - reward.cost - 20);
});
await check('students cannot move their earnings to another college themselves', async () => {
  await assert.rejects(D.updateProfile(b, { college: 'KK5' }), { code: 'permission-denied' });
  assert.deepEqual(await league(), { KK3: 1250 });
});
await check('demo transfers existing earnings when HEP corrects a college', async () => {
  await D.setCollege(admin, 'b', 'KK5', 'Picked the wrong college at sign-up');
  assert.deepEqual(await league(), { KK3: 1000, KK5: 250 });
});
await check('welfare support credits a wallet but does not inflate earned KK points', async () => {
  const request = await D.submitWelfareRequest(a, 10, 'Support with study essentials.');
  const before = (await D.getProfile(a)).points;
  await D.reviewWelfareRequest(admin, request, true);
  assert.equal((await D.getProfile(a)).points, before + 10);
  assert.deepEqual(await league(), { KK3: 1000, KK5: 250 });
  assert.equal(leagueContribution({ role: 'student', college: 'KK3' }, [{ type: 'welfare', delta: 10 }, { type: 'lesson', delta: 50 }]).earned, 50);
});
await check('existing saved demo ledgers rebuild totals rather than trusting old checkout counts', async () => {
  sdk._rawUpdate((saved) => {
    saved.set('users/b/ledger/historical', { delta: 75 });
    saved.set('stats/campus', { checkins: 500, colleges: { KK3: 500 } });
  });
  assert.deepEqual(await league(), { KK3: 1000, KK5: 325 });
});
await check('clients cannot forge league totals or inspect private contribution records', async () => {
  await assert.rejects(sdk.setDoc(sdk.doc(a.db, 'stats', 'league'), { colleges: { KK3: 999999 } }), { code: 'permission-denied' });
  await assert.rejects(sdk.getDoc(sdk.doc(a.db, 'leagueMembers', 'b')), { code: 'permission-denied' });
  await assert.rejects(sdk.setDoc(sdk.doc(admin.db, 'stats', 'league'), { colleges: { KK3: 999999 } }), { code: 'permission-denied' });
});
console.log(`\n${passed} passed, 0 failed`);
