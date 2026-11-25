// "Add another email" (Me > Sign-in emails), kept free of Firebase so it can be tested on its own (tests/email-alias.mjs).
//
// Why not Firebase account linking: Firebase allows only one Google account per sign-in, so a student who signed up
// with Google can't link a second Google account (e.g. Gmail + siswa email). Instead, the server keeps a list of
// extra emails, emailAliases/{email} -> { uid }, that the app can't read or write (firestore.rules denies it):
// - addEmail: the student, signed in as A, proves they own email B by signing in with it in a Google window. If B has
//   no +Onz profile, the server saves B -> A and removes B's empty sign-in.
// - aliasSignIn: someone signed in as B with no profile asks the server; if B -> A, it returns a one-time sign-in
//   token for A (the same kind the iPhone hand-off uses) and removes B's empty sign-in again.
// - removeEmail: the student removes an email they added.
// Only a student's own, verified emails can be added, and an email with its own +Onz account is never taken over.
import { HttpError } from './handoff.js';

export const MAX_EXTRA_EMAILS = 4; // plus the account's own email: 5 in all
export const normEmail = (e) => String(e || '').trim().toLowerCase();

async function verify(deps, token, what) {
  if (typeof token !== 'string' || token.length < 20) throw new HttpError(401, 'unauthenticated', what === 'other' ? 'Sign in with the email you want to add.' : 'Sign in first.');
  let user;
  try { user = await deps.verifyIdToken(token); } catch { throw new HttpError(401, 'unauthenticated', 'Your sign-in has expired. Sign in again.'); }
  if (!user.email || !user.email_verified) throw new HttpError(403, 'unverified', 'That email isn’t verified yet.');
  if (user.email.includes('/')) throw new HttpError(400, 'bad-email', 'That email can’t be used here.');
  return { uid: user.uid, email: normEmail(user.email) };
}

// deps: { verifyIdToken(token) -> {uid, email, email_verified}, getProfile(uid) -> data|null, getAlias(email) -> {uid}|null,
//   saveAlias(email, uid, max) -> 'added' | 'already' | 'taken' | 'full', removeAlias(email, uid) -> boolean,
//   deleteAuthUser(uid), mintToken(uid) -> string }
export async function addEmail(deps, { idToken, otherToken }) {
  const me = await verify(deps, idToken, 'me');
  const other = await verify(deps, otherToken, 'other');
  if (other.uid === me.uid || other.email === me.email) throw new HttpError(400, 'same', 'That’s the email you’re signed in with. Choose a different Google account.');
  const profile = await deps.getProfile(me.uid);
  if (!profile || profile.role !== 'student') throw new HttpError(403, 'not-allowed', 'Only student accounts can add another email.');
  if (profile.disabled) throw new HttpError(403, 'blocked', 'This account is blocked.');
  if (await deps.getProfile(other.uid)) {
    throw new HttpError(409, 'has-account', 'That email already has its own +Onz account. Sign in with it and delete that account first (Me > Delete my account), or ask the Admin team.');
  }
  const result = await deps.saveAlias(other.email, me.uid, MAX_EXTRA_EMAILS);
  if (result === 'taken') throw new HttpError(409, 'taken', 'That email is already added to another +Onz account.');
  if (result === 'full') throw new HttpError(400, 'full', `You can add up to ${MAX_EXTRA_EMAILS} other emails. Remove one first.`);
  // The empty sign-in made while proving the email isn't needed any more (it has no profile, checked above).
  await deps.deleteAuthUser(other.uid).catch(() => {});
  return { ok: true, email: other.email, already: result === 'already' };
}

export async function aliasSignIn(deps, { idToken }) {
  const me = await verify(deps, idToken, 'me');
  const alias = await deps.getAlias(me.email);
  if (!alias || alias.uid === me.uid) return { status: 'none' };
  // Never move someone who has their own +Onz account, and only ever sign in to a student account.
  if (await deps.getProfile(me.uid)) return { status: 'none' };
  const target = await deps.getProfile(alias.uid);
  if (!target || target.role !== 'student') return { status: 'none' };
  const token = await deps.mintToken(alias.uid);
  await deps.deleteAuthUser(me.uid).catch(() => {}); // the empty sign-in; harmless if it stays
  return { status: 'ready', token };
}

export async function removeEmail(deps, { idToken, email }) {
  const me = await verify(deps, idToken, 'me');
  const target = normEmail(email);
  if (!target || target.length > 254 || target.includes('/')) throw new HttpError(400, 'bad-request', 'Choose an email to remove.');
  if (target === me.email) throw new HttpError(400, 'primary', 'This is the account’s own email, so it can’t be removed.');
  if (!(await deps.removeAlias(target, me.uid))) throw new HttpError(404, 'not-found', 'That email isn’t added to this account.');
  return { ok: true };
}
