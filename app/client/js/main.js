// Student and merchant app: backend choice, sign-in state, role shells and hash routing.
// The HEP admin dashboard is a separate website (app/admin), linked from the account menu for HEP admins.
import { initBackend } from './backend.js';
import * as D from './data.js';
import { $, $$, esc, icon, toast, sheet, closeSheet, sheetOpen, countUp, initials, errText } from './ui.js';
import * as Auth from './views/auth.js';
import { initI18n, langToggleHTML } from './i18n.js';
import { avatarSVG, defaultFor } from './avatar.js';
import { siteUrls } from './firebase-config.js';
initI18n();

const app = {
  site: 'client', backend: null, ctx: null, user: null, profile: null, isMpp: false, rules: D.DEFAULT_RULES, role: null,
  merchant: null, visits: [], ledger: [], watchers: [], viewCleanup: null, routes: {}, shellRole: null,
};
window.__umc = app; // handy for debugging in the console

const nav = {
  student: [['home', 'Home', 'house'], ['events', 'Campus Events', 'calendar'], ['checkin', 'Check out', 'map-pin-check', true], ['rewards', 'Rewards', 'gift'], ['me', 'Me', 'user']],
  merchant: [['home', 'Home', 'house'], ['shop', 'My shop', 'store'], ['scan', 'Redeem', 'scan-line', true], ['promote', 'Promote', 'megaphone'], ['insights', 'Insights', 'chart-column']],
};

// A route can name the switch (or switches) it needs; turned-off routes vanish from the menu and redirect home.
const routeOn = (r) => !r.feature || [].concat(r.feature).every((k) => D.featureOn(app.rules, k));
export function go(path) { if (location.hash !== '#/' + path) location.hash = '#/' + path; else render(); }
app.go = go;

function stopWatchers() { app.watchers.forEach((u) => { try { u(); } catch { /* */ } }); app.watchers = []; }

async function boot() {
  try {
    app.backend = await initBackend();
  } catch (e) {
    document.body.innerHTML = `<div class="boot"><div><h2>+Onz couldn’t start</h2><p class="muted">${esc(e.message)}</p></div></div>`;
    return;
  }
  const { sdk, auth, mode } = app.backend;
  document.documentElement.dataset.backend = mode;
  if (mode === 'demo') {
    const { ensureDemoData } = await import('./demo-seed.js');
    await ensureDemoData(app.backend, (msg) => { $('#boot-msg') && ($('#boot-msg').textContent = msg); });
  }
  Auth.finishRedirect(app);
  sdk.onAuthStateChanged(auth, (user) => onUser(user).catch((e) => { console.error(e); toast(errText(e), true); }));
  window.addEventListener('hashchange', () => render());
  window.addEventListener('kk-maps-fallback', () => { toast('Google Maps isn’t set up for this address yet, so the basic map is shown.'); render(); });
}

async function onUser(user) {
  stopWatchers(); closeSheet();
  app.user = user; app.profile = null; app.isMpp = false; app.merchant = null; app.visits = []; app.ledger = []; app.shellRole = null;
  const { sdk, db, mode } = app.backend;
  if (!user) return Auth.renderSignIn(app);
  Auth.googleWorked();
  // Ask the browser to keep this site's storage (and so the sign-in) instead of clearing it when space runs low.
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* not supported */ }
  if (mode === 'live' && !user.emailVerified) return Auth.renderVerify(app);
  // Opened from the iPhone home-screen app to sign in: hand the sign-in back instead of opening the app here.
  const hoHash = mode === 'live' ? Auth.handoffHash() : null;
  if (hoHash) return Auth.renderHandoffDone(app, user, hoHash, await D.isMppUser({ sdk, db, uid: user.uid, email: user.email }));
  app.ctx = { sdk, db, uid: user.uid, email: user.email, profile: null };
  const [isMpp, profile] = await Promise.all([D.isMppUser(app.ctx), D.getProfile(app.ctx).catch(() => null)]);
  app.isMpp = isMpp; app.profile = profile; app.ctx.profile = profile;
  try { app.rules = await D.getRules(app.ctx); } catch { app.rules = D.DEFAULT_RULES; }
  if (profile?.disabled) return Auth.renderBlocked(app);
  if (profile?.role === 'merchant' && !D.featureOn(app.rules, 'merchantSignup') && !D.featureOn(app.rules, 'merchantTools')) return Auth.renderComingSoon(app);
  if (isMpp && !profile) return Auth.renderAdminElsewhere(app, () => Auth.renderOnboarding(app, onboarded));
  if (!profile) return Auth.renderOnboarding(app, onboarded);
  startRole(profile.role);
}
async function onboarded() { app.profile = await D.getProfile(app.ctx); app.ctx.profile = app.profile; startRole(app.profile.role); }

