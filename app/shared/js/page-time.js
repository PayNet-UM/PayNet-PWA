// Time spent on each page, as ANONYMOUS daily totals (privacy notice: "How the app is used").
// Approved by the team lead on 24 Nov 2026: no names, uids or emails. Each signed-in student's app adds its time to
// pageTime/{day}_{page} with Firestore increments, so the documents only ever hold totals for everyone together.
//
// What counts: time while the page is on screen AND the student did something (tap, key, scroll) in the last
// 2 minutes, so a phone left open on a page doesn't count. A visit also records how far down the page they scrolled:
// r25/r50/r75/r100 count visits that reached at least that far (r100 = the bottom, 95% or more).
// The daily summary (daily-stats.js) turns these into minutes per student per day and a per-page table.
import { dayKey } from './data.js';

// Student pages that are tracked (firestore.rules allows exactly these); anything else counts as 'other'.
export const PAGE_NAMES = {
  home: 'Home', explore: 'Overview', merchant: 'Shop page', rewards: 'Rewards', feskum: 'FESKUM', events: 'Campus Events',
  bayar: 'Pay Cashless', learn: 'Learn & Earn', survey: 'Money check', community: 'Community', leagues: 'Leagues',
  avatar: 'Avatar', me: 'Me', feedback: 'Questions and feedback', 'delete-account': 'Delete my account',
  points: 'Points guide', about: 'About us', contact: 'Contact us', other: 'Other pages',
};
export const PAGE_KEYS = Object.keys(PAGE_NAMES);
export const IDLE_MS = 2 * 60 * 1000;     // no taps, keys or scrolling for this long: stop counting
export const TICK_MS = 5000;              // how often time is added up
export const FLUSH_MS = 60 * 1000;        // how often totals are saved
export const MAX_VIEW_MS = 30 * 60 * 1000; // one visit never counts for more than 30 minutes
export const MIN_VIEW_MS = 1000;          // a visit shorter than this (a redirect) isn't counted as a visit
export const pageKey = (hash) => { const k = String(hash || '').replace(/^#\/?/, '').split(/[/?]/)[0] || 'home'; return PAGE_KEYS.includes(k) ? k : 'other'; };
const REACH = [['r25', 25], ['r50', 50], ['r75', 75], ['r100', 95]];

// The counting, without the browser: tell it what happens and when, and take() returns the totals to save.
export function createPageTimer(start = Date.now()) {
  let view = null, lastTick = start, lastActive = start, visible = true;
  const pending = {};
  const slot = (k) => (pending[k] ||= { ms: 0, views: 0, r25: 0, r50: 0, r75: 0, r100: 0 });
  const tick = (now) => {
    if (now < lastTick) return; // never count backwards (a clock change)
    if (view && visible) {
      // Count time since the last tick, but only up to IDLE_MS after the last activity, and never a long gap.
      const until = Math.min(now, lastActive + IDLE_MS);
      const add = Math.max(0, Math.min(until - lastTick, TICK_MS * 3, MAX_VIEW_MS - view.ms));
      view.ms += add; slot(view.key).ms += add;
    }
    lastTick = now;
  };
  const end = (now) => {
    if (!view) return;
    tick(now);
    if (view.ms >= MIN_VIEW_MS) {
      const s = slot(view.key); s.views += 1;
      for (const [k, pct] of REACH) if (view.reach >= pct) s[k] += 1;
    }
    view = null;
  };
  return {
    open(key, now, reach = 0) { end(now); view = { key, ms: 0, reach }; lastTick = now; lastActive = now; },
    active(now) { tick(now); lastActive = now; },
    scrolled(pct, now) { this.active(now); this.seen(pct); },
    // How much of the page is on screen, without counting as activity (a short page is read without scrolling).
    seen(pct) { if (view) view.reach = Math.max(view.reach, Math.round(pct)); },
    hidden(now) { tick(now); visible = false; },
    shown(now) { lastTick = now; visible = true; lastActive = now; },
    tick, end,
    // Totals since the last take(): the visit in progress keeps counting, its time so far is included.
    take(now) { tick(now); const out = {}; for (const [k, v] of Object.entries(pending)) if (v.ms || v.views) out[k] = { ...v }; for (const k of Object.keys(pending)) delete pending[k]; return out; },
    get current() { return view && { ...view }; },
  };
}

// How far down the page the bottom of the screen is, in % (a page that fits the screen counts as read to the end).
export function scrollReach(doc = document, host = window) {
  const total = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0);
  if (total <= host.innerHeight + 4) return 100;
  return Math.min(100, ((host.scrollY + host.innerHeight) / total) * 100);
}

// Starts tracking for a signed-in student. Returns { stop, flush }.
export function startPageTime(ctx, { doc = document, host = window, now = Date.now } = {}) {
  const timer = createPageTimer(now());
  let stopped = false, saving = Promise.resolve();
  const save = () => {
    const totals = timer.take(now()); const day = dayKey(now());
    const writes = Object.entries(totals);
    if (!writes.length) return saving;
    const { sdk, db } = ctx;
    const inc = (v) => sdk.increment(v);
    saving = saving.then(() => Promise.all(writes.map(([page, t]) => sdk.setDoc(sdk.doc(db, 'pageTime', `${day}_${page}`),
      { day, page, ms: inc(Math.round(t.ms)), views: inc(t.views), r25: inc(t.r25), r50: inc(t.r50), r75: inc(t.r75), r100: inc(t.r100) }, { merge: true })
      .catch(() => {})))); // analytics only: a refused or offline save is simply skipped
    return saving;
  };
  const openCurrent = () => setTimeout(() => { if (!stopped) timer.open(pageKey(host.location.hash), now(), 0); }, 0);
  const onHash = () => { timer.end(now()); openCurrent(); };
  const onActive = () => timer.active(now());
  const onScroll = () => timer.scrolled(scrollReach(doc, host), now());
  const onVisibility = () => { if (doc.visibilityState === 'hidden') { timer.hidden(now()); save(); } else timer.shown(now()); };
  const onLeave = () => { timer.end(now()); save(); };
  const onBack = () => { if (!timer.current) openCurrent(); };
  const events = [[host, 'hashchange', onHash], [doc, 'pointerdown', onActive], [doc, 'keydown', onActive], [host, 'scroll', onScroll, { passive: true }],
    [doc, 'visibilitychange', onVisibility], [host, 'pagehide', onLeave], [host, 'pageshow', onBack]];
  for (const [t, name, f, o] of events) t.addEventListener(name, f, o);
  const tickTimer = setInterval(() => {
    timer.tick(now());
    if (doc.visibilityState !== 'hidden' && !doc.querySelector('#view[aria-busy]')) timer.seen(scrollReach(doc, host));
  }, TICK_MS);
  const flushTimer = setInterval(save, FLUSH_MS);
  if (doc.visibilityState === 'hidden') timer.hidden(now());
  openCurrent();
  return {
    flush: () => { timer.tick(now()); return save(); },
    stop: () => { stopped = true; clearInterval(tickTimer); clearInterval(flushTimer); for (const [t, name, f, o] of events) t.removeEventListener(name, f, o); timer.end(now()); save(); },
  };
}
