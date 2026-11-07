// Sign in, sign up, email verification and first-time profile. Shared by both websites:
// app.site is 'client' (students and merchants) or 'admin' (the HEP dashboard).
import * as D from '../data.js';
import { $, $$, esc, icon, toast, busy, errText, chevron, sheet, closeSheet } from '../ui.js';
import { mppBootstrapEmails, firebaseConfig, siteUrls } from '../firebase-config.js';
import { langToggleHTML, tr } from '../i18n.js';
const MPP_EMAIL = mppBootstrapEmails[0];
const isAdminSite = (app) => app.site === 'admin';

function frame(app, inner) {
  document.body.classList.remove('mpp-mode');
  const admin = isAdminSite(app);
  document.body.innerHTML = `<div class="auth">
    <aside class="art">
      <a class="brand" style="color:#fff"><img class="onz-brand-logo" src="icons/icon-192.png" alt="+Onz" width="48" height="48"></a>
      <div><h2>${admin ? 'HEP admin dashboard' : 'Add on to campus life.'}</h2>
        <p>${admin ? 'Review merchants, approve deals and report on the +Onz programme.' : 'Shops, events, check-ins and rewards in one place.'}</p></div>
      <p class="faint" style="color:#8A9AB2">Universiti Malaya · Hal Ehwal Pelajar · PayNet Digital Campus 5.0</p>
      ${chevron('#29B6F6', 16)}
    </aside>
    <div class="form-side">${langToggleHTML('auth-lang')}${inner}</div></div>`;
  app.shellRole = null;
  if (app.addDemoRibbon) app.addDemoRibbon();
}

const GOOGLE_G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

// ------------------------------------------------------------- device checks for Google sign-in
const UA = navigator.userAgent || '';
// Google refuses sign-in inside apps' built-in browsers (WhatsApp, Instagram, Telegram, Facebook, TikTok, LINE…).
export const inAppBrowser = () => /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Telegram|TikTok|musical_ly|BytedanceWebview|Snapchat|Twitter|MicroMessenger|WhatsApp|GSA\/|; wv\)/i.test(UA)
  || (/iPhone|iPad|iPod/.test(UA) && !/Safari\//.test(UA) && !/CriOS|FxiOS|EdgiOS/.test(UA));
const isPhone = () => /Android|iPhone|iPad|iPod|Mobile/i.test(UA) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(UA));
const displayStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
// A sign-in page opened from the home-screen app can report itself as standalone on iPhone, so a hand-off code wins.
const isStandalone = () => !handoffHash() && displayStandalone();
const isIOS = () => /iPhone|iPad|iPod/.test(UA) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(UA));

function openInBrowserSheet() {
  const url = location.origin + location.pathname;
  const android = /Android/i.test(UA);
  const el = sheet(`<h2>Open in ${android ? 'Chrome' : 'Safari'} to sign in</h2>
    <p class="muted">You opened +Onz inside another app (like WhatsApp, Instagram or Telegram). Google doesn’t allow sign-in there.</p>
    <div class="stack" style="margin-top:14px">
      ${android ? `<a class="btn primary block" href="intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;end">Open in Chrome</a>` : ''}
      <button class="btn block ${android ? '' : 'primary'}" id="copy-link">Copy the link</button>
      <p class="faint">${android ? 'Or tap ⋮ at the top right and choose “Open in browser”.' : 'Then open Safari, paste it in the address bar and sign in. Or tap ••• / the share button and choose “Open in Safari”.'}</p>
      <p class="faint">You can also use “Use email and password instead” below.</p>
    </div>`);
  $('#copy-link', el).onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link copied. Paste it in your browser.'); } catch { prompt(tr('Copy this link'), url); } };
}