function startRole(role) {
  app.role = role;
  const { sdk, db } = app.backend;
  app.watchers.push(sdk.onSnapshot(sdk.doc(db, 'users', app.ctx.uid), (s) => {
    if (!s.exists()) return;
    app.profile = { id: s.id, ...s.data() }; app.ctx.profile = app.profile;
    $$('[data-bind=points]').forEach((el) => countUp(el, app.profile.points));
    paintAvatar();
  }, () => {}));
  if (role === 'student') {
    if (D.featureOn(app.rules, 'hereNow')) import('./herenow.js').then((H) => { if (app.role === 'student') app.watchers.push(H.startWaveListener(app)); }).catch(() => {});
    app.watchers.push(D.watchMyVisits(app.ctx, (v) => { app.visits = v; app.emit && app.emit('visits'); }, () => {}));
    app.watchers.push(D.watchLedger(app.ctx, (l) => { app.ledger = l; app.emit && app.emit('ledger'); }, () => {}));
  }
  if (role === 'merchant') {
    app.watchers.push(sdk.onSnapshot(sdk.doc(db, 'merchants', app.ctx.uid), (s) => {
      app.merchant = s.exists() ? { id: s.id, ...s.data() } : null; app.ctx.merchantName = app.merchant?.name || '';
      paintAvatar();
      app.emit && app.emit('merchant');
    }, () => {}));
  }
  render();
}

// tiny event hub so views can refresh parts of the page when live data changes
const listeners = new Set();
app.emit = (topic) => listeners.forEach((f) => f(topic));
app.on = (f) => { listeners.add(f); return () => listeners.delete(f); };

async function loadRoleModule(role) {
  return role === 'merchant' ? import('./views/merchant.js') : import('./views/student.js');
}

