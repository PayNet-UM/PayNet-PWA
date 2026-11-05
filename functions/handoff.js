// Sign-in hand-off for the iPhone home-screen app, kept free of Firebase so it can be tested on its own.
//
// Why: an app added to the iPhone home screen opens Google's sign-in in a separate Safari window, which can't hand
// the session back. So the app makes a random secret, keeps it, and opens Safari with only the secret's SHA-256 hash.
// After Google sign-in in Safari, that page calls create(hash, idToken). The app then calls redeem(secret): the server
// hashes it, finds the record, deletes it, and returns a one-time Firebase custom token for the same user.
// The secret never leaves the app until redeem, each record works once, and it expires after a few minutes.
import { createHash } from 'node:crypto';

export const TTL_MS = 3 * 60 * 1000;
const HASH = /^[a-f0-9]{64}$/;
const SECRET = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url without padding

export const sha256hex = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

// deps: { verifyIdToken(token) -> {uid, email, email_verified}, store: { create(id, data), peek(id) -> data|null, take(id) -> data|null }, mintToken(uid) -> string, now() }
export async function create(deps, { hash, idToken }) {
  if (typeof hash !== 'string' || !HASH.test(hash)) throw new HttpError(400, 'bad-request', 'Missing or invalid hand-off code.');
  if (typeof idToken !== 'string' || idToken.length < 20) throw new HttpError(401, 'unauthenticated', 'Sign in first.');
  let user;
  try { user = await deps.verifyIdToken(idToken); } catch { throw new HttpError(401, 'unauthenticated', 'Your sign-in has expired. Sign in again.'); }
  if (!user.email_verified) throw new HttpError(403, 'unverified', 'Verify your email address first.');
  const now = deps.now();
  try {
    await deps.store.create(hash, { uid: user.uid, email: user.email || null, createdAt: now, expiresAt: now + TTL_MS });
  } catch (e) {
    if (e && e.code === 'already-exists') {
      // The same person reloading the Safari page is fine; a different account can't take over the code.
      const rec = await deps.store.peek(hash);
      if (rec && rec.uid === user.uid) return { ok: true, email: user.email || null };
      throw new HttpError(409, 'used', 'This sign-in link was already used. Start again from the app.');
    }
    throw e;
  }
  return { ok: true, email: user.email || null };
}

export async function redeem(deps, { secret }) {
  if (typeof secret !== 'string' || !SECRET.test(secret)) throw new HttpError(400, 'bad-request', 'Missing or invalid hand-off secret.');
  const id = sha256hex(secret);
  const rec = await deps.store.peek(id);
  if (!rec) return { status: 'pending' };
  if (deps.now() > rec.expiresAt) { await deps.store.take(id); throw new HttpError(410, 'expired', 'That sign-in took too long. Start again from the app.'); }
  // Make the token first, then use up the record: if making the token fails, the app can still try again.
  const token = await deps.mintToken(rec.uid);
  if (!(await deps.store.take(id))) return { status: 'pending' }; // someone else just used it
  return { status: 'ready', token, email: rec.email };
}
