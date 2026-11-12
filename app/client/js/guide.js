// First-time guide: a welcome moment with confetti, then a short spotlight tour of the app.
// New accounts see it once, right after they set up their profile. Anyone can replay it from the account menu.
// Whether it's been seen is kept in this browser (localStorage), so no database or rules change is needed.
import { $, $$, esc, icon, n, confetti } from './ui.js';

const KEY = (uid) => `onz-guide-v1:${uid}`;
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const read = (uid) => store.get(KEY(uid));
const write = (uid, v) => store.set(KEY(uid), v);

/** Call once when a brand-new profile is created: the welcome and tour then show on the next screen. */
export function markNewAccount(uid) { write(uid, 'pending'); }
export const isPending = (uid) => read(uid) === 'pending';

const firstName = (p) => String(p?.name || '').trim().split(/\s+/)[0] || '';

// ------------------------------------------------------------- the steps
// A step with a target highlights that element; steps whose target isn't on screen (a tab HEP has switched off)
// are left out. `has` checks for an element, so the list can be tested without a browser.
export function stepsFor(app, { first = true, has = (sel) => !!document.querySelector(sel) } = {}) {
  const p = app.profile || {}; const name = firstName(p);
  const student = app.role === 'student';
  const welcome = {
    kind: 'welcome', icon: 'sparkles',
    title: first ? (name ? `Welcome to +Onz, ${name}!` : 'Welcome to +Onz!') : 'A quick tour of +Onz',
    body: first
      ? (student ? 'Your campus journey starts here. Take a one-minute tour to see where everything is.'
        : 'Your business is about to join the campus map. Take a one-minute tour to see how it works.')
      : 'Here’s where everything is. It takes about a minute.',
    chips: student
      ? [['sparkles', 'Collect points'], ['gift', 'Swap for rewards'], ['compass', 'Discover campus']]
      : [['store', 'Set up your shop'], ['map-pin', 'Get on the map'], ['users', 'Reach students']],
  };
  const tab = (key, ic, title, body) => ({ target: `.tabbar [data-tab="${key}"]`, icon: ic, title, body });
  const tour = student ? [
    tab('home', 'house', 'Home', 'Your +Onz card: your points, your level and your daily streak. Explore shops, live deals and Learn & Earn from here.'),
    { target: '.topbar .pts-chip', icon: 'sparkles', title: 'Your points', body: 'Every point you earn shows up here. Tap it to see what you can swap them for.' },
    tab('community', 'users', 'Community', 'Climb the KK League with your college, invite friends, and support the student welfare fund.'),
    tab('events', 'calendar', 'Campus Events', 'See what’s happening around UM, like FESKUM 2026.'),
    tab('rewards', 'gift', 'Rewards', 'Swap your points for vouchers, and see your badges and streak.'),
    tab('me', 'user', 'Me', 'Your profile, your invite code and your points history.'),
  ] : [
    tab('home', 'house', 'Home', 'Your shop at a glance: its status, live-deal activity and updates from HEP.'),
    tab('shop', 'store', 'My shop', 'Set up your business here: its details, logo and exact map pin. HEP checks them before students can see you.'),
    tab('scan', 'qr-code', 'Deal QR', 'Show this QR to students so they can claim your live deals.'),
    tab('promote', 'megaphone', 'Promote live deals', 'Create off-peak deals to bring students in when it’s quiet.'),
    tab('insights', 'chart-column', 'Insights', 'See how students are responding to your deals.'),
  ];
  const shared = [
    { target: '.topbar .lang-toggle', icon: 'settings', title: 'English or Bahasa Malaysia', body: 'Switch language any time. Everything changes straight away.' },
    { target: '#avatar', icon: 'user', title: 'Your account menu', body: student
      ? 'Tap here for settings, to ask us anything or send feedback, to install +Onz on your phone, or to sign out. You can replay this tour from here too.'
      : 'Tap here for settings, to install +Onz on your phone, or to sign out. You can replay this tour from here too.' },
  ];
  const finish = { kind: 'finish', icon: 'circle-check', title: first ? 'You’re all set!' : 'That’s the tour', tasks: tasksFor(app) };
  return [welcome, ...[...tour, ...shared].filter((s) => has(s.target)), finish];
}

