// Kampus Kita+ server functions. Firebase Hosting sends /api/** here (see firebase.json), so the app calls
// them on its own address with no cross-site setup.
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { create, redeem, HttpError } from './handoff.js';

initializeApp();
const db = getFirestore();
const auth = getAuth();

// Hand-off records live in a collection the app itself can't read or write (firestore.rules denies it).
const store = {
  async create(id, data) {
    await db.collection('handoffs').doc(id).create({ ...data, expiresAt: Timestamp.fromMillis(data.expiresAt) });
  },
  async peek(id) {
    const snap = await db.collection('handoffs').doc(id).get();
    if (!snap.exists) return null;
    const d = snap.data(); return { ...d, expiresAt: d.expiresAt.toMillis() };
  },
  async take(id) {
    const ref = db.collection('handoffs').doc(id);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      tx.delete(ref);
      const d = snap.data();
      return { ...d, expiresAt: d.expiresAt.toMillis() };
    });
  },
};
const deps = {
  store,
  verifyIdToken: (t) => auth.verifyIdToken(t),
  mintToken: (uid) => auth.createCustomToken(uid),
  now: () => Date.now(),
};

// Runs as the account named in functions/.env.<project-id> (HANDOFF_SERVICE_ACCOUNT): it needs the
// "Service Account Token Creator" role to make sign-in tokens. Without the file it runs as the default compute account.
const runAs = process.env.HANDOFF_SERVICE_ACCOUNT ? { serviceAccount: process.env.HANDOFF_SERVICE_ACCOUNT } : {};

export const api = onRequest({ region: 'asia-southeast1', invoker: 'public', maxInstances: 5, memory: '256MiB', timeoutSeconds: 15, ...runAs }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  const body = typeof req.body === 'object' && req.body ? req.body : {};
  try {
    if (req.path.endsWith('/handoff/create')) {
      const idToken = (req.get('Authorization') || '').replace(/^Bearer /, '');
      const out = await create(deps, { hash: body.hash, idToken });
      console.log('handoff create', String(body.hash).slice(0, 6));
      return res.json(out);
    }
    if (req.path.endsWith('/handoff/redeem')) {
      const out = await redeem(deps, { secret: body.secret });
      if (out.status === 'ready') console.log('handoff redeemed');
      return res.json(out);
    }
    return res.status(404).json({ error: 'not-found' });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.code, message: e.message });
    console.error(e);
    if (e && /insufficient-permission|signBlob|iam\.serviceAccounts/i.test(String(e.code) + e.message)) {
      return res.status(500).json({ error: 'setup', message: 'The sign-in server isn’t allowed to create sign-in tokens yet. Ask the team to finish the set-up in docs/DEPLOY.md.' });
    }
    return res.status(500).json({ error: 'internal', message: 'Something went wrong. Try again.' });
  }
});
