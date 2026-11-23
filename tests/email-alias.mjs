// Tests for extra sign-in emails (functions/email-alias.js), with in-memory stand-ins for Firebase.
import assert from 'node:assert/strict';
import { addEmail, aliasSignIn, removeEmail, MAX_EXTRA_EMAILS } from '../functions/email-alias.js';
import { erasePlan } from '../functions/account.js';
import { HttpError } from '../functions/handoff.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n   ', e.message); } };
const rejects = async (p, code) => { try { await p; } catch (e) { assert.ok(e instanceof HttpError, 'not an HttpError: ' + e.message); assert.equal(e.code, code); return; } assert.fail('expected ' + code); };

// token -> sign-in. "Siswa" is a fresh, empty sign-in made while proving the siswa email.
const T = (k) => `token-${k}-xxxxxxxxxxxxxxxxxxxx`;
const SIGNINS = {
  [T('aina')]: { uid: 'aina', email: 'Aina.Ali@gmail.com', email_verified: true },
  [T('siswa')]: { uid: 'tmp1', email: 'S2012345@siswa.um.edu.my', email_verified: true },
  [T('siswa2')]: { uid: 'tmp2', email: 's2012345@siswa.um.edu.my', email_verified: true },
  [T('ben')]: { uid: 'ben', email: 'ben@gmail.com', email_verified: true },
  [T('unverified')]: { uid: 'tmp3', email: 'x@y.my', email_verified: false },
  [T('shop')]: { uid: 'shop1', email: 'owner@kopi.my', email_verified: true },
  [T('hep')]: { uid: 'hep1', email: 'hep@um.edu.my', email_verified: true },
  [T('free')]: { uid: 'tmp4', email: 'free@gmail.com', email_verified: true },
};
function setup() {
  const profiles = {
    aina: { role: 'student', name: 'Aina', linkedEmails: [] },
    ben: { role: 'student', name: 'Ben', linkedEmails: [] },
    shop1: { role: 'merchant', name: 'Owner' },
    hep1: { role: 'mpp', name: 'HEP' },
  };
  const aliases = new Map(); const s = { deleted: [], minted: [] };
  const deps = {
    verifyIdToken: async (t) => { if (!SIGNINS[t]) throw new Error('bad'); return SIGNINS[t]; },
    getProfile: async (uid) => profiles[uid] || null,
    getAlias: async (email) => aliases.get(email) || null,
    saveAlias: async (email, uid, max) => {
      const a = aliases.get(email); if (a) return a.uid === uid ? 'already' : 'taken';
      if (profiles[uid].linkedEmails.length >= max) return 'full';
      aliases.set(email, { uid }); profiles[uid].linkedEmails.push(email); return 'added';
    },
    removeAlias: async (email, uid) => {
      const a = aliases.get(email); if (!a || a.uid !== uid) return false;
      aliases.delete(email); profiles[uid].linkedEmails = profiles[uid].linkedEmails.filter((e) => e !== email); return true;
    },
    deleteAuthUser: async (uid) => { s.deleted.push(uid); },
    mintToken: async (uid) => { s.minted.push(uid); return 'custom-' + uid; },
  };
  return { deps, s, profiles, aliases };
}