// "Make it yours": the first things to do, ticked off as they're done.
export function tasksFor(app) {
  if (app.role === 'student') {
    const done = new Set((app.ledger || []).map((e) => e.id));
    const p = app.profile || {};
    return {
      heading: 'Make it your own', go: 'home', cta: 'Start exploring',
      items: [
        { route: 'avatar', icon: 'palette', label: 'Customise your avatar', done: !!p.avatar },
        { route: 'me', icon: 'user', label: 'Check your profile', done: false },
        { route: 'survey', icon: 'target', label: `Earn ${n(app.rules?.surveyBonus)} points with the Money check`, done: done.has('survey') },
      ],
    };
  }
  const m = app.merchant;
  const sent = !!m && ['pending', 'verified'].includes(m.status);
  return {
    heading: 'Set up your shop', go: 'shop', cta: m?.status === 'verified' ? 'Go to my shop' : 'Set up my shop',
    note: m?.status === 'verified' ? '' : 'Students see your shop once HEP verifies it.',
    items: [
      { route: 'shop', icon: 'store', label: 'Add your business details and DuitNow QR photo', done: !!m },
      { route: 'shop', icon: 'image', label: 'Upload your logo', done: !!m?.logo },
      { route: 'shop', icon: 'map-pin', label: 'Pin your shop on the map', done: !!m && 'lat' in m },
      { route: 'shop', icon: 'check', label: 'Send to HEP for verification', done: sent },
    ],
  };
}

// ------------------------------------------------------------- the overlay
let active = null;
// A sign-out replaces the whole page, so an overlay that's no longer on the page doesn't count as open.
export const isOpen = () => !!active && document.body.contains(active.root);

// A page tour passes its own `steps` (tour steps only) and `onDone`; it closes if the student leaves the page.
export function start(app, { first = false, steps: pageSteps = null, onDone = null } = {}) {
  if (isOpen()) return;
  active = null;
  const uid = app.ctx?.uid;
  const steps = pageSteps || stepsFor(app, { first });
  const tourSteps = steps.filter((x) => !x.kind);
  const root = document.createElement('div');
  root.className = 'guide'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'guide-title');
  root.innerHTML = '<div class="guide-spot" aria-hidden="true"></div><div class="guide-card" tabindex="-1"></div>';
  document.body.append(root);
  const card = $('.guide-card', root); const spot = $('.guide-spot', root);
  const returnFocus = document.activeElement;
  let i = 0;

  const close = (route) => {
    if (!active) return;
    if (onDone) onDone(); else if (uid) write(uid, 'done');
    removeEventListener('resize', place); removeEventListener('keydown', onKey, true); removeEventListener('hashchange', onLeave);
    root.classList.add('leaving');
    setTimeout(() => root.remove(), 180);
    active = null;
    if (route && app.go) app.go(route);
    else if (returnFocus && returnFocus.focus) returnFocus.focus();
  };

  function place() {
    const s = steps[i]; const el = s.target && document.querySelector(s.target);
    root.classList.toggle('no-target', !el);
    if (!el) { card.style.top = card.style.bottom = ''; return; }
    // Bring it to the middle of the screen if the top bar or tab bar would cover it (items in those bars never scroll).
    const r0 = el.getBoundingClientRect();
    const topSafe = (document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0) + 8;
    const bottomSafe = (document.querySelector('.tabbar')?.getBoundingClientRect().top || innerHeight) - 8;
    if (!el.closest('.topbar, .tabbar') && (r0.top < topSafe || r0.bottom > bottomSafe)) el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect(); const pad = 6;
    Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    // Put the card next to the highlighted element, on the side with room for it, and never off the screen.
    const h = card.offsetHeight, gap = 16, edge = 8;
    const fitsAbove = r.top - gap - h >= edge, fitsBelow = r.bottom + gap + h <= innerHeight - edge;
    const preferBelow = r.top + r.height / 2 <= innerHeight / 2;
    if (fitsAbove && !(preferBelow && fitsBelow)) { card.style.top = ''; card.style.bottom = `${innerHeight - r.top + gap}px`; }
    else { card.style.bottom = ''; card.style.top = `${Math.max(edge, Math.min(r.bottom + gap, innerHeight - h - edge))}px`; }
  }

  function show(n) {
    i = Math.max(0, Math.min(steps.length - 1, n));
    const s = steps[i];
    const last = i === steps.length - 1;
    const dots = `<div class="guide-dots" aria-hidden="true">${steps.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>`;
    let html;
    if (s.kind === 'welcome') {
      html = `<div class="guide-hero" aria-hidden="true">${icon(s.icon)}</div>
        <h2 id="guide-title">${esc(s.title)}</h2><p>${esc(s.body)}</p>
        <ul class="guide-chips">${s.chips.map(([ic, t]) => `<li>${icon(ic)}<span>${esc(t)}</span></li>`).join('')}</ul>
        <div class="guide-actions"><button type="button" class="btn ghost" data-skip>Skip for now</button>
          <button type="button" class="btn primary" data-next>Show me around ${icon('arrow-right')}</button></div>`;
    } else if (s.kind === 'finish') {
      const t = s.tasks;
      html = `<div class="guide-hero done" aria-hidden="true">${icon(s.icon)}</div>
        <h2 id="guide-title">${esc(s.title)}</h2>
        <p class="guide-sub">${esc(t.heading)}</p>
        <ol class="guide-tasks">${t.items.map((x) => `<li class="${x.done ? 'done' : ''}"><a href="#/${esc(x.route)}" data-go="${esc(x.route)}">
          <span class="guide-tick" aria-hidden="true">${icon(x.done ? 'check' : x.icon)}</span><span>${esc(x.label)}</span>
          ${x.done ? '<span class="visually-hidden">Done</span>' : icon('chevron-right')}</a></li>`).join('')}</ol>
        ${t.note ? `<p class="guide-note">${esc(t.note)}</p>` : ''}
        <p class="guide-note">You can replay this tour from your account menu.</p>
        ${dots}<div class="guide-actions"><button type="button" class="btn ghost" data-back>${icon('arrow-left')} Back</button>
          <button type="button" class="btn primary" data-go="${esc(t.go)}">${esc(t.cta)}</button></div>`;
    } else {
      html = `<p class="guide-step">Step ${tourSteps.indexOf(s) + 1} of ${tourSteps.length}</p>
        <div class="guide-head"><span class="tile-icon" aria-hidden="true">${icon(s.icon)}</span><h2 id="guide-title">${esc(s.title)}</h2></div>
        <p>${esc(s.body)}</p>
        ${dots}<div class="guide-actions">${last ? '' : '<button type="button" class="btn ghost small" data-skip>Skip tour</button>'}<span class="spacer"></span>
          ${i > 0 ? `<button type="button" class="btn" data-back aria-label="Back">${icon('arrow-left')}</button>` : ''}
          ${last ? `<button type="button" class="btn primary" data-skip>Got it ${icon('check')}</button>`
            : `<button type="button" class="btn primary" data-next>Next ${icon('arrow-right')}</button>`}</div>`;
    }
    card.className = `guide-card is-${s.kind || 'tour'}`;
    card.innerHTML = html;
    $$('[data-next]', card).forEach((b) => { b.onclick = () => show(i + 1); });
    $$('[data-back]', card).forEach((b) => { b.onclick = () => show(i - 1); });
    $$('[data-skip]', card).forEach((b) => { b.onclick = () => close(); });
    $$('[data-go]', card).forEach((b) => { b.onclick = (e) => { e.preventDefault(); close(b.dataset.go); }; });
    place();
    ($('[data-next]', card) || $('.guide-actions .btn.primary', card) || card).focus();
  }

  // Keyboard: Esc skips, arrows move, Tab stays inside the card.
  function onKey(e) {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowRight' && i < steps.length - 1) { e.preventDefault(); show(i + 1); return; }
    if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); show(i - 1); return; }
    if (e.key === 'Tab') {
      const f = $$('a[href], button:not([disabled])', card); if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      else if (!card.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
    }
  }

  // A page tour belongs to its page: leaving the page ends it (and counts as seen).
  function onLeave() { close(); }
  active = { close, root };
  addEventListener('resize', place); addEventListener('keydown', onKey, true);
  if (pageSteps) addEventListener('hashchange', onLeave);
  show(0);
  if (first) { confetti(); setTimeout(() => active && confetti(), 650); }
}

