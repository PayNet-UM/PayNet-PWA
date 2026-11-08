// "Delete my account", kept free of Firebase so it can be tested on its own (tests/account.mjs).
//
// Students delete their own account straight away: their personal data is deleted, programme records that HEP and
// businesses still need (vouchers, welfare requests, archived visits) are made anonymous, the sign-in is removed,
// and HEP gets an anonymous note with the reasons they gave (accountClosures, read in the HEP dashboard).
// Businesses send a closing request instead: HEP settles their vouchers and PayNet listing first, then closes it.
import { HttpError } from './handoff.js';

export const REASONS = {
  'not-useful': 'I don’t find it useful',
  'not-using': 'I don’t use it often enough',
  'rewards': 'Not enough rewards or offers',
  'privacy': 'Privacy or data concerns',
  'problems': 'Sign-in problems or bugs',
  'too-many-alerts': 'Too many sounds or notifications',
  'leaving': 'I’m graduating or leaving UM',
  'few-students': 'Not enough students use it',
  'business-closing': 'My business is closing or moving',
  'other': 'Something else',
  'prefer-not': 'I’d rather not say',
};
export const COMMENT_MAX = 500;
export const DELETED = 'deleted-account'; // stands in for the uid and name in records that are kept
export const DELETED_NAME = 'Deleted account';

export function cleanAnswers({ reasons, comment }) {
  if (!Array.isArray(reasons) || reasons.length < 1 || reasons.length > Object.keys(REASONS).length
    || !reasons.every((r) => typeof r === 'string' && r in REASONS)) {
    throw new HttpError(400, 'bad-request', 'Choose at least one reason.');
  }
  if (comment != null && typeof comment !== 'string') throw new HttpError(400, 'bad-request', 'Invalid comment.');
  const text = (comment || '').trim();
  if (text.length > COMMENT_MAX) throw new HttpError(400, 'bad-request', `Keep the comment under ${COMMENT_MAX} characters.`);
  return { reasons: [...new Set(reasons)], comment: text };
}

// What to remove for a student. The college leaderboard drops their points (syncLeagueStudent) once users/{uid}
// is gone. Paths are Firestore document paths; queries name a collection, a field equal to
// the student's uid, and whether matching documents are deleted or made anonymous with `patch`.
export function erasePlan(uid, profile = {}) {
  const docs = [`presence/${uid}`, `surveys/${uid}`, `referrals/${uid}`];
  if (profile.matric) docs.push(`matrics/${profile.matric}`);
  if (profile.referralCode) docs.push(`referralCodes/${profile.referralCode}`);
  if (profile.username) docs.push(`usernames/${profile.username}`);
  return {
    docs,
    // Deleted with everything under them (points history, app days, waves sent to them).
    trees: [`waves/${uid}`, `users/${uid}`],
    // Archived check-ins from the first pilot version: one document per student and shop, named uid_shop.
    prefixes: [{ collection: 'checkins', prefix: `${uid}_` }],
    queries: [
      { collection: 'friendships', field: 'from', action: 'delete' },
      { collection: 'friendships', field: 'to', action: 'delete' },
      { collection: 'referrals', field: 'inviterUid', action: 'delete' },
      { collection: 'missionClaims', field: 'uid', action: 'delete' },
      { collection: 'vouchers', field: 'studentUid', action: 'anonymise', patch: { studentUid: DELETED, studentName: DELETED_NAME } },
      { collection: 'liveDealClaims', field: 'studentUid', action: 'anonymise', patch: { studentUid: DELETED, studentName: DELETED_NAME } },
      { collection: 'welfareRequests', field: 'studentUid', action: 'anonymise', patch: { studentUid: DELETED, name: DELETED_NAME, reason: '' } },
      { collection: 'visits', field: 'uid', action: 'anonymise', patch: { uid: DELETED } },
    ],
  };
}

// deps: { verifyIdToken(token) -> {uid, email}, getProfile(uid) -> data|null, getMerchant(uid) -> data|null,
//   addClosure(id|null, data) -> throws {code:'already-exists'} on a repeated request, erase(uid, plan),
//   deleteAuthUser(uid), now() }
export async function closeAccount(deps, { idToken, reasons, comment }) {
  if (typeof idToken !== 'string' || idToken.length < 20) throw new HttpError(401, 'unauthenticated', 'Sign in first.');
  let user;
  try { user = await deps.verifyIdToken(idToken); } catch { throw new HttpError(401, 'unauthenticated', 'Your sign-in has expired. Sign in again.'); }
  const answers = cleanAnswers({ reasons, comment });
  const profile = await deps.getProfile(user.uid);
  const role = profile?.role || 'student';
  if (profile?.disabled) throw new HttpError(403, 'blocked', 'This account is blocked. Email admin@addonz.my to close it.');
  const base = { role, ...answers, createdAt: deps.now(), seen: false };

  if (role === 'merchant') {
    const shop = await deps.getMerchant(user.uid);
    try {
      await deps.addClosure(`request_${user.uid}`, { ...base, kind: 'request', status: 'open', uid: user.uid,
        name: profile.name || '', email: user.email || profile.email || '', businessName: shop?.name || '' });
    } catch (e) {
      if (e && e.code === 'already-exists') return { ok: true, kind: 'request', already: true };
      throw e;
    }
    return { ok: true, kind: 'request' };
  }
  if (role !== 'student') throw new HttpError(403, 'not-allowed', 'HEP accounts are closed by another HEP admin.');

  // The note to HEP goes first, so a failure part-way still leaves a trace of the request.
  await deps.addClosure(null, { ...base, kind: 'deleted', college: profile?.college || '', faculty: profile?.faculty || '',
    points: Number(profile?.points) || 0 });
  await deps.erase(user.uid, erasePlan(user.uid, profile || {}));
  await deps.deleteAuthUser(user.uid);
  return { ok: true, kind: 'deleted' };
}