console.log('Extra sign-in emails');
await test('a student adds a second Google email; the empty sign-in is removed', async () => {
  const { deps, s, profiles } = setup();
  const r = await addEmail(deps, { idToken: T('aina'), otherToken: T('siswa') });
  assert.equal(r.email, 's2012345@siswa.um.edu.my');
  assert.deepEqual(profiles.aina.linkedEmails, ['s2012345@siswa.um.edu.my']);
  assert.deepEqual(s.deleted, ['tmp1']);
});
await test('signing in with the added email switches to the student’s account', async () => {
  const { deps, s } = setup();
  await addEmail(deps, { idToken: T('aina'), otherToken: T('siswa') });
  const r = await aliasSignIn(deps, { idToken: T('siswa2') });
  assert.deepEqual(r, { status: 'ready', token: 'custom-aina' });
  assert.deepEqual(s.minted, ['aina']);
  assert.ok(s.deleted.includes('tmp2'));
});
await test('an email nobody added gets no switch', async () => {
  const { deps, s } = setup();
  assert.deepEqual(await aliasSignIn(deps, { idToken: T('free') }), { status: 'none' });
  assert.equal(s.minted.length, 0);
});
await test('an email with its own +Onz account is never taken over', async () => {
  const { deps } = setup();
  await rejects(addEmail(deps, { idToken: T('aina'), otherToken: T('ben') }), 'has-account');
});
await test('an email already added to another student is refused', async () => {
  const { deps, aliases } = setup();
  aliases.set('free@gmail.com', { uid: 'ben' });
  await rejects(addEmail(deps, { idToken: T('aina'), otherToken: T('free') }), 'taken');
});
await test('adding the same email twice is harmless', async () => {
  const { deps, profiles } = setup();
  await addEmail(deps, { idToken: T('aina'), otherToken: T('siswa') });
  const r = await addEmail(deps, { idToken: T('aina'), otherToken: T('siswa2') });
  assert.equal(r.already, true); assert.equal(profiles.aina.linkedEmails.length, 1);
});
await test('the student’s own email and unverified emails are refused', async () => {
  const { deps } = setup();
  await rejects(addEmail(deps, { idToken: T('aina'), otherToken: T('aina') }), 'same');
  await rejects(addEmail(deps, { idToken: T('aina'), otherToken: T('unverified') }), 'unverified');
  await rejects(addEmail(deps, { idToken: T('aina'), otherToken: 'nope' }), 'unauthenticated');
});
await test('only students can add emails, and only up to the limit', async () => {
  const { deps, profiles } = setup();
  await rejects(addEmail(deps, { idToken: T('shop'), otherToken: T('free') }), 'not-allowed');
  await rejects(addEmail(deps, { idToken: T('hep'), otherToken: T('free') }), 'not-allowed');
  profiles.aina.linkedEmails = Array.from({ length: MAX_EXTRA_EMAILS }, (_, i) => `e${i}@x.my`);
  await rejects(addEmail(deps, { idToken: T('aina'), otherToken: T('free') }), 'full');
});
await test('a switch never leads to an admin or business account', async () => {
  const { deps, aliases, s } = setup();
  aliases.set('free@gmail.com', { uid: 'hep1' });
  assert.deepEqual(await aliasSignIn(deps, { idToken: T('free') }), { status: 'none' });
  aliases.set('free@gmail.com', { uid: 'shop1' });
  assert.deepEqual(await aliasSignIn(deps, { idToken: T('free') }), { status: 'none' });
  assert.equal(s.minted.length, 0);
});
await test('a sign-in that has its own profile is never switched', async () => {
  const { deps, aliases, s } = setup();
  aliases.set('ben@gmail.com', { uid: 'aina' });
  assert.deepEqual(await aliasSignIn(deps, { idToken: T('ben') }), { status: 'none' });
  assert.equal(s.minted.length, 0);
});
await test('a student removes an added email, but not their main one or someone else’s', async () => {
  const { deps, profiles, aliases } = setup();
  await addEmail(deps, { idToken: T('aina'), otherToken: T('siswa') });
  await rejects(removeEmail(deps, { idToken: T('ben'), email: 's2012345@siswa.um.edu.my' }), 'not-found');
  await rejects(removeEmail(deps, { idToken: T('aina'), email: 'aina.ali@gmail.com' }), 'primary');
  await removeEmail(deps, { idToken: T('aina'), email: ' S2012345@siswa.um.edu.my ' });
  assert.equal(aliases.size, 0); assert.deepEqual(profiles.aina.linkedEmails, []);
  assert.deepEqual(await aliasSignIn(deps, { idToken: T('siswa2') }), { status: 'none' });
});
await test('deleting an account also frees its added emails', async () => {
  const plan = erasePlan('aina', { linkedEmails: ['s2012345@siswa.um.edu.my', 'bad/id@x.my'] });
  assert.ok(plan.docs.includes('emailAliases/s2012345@siswa.um.edu.my'));
  assert.ok(!plan.docs.some((p) => p.includes('bad/id')));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
