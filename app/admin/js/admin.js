// HEP admin dashboard website: backend choice, sign-in, the HEP admin check and hash routing.
// Students and merchants use a separate website (app/client). Firestore rules (isMpp) decide what an
// account can read and change; this page only decides what to show.
import { initBackend } from './backend.js';
import * as D from './data.js';
import { $, esc, icon, toast, closeSheet, sheetOpen, errText } from './ui.js';
import * as Auth from './views/auth.js';
import * as Hep from './views/mpp.js';
import { initI18n } from './i18n.js';
initI18n();

const app = {
  site: 'admin', backend: null, ctx: null, user: null, profile: null, isMpp: false, rules: D.DEFAULT_RULES, role: null,
  viewCleanup: null, shellRole: null,
};
window.__umc = app; // handy for debugging in the console

export function go(path) { if (location.hash !== '#/' + path) location.hash = '#/' + path; else render(); }
app.go = go;

async function boot() {
  try {
    app.backend = await initBackend();
  } catch (e) {
    document.body.innerHTML = `<div class="boot"><div><h2>The HEP dashboard couldn’t start</h2><p class="muted">${esc(e.message)}</p></div></div>`;
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
  closeSheet();
  app.user = user; app.profile = null; app.isMpp = false; app.role = null; app.shellRole = null;
  const { sdk, db, mode } = app.backend;
  if (!user) return Auth.renderSignIn(app);
  Auth.googleWorked();
  if (mode === 'live' && !user.emailVerified) return Auth.renderVerify(app);
  app.ctx = { sdk, db, uid: user.uid, email: user.email, profile: null };
  const [isMpp, profile] = await Promise.all([D.isMppUser(app.ctx), D.getProfile(app.ctx).catch(() => null)]);
  if (!isMpp) return Auth.renderNotAdmin(app);
  app.isMpp = true; app.profile = profile; app.ctx.profile = profile;
  try { app.rules = await D.getRules(app.ctx); } catch { app.rules = D.DEFAULT_RULES; }
  app.role = 'mpp';
  render();
}

function shell() {
  if (app.shellRole === 'mpp') return;
  app.shellRole = 'mpp';
  document.body.classList.add('mpp-mode');
  document.body.innerHTML = '<div id="root"></div>';
}

function addDemoRibbon() {
  if (app.backend.mode !== 'demo' || $('.demo-ribbon')) return;
  const b = document.createElement('button'); b.className = 'demo-ribbon'; b.innerHTML = icon('info') + 'Demo';
  b.setAttribute('aria-label', 'Demo mode: switch account or reset');
  b.onclick = () => import('./demo-seed.js').then((m) => m.demoSheet(app));
  document.body.append(b);
}
app.addDemoRibbon = addDemoRibbon;

async function render() {
  if (app.role !== 'mpp' || !app.user) return;
  shell();
  const parts = (location.hash.replace(/^#\/?/, '') || Hep.defaultRoute).split('/');
  const route = Hep.routes[parts[0]] ? parts[0] : Hep.defaultRoute;
  const r = Hep.routes[route];
  if (app.viewCleanup) { try { app.viewCleanup(); } catch { /* */ } app.viewCleanup = null; }
  if (sheetOpen()) closeSheet();
  await Hep.renderShell(app, route);
  const view = $('#view');
  view.className = 'view' + (r.wide ? ' wide' : '');
  view.innerHTML = '<div class="skeleton" style="height:180px;margin-top:16px"></div><div class="skeleton" style="height:90px;margin-top:12px"></div>';
  document.title = `${r.title} · +Onz HEP`;
  const token = Symbol(); render.token = token;
  try {
    const html = await r.render(app, parts.slice(1));
    if (render.token !== token) return;
    view.innerHTML = html;
    window.scrollTo(0, 0);
    const cleanup = r.mount ? await r.mount(view, app, parts.slice(1)) : null;
    if (render.token !== token) { cleanup && cleanup(); return; }
    app.viewCleanup = cleanup || null;
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card empty" style="margin-top:20px">${icon('circle-alert')}<h3>This page didn’t load</h3><p class="muted">${esc(errText(e))}</p>
      <button class="btn" style="margin-top:12px" onclick="location.reload()">${icon('refresh-cw')} Reload</button></div>`;
  }
}
app.render = render;

boot();
