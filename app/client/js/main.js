// Student and merchant app: backend choice, sign-in state, role shells and hash routing.
// The Admin dashboard is a separate website (app/admin), linked from the account menu for Admin team members.
import { initBackend } from './backend.js';
import { captureSource } from './initiatives.js';
import * as D from './data.js';
import { $, $$, esc, icon, toast, sheet, closeSheet, sheetOpen, countUp, initials, errText, routeLoadingHTML } from './ui.js';
import * as Auth from './views/auth.js';
import { trySignInByAlias } from './link-email.js';
import { initI18n, langToggleHTML, getLang } from './i18n.js';
import { avatarSVG, defaultFor } from './avatar.js';
import { siteUrls } from './firebase-config.js';
import { startDailyAppActivity } from './app-activity.js';
import { startPageTime } from './page-time.js';
import * as Guide from './guide.js';
import { unseenReplies } from './feedback.js';
import { INFORMATION_ROUTES } from './information.js';
import { mountPageMotion } from './motion.js';
import { installOzIcons, ozIcon } from './oz-icons.js';
import { ozPointsPill } from './oz-ui.js';
installOzIcons();
initI18n();

const app = {
  site: 'client', backend: null, ctx: null, user: null, profile: null, isMpp: false, rules: D.DEFAULT_RULES, role: null,
  merchant: null, visits: [], ledger: [], ledgerLoaded: false, appDays: [], watchers: [], viewCleanup: null, routes: {}, shellRole: null,
};
window.__umc = app; // handy for debugging in the console

// +Onz redesign navigation (Bottom Tab Bar 721:20421 on mobile, Web · Sidebar 915:33484 from 1024px).
// Students: five destinations. Events are reached from Home and About from the account menu.
const nav = {
  student: [['community', 'Community', 'users'], ['leagues', 'Leagues', 'trophy'], ['home', 'Home', 'house'], ['rewards', 'Rewards', 'gift'], ['me', 'Me', 'user']],
  merchant: [['scan', 'Deal QR', 'qr-code'], ['shop', 'My shop', 'store'], ['home', 'Home', 'house'], ['promote', 'Promote your shop', 'megaphone'], ['insights', 'Insights', 'chart-column'], ['about', 'About us', 'info', 'desktop']],
};

// A route can name the switch (or switches) it needs; turned-off routes leave the menu and redirect home.
const routeOn = (r) => !r.feature || [].concat(r.feature).every((k) => D.featureOn(app.rules, k));
export function go(path) { if (location.hash !== '#/' + path) location.hash = '#/' + path; else render(); }
app.go = go;

function stopWatchers() { app.watchers.forEach((u) => { try { u(); } catch { /* */ } }); app.watchers = []; }

