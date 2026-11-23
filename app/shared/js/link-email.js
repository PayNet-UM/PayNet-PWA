// "Add another email": a signed-in student links a second Google account (e.g. their siswa email) to the SAME
// +Onz account, so either email signs in to it. Uses Firebase's own account linking; the list of linked emails is
// copied to the profile (linkedEmails) so HEP can find the student by either email. Rules check it against the token.
import * as D from './data.js';

// Emails that sign in to this account, from Firebase (primary email first).
export function signInEmails(user) {
  const list = [user?.email, ...(user?.providerData || []).map((p) => p.email)].filter(Boolean).map((e) => e.toLowerCase());
  return [...new Set(list)];
}

// Friendly messages for the link errors people can actually hit.
export function linkErrorText(err) {
  const c = err && err.code;
  if (c === 'auth/credential-already-in-use' || c === 'auth/email-already-in-use' || c === 'auth/account-exists-with-different-credential')
    return 'That Google account already has its own +Onz sign-in. Sign in with it, tap “I already have an account” on the sign-up screen to remove the empty one, then add it here again. If it’s a full account, ask the Admin team.';
  if (c === 'auth/provider-already-linked') return 'This account already has a Google sign-in. To add a different Google account, sign out of Google in your browser first, then try again.';
  if (c === 'auth/requires-recent-login') return 'For your safety, sign out and sign in again, then add the email.';
  if (c === 'auth/popup-blocked') return 'Your browser blocked the Google window. Allow pop-ups for this site, then try again.';
  return 'Couldn’t add that account. Try again in Chrome or Safari.';
}

// Links another Google account. backend = app.backend; demoEmail is only used in Demo mode.
// Returns the updated list of sign-in emails, or null if the person closed the Google window.
export async function linkGoogleAccount(app, demoEmail = '') {
  const { sdk, auth, mode } = app.backend;
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (mode === 'demo') provider.demoEmail = demoEmail;
  try { await sdk.linkWithPopup(auth.currentUser, provider); }
  catch (err) { if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return null; throw err; }
  await auth.currentUser.getIdToken(true); // the new email must be in the token before the rules accept it
  const emails = signInEmails(auth.currentUser);
  await D.saveLinkedEmails(app.ctx, emails);
  return emails;
}

// Removes the brand-new, empty sign-in someone just made with a second email (no +Onz profile yet), so that email
// can be linked to their real account instead. Only for accounts without a profile.
export async function removeEmptySignIn(app) {
  const { sdk, auth } = app.backend;
  const user = auth.currentUser;
  if (!user) return;
  if (await D.getProfile(app.ctx).catch(() => null)) throw new Error('This account already has a profile, so it can’t be removed here.');
  try { await user.delete(); } catch (err) {
    if (err?.code === 'auth/requires-recent-login') { await sdk.signOut(auth); throw new Error('Sign in with that email once more, then tap “I already have an account” again.'); }
    throw err;
  }
}
