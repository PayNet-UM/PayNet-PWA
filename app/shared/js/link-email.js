// "Add another email": a student adds a second Google account (e.g. their siswa email) so either email opens the
// SAME +Onz account. Firebase allows only one Google account per sign-in, so the server keeps the extra emails
// (functions/email-alias.js) and copies them to the profile as linkedEmails, which HEP can search.
// - Adding: the student proves they own the other email by signing in with it in a SEPARATE Firebase sign-in, so
//   their own session stays as it is. The server checks both sign-ins and saves the email.
// - Signing in with it later: the new sign-in has no profile, so the app asks the server, which hands back a one-time
//   sign-in for the real account (trySignInByAlias).
// Demo mode has no server, so the demo Firebase stands in for it.
import * as D from './data.js';

const norm = (e) => String(e || '').trim().toLowerCase();

// The account's own email first, then the ones added.
export function signInEmails(app) {
  const own = norm(app.profile?.email || app.ctx?.email || app.backend?.auth?.currentUser?.email);
  return { own, added: [...new Set((app.profile?.linkedEmails || []).map(norm))].filter((e) => e && e !== own) };
}

// Friendly messages for Google window errors; server errors already carry their own message.
export function linkErrorText(err) {
  const c = err && err.code;
  if (c === 'auth/account-exists-with-different-credential' || c === 'auth/email-already-in-use')
    return 'That email already has its own +Onz sign-in. Ask the Admin team to help you combine them.';
  if (c === 'auth/popup-blocked') return 'Your browser blocked the Google window. Allow pop-ups for this site, then try again.';
  if (c && String(c).startsWith('auth/')) return 'Couldn’t add that account. Try again in Chrome or Safari.';
  return (err && err.message) || 'Couldn’t add that account. Try again.';
}

// Adds another Google account. demoEmail is only used in Demo mode. Returns the added email, or null if the person
// closed the Google window.
export async function addSignInEmail(app, demoEmail = '') {
  const { sdk, auth, mode } = app.backend;
  if (mode === 'demo') return (await sdk._demoAddEmail(auth.currentUser.uid, demoEmail)).email;
  // A second, separate Firebase sign-in, so proving the other email doesn't sign the student out of their own.
  if (!app.backend.secondAuth) app.backend.secondAuth = sdk.getAuth(sdk.initializeApp(app.backend.config, 'add-email'));
  const second = app.backend.secondAuth;
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let cred;
  try { cred = await sdk.signInWithPopup(second, provider); }
  catch (err) { if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return null; throw err; }
  try {
    const otherToken = await cred.user.getIdToken();
    const idToken = await auth.currentUser.getIdToken();
    return (await D.addSignInEmail(idToken, otherToken)).email;
  } finally { await sdk.signOut(second).catch(() => {}); }
}

export async function removeSignInEmail(app, email) {
  const { sdk, auth, mode } = app.backend;
  if (mode === 'demo') return sdk._demoRemoveEmail(auth.currentUser.uid, email);
  return D.removeSignInEmail(await auth.currentUser.getIdToken(), email);
}

// A sign-in with no +Onz profile: if it's an email a student added, switch to that student's account.
// Returns true when the switch started (the app then signs in again as the real account).
export async function trySignInByAlias(app, user) {
  const { sdk, auth, mode } = app.backend;
  if (mode !== 'live') return false;
  try {
    const r = await D.signInByEmailAlias(await user.getIdToken());
    if (r.status !== 'ready') return false;
    await sdk.signInWithCustomToken(auth, r.token);
    return true;
  } catch { return false; } // server not reachable: carry on to sign-up, which explains a taken matric number
}

// Removes the brand-new, empty sign-in someone just made with a second email (no +Onz profile yet), so that email
// can be added to their real account instead. Only for accounts without a profile.
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