const REDIRECT_KEY = 'kk-google-redirect';
const NEXT_KEY = 'kk-google-next';
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } }, del: (k) => { try { localStorage.removeItem(k); } catch { /* */ } } };
// The installed app (added to the home screen) is the hard case: phones handle Google's sign-in window differently
// there, and the two Firebase methods (popup, full-page redirect) each fail on some phones. So the app tries one,
// and if it doesn't finish, the next tap uses the other. If both fail it offers email and password.
function standaloneOrder() { return isIOS() ? ['popup', 'redirect'] : ['redirect', 'popup']; }
function nextMethod() {
  const order = standaloneOrder(); const saved = ls.get(NEXT_KEY);
  return order.includes(saved) ? saved : order[0];
}
function markFailed(method) {
  const order = standaloneOrder(); const tried = (ls.get(NEXT_KEY + '-tried') || '').split(',').filter(Boolean);
  if (!tried.includes(method)) tried.push(method);
  ls.set(NEXT_KEY + '-tried', tried.join(','));
  const other = order.find((m) => !tried.includes(m));
  if (other) { ls.set(NEXT_KEY, other); return 'retry'; }
  ls.del(NEXT_KEY); ls.del(NEXT_KEY + '-tried'); return 'both';
}
export function googleWorked() { ls.del(NEXT_KEY + '-tried'); ls.del(REDIRECT_KEY); }
function standaloneHelp(kind) {
  if (kind === 'retry') return toast('Google sign-in didn’t finish. Tap “Continue with Google” again: the app will try another way.', true);
  const el = sheet(`<h2>Google sign-in is blocked in the installed app</h2>
    <p class="muted">On some phones, Google’s sign-in window can’t hand back to an app added to the home screen.</p>
    <div class="stack" style="margin-top:14px">
      <button class="btn primary block" id="sa-browser">Sign in through the browser</button>
      <button class="btn block" id="sa-email">Use email and password instead</button>
      <button class="btn block" id="sa-setpw">I signed up with Google: set a password</button>
      <p class="faint">${isIOS() ? 'Or sign in from Safari instead of the home-screen icon. On iPhone the installed app keeps its own sign-in, separate from Safari.' : 'Or open the site in Chrome and sign in there: the installed app shares Chrome’s sign-in.'}</p>
    </div>`);
  $('#sa-browser', el).onclick = () => { closeSheet(); handoffStart(window.__kkApp); };
  $('#sa-setpw', el).onclick = () => { closeSheet(); setPasswordSheet(window.__kkApp); };
  $('#sa-email', el).onclick = () => { closeSheet(); const box = document.getElementById('email-box'); if (box) { box.open = true; box.scrollIntoView({ block: 'center' }); box.querySelector('input')?.focus(); } };
}
// ------------------------------------------------------------- sign-in hand-off (home-screen app <-> browser)
// The home-screen app makes a random secret and keeps it; the browser gets only its SHA-256 hash in the address.
// After Google sign-in there, the browser registers the hash with the server (functions/handoff.js). The app then
// trades its secret for a one-time sign-in token. See docs/DEPLOY.md for the server set-up.
const HANDOFF_KEY = 'kk-handoff';
const HANDOFF_PARAM = 'handoff';
const HANDOFF_MAX_MS = 5 * 60 * 1000;
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// SHA-256, synchronous on purpose: iPhone only opens a new window straight from a tap, with no waiting in between.
function sha256hex(text) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const bytes = [...new TextEncoder().encode(text)]; const bitLen = bytes.length * 8;
  bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n)); const W = new Array(64);
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3); const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
async function api(path, body, idToken) {
  const res = await fetch('/api/handoff/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: 'Bearer ' + idToken } : {}) }, body: JSON.stringify(body) });
  let data = {}; try { data = await res.json(); } catch { /* not JSON: server not deployed */ }
  if (!res.ok) { const e = new Error(data.message || `The sign-in server didn’t answer (${res.status}).`); e.status = res.status; e.code = data.error; throw e; }
  return data;
}
// In the browser: the hash this page was opened with, kept across Google's redirect.
export function handoffHash() {
  try {
    const q = new URLSearchParams(location.search).get(HANDOFF_PARAM);
    if (q && /^[a-f0-9]{64}$/.test(q)) { sessionStorage.setItem(HANDOFF_KEY + '-hash', q); sessionStorage.setItem(HANDOFF_KEY + '-at', String(Date.now())); return q; }
    // Kept across Google's redirect, but never for long, so an old code can't linger.
    const at = Number(sessionStorage.getItem(HANDOFF_KEY + '-at')) || 0;
    if (Date.now() - at > HANDOFF_MAX_MS) { sessionStorage.removeItem(HANDOFF_KEY + '-hash'); sessionStorage.removeItem(HANDOFF_KEY + '-at'); return null; }
    return sessionStorage.getItem(HANDOFF_KEY + '-hash');
  } catch { return null; }
}
const handoffCode = (hash) => hash.slice(0, 6).toUpperCase();
let polling = null;
// The browser page must be on a DIFFERENT address from the installed app: iPhone pulls a link to the app's own
// address back into the app (where Google sign-in can't finish). Firebase Hosting serves the site on two
// addresses (<project>.web.app and <project>.firebaseapp.com), so the hand-off page uses the other one.
function handoffOrigin() {
  const id = firebaseConfig && firebaseConfig.projectId; const host = location.hostname;
  if (!id || /REPLACE/.test(id) || host === 'localhost' || host === '127.0.0.1') return location.origin;
  return host === `${id}.firebaseapp.com` ? `https://${id}.web.app` : `https://${id}.firebaseapp.com`;
}
const handoffUrl = (hash) => `${handoffOrigin()}/?${HANDOFF_PARAM}=${hash}`;
// Must stay synchronous from the tap to window.open, or iPhone blocks the new window.
function handoffStart(app) {
  // Reuse an unfinished attempt, so a second tap opens the same code the app is already waiting for.
  let h = handoffPending();
  if (!h) { const secret = b64url(crypto.getRandomValues(new Uint8Array(32))); h = { secret, hash: sha256hex(secret), at: Date.now() }; ls.set(HANDOFF_KEY, JSON.stringify(h)); }
  const hash = h.hash;
  // From a home-screen app, iPhone opens a new window in Safari, where Google sign-in works.
  try { window.open(handoffUrl(hash), '_blank', 'noopener'); } catch { /* blocked: the sheet has a link */ }
  handoffWait(app);
}
function handoffPending() {
  try { const h = JSON.parse(ls.get(HANDOFF_KEY) || 'null'); return h && h.hash && Date.now() - h.at < HANDOFF_MAX_MS ? h : null; } catch { return null; }
}
function handoffWait(app) {
  const h = handoffPending(); if (!h) return;
  const el = sheet(`<h2>Finish signing in in Safari</h2>
    <p class="muted">Sign in with Google in Safari. Then come back to this app: you’ll be signed in automatically.</p>
    <div class="row" style="margin-top:14px;gap:10px;align-items:center"><span class="spinner" aria-hidden="true"></span><span class="faint" id="ho-status">Waiting for Safari…</span></div>
    <p style="margin-top:12px">Your code: <span class="code-text">${esc(handoffCode(h.hash))}</span></p>
    <div class="stack" style="margin-top:14px"><a class="btn primary block" id="ho-open" href="${esc(handoffUrl(h.hash))}" target="_blank" rel="noopener">Open Safari</a><button class="btn ghost block" id="ho-cancel">Cancel</button></div>
    <p class="faint" style="margin-top:10px">Safari didn’t open? Tap “Open Safari”.</p>`);
  $('#ho-cancel', el).onclick = () => { ls.del(HANDOFF_KEY); stopPoll(); closeSheet(); };
  startPoll(app);
}
function stopPoll() { if (polling) { clearInterval(polling.timer); removeEventListener('visibilitychange', polling.vis); removeEventListener('focus', polling.vis); polling = null; } }
function startPoll(app) {
  stopPoll();
  let busyNow = false;
  const tick = async () => {
    const h = handoffPending();
    if (!h) { stopPoll(); if (ls.get(HANDOFF_KEY)) { ls.del(HANDOFF_KEY); closeSheet(); toast('That sign-in took too long. Tap “Continue with Google” to try again.', true); } return; }
    if (busyNow || document.visibilityState === 'hidden') return;
    busyNow = true;
    try {
      const r = await api('redeem', { secret: h.secret });
      if (r.status === 'ready') {
        ls.del(HANDOFF_KEY); stopPoll();
        await app.backend.sdk.signInWithCustomToken(app.backend.auth, r.token);
        closeSheet(); toast(r.email ? `Signed in as ${r.email}` : 'Signed in.');
      }
    } catch (e) {
      const st = document.getElementById('ho-status');
      if (e.code === 'expired' || e.status === 404) { ls.del(HANDOFF_KEY); stopPoll(); closeSheet(); toast(e.status === 404 ? 'The sign-in server isn’t set up yet. Use email and password for now.' : e.message, true); }
      else if (e.code === 'setup') { stopPoll(); if (st) st.textContent = e.message; }
      else if (e.status) { if (st) st.textContent = `${e.message} Retrying…`; }
      else if (e.code && String(e.code).startsWith('auth/')) { if (st) st.textContent = `Couldn’t finish signing in (${e.code}). Retrying…`; }
      else if (st) st.textContent = 'Can’t reach the server. Retrying…';
    } finally { busyNow = false; }
  };
  const vis = () => { if (document.visibilityState === 'visible') tick(); };
  polling = { timer: setInterval(tick, 2500), vis };
  addEventListener('visibilitychange', vis); addEventListener('focus', vis);
  tick();
}
// At start-up in the home-screen app: iPhone may reload the app while the person is in Safari, so carry on waiting.
export function resumeHandoff(app) {
  if (app.backend.mode !== 'live' || !handoffPending() || app.backend.auth.currentUser) return;
  handoffWait(app);
}
// In the browser, once signed in: register the hash so the home-screen app can collect the sign-in.
export async function renderHandoffDone(app, user, hash, isAdmin = false) {
  const leave = () => { try { sessionStorage.removeItem(HANDOFF_KEY + '-hash'); sessionStorage.removeItem(HANDOFF_KEY + '-at'); } catch { /* */ } history.replaceState(null, '', location.pathname); location.reload(); };
  // Never hand over an admin session through a link.
  if (isAdmin) {
    frame(app, `<div><a class="brand"><img class="onz-brand-logo" src="icons/icon-192.png" alt="+Onz" width="48" height="48"></a></div>
      <div><h1>Not available for HEP accounts</h1><p class="lede">For security, HEP accounts can't sign in to the home-screen app this way. Use email and password in the app, or use +Onz here in Safari.</p>
      <button class="btn block" id="ho-here" style="margin-top:14px">Continue in Safari</button></div>`);
    $('#ho-here').onclick = leave;
    return;
  }
  // A link alone must never sign anyone in: someone else could have sent it. Ask first.
  frame(app, `<div><a class="brand"><img class="onz-brand-logo" src="icons/icon-192.png" alt="+Onz" width="48" height="48"></a></div>
    <div id="ho-ask"><h1>Sign in to the +Onz app?</h1>
      <p class="lede">You're signed in as <b>${esc(user.email || 'this account')}</b>. Continue only if you just tapped Continue with Google in the +Onz app on this phone, and it shows this code:</p>
      <p style="margin:14px 0;text-align:center"><span class="code-text">${esc(handoffCode(hash))}</span></p>
      <p class="faint">If you didn't start this, or someone sent you this link, tap "This wasn't me". Otherwise they could get into your account.</p>
      <button class="btn primary block" id="ho-yes" style="margin-top:14px">Yes, sign in to the app</button>
      <button class="btn ghost block" id="ho-no" style="margin-top:8px">This wasn't me</button></div>`);
  $('#ho-no').onclick = leave;
  await new Promise((resolve) => { $('#ho-yes').onclick = resolve; });
  frame(app, `<div><a class="brand"><img class="onz-brand-logo" src="icons/icon-192.png" alt="+Onz" width="48" height="48"></a></div>
    <div id="ho-box"><h1>Finishing sign-in…</h1><p class="lede">One moment.</p></div>`);
  const box = $('#ho-box');
  try {
    await api('create', { hash }, await user.getIdToken());
    try { sessionStorage.removeItem(HANDOFF_KEY + '-hash'); sessionStorage.removeItem(HANDOFF_KEY + '-at'); } catch { /* */ }
    history.replaceState(null, '', location.pathname);
    box.innerHTML = `<h1>You’re signed in</h1><p class="lede">Go back to the +Onz app on your home screen. It will open signed in as <b>${esc(user.email || 'you')}</b>.</p>
      <p class="faint" style="margin-top:14px">You can close this Safari window. Tap “Done” at the top, or switch apps.</p>
      <button class="btn block" id="ho-here" style="margin-top:14px">Keep using +Onz in Safari instead</button>`;
    $('#ho-here').onclick = () => location.reload();
  } catch (e) {
    try { sessionStorage.removeItem(HANDOFF_KEY + '-hash'); } catch { /* */ }
    box.innerHTML = `<h1>Couldn’t finish signing in to the app</h1><p class="lede">${esc(e.message)}</p>
      <p class="faint" style="margin-top:14px">Go back to the app and tap “Continue with Google” again.</p>
      <button class="btn block" id="ho-here" style="margin-top:14px">Use +Onz in Safari instead</button>`;
    $('#ho-here').onclick = () => { history.replaceState(null, '', location.pathname); location.reload(); };
  }
}

// Lets a student who signed up with Google add a password to the SAME account (Firebase links it on reset),
// so they can sign in inside the iPhone home-screen app, where Google sign-in can't finish.
function setPasswordSheet(app) {
  const { sdk, auth } = app.backend;
  const el = sheet(`<h2>Set a password for your account</h2>
    <p class="muted">Enter the email you use with Google. We’ll email you a link to choose a password. Open it, set the password, then come back here and sign in with email and password.</p>
    <form id="spw" class="stack" style="margin-top:14px"><label class="field">Email<input name="email" type="email" autocomplete="email" required></label>
      <button class="btn primary block">Email me the link</button></form>
    <p class="faint" style="margin-top:10px">It’s the same account, so your points, avatar and history stay the same. You can still use Google in Safari.</p>`);
  $('#spw', el).onsubmit = (e) => {
    e.preventDefault(); const email = e.target.email.value.trim();
    busy($('button', e.target), async () => {
      try { await sdk.sendPasswordResetEmail(auth, email); closeSheet(); toast('Link sent. Check your inbox (and spam), set a password, then sign in here.'); }
      catch (err) { toast(errText(err), true); }
    });
  };
}
async function googleSignIn(app, demoEmail) {
  window.__kkApp = app;
  const { sdk, auth, mode } = app.backend;
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (mode === 'demo') provider.demoEmail = demoEmail;
  if (mode === 'live' && inAppBrowser()) return openInBrowserSheet();
  const standalone = mode === 'live' && isStandalone();
  const redirect = () => { ls.set(REDIRECT_KEY, JSON.stringify({ at: Date.now(), standalone })); return sdk.signInWithRedirect(auth, provider).catch((err) => { ls.del(REDIRECT_KEY); if (standalone) standaloneHelp(markFailed('redirect')); else toast(googleErrorText(err), true); }); };
  const popup = async () => {
    const t0 = Date.now();
    try { await sdk.signInWithPopup(auth, provider); googleWorked(); }
    catch (err) {
      if (mode === 'live' && ['auth/popup-blocked', 'auth/operation-not-supported-in-environment', 'auth/web-storage-unsupported'].includes(err.code)) {
        if (standalone) { markFailed('popup'); return redirect(); }
        return redirect();
      }
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // In the installed app a popup that can't hand back looks like the person closed it, after a while.
        if (standalone && Date.now() - t0 > 6000) standaloneHelp(markFailed('popup'));
        return;
      }
      if (standalone) return standaloneHelp(markFailed('popup'));
      toast(googleErrorText(err), true);
    }
  };
  if (standalone && isIOS()) return handoffStart(app);
  if (standalone) return nextMethod() === 'redirect' ? redirect() : popup();
  // Phones in the browser: a full-page redirect is more reliable than a popup (mobile browsers often lose the popup tab).
  if (mode === 'live' && isPhone()) return redirect();
  return popup();
}
export function googleErrorText(err) {
  const c = err && err.code;
  if (c === 'auth/unauthorized-domain') return 'This web address isn’t authorised for Google sign-in yet. Add it in Firebase > Authentication > Settings > Authorized domains.';
  if (c === 'auth/operation-not-allowed') return 'Google sign-in isn’t switched on yet. Turn it on in Firebase > Authentication > Sign-in method.';
  if (c === 'auth/account-exists-with-different-credential') return 'This email already has a password account. Sign in with email instead.';
  if (c === 'auth/web-storage-unsupported') return 'Your browser is blocking storage (private mode or strict cookie settings). Turn that off, or sign in with email and password.';
  if (c === 'auth/network-request-failed') return 'No connection. Check your internet and try again.';
  if (c === 'auth/internal-error' && inAppBrowser()) return 'Google sign-in doesn’t work inside this app. Open the link in Chrome or Safari.';
  return `Google sign-in didn’t work (${c || 'unknown error'}). Try again, or use email and password.`;
}
// Called once at start-up: reports a failed redirect sign-in instead of silently returning to the sign-in page.
export async function finishRedirect(app) {
  window.__kkApp = app;
  const { sdk, auth } = app.backend;
  let started = null; try { started = JSON.parse(ls.get(REDIRECT_KEY) || 'null'); } catch { /* */ }
  ls.del(REDIRECT_KEY);
  if (!sdk.getRedirectResult) return;
  try {
    const res = await sdk.getRedirectResult(auth);
    if (res) { googleWorked(); return; }
    if (started && Date.now() - started.at < 10 * 60000) {
      setTimeout(() => {
        if (auth.currentUser) return googleWorked();
        if (started.standalone) standaloneHelp(markFailed('redirect'));
        else toast('Google sign-in didn’t finish. If you use private browsing or block cookies, switch that off, or use email and password.', true);
      }, 1500);
    }
  } catch (e) { if (started && started.standalone) standaloneHelp(markFailed('redirect')); else toast(googleErrorText(e), true); }
}