// ------------------------------------------------------------- page tours: a short explanation the first time a page opens
const PAGE_KEY = (uid, page) => `onz-page-tour-v1:${page}:${uid}`;
export const PAGE_TOURS = {
  community: () => [
    { target: '.community-league-summary', icon: 'trophy', title: 'Your KK', body: 'This is your college, its rank and its total points. All the points you collect add to it.' },
    { target: '#lb', icon: 'chart-column', title: 'The leaderboard', body: 'See how your KK compares with the others. The KK with the most points wins prizes!' },
  ],
};
export const pageTourSeen = (uid, page) => store.get(PAGE_KEY(uid, page)) === 'done';
/** Shows a page's tour (replay: always; otherwise only the first time, and never on top of another tour). */
export function startPageTour(app, page, { replay = false, has = (sel) => !!document.querySelector(sel) } = {}) {
  const uid = app.ctx?.uid; if (!uid || !PAGE_TOURS[page] || isOpen()) return false;
  if (!replay && (pageTourSeen(uid, page) || isPending(uid))) return false;
  const steps = PAGE_TOURS[page]().filter((x) => has(x.target));
  if (!steps.length) return false;
  start(app, { steps, onDone: () => store.set(PAGE_KEY(uid, page), 'done') });
  return true;
}

/** After the first screen renders: start the welcome if this account was just created. */
export function maybeStart(app) {
  if (app.ctx?.uid && isPending(app.ctx.uid)) start(app, { first: true });
}
