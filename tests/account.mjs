// Tests for "Delete my account" (functions/account.js), with in-memory stand-ins for Firebase.
import assert from 'node:assert/strict';
import { closeAccount, erasePlan, cleanAnswers, patchFor, REASONS, DELETED, adminDelete, merchantErasePlan } from '../functions/account.js';
import { HttpError } from '../functions/handoff.js';
import { CLOSE_REASONS } from '../app/shared/js/data.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n   ', e.message); } };
const rejects = async (p, code) => { try { await p; } catch (e) { assert.ok(e instanceof HttpError, 'not an HttpError: ' + e.message); assert.equal(e.code, code); return; } assert.fail('expected ' + code); };

const TOKENS = { 'token-aina-xxxxxxxxxxxxxxxx': 'aina', 'token-shop-xxxxxxxxxxxxxxxx': 'shop1', 'token-hep-xxxxxxxxxxxxxxxxx': 'hep1', 'token-bad-xxxxxxxxxxxxxxxxx': 'bad1', 'token-new-xxxxxxxxxxxxxxxxx': 'new1' };
function setup() {
  const profiles = {
    aina: { role: 'student', name: 'Aina Ali', matric: 'S2012345', college: 'KK3', faculty: 'Science', points: 120, referralCode: 'AINA-7K', username: 'aina_a' },
    shop1: { role: 'merchant', name: 'Owner', email: 'owner@kopi.my' },
    hep1: { role: 'mpp', name: 'HEP' },
    bad1: { role: 'student', name: 'Blocked', disabled: true },
  };
  const s = { closures: new Map(), erased: [], authDeleted: [], seq: 0 };
  const deps = {
    verifyIdToken: async (t) => { if (!TOKENS[t]) throw new Error('bad'); return { uid: TOKENS[t], email: TOKENS[t] + '@x.my' }; },
    getProfile: async (uid) => profiles[uid] || null,
    getMerchant: async (uid) => (uid === 'shop1' ? { name: 'Kopi Kolej' } : null),
    addClosure: async (id, data) => { const key = id || 'auto' + (++s.seq); if (s.closures.has(key)) throw Object.assign(new Error('exists'), { code: 'already-exists' }); s.closures.set(key, data); },
    erase: async (uid, plan) => { s.erased.push([uid, plan]); },
    deleteAuthUser: async (uid) => { s.authDeleted.push(uid); },
    now: () => 1_000_000,
  };
  return { deps, s };
}