function demoGoogleChooser(app) {
  const accounts = isAdminSite(app) ? [[MPP_EMAIL, 'HEP admin', 'Dashboard']]
    : [['aina@siswa.um.edu.my', 'Aina Nadhirah', 'Student, has history'], ['kopikolej@demo.my', 'Kopi Kolej', 'Merchant']];
  const el = sheet(`<h2>Choose a Google account</h2><p class="muted">Demo mode stands in for Google’s account picker. Live, this is Google’s own sign-in window.</p>
    <div class="stack" style="margin-top:14px">
      ${accounts
        .map(([e, n, d]) => `<button class="btn block" data-g="${e}" style="justify-content:flex-start;height:auto;padding:10px 16px;text-align:left;white-space:normal;min-width:0"><span class="avatar" style="width:32px;height:32px;flex:none">${esc(n[0])}</span><span><b>${esc(n)}</b><br><span class="faint">${esc(e)} · ${esc(d)}</span></span></button>`).join('')}
      <form id="gnew" class="stack"><label class="field">Or use another Gmail address<input name="email" type="email" required placeholder="you@gmail.com"></label><button class="btn primary">Continue</button></form>
    </div>`);
  $$('[data-g]', el).forEach((b) => { b.onclick = () => { closeSheet(); googleSignIn(app, b.dataset.g); }; });
  $('#gnew', el).onsubmit = (e) => { e.preventDefault(); const v = e.target.email.value; closeSheet(); googleSignIn(app, v); };
}