async function boot() {
  // Remember a tracking-link code (addonz.my/?src=...) for 30 days, so a later sign-up is credited to that initiative.
  try { captureSource(location.search, window.localStorage); } catch { /* storage blocked: tracking is optional */ }
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
  render.token=Symbol();
  if(app.viewCleanup){try{app.viewCleanup();}catch{}app.viewCleanup=null;}
  stopWatchers(); closeSheet();
  app.user = user; app.role = null; app.ctx = null; app.rules = D.DEFAULT_RULES; app.profile = null; app.isMpp = false; app.feedbackNew = 0; app.merchant = null; app.stallSurveyDone = undefined; app.visits = []; app.ledger = []; app.ledgerLoaded = false; app.appDays = []; app.shellRole = null;
  const { sdk, db, mode } = app.backend;
  if (!user) return informationRoute()?renderPublicInformation():Auth.renderSignIn(app);
  Auth.googleWorked();
  // Ask the browser to keep this site's storage (and so the sign-in) instead of clearing it when space runs low.
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* not supported */ }
  if (mode === 'live' && !user.emailVerified) return informationRoute()?renderPublicInformation():Auth.renderVerify(app);
  // Opened from the iPhone home-screen app to sign in: hand the sign-in back instead of opening the app here.
  const hoHash = mode === 'live' ? Auth.handoffHash() : null;
  if (hoHash) return Auth.renderHandoffDone(app, user, hoHash, await D.isMppUser({ sdk, db, uid: user.uid, email: user.email }));
  Auth.discardPendingHandoff();
  app.ctx = { sdk, db, uid: user.uid, email: user.email, profile: null };
  const [isMpp, profile] = await Promise.all([D.isMppUser(app.ctx), D.getProfile(app.ctx).catch(() => null)]);
  app.isMpp = isMpp; app.profile = profile; app.ctx.profile = profile;
  try { app.rules = await D.getRules(app.ctx); } catch { app.rules = D.DEFAULT_RULES; }
  if(informationRoute()&&(!profile||profile.disabled||D.needsTerms(profile)||(profile.role==='merchant'&&!D.featureOn(app.rules,'merchantSignup')&&!D.featureOn(app.rules,'merchantTools'))))return renderPublicInformation();
  if (profile?.disabled) return Auth.renderBlocked(app);
  if (profile?.role === 'merchant' && !D.featureOn(app.rules, 'merchantSignup') && !D.featureOn(app.rules, 'merchantTools')) return Auth.renderComingSoon(app);
  if (isMpp && !profile) return Auth.renderAdminElsewhere(app, () => Auth.renderOnboarding(app, onboarded));
  // An email a student added on Me > Sign-in emails: the server switches this sign-in to their account.
  if (!profile && await trySignInByAlias(app, user)) return;
  if (!profile) return Auth.renderOnboarding(app, onboarded);
  // Terms of Use and Privacy Notice: shown once to anyone who hasn't accepted the current version.
  if (D.needsTerms(profile)) return Auth.renderTerms(app, () => startRole(profile.role));
  startRole(profile.role);
}
// A brand-new profile: show the welcome and tour once the app's first screen is up.
async function onboarded() { Guide.markNewAccount(app.ctx.uid); app.profile = await D.getProfile(app.ctx); app.ctx.profile = app.profile; startRole(app.profile.role); }

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

    app.watchers.push(D.watchLedger(app.ctx, (l) => { app.ledger = l; app.ledgerLoaded = true; app.emit && app.emit('ledger'); }, () => {}));
    app.watchers.push(D.watchAppDays(app.ctx, (days) => { app.appDays = days; app.emit && app.emit('app-activity'); }, () => {}));
    app.watchers.push(startDailyAppActivity(app.ctx, { onError: () => toast('Couldn’t save today’s app check-in. We’ll retry when you return.', true) }));
    // Anonymous time on each page (privacy notice: "How the app is used").
    app.pageTime = startPageTime(app.ctx); app.watchers.push(app.pageTime.stop);
  }
  if (role === 'merchant') {
    app.watchers.push(sdk.onSnapshot(sdk.doc(db, 'config', 'rules'), (s) => {
      const update = s.exists() ? s.data().merchantReadinessUpdate : null;
      if (D.toMs(update?.publishedAt) === D.toMs(app.rules.merchantReadinessUpdate?.publishedAt) && update?.message === app.rules.merchantReadinessUpdate?.message) return;
      app.rules = { ...app.rules, merchantReadinessUpdate: update || null };
      app.emit && app.emit('merchant-readiness');
    }, () => {}));
    app.watchers.push(sdk.onSnapshot(sdk.doc(db, 'merchants', app.ctx.uid), (s) => {
      app.merchant = s.exists() ? { id: s.id, ...s.data() } : null; app.ctx.merchantName = app.merchant?.name || '';
      paintAvatar();
      app.emit && app.emit('merchant');
    }, () => {}));
  }
  render().then(() => Guide.maybeStart(app));
  // One quick look for replies to the student's feedback they haven't seen yet (shown as a dot on their avatar).
  if (role === 'student') D.myFeedback(app.ctx).then((items) => { app.feedbackNew = unseenReplies(app.ctx.uid, items); paintFeedbackDot(); }).catch(() => {});
}
function paintFeedbackDot() { const el = $('#avatar'); if (el) el.classList.toggle('has-dot', !!app.feedbackNew); }
app.paintFeedbackDot = paintFeedbackDot;

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
    <div class="shell oz-shell oz-${role}">
      <header class="topbar oz-topbar">
        <a class="brand oz-wordmark" href="#/home" aria-label="+Onz home" data-no-i18n>+Onz</a>
        <p class="oz-tagline">your campus, all added up</p>
        <span class="spacer"></span>
        ${role === 'student' ? ozPointsPill(p.points || 0) : ''}
        <button class="avatar oz-gear" id="avatar" aria-label="Account menu">${role === 'student' ? ozIcon('settings') : esc(initials(p.name))}</button>
      </header>
      <aside class="oz-sidebar">
        <a class="oz-side-brand" href="#/home" aria-label="+Onz home" data-no-i18n tabindex="-1">+Onz</a>
        <nav class="tabbar oz-tabbar" aria-label="Main">${nav[role].filter(([k]) => !routes[k] || routeOn(routes[k])).map(([k, label, ic, only]) =>
          `<a href="#/${k}" data-tab="${k}" class="oz-tab${only === 'desktop' ? ' nav-desktop-only' : ''}">${icon(ic)}<span class="oz-tab-label">${label}</span></a>`).join('')}</nav>
      </aside>
      <main class="view" id="view"></main>
    </div>`;
  $('#avatar').onclick = () => accountSheet();
  addDemoRibbon();
  paintAvatar();
  paintFeedbackDot(); // the reply check may finish before the top bar exists
}
// Students see their avatar in the top bar; merchants see their logo.
function paintAvatar() {
  const el = $('#avatar'); if (!el) return;
  const p = app.profile || {};
  if (app.role === 'student') return; // the student's top-right control is the settings gear (Top Bar 431:356)
  else if (app.role === 'merchant' && app.merchant?.logo) { el.classList.add('has-art'); el.innerHTML = `<img src="${app.merchant.logo}" alt="">`; }
  else { el.classList.remove('has-art'); el.textContent = initials(p.name); }
}

// Account menu (Figma "Me · Account menu" 525:10476): grouped rows, shown as a sheet from the settings gear so every
// existing entry point and id (#tour, #install, #terms, #signout, #to-feedback, #to-mpp) keeps working.
function accountSheet() {
  const p = app.profile || {};
  const student = app.role === 'student';
  const chev = ozIcon('s:chevron-right', 'oz-menu-chev');
  const row = (label, { href, id, badge = '' } = {}) => {
    const inner = `<span class="oz-menu-label">${label}${badge}</span>${chev}`;
    return href ? `<a class="oz-menu-row" href="${esc(href)}"${id ? ` id="${id}"` : ''} data-close>${inner}</a>`
      : `<button type="button" class="oz-menu-row" id="${id}">${inner}</button>`;
  };
  const group = (title, rows) => `<h3 class="oz-menu-title">${title}</h3><div class="oz-menu-group">${rows.join('')}</div>`;
  const lang = getLang();
  const el = sheet(`<div class="oz-account">
    <div class="oz-account-id">${student ? `<span class="oz-account-av">${avatarSVG(p.avatar || defaultFor(app.ctx?.uid), { variant: 'head', size: 52, title: p.name })}</span>` : ''}
      <div class="oz-account-text"><h2 class="oz-account-name">${esc(p.name || app.user.email)}</h2><p class="oz-account-sub">${esc(app.user.email)}</p></div></div>
    ${student ? group('Profile and preferences', [row('Profile and settings', { href: '#/me' }), row('Customise avatar', { href: '#/avatar' })]) : ''}
    ${group('Help and information', [
      ...(student ? [row('Questions and feedback', { href: '#/feedback', id: 'to-feedback', badge: app.feedbackNew ? ` <span class="oz-tag oz-tag-success">${app.feedbackNew === 1 ? '1 new reply' : `${app.feedbackNew} new replies`}</span>` : '' })] : []),
      row('About +Onz', { href: '#/about' }), row('Contact us', { href: '#/contact' }), row('Points guide', { href: '#/points' })])}
    ${group('App', [row('Take the tour', { id: 'tour' }), row('Install +Onz', { id: 'install' }), row('Terms of Use and Privacy', { id: 'terms' })])}
    <h3 class="oz-menu-title" id="oz-lang-title">Language</h3>
    <div class="oz-menu-group oz-lang" role="group" aria-labelledby="oz-lang-title" data-no-i18n>
      <button type="button" class="oz-menu-row" data-lang-set="en" aria-pressed="${lang === 'en'}"><span class="oz-menu-label">English</span>${ozIcon('s:check', 'oz-menu-check')}</button>
      <button type="button" class="oz-menu-row" data-lang-set="ms" aria-pressed="${lang === 'ms'}"><span class="oz-menu-label">Bahasa Malaysia</span>${ozIcon('s:check', 'oz-menu-check')}</button>
    </div>
    <div class="oz-menu-group oz-menu-end">
      ${app.isMpp ? `<a class="oz-menu-row" href="${esc(siteUrls.admin)}" id="to-mpp"><span class="oz-menu-label">Open the Admin dashboard</span>${chev}</a>` : ''}
      <button type="button" class="oz-menu-row" id="signout"><span class="oz-menu-label">${ozIcon('s:logout')}Sign out</span></button>
      <a class="oz-menu-row is-danger" href="#/delete-account" data-close><span class="oz-menu-label">${ozIcon('s:trash')}${app.role === 'merchant' ? 'Close my account' : 'Delete my account'}</span></a>
    </div></div>`);
  $('#signout', el).onclick = async () => { closeSheet(); await app.backend.sdk.signOut(app.backend.auth); location.hash = ''; };
  $('#install', el).onclick = () => installApp();
  $('#tour', el).onclick = () => { closeSheet(); Guide.start(app); };
  $('#terms', el).onclick = () => { closeSheet(); import('./terms.js').then((m) => m.termsSheet()); };
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

const informationRoute=()=>{
  const parts=location.hash.replace(/^#\/?/,'').split('/');
  return Object.hasOwn(INFORMATION_ROUTES,parts[0])?{page:parts[0],args:parts.slice(1)}:null;
};
async function renderPublicInformation() {
  const requested=informationRoute();if(!requested)return;
  const token=Symbol();render.token=token;
  if(app.viewCleanup){try{app.viewCleanup();}catch{}app.viewCleanup=null;}
  closeSheet();app.shellRole=null;
  const route=INFORMATION_ROUTES[requested.page];
  document.body.classList.remove('mpp-mode');
  document.body.innerHTML=`<div class="info-public-shell"><header class="info-public-header"><a href="#/home" aria-label="+Onz home"><img class="onz-brand-logo" src="icons/onz-logo.svg" alt="+Onz" width="680" height="214"></a><span class="spacer"></span>${langToggleHTML()}<a class="info-public-open" href="#/home">${app.user?'Open app':'Sign in'} ${icon('arrow-right')}</a></header><main class="info-public-main" id="view"></main></div>`;
  document.title=route.title+' · +Onz';
  const view=$('#view');
  const html=await route.render(app,requested.args);
  if(render.token!==token)return;
  view.innerHTML=html;window.scrollTo(0,0);
  const cleanup=route.mount?.(view,app,requested.args);
  const stopMotion=mountPageMotion(view);
  app.viewCleanup=()=>{stopMotion();cleanup?.();};
}
async function render() {
  if(informationRoute()&&!(app.user&&app.profile&&!app.profile.disabled&&!D.needsTerms(app.profile)&&app.role===app.profile.role))return renderPublicInformation();
  if(!app.user){if(app.viewCleanup){try{app.viewCleanup();}catch{}app.viewCleanup=null;}return Auth.renderSignIn(app);}
  if(!app.role||!app.profile)return onUser(app.user);
  const token=Symbol();render.token=token;
  if(app.viewCleanup){try{app.viewCleanup();}catch{}app.viewCleanup=null;}
  if(sheetOpen())closeSheet();
  const requestedPath=location.hash.replace(/^#\/?/,'')||'home';
  const previousView=$('#view');
  if(previousView){previousView.setAttribute('aria-busy','true');previousView.innerHTML=routeLoadingHTML(requestedPath);}
  $$('.tabbar a').forEach(a=>a.classList.toggle('pending',a.dataset.tab===requestedPath.split('/')[0]));
  let view=previousView;
  try {
    // Fetch in parallel, and ignore any request superseded by a later tap or sign-in change.
    const [next,mod]=await Promise.all([D.getRules(app.ctx).catch(()=>app.rules),loadRoleModule(app.role)]);
    if(render.token!==token)return;
    if(JSON.stringify(next.features)!==JSON.stringify(app.rules.features))app.shellRole=null;
    app.rules=next;shell(app.role,mod.routes);
    const canonical=mod.canonicalPath?mod.canonicalPath(requestedPath):requestedPath;
    if(canonical!==requestedPath)history.replaceState(null,'','#/'+canonical);
    let parts=canonical.split('/');
    let route=mod.routes[parts[0]]&&routeOn(mod.routes[parts[0]])?parts[0]:mod.defaultRoute;
    // A role can require a step before anything else (merchants: the stall survey). The view module decides.
    const gate=mod.gateRoute?await mod.gateRoute(app,route):null;
    if(render.token!==token)return;
    if(gate&&gate!==route){history.replaceState(null,'','#/'+gate);route=gate;parts=[gate];if(mod.gateMessage)toast(mod.gateMessage);}
    const r=mod.routes[route];
    $$('.tabbar a').forEach(a=>{const active=a.dataset.tab===(r.tab||route)||(a.dataset.tab===route&&!$(`.tabbar a[data-tab="${r.tab}"]`));a.classList.toggle('on',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    view=$('#view');view.className='view'+(r.wide?' wide':'');view.setAttribute('aria-busy','true');
    view.innerHTML=routeLoadingHTML(route);
    document.title=`${r.title} · +Onz ${app.role==='student'?'Student':'Merchant'}`;
    const html=await r.render(app,parts.slice(1));
    if(render.token!==token)return;
    view.innerHTML=html;window.scrollTo(0,0);
    const cleanup=r.mount?await r.mount(view,app,parts.slice(1)):null;
    if(render.token!==token){cleanup?.();return;}
    const stopMotion=mountPageMotion(view);app.viewCleanup=()=>{stopMotion();cleanup?.();};
    view.removeAttribute('aria-busy');$$('.tabbar a.pending').forEach(a=>a.classList.remove('pending'));
    $$('[data-bind=points]',view).forEach(el=>{el.dataset.v=app.profile?.points||0;});
  }catch(e){
    if(render.token!==token)return;
    console.error(e);view?.removeAttribute('aria-busy');$$('.tabbar a.pending').forEach(a=>a.classList.remove('pending'));
    if(view)view.innerHTML=`<div class="card empty" style="margin-top:20px">${icon('circle-alert')}<h3>This page didn’t load</h3><p class="muted">${esc(errText(e))}</p><button class="btn" style="margin-top:12px" onclick="location.reload()">${icon('refresh-cw')} Reload</button></div>`;
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