await test('a student deletes their account: data erased, sign-in removed, HEP told without their name', async () => {
  const { deps, s } = setup();
  const r = await closeAccount(deps, { idToken: 'token-aina-xxxxxxxxxxxxxxxx', reasons: ['privacy', 'privacy', 'leaving'], comment: '  Graduating soon  ' });
  assert.deepEqual(r, { ok: true, kind: 'deleted' });
  assert.deepEqual(s.authDeleted, ['aina']);
  assert.equal(s.erased[0][0], 'aina');
  const [note] = [...s.closures.values()];
  assert.deepEqual(note.reasons, ['privacy', 'leaving']);
  assert.equal(note.comment, 'Graduating soon');
  assert.equal(note.college, 'KK3'); assert.equal(note.points, 120); assert.equal(note.seen, false);
  assert.ok(!JSON.stringify(note).includes('Aina') && !JSON.stringify(note).includes('S2012345') && !JSON.stringify(note).includes('aina'), 'note must not identify the student');
});
await test('the erase plan covers every place a student’s data lives', async () => {
  const plan = erasePlan('aina', { matric: 'S2012345', referralCode: 'AINA-7K', username: 'aina_a' });
  for (const p of ['presence/aina', 'surveys/aina', 'referrals/aina', 'matrics/S2012345', 'referralCodes/AINA-7K', 'usernames/aina_a']) assert.ok(plan.docs.includes(p), p);
  assert.deepEqual(plan.trees, ['waves/aina', 'users/aina']);
  assert.deepEqual(plan.prefixes, [{ collection: 'checkins', prefix: 'aina_' }]);
  const q = (c, f) => plan.queries.find((x) => x.collection === c && x.field === f);
  assert.equal(q('friendships', 'from').action, 'delete'); assert.equal(q('friendships', 'to').action, 'delete');
  assert.equal(q('referrals', 'inviterUid').action, 'delete'); assert.equal(q('missionClaims', 'uid').action, 'delete');
  assert.deepEqual(q('vouchers', 'studentUid').patch, { studentUid: DELETED, studentName: 'Deleted account' });
  assert.deepEqual(q('liveDealClaims', 'studentUid').patch, { studentUid: DELETED, studentName: 'Deleted account' });
  assert.equal(q('welfareRequests', 'studentUid').patch.reason, '');
  assert.equal(q('feedback', 'studentUid').action, 'delete');
  assert.equal(q('visits', 'uid').patch.uid, DELETED);
  assert.ok(!plan.docs.some((p) => p.startsWith('leagueMembers/')), 'leaderboard entry is left for syncLeagueStudent to subtract');
});
await test('a deleted account’s unused vouchers are cancelled, and used ones are kept as they were', async () => {
  const vouchers = erasePlan('aina', {}).queries.find((x) => x.collection === 'vouchers');
  assert.deepEqual(patchFor(vouchers, { status: 'issued' }), { studentUid: DELETED, studentName: 'Deleted account', status: 'cancelled' });
  assert.deepEqual(patchFor(vouchers, { status: 'used' }), { studentUid: DELETED, studentName: 'Deleted account' });
  const claims = erasePlan('aina', {}).queries.find((x) => x.collection === 'liveDealClaims');
  assert.deepEqual(patchFor(claims, { status: 'issued' }), claims.patch, 'only vouchers are cancelled');
});
await test('a student without a username or referral code still gets a clean plan', async () => {
  const plan = erasePlan('x', {});
  assert.ok(plan.docs.every((p) => !p.includes('undefined')));
});
await test('a business sends a closing request instead, once', async () => {
  const { deps, s } = setup();
  const r = await closeAccount(deps, { idToken: 'token-shop-xxxxxxxxxxxxxxxx', reasons: ['business-closing'] });
  assert.deepEqual(r, { ok: true, kind: 'request' });
  assert.deepEqual(s.authDeleted, []); assert.deepEqual(s.erased, []);
  const note = s.closures.get('request_shop1');
  assert.equal(note.businessName, 'Kopi Kolej'); assert.equal(note.status, 'open'); assert.equal(note.email, 'shop1@x.my');
  assert.deepEqual(await closeAccount(deps, { idToken: 'token-shop-xxxxxxxxxxxxxxxx', reasons: ['other'] }), { ok: true, kind: 'request', already: true });
  assert.equal(s.closures.size, 1);
});
await test('HEP accounts and blocked accounts can’t delete themselves here', async () => {
  const { deps, s } = setup();
  await rejects(closeAccount(deps, { idToken: 'token-hep-xxxxxxxxxxxxxxxxx', reasons: ['other'] }), 'not-allowed');
  await rejects(closeAccount(deps, { idToken: 'token-bad-xxxxxxxxxxxxxxxxx', reasons: ['other'] }), 'blocked');
  assert.deepEqual(s.authDeleted, []);
});
await test('someone who signed in but never finished sign-up can still delete their sign-in', async () => {
  const { deps, s } = setup();
  assert.equal((await closeAccount(deps, { idToken: 'token-new-xxxxxxxxxxxxxxxxx', reasons: ['prefer-not'] })).kind, 'deleted');
  assert.deepEqual(s.authDeleted, ['new1']);
});
await test('requests need a valid sign-in and at least one known reason', async () => {
  const { deps, s } = setup();
  await rejects(closeAccount(deps, { idToken: '', reasons: ['other'] }), 'unauthenticated');
  await rejects(closeAccount(deps, { idToken: 'token-zzz-xxxxxxxxxxxxxxxxx', reasons: ['other'] }), 'unauthenticated');
  await rejects(closeAccount(deps, { idToken: 'token-aina-xxxxxxxxxxxxxxxx', reasons: [] }), 'bad-request');
  await rejects(closeAccount(deps, { idToken: 'token-aina-xxxxxxxxxxxxxxxx', reasons: ['made-up'] }), 'bad-request');
  await rejects(closeAccount(deps, { idToken: 'token-aina-xxxxxxxxxxxxxxxx', reasons: 'privacy' }), 'bad-request');
  await rejects(closeAccount(deps, { idToken: 'token-aina-xxxxxxxxxxxxxxxx', reasons: ['other'], comment: 'x'.repeat(501) }), 'bad-request');
  await rejects(closeAccount(deps, { idToken: 'token-aina-xxxxxxxxxxxxxxxx', reasons: ['other'], comment: { a: 1 } }), 'bad-request');
  assert.deepEqual(s.authDeleted, []); assert.equal(s.closures.size, 0);
  assert.deepEqual(cleanAnswers({ reasons: ['other'] }), { reasons: ['other'], comment: '' });
});
await test('the app offers exactly the reasons the server accepts', async () => {
  assert.deepEqual(CLOSE_REASONS.map(([k]) => k).sort(), Object.keys(REASONS).sort());
  for (const [k, label] of CLOSE_REASONS) assert.equal(label, REASONS[k], k);
});