export function renderSignIn(app, mode = 'in', showEmail = false) {
  const demo = app.backend.mode === 'demo';
  const admin = isAdminSite(app);
  const iosApp = !admin && !demo && isStandalone() && isIOS();
  const forApp = !admin && !demo && !!handoffHash();
  frame(app, `
    <div><a class="brand"><img class="onz-brand-logo" src="icons/icon-192.png" alt="+Onz" width="48" height="48"></a></div>
    <div><h1>${admin ? 'Sign in to the HEP dashboard' : 'Sign in to +Onz'}</h1>
      <p class="lede">${admin ? 'For HEP staff only. Use the email HEP gave admin access to.' : 'Sign in with Google. New users get an account.'}</p></div>
    ${!demo && inAppBrowser() ? `<div class="notice warn" id="inapp">${icon('info')}<span>You’re in another app’s built-in browser. Google sign-in only works in Chrome or Safari. <button class="link" id="open-browser">Open in browser</button></span></div>` : ''}
    ${iosApp ? `<div class="notice" id="ios-app">${icon('info')}<span>Google sign-in opens Safari for a moment. Sign in there, then come back to this app and you’re in.</span></div>` : ''}
    ${forApp ? `<div class="notice" id="for-app">${icon('smartphone')}<span><b>Signing in for the +Onz app on your home screen.</b> Sign in here (no need to switch to the Safari app), then go back to the app.</span></div>` : ''}
    <button class="btn block google-btn" id="google">${GOOGLE_G}<span>Continue with Google</span></button>
    <details id="email-box" ${showEmail ? 'open' : ''}><summary>Use email and password instead</summary>
      <div class="stack" style="margin-top:14px">
        <div class="seg" role="tablist"><button class="${mode === 'in' ? 'on' : ''}" data-mode="in">Sign in</button><button class="${mode === 'up' ? 'on' : ''}" data-mode="up">Create account</button></div>
        <form id="auth-form" class="stack">
          <label class="field">Email<input name="email" type="email" autocomplete="email" required></label>
          <label class="field">Password<input name="password" type="password" minlength="6" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}" required>
            ${mode === 'up' ? '<small>At least 6 characters. We’ll email you a link to verify the address.</small>' : ''}</label>
          <button class="btn primary block" type="submit">${mode === 'in' ? 'Sign in' : 'Create account'}</button>
          ${mode === 'in' ? '<button class="btn ghost block" type="button" id="forgot">Forgot your password?</button>' : ''}
        </form></div></details>
    <p class="faint" style="text-align:center">You’ll stay signed in on this device until you sign out.</p>
    ${demo ? `<div class="demo-box"><b>Demo mode</b><p class="faint">No Firebase project is connected, so data stays in this browser. Jump straight into a ready-made account:</p>
      <div class="row">${admin ? `<button class="btn small" data-demo="${MPP_EMAIL}">HEP admin</button>`
        : '<button class="btn small" data-demo="aina@siswa.um.edu.my">Student</button><button class="btn small" data-demo="kopikolej@demo.my">Merchant</button>'}</div></div>` : ''}
    ${admin ? `<p class="faint" style="text-align:center">Student or merchant? <a href="${esc(siteUrls.client)}">Open the +Onz app</a></p>` : ''}`);
  const { sdk, auth } = app.backend;
  if ($('#open-browser')) $('#open-browser').onclick = openInBrowserSheet;
  if ($('#set-pw')) $('#set-pw').onclick = () => setPasswordSheet(app);
  if (!admin && !demo && !forApp && isStandalone()) resumeHandoff(app);
  $('#google').onclick = (e) => { if (demo) demoGoogleChooser(app); else busy(e.currentTarget, () => googleSignIn(app)); };
  $$('.seg [data-mode]').forEach((b) => { b.onclick = () => renderSignIn(app, b.dataset.mode, true); });
  $('#auth-form').onsubmit = (e) => {
    e.preventDefault(); const f = e.target; const btn = $('button[type=submit]', f);
    busy(btn, async () => {
      try {
        if (mode === 'in') await sdk.signInWithEmailAndPassword(auth, f.email.value.trim(), f.password.value);
        else {
          const cred = await sdk.createUserWithEmailAndPassword(auth, f.email.value.trim(), f.password.value);
          if (app.backend.mode === 'live') await sdk.sendEmailVerification(cred.user, { url: location.origin + location.pathname });
        }
      } catch (err) { toast(errText(err), true); }
    });
  };
  if ($('#forgot')) $('#forgot').onclick = async () => {
    const email = $('#auth-form').email.value.trim();
    if (!email) return toast('Type your email first, then tap “Forgot your password?”.');
    try { await sdk.sendPasswordResetEmail(auth, email); toast('Password reset email sent. Check your inbox.'); } catch (err) { toast(errText(err), true); }
  };
  $$('[data-demo]').forEach((b) => { b.onclick = () => googleSignIn(app, b.dataset.demo); });
}

