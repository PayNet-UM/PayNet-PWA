// Tests for the iPhone home-screen sign-in hand-off (functions/handoff.js), with an in-memory store.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { create, redeem, sha256hex, TTL_MS, HttpError } from '../functions/handoff.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n   ', e.message); } };
const rejects = async (p, code) => { try { await p; } catch (e) { assert.ok(e instanceof HttpError, 'not an HttpError: ' + e.message); assert.equal(e.code, code); return; } assert.fail('expected ' + code); };

function setup() {
  let clock = 1_000_000;
  const rows = new Map();
  const deps = {
    now: () => clock,
    tick: (ms) => { clock += ms; },
    rows,
    verifyIdToken: async (t) => {
      if (t === 'token-aina-verified-xxxxxxxx') return { uid: 'aina', email: 'aina@siswa.um.edu.my', email_verified: true };
      if (t === 'token-cara-verified-xxxxxxxx') return { uid: 'cara', email: 'cara@siswa.um.edu.my', email_verified: true };
      if (t === 'token-bob-unverified-xxxxxxx') return { uid: 'bob', email: 'bob@x.my', email_verified: false };
      throw new Error('bad token');
    },
    mintToken: async (uid) => `custom-token-for-${uid}`,
    store: {
      async create(id, data) { if (rows.has(id)) { const e = new Error('exists'); e.code = 'already-exists'; throw e; } rows.set(id, { ...data }); },
      async peek(id) { return rows.get(id) || null; },
      async take(id) { const r = rows.get(id) || null; rows.delete(id); return r; },
    },
  };
  return deps;
}
const newSecret = () => randomBytes(32).toString('base64url');

console.log('Sign-in hand-off');
await test('a verified user hands off, and the app redeems a custom token once', async () => {
  const d = setup(); const secret = newSecret(); const hash = sha256hex(secret);
  assert.deepEqual(await redeem(d, { secret }), { status: 'pending' });
  assert.equal((await create(d, { hash, idToken: 'token-aina-verified-xxxxxxxx' })).ok, true);
  const r = await redeem(d, { secret });
  assert.equal(r.status, 'ready'); assert.equal(r.token, 'custom-token-for-aina'); assert.equal(r.email, 'aina@siswa.um.edu.my');
  assert.deepEqual(await redeem(d, { secret }), { status: 'pending' }, 'second redeem gets nothing');
  assert.equal(d.rows.size, 0, 'record deleted');
});
await test('only the hash is stored, never the secret', async () => {
  const d = setup(); const secret = newSecret();
  await create(d, { hash: sha256hex(secret), idToken: 'token-aina-verified-xxxxxxxx' });
  assert.ok(!d.rows.has(secret)); assert.ok(!JSON.stringify([...d.rows]).includes(secret));
});
await test('knowing the hash (from the Safari address) is not enough to redeem', async () => {
  const d = setup(); const secret = newSecret(); const hash = sha256hex(secret);
  await create(d, { hash, idToken: 'token-aina-verified-xxxxxxxx' });
  await rejects(redeem(d, { secret: hash }), 'bad-request');
  assert.deepEqual(await redeem(d, { secret: newSecret() }), { status: 'pending' });
});
await test('an expired hand-off is refused and removed', async () => {
  const d = setup(); const secret = newSecret();
  await create(d, { hash: sha256hex(secret), idToken: 'token-aina-verified-xxxxxxxx' });
  d.tick(TTL_MS + 1);
  await rejects(redeem(d, { secret }), 'expired'); assert.equal(d.rows.size, 0);
});
await test('a hand-off code can be claimed by only one sign-in', async () => {
  const d = setup(); const hash = sha256hex(newSecret());
  await create(d, { hash, idToken: 'token-aina-verified-xxxxxxxx' });
  assert.equal((await create(d, { hash, idToken: 'token-aina-verified-xxxxxxxx' })).ok, true, 'same person reloading is fine');
  await rejects(create(d, { hash, idToken: 'token-cara-verified-xxxxxxxx' }), 'used');
  assert.equal(d.rows.get(hash).uid, 'aina');
});
await test('needs a valid, verified sign-in', async () => {
  const d = setup(); const hash = sha256hex(newSecret());
  await rejects(create(d, { hash, idToken: '' }), 'unauthenticated');
  await rejects(create(d, { hash, idToken: 'forged-token-xxxxxxxxxxxxxxx' }), 'unauthenticated');
  await rejects(create(d, { hash, idToken: 'token-bob-unverified-xxxxxxx' }), 'unverified');
  assert.equal(d.rows.size, 0);
});
await test('rejects malformed input', async () => {
  const d = setup();
  await rejects(create(d, { hash: 'abc', idToken: 'token-aina-verified-xxxxxxxx' }), 'bad-request');
  await rejects(create(d, { hash: '../../users/x', idToken: 'token-aina-verified-xxxxxxxx' }), 'bad-request');
  await rejects(redeem(d, { secret: 'short' }), 'bad-request');
  await rejects(redeem(d, {}), 'bad-request');
});
await test('if making the token fails, the hand-off is kept so the app can retry', async () => {
  const d = setup(); const secret = newSecret();
  await create(d, { hash: sha256hex(secret), idToken: 'token-aina-verified-xxxxxxxx' });
  const real = d.mintToken; d.mintToken = async () => { const e = new Error('iam.serviceAccounts.signBlob denied'); e.code = 'auth/insufficient-permission'; throw e; };
  await assert.rejects(redeem(d, { secret }), /signBlob/);
  assert.equal(d.rows.size, 1, 'record kept');
  d.mintToken = real; assert.equal((await redeem(d, { secret })).status, 'ready');
});
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