// ---- HEP deletes an account (the rules have already checked the admin, matric and request)
function adminSetup() {
  const { deps, s } = setup();
  s.updated = [];
  return { deps: { ...deps, updateClosure: async (id, data) => { s.updated.push([id, data]); } }, s };
}
await test('HEP deletes a student: anonymous note, full erase, sign-in removed', async () => {
  const { deps, s } = adminSetup();
  assert.deepEqual(await adminDelete(deps, { uid: 'aina', role: 'student', by: 'hep@um.edu.my' }), { status: 'done' });
  const note = [...s.closures.values()][0];
  assert.equal(note.kind, 'deleted'); assert.equal(note.byAdmin, 'hep@um.edu.my'); assert.equal(note.points, 120);
  assert.ok(!('name' in note) && !('matric' in note) && !('email' in note), 'the note must not name the student');
  assert.deepEqual(s.erased[0], ['aina', erasePlan('aina', { role: 'student', name: 'Aina Ali', matric: 'S2012345', college: 'KK3', faculty: 'Science', points: 120, referralCode: 'AINA-7K', username: 'aina_a' })]);
  assert.deepEqual(s.authDeleted, ['aina']);
});
await test('HEP deletes a business: shop data erased, request marked closed', async () => {
  const { deps, s } = adminSetup();
  assert.equal((await adminDelete(deps, { uid: 'shop1', role: 'merchant', by: 'hep@um.edu.my' })).status, 'done');
  assert.deepEqual(s.erased[0], ['shop1', merchantErasePlan('shop1')]);
  assert.equal(s.updated[0][0], 'request_shop1'); assert.equal(s.updated[0][1].status, 'done'); assert.equal(s.updated[0][1].handledBy, 'hep@um.edu.my');
  assert.equal(s.closures.size, 0); assert.deepEqual(s.authDeleted, ['shop1']);
});
await test('a business erase keeps the records students and HEP need', () => {
  const plan = merchantErasePlan('shop1');
  assert.ok(plan.docs.includes('merchants/shop1') && plan.docs.includes('merchantPrivate/shop1'));
  const queried = plan.queries.map((q) => q.collection);
  for (const keep of ['vouchers', 'liveDealClaims', 'visits']) assert.ok(!queried.includes(keep), keep + ' should be kept');
  assert.ok(!plan.docs.some((p) => p.startsWith('stallSurveys/')), 'the merchant assessment counts toward a KPI');
});
await test('a changed account type, an admin profile or a missing uid is not deleted', async () => {
  const { deps, s } = adminSetup();
  assert.equal((await adminDelete(deps, { uid: 'aina', role: 'merchant', by: 'x' })).status, 'error');
  assert.equal((await adminDelete(deps, { uid: 'hep1', role: 'mpp', by: 'x' })).status, 'error');
  assert.equal((await adminDelete(deps, { uid: '', role: 'student', by: 'x' })).status, 'error');
  assert.equal(s.erased.length, 0); assert.equal(s.authDeleted.length, 0);
});
await test('an account that is already gone just finishes; a stuck sign-in is reported', async () => {
  const { deps, s } = adminSetup();
  assert.deepEqual(await adminDelete(deps, { uid: 'nobody', role: 'student', by: 'x' }), { status: 'done' });
  assert.equal(s.erased.length, 0);
  const r = await adminDelete({ ...deps, deleteAuthUser: async () => { throw new Error('no permission'); } }, { uid: 'aina', role: 'student', by: 'x' });
  assert.equal(r.status, 'done'); assert.match(r.warning, /sign-in/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