export function renderBlocked(app) {
  frame(app, `<div><a class="brand"><img class="onz-brand-logo" src="icons/icon-192.png" alt="+Onz" width="48" height="48"></a></div>
    <div><h1>This account is blocked</h1><p class="lede">Contact HEP if you think this is a mistake.</p>
    <button class="btn block" id="blk-out" style="margin-top:14px">Sign out</button></div>`);
  $('#blk-out').onclick = () => app.backend.sdk.signOut(app.backend.auth);
}
export function renderVerify(app) {
  const { sdk, auth } = app.backend;
  frame(app, `<div><h1>Check your email</h1><p class="lede">We sent a verification link to <b>${esc(app.user.email)}</b>. Open it, then come back and tap “I’ve verified”.</p></div>
    <div class="stack"><button class="btn primary block" id="done">I’ve verified</button>
    <button class="btn block" id="resend">Send the link again</button><button class="btn ghost block" id="out">Use a different email</button></div>
    <p class="faint">Can’t find it? Check spam or promotions. UM student emails may take a few minutes.</p>`);
  $('#done').onclick = (e) => busy(e.currentTarget, async () => {
    await sdk.reload(auth.currentUser);
    if (!auth.currentUser.emailVerified) return toast('Not verified yet. Open the link in the email first.', true);
    await auth.currentUser.getIdToken(true); location.reload();
  });
  $('#resend').onclick = (e) => busy(e.currentTarget, async () => {
    try { await sdk.sendEmailVerification(auth.currentUser, { url: location.origin + location.pathname }); toast('Verification email sent.'); } catch (err) { toast(errText(err), true); }
  });
  $('#out').onclick = () => sdk.signOut(auth);
}