function shell(role, routes) {
  if (app.shellRole === role) return;
  app.shellRole = role;
  const p = app.profile || {};
  document.body.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="#/home"><img class="onz-brand-logo" src="icons/onz-header.png" alt="+Onz" width="368" height="227"><em class="onz-role">${role === 'student' ? 'Student' : 'Merchant'}</em></a>
        <span class="spacer"></span>
        ${role === 'student' ? `<a class="pts-chip" href="#/rewards" aria-label="Your points">${icon('sparkles')}<span data-bind="points">${(p.points || 0).toLocaleString()}</span></a>` : ''}
        ${langToggleHTML()}
        <button class="avatar" id="avatar" aria-label="Account menu">${esc(initials(p.name))}</button>
      </header>
      <main class="view" id="view"></main>
      <nav class="tabbar" aria-label="Main">${nav[role].filter(([k]) => !routes[k] || routeOn(routes[k])).map(([k, label, ic, center]) =>
        `<a href="#/${k}" data-tab="${k}" class="${center ? 'center' : ''}">${center ? `<span class="bubble">${icon(ic)}</span>` : icon(ic)}<span>${label}</span></a>`).join('')}</nav>
    </div>`;
  $('#avatar').onclick = () => accountSheet();
  addDemoRibbon();
  paintAvatar();
}
// Students see their avatar in the top bar; merchants see their logo.
function paintAvatar() {
  const el = $('#avatar'); if (!el) return;
  const p = app.profile || {};
  if (app.role === 'student') { el.classList.add('has-art'); el.innerHTML = avatarSVG(p.avatar || defaultFor(app.ctx?.uid), { variant: 'head', size: 40, title: p.name }); }
  else if (app.role === 'merchant' && app.merchant?.logo) { el.classList.add('has-art'); el.innerHTML = `<img src="${app.merchant.logo}" alt="">`; }
  else { el.classList.remove('has-art'); el.textContent = initials(p.name); }
}

function accountSheet() {
  const p = app.profile || {};
  const el = sheet(`<h2>${esc(p.name || app.user.email)}</h2><p class="muted">${esc(app.user.email)}</p>
    <div class="stack" style="margin-top:18px">
      ${app.role === 'student' ? '<a class="btn block" href="#/me" data-close>Profile and settings</a><a class="btn block" href="#/avatar" data-close>Customise avatar</a>' : ''}
      ${app.isMpp ? `<a class="btn block" href="${esc(siteUrls.admin)}" id="to-mpp">Open the HEP dashboard</a>` : ''}
      <button class="btn block" id="install">Install the app on this device</button>
      <button class="btn block warn" id="signout">${icon('log-out')} Sign out</button>
    </div>`);
  $('#signout', el).onclick = async () => { closeSheet(); await app.backend.sdk.signOut(app.backend.auth); location.hash = ''; };
  $('#install', el).onclick = () => installApp();
}
app.accountSheet = accountSheet;

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
function installApp() {
  if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; closeSheet(); return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  sheet(`<h2>Install +Onz</h2><p class="muted">${ios
    ? 'In Safari, tap the Share button, then “Add to Home Screen”.'
    : 'Open your browser menu and choose “Install app” or “Add to Home screen”. If it’s already installed, open it from your home screen.'}</p>`);
}
app.installApp = installApp;

function addDemoRibbon() {
  if (app.backend.mode !== 'demo' || $('.demo-ribbon')) return;
  const b = document.createElement('button'); b.className = 'demo-ribbon'; b.innerHTML = icon('info') + 'Demo';
  b.setAttribute('aria-label', 'Demo mode: switch account or reset');
  b.onclick = () => import('./demo-seed.js').then((m) => m.demoSheet(app));
  const bar = $('.topbar .spacer');
  if (bar) { b.classList.add('in-bar'); bar.before(b); } else document.body.append(b);
}
app.addDemoRibbon = addDemoRibbon;

async function render() {
  if (!app.role || !app.user) return;
  const mod = await loadRoleModule(app.role);
  shell(app.role, mod.routes);
  const parts = (location.hash.replace(/^#\/?/, '') || mod.defaultRoute).split('/');
  const route = mod.routes[parts[0]] && routeOn(mod.routes[parts[0]]) ? parts[0] : mod.defaultRoute;
  const r = mod.routes[route];
  if (app.viewCleanup) { try { app.viewCleanup(); } catch { /* */ } app.viewCleanup = null; }
  if (sheetOpen()) closeSheet();
  $$('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (r.tab || route)));
  const view = $('#view');
  view.className = 'view' + (r.wide ? ' wide' : '');
  view.innerHTML = '<div class="skeleton" style="height:180px;margin-top:16px"></div><div class="skeleton" style="height:90px;margin-top:12px"></div>';
  document.title = `${r.title} · +Onz ${app.role === 'student' ? 'Student' : 'Merchant'}`;
  const token = Symbol(); render.token = token;
  try {
    const html = await r.render(app, parts.slice(1));
    if (render.token !== token) return;
    view.innerHTML = html;
    window.scrollTo(0, 0);
    const cleanup = r.mount ? await r.mount(view, app, parts.slice(1)) : null;
    if (render.token !== token) { cleanup && cleanup(); return; }
    app.viewCleanup = cleanup || null;
    $$('[data-bind=points]', view).forEach((el) => { el.dataset.v = app.profile?.points || 0; });
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card empty" style="margin-top:20px">${icon('circle-alert')}<h3>This page didn’t load</h3><p class="muted">${esc(errText(e))}</p>
      <button class="btn" style="margin-top:12px" onclick="location.reload()">${icon('refresh-cw')} Reload</button></div>`;
  }
}
app.render = render;

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) toast('A new version is ready. Reopen the app to update.');
      });
    });
  }).catch(() => {}));
}

boot();
