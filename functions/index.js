// Kampus Kita+ server functions. Firebase Hosting sends /api/** here (see firebase.json), so the app calls
// them on its own address with no cross-site setup.
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldPath } from 'firebase-admin/firestore';
import { create, redeem, HttpError } from './handoff.js';
import { syncLeagueStudent } from './league.js';
import { rebuildReferralBoard } from './referrals.js';
import { closeAccount, patchFor } from './account.js';

initializeApp();
const db = getFirestore();
const auth = getAuth();

const leagueOptions = { region: 'asia-southeast1', retry: true, maxInstances: 5 };
export const kkLeaguePoints = onDocumentWritten({ ...leagueOptions, document: 'users/{uid}/ledger/{entry}' },
  (event) => syncLeagueStudent(db, event.params.uid));
export const kkLeagueCollege = onDocumentWritten({ ...leagueOptions, document: 'users/{uid}' }, async (event) => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  // The referral board shows usernames, and drops students who deleted their account.
  if (before?.username !== after?.username || !after) await rebuildReferralBoard(db);
  if (before?.college === after?.college && before?.faculty === after?.faculty && before?.role === after?.role) return;
  return syncLeagueStudent(db, event.params.uid);
});
// Referral leaderboard (stats/referrals): recounted whenever a referral is added or removed.
export const referralBoard = onDocumentWritten({ ...leagueOptions, document: 'referrals/{friend}' }, () => rebuildReferralBoard(db));

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

// "Delete my account" (functions/account.js decides what goes; this carries it out with admin access).
async function commitAll(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch(); ops.slice(i, i + 400).forEach((op) => op(b)); await b.commit();
  }
}
async function erase(uid, plan) {
  const ops = plan.docs.map((p) => (b) => b.delete(db.doc(p)));
  for (const { collection, prefix } of plan.prefixes) {
    const snap = await db.collection(collection).orderBy(FieldPath.documentId()).startAt(prefix).endAt(prefix + '\uf8ff').get();
    snap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
  }
  for (const q of plan.queries) {
    const snap = await db.collection(q.collection).where(q.field, '==', uid).get();
    snap.docs.forEach((d) => ops.push((b) => (q.action === 'delete' ? b.delete(d.ref) : b.update(d.ref, patchFor(q, d.data())))));
  }
  await commitAll(ops);
  for (const p of plan.trees) await db.recursiveDelete(db.doc(p));
  await syncLeagueStudent(db, uid);
}
const accountDeps = {
  verifyIdToken: (t) => auth.verifyIdToken(t),
  getProfile: async (uid) => { const s = await db.doc(`users/${uid}`).get(); return s.exists ? s.data() : null; },
  getMerchant: async (uid) => { const s = await db.doc(`merchants/${uid}`).get(); return s.exists ? s.data() : null; },
  addClosure: async (id, data) => {
    const row = { ...data, createdAt: Timestamp.fromMillis(data.createdAt) };
    if (!id) return void await db.collection('accountClosures').add(row);
    // The admin SDK reports a document that already exists as gRPC code 6.
    try { await db.collection('accountClosures').doc(id).create(row); } catch (e) { throw e?.code === 6 ? Object.assign(e, { code: 'already-exists' }) : e; }
  },
  erase,
  deleteAuthUser: async (uid) => { try { await auth.deleteUser(uid); } catch (e) { if (e?.code !== 'auth/user-not-found') throw e; } },
  now: () => Date.now(),
};

// Runs as the account named in functions/.env.<project-id> (HANDOFF_SERVICE_ACCOUNT): it needs the
// "Service Account Token Creator" role to make sign-in tokens. Without the file it runs as the default compute account.
const runAs = process.env.HANDOFF_SERVICE_ACCOUNT ? { serviceAccount: process.env.HANDOFF_SERVICE_ACCOUNT } : {};

export const api = onRequest({ region: 'asia-southeast1', invoker: 'public', maxInstances: 5, memory: '256MiB', timeoutSeconds: 60, ...runAs }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  const body = typeof req.body === 'object' && req.body ? req.body : {};
  try {
    if (req.path.endsWith('/handoff/create')) {
      const idToken = (req.get('Authorization') || '').replace(/^Bearer /, '');
      return res.json(await create(deps, { hash: body.hash, idToken }));
    }
    if (req.path.endsWith('/handoff/redeem')) return res.json(await redeem(deps, { secret: body.secret }));
    if (req.path.endsWith('/account/close')) {
      const idToken = (req.get('Authorization') || '').replace(/^Bearer /, '');
      return res.json(await closeAccount(accountDeps, { idToken, reasons: body.reasons, comment: body.comment }));
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