// Client site: a HEP admin with no student or merchant profile most likely wanted the dashboard.
export function renderAdminElsewhere(app, setUpProfile) {
  frame(app, `<div><h1>You’re a HEP admin</h1><p class="lede">Signed in as ${esc(app.user.email || '')}. The HEP dashboard is a separate website.</p></div>
    <div class="stack"><a class="btn primary block" id="to-admin" href="${esc(siteUrls.admin)}">Open the HEP dashboard</a>
      <button class="btn block" id="setup">Set up a student or merchant profile here</button>
      <button class="btn ghost block" id="out">Sign out</button></div>`);
  $('#setup').onclick = () => setUpProfile();
  $('#out').onclick = () => app.backend.sdk.signOut(app.backend.auth);
}

// Admin site: signed in, but this account isn't on the HEP admin list.
export function renderNotAdmin(app) {
  frame(app, `<div><h1>This account isn’t a HEP admin</h1><p class="lede">${esc(app.user.email || 'This account')} doesn’t have access to the HEP dashboard.
      If you should, ask an existing HEP admin to add your email under Settings.</p></div>
    <div class="stack"><a class="btn primary block" href="${esc(siteUrls.client)}">Open the +Onz app for students and merchants</a>
      <button class="btn ghost block" id="out">Sign out and use another account</button></div>`);
  $('#out').onclick = () => app.backend.sdk.signOut(app.backend.auth);
}

export function renderOnboarding(app, done) {
  const email = app.user.email || '';
  const looksStudent = /@((siswa\.)?um\.edu\.my|gmail\.com|googlemail\.com)$/i.test(email);
  frame(app, `<div><h1>Set up your profile</h1><p class="lede">Signed in as ${esc(email)}.</p></div>
    <form id="ob" class="stack">
      <div class="role-pick">
        <label><input type="radio" name="role" value="student" ${looksStudent ? 'checked' : ''}><span class="tile-icon">${icon('graduation-cap')}</span>
          <span><b>I’m a student</b><br><span class="faint">Discover campus, check in at shops and collect rewards</span></span></label>
        <label><input type="radio" name="role" value="merchant" ${looksStudent ? '' : 'checked'}><span class="tile-icon orange">${icon('store')}</span>
          <span><b>I run a business or stall</b><br><span class="faint">Join the campus map so students can find and visit you</span></span></label>
      </div>
      <label class="field">Your full name<input name="name" required minlength="2" autocomplete="name" value="${esc(app.user.displayName || '')}"></label>
      <div id="student-fields" class="stack">
        <label class="field">Matric number<input name="matric" autocomplete="off" placeholder="e.g. 23001234" pattern="[A-Za-z0-9]{5,15}" title="Letters and numbers only"><small>One account per matric number. You can’t change it later, so check it.</small></label>
        <label class="field">Residential college<select name="college">${D.COLLEGES.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
          <small>Your check-ins count towards your college on the leaderboard.</small></label>
        <label class="field">Faculty<select name="faculty">${D.FACULTIES.map((f) => `<option>${esc(f)}</option>`).join('')}</select></label>
      </div>
      <label class="check"><input type="checkbox" required> I agree that +Onz stores my name, email, avatar and the check-ins I make, for running and reporting this campus programme (PDPA notice).</label>
      <button class="btn primary block" type="submit">Continue</button>
      <button class="btn ghost block" type="button" id="out">Sign out</button>
    </form>`);
  const f = $('#ob');
  const sync = () => { $('#student-fields').classList.toggle('hidden', f.role.value !== 'student'); f.matric.required = f.role.value === 'student'; };
  $$('input[name=role]', f).forEach((r) => { r.onchange = sync; }); sync();
  $('#out').onclick = () => app.backend.sdk.signOut(app.backend.auth);
  f.onsubmit = (e) => {
    e.preventDefault();
    busy($('button[type=submit]', f), async () => {
      const role = f.role.value;
      try {
        await D.createProfile(app.ctx, role === 'student'
          ? { role, name: f.name.value, matric: f.matric.value.trim(), college: f.college.value, faculty: f.faculty.value }
          : { role, name: f.name.value });
        await done();
      } catch (err) {
        if (err.notReady) toast('+Onz isn’t open for students yet. The HEP admin needs to sign in once to set it up.', true);
        else if (err.badMatric) toast('Enter your matric number using letters and numbers only (5–15 characters).', true);
        else if (err.matricTaken) toast('That matric number is already registered. If it’s yours, contact HEP.', true);
        else if (err.code === 'permission-denied' && role === 'student')
          toast('This email can’t join as a student. Use your Gmail or UM email, or ask HEP to add you as a tester.', true);
        else toast(errText(err), true);
      }
    });
  };
}
