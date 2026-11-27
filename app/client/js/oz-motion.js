// +Onz motion (Figma Motion page 55:5356; reduced motion = 150 ms dissolve). Modelled on native apps seen on Mobbin
// (OpenTable, Brainly and Ladder capsule tab bars; Tide Guide settings push; Duolingo "Pick your look"):
//  - switching tabs swaps the screen instantly; only the selected pill moves, on a spring
//  - opening a sub-page pushes it in from the right over the previous page, which slides back a little and dims;
//    Back reverses it (phones only; the web keeps instant page changes)
//  - segmented controls move their thumb; content switches instantly
//  - Onzo settles when an item goes on; images cross-fade
import { tapOrigin } from './ui.js';
export { tapOrigin };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const can = () => typeof Element.prototype.animate === 'function';
const phone = () => matchMedia('(max-width: 1023.98px)').matches;
export const EASE = { out: 'cubic-bezier(.22,1,.36,1)', push: 'cubic-bezier(.32,.72,0,1)', spring: 'cubic-bezier(.25,1,.5,1)' }; // "spring" = critically damped: no bounce past the target

let lastPath = '', forced = 0;
/** Force the next route change to push (1) or pop (-1), for links that open a page in the current context. */
export const nextRouteDir = (d) => { forced = d; };
const depth = (p) => p.split('/').filter(Boolean).length;
/** Before a route renders: decide whether this is a push/pop and, if so, keep a snapshot of the outgoing page. */
// Pages that open like a full-height sheet from Home (rise from the bottom, drop back down), not a sideways push.
const RISE = new Set(['events', 'feskum']);
const PEER_ROUTES = new Set(['leagues', 'community', 'explore']);
// Pages that are separate routes but are children of another page: opening one pushes, going back pops.
const PARENT = { activities: 'home', learn: 'home', explore: 'home', bayar: 'home', 'claim-deal': 'home', survey: 'learn', merchant: 'explore',
  avatar: 'me', feedback: 'me', about: 'me', contact: 'about', 'delete-account': 'me', points: 'rewards' };
const activeRouteMotion = new WeakMap();
export function routeLeave(view, path, snapshot = null) {
  activeRouteMotion.get(view)?.();
  const prev = lastPath; const f = forced; forced = 0;
  if (!can() || reduced() || !phone() || !prev || prev === path || (!snapshot && view.querySelector('.route-loading'))) return null;
  const a = prev.split('/')[0], b = path.split('/')[0];
  let dir;
  if (f) dir = f;
  else if (a !== b) {
    // Tab switches stay instant; only the rise pages animate, and only when entered from / left to another page.
    if (RISE.has(b) && !RISE.has(a)) dir = 2; else if (RISE.has(a) && !RISE.has(b)) dir = -2;
    else if (PARENT[b] === a) dir = 1; else if (PARENT[a] === b) dir = -1; // child pages push from their parent
    else return null;
  } else {
    if (PEER_ROUTES.has(a)) return null;
    dir = Math.sign(depth(path) - depth(prev));
    if (!dir) return null;
  }
  const r = view.getBoundingClientRect();
  const ghost = snapshot || view.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
  ghost.classList.add('oz-route-ghost');
  Object.assign(ghost.style, { top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${innerHeight - r.top}px` });
  ghost.style.visibility = 'hidden';
  document.body.append(ghost);
  setTimeout(() => ghost.remove(), 1500); // never left behind if the new route is abandoned
  return { ghost, dir };
}
/** After it renders: run the push (dir 1) or pop (dir -1). Tab switches pass null and stay instant. */
export function routeEnter(view, leaving, path) {
  lastPath = path;
  if (!leaving?.ghost.isConnected) return;
  const { ghost, dir } = leaving;
  const opts = { duration: dir > 0 ? 300 : 230, easing: dir > 0 ? EASE.push : 'cubic-bezier(.4,0,1,1)' };
  ghost.style.visibility = '';
  view.classList.add('oz-route-in'); view.style.zIndex = dir > 0 ? '6' : '4';
  const animations = [];
  const run = (element, frames) => {
    const animation = element.animate(frames, opts);
    animations.push(animation);
    return animation;
  };
  const done = () => {
    if (activeRouteMotion.get(view) !== done) return;
    activeRouteMotion.delete(view);
    animations.forEach((animation) => animation.cancel());
    ghost.remove(); view.classList.remove('oz-route-in'); view.style.zIndex = '';
  };
  activeRouteMotion.set(view, done);
  if (dir === 2 || dir === -2) { // rise / drop on the iOS sheet curve; the page underneath dims slightly
    if (dir === 2) {
      run(view, [{ transform: 'translateY(100%)', boxShadow: '0 -8px 32px rgba(10,15,59,.14)' }, { transform: 'none', boxShadow: '0 -8px 32px rgba(10,15,59,0)' }]);
      run(ghost, [{ filter: 'brightness(1)' }, { filter: 'brightness(.94)' }]).finished.then(done, done);
    } else {
      ghost.style.zIndex = '6';
      run(view, [{ filter: 'brightness(.94)' }, { filter: 'brightness(1)' }]);
      run(ghost, [{ transform: 'none' }, { transform: 'translateY(100%)' }]).finished.then(done, done);
    }
    return;
  }
  if (dir > 0) {
    run(view, [{ transform: 'translateX(100%)', boxShadow: '-8px 0 24px rgba(10,15,59,.08)' }, { transform: 'none', boxShadow: 'none' }]);
    run(ghost, [{ transform: 'none', filter: 'brightness(1)' }, { transform: 'translateX(-30%)', filter: 'brightness(.92)' }]).finished.then(done, done);
  } else {
    ghost.style.zIndex = '6';
    run(view, [{ transform: 'translateX(-30%)', filter: 'brightness(.92)' }, { transform: 'none', filter: 'brightness(1)' }]);
    run(ghost, [{ transform: 'none' }, { transform: 'translateX(100%)' }]).finished.then(done, done);
  }
}

/** Onzo settles: a small give from the feet, no overshoot. Uses the `scale` property, never `transform`, so a
 *  centring transform on the element (the wardrobe's translateX(-50%)) is left alone. */
export function pop(el, delay = 0) {
  if (!can() || reduced()) return;
  el.style.transformOrigin = '50% 100%';
  el.animate([{ scale: '1' }, { scale: '1.01 .98', offset: .4 }, { scale: '1' }], { duration: 260, delay, easing: EASE.out });
}
/**
 * The wardrobe "putting it on" moment (Duolingo / Finch outfit pickers on Mobbin): only the piece that changed moves.
 *  hat     – drops onto the head from above, then Onzo gives slightly under it
 *  eyewear – slides down onto the face
 *  neck    – wraps in from 0.97 (entrances never start from 0)
 *  colour / look / reset – the previous Onzo cross-fades out over the new one
 * `ghostHTML` is the previous drawing, used for the cross-fade.
 */
export function wear(stage, kind, ghostHTML = '') {
  if (!can() || reduced() || !kind) return;
  const svg = stage.querySelector('svg'); if (!svg) return;
  const layer = (cls) => svg.querySelector(`.${cls}`);
  const enter = (el, from, ms = 360) => { if (!el) return null; el.style.transformBox = 'fill-box'; el.style.transformOrigin = '50% 100%';
    return el.animate([{ opacity: 0, ...from }, { opacity: 1, translate: '0 0', scale: '1' }], { duration: ms, easing: EASE.out, fill: 'backwards' }); };
  if (kind === 'hat') { if (enter(layer('onz-hat'), { translate: '0 -28px', scale: '.97' }, 380)) pop(svg, 240); else pop(svg); return; }
  if (kind === 'eyewear') { enter(layer('onz-eyewear'), { translate: '0 -10px' }, 300) || pop(svg); return; }
  if (kind === 'neck') { enter(layer('onz-neck'), { scale: '.97' }, 280) || pop(svg); return; }
  if (!ghostHTML) return;
  const ghost = document.createElement('div'); ghost.className = 'oz-wear-ghost'; ghost.setAttribute('aria-hidden', 'true'); ghost.innerHTML = ghostHTML;
  stage.append(ghost);
  const done = () => ghost.remove();
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-out' }).finished.then(done, done);
}
/**
 * Hand a released drag to a spring that keeps the release velocity (bounce 0, ~0.5 s), instead of a fixed-duration
 * transition. `from` is the current offset in px, `velocity` px/s toward +. Animates the `translate` property on `axis`.
 * Critically damped: x(t) = (x0 + (v0 + w·x0)·t)·e^(−w·t).
 */
export function springBack(el, from, velocity = 0, { axis = 'x', duration = .5 } = {}) {
  const put = (v) => (axis === 'x' ? `${v}px 0` : `0 ${v}px`);
  if (!can() || reduced() || Math.abs(from) < .5) { el.style.translate = ''; return null; }
  const w = 9.5 / duration; const frames = []; const steps = Math.round(duration * 60);
  for (let k = 0; k <= steps; k++) { const t = (k / steps) * duration; frames.push({ translate: put((from + (velocity + w * from) * t) * Math.exp(-w * t)) }); }
  frames[frames.length - 1] = { translate: put(0) };
  el.style.translate = '';
  return el.animate(frames, { duration: duration * 1000, easing: 'linear' });
}
/** Resistance that grows the further you pull (iOS rubber band): small pulls track the finger, long pulls barely move. */
export const rubber = (dx, size) => Math.sign(dx) * (1 - 1 / ((Math.abs(dx) * .55) / size + 1)) * size;
/** Wrong answer: shake the field as well as turning it red (360 ms, decaying). */
export function shake(el) {
  if (!can() || reduced()) return;
  el.animate([0, -10, 10, -6, 6, -3, 0].map((x) => ({ translate: `${x}px 0` })), { duration: 360, easing: 'ease-out' });
}

/** Swap an image (wardrobe background) with a cross-fade instead of a hard cut. */
export function crossfade(img, src) {
  if (!can() || reduced()) { img.src = src; return; }
  const ghost = img.cloneNode(); ghost.removeAttribute('id'); ghost.classList.add('oz-fade-ghost'); img.after(ghost);
  img.src = src;
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-out' }).finished.then(() => ghost.remove(), () => ghost.remove());
}

// Selection pills. Each group has one thumb that springs to the selected item; groups that re-render with the route
// (Leagues tabs) start from where their thumb last was. In the nav bar the other tabs glide to their new places too.
const GROUPS = '.oz-tabbar, .oz-lg-tabs, .oz-ctabs, .oz-seg, .av-modes, .av-categories';
const ACTIVE = '[aria-current="page"], [aria-selected="true"], [aria-pressed="true"], .on';
const last = new Map();
const items = (group, thumb) => [...group.children].filter((c) => c !== thumb && c.offsetParent !== null);
function place(group, thumb, animate) {
  const active = items(group, thumb).find((c) => c.matches(ACTIVE));
  if (!active) { thumb.style.opacity = '0'; return; }
  // Layout offsets, not getBoundingClientRect: the nav icons are mid-glide (a transform) when the selection changes,
  // and measuring them then left the pill short of the tab ("Me" spilling out of the bar). Every group is positioned,
  // so offsets share the thumb's origin.
  const to = { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight };
  thumb.style.transition = animate && !reduced() ? '' : 'none';
  Object.assign(thumb.style, { opacity: '1', width: `${to.w}px`, height: `${to.h}px`, transform: `translate(${to.x}px, ${to.y}px)` });
  if (!animate) { void thumb.offsetWidth; thumb.style.transition = ''; }
  last.set(group.dataset.thumbKey || group.className, to);
}
export function mountThumbs(root = document) {
  const stops = [];
  root.querySelectorAll(GROUPS).forEach((group) => {
    if (group.querySelector(':scope > .oz-thumb')) return;
    const thumb = document.createElement('i'); thumb.className = 'oz-thumb'; thumb.setAttribute('aria-hidden', 'true');
    group.classList.add('has-thumb'); group.prepend(thumb);
    const key = group.dataset.thumbKey || group.className; const from = last.get(key);
    if (from && !reduced()) {
      thumb.style.transition = 'none';
      Object.assign(thumb.style, { opacity: '1', width: `${from.w}px`, height: `${from.h}px`, transform: `translate(${from.x}px, ${from.y}px)` });
      void thumb.offsetWidth; thumb.style.transition = '';
      requestAnimationFrame(() => place(group, thumb, true));
    } else place(group, thumb, false);
    // Nav bar: remember where every tab was so the icons glide instead of jumping when the selected tab widens.
    const isNav = group.classList.contains('oz-tabbar'); let rects = null;
    const snap = () => { rects = new Map(items(group, thumb).map((c) => [c, c.getBoundingClientRect().left])); };
    if (isNav) { snap(); group.addEventListener('click', snap, true); }
    let changedAt = 0;
    const mo = new MutationObserver(() => {
      changedAt = performance.now();
      if (isNav && rects && can() && !reduced()) {
        for (const [c, before] of rects) { const dx = before - c.getBoundingClientRect().left; if (Math.abs(dx) > 1) c.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 300, easing: EASE.spring }); }
        snap();
      }
      place(group, thumb, true);
    });
    mo.observe(group, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-current', 'aria-pressed', 'class', 'hidden'] });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => place(group, thumb, performance.now() - changedAt < 400)) /* a tab change can resize the group (the panel below changes the page height and the scrollbar): keep the glide instead of snapping */ : null; ro?.observe(group);
    stops.push(() => { mo.disconnect(); ro?.disconnect(); if (isNav) group.removeEventListener('click', snap, true); });
  });
  return () => stops.forEach((s) => s());
}

// ---------------------------------------------------------------------------------------------------------------
// Micro-interactions, round 6 (Mobbin: Duolingo / Brilliant "+15 XP", Crumbl "You earned", Speak and Brilliant
// streaks, Apple Maps and AllTrails sheets). Rules: translate / scale / opacity only, no overshoot, nothing under
// reduced motion. Every helper is safe to call when the element is gone.

const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
/**
 * Points come from where they were earned: a "+N pts" chip leaves the tapped control and travels to the points pill,
 * which then brightens once while it counts up. Without a recent tap (points arriving from the server) only the pill
 * reacts. Called from the profile watcher whenever the balance goes up.
 */
export function flyPoints(delta) {
  if (!(delta > 0) || !can()) return;
  const target = [...document.querySelectorAll('.oz-points-pill, [data-bind=points]')].find(visible);
  if (!target) return;
  const flash = () => target.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.18) saturate(1.2)', offset: .35 }, { filter: 'brightness(1)' }], { duration: 520, easing: 'ease-out' });
  const from = tapOrigin();
  if (reduced() || !from) { if (!reduced()) flash(); return; }
  const to = target.getBoundingClientRect();
  const chip = document.createElement('div');
  chip.className = 'oz-fly-pts'; chip.setAttribute('aria-hidden', 'true'); chip.textContent = `+${delta.toLocaleString('en-MY')} pts`;
  document.body.append(chip);
  const w = chip.offsetWidth, h = chip.offsetHeight;
  const x0 = from.left + from.width / 2 - w / 2, y0 = from.top + from.height / 2 - h / 2;
  const x1 = to.left + to.width / 2 - w / 2, y1 = to.top + to.height / 2 - h / 2;
  const lift = Math.min(64, Math.abs(y1 - y0) * .25 + 24); // a short arc up and over, not a straight slide
  chip.style.left = '0px'; chip.style.top = '0px';
  const a = chip.animate([
    { translate: `${x0}px ${y0}px`, scale: '.97', opacity: 0 },
    { translate: `${x0}px ${y0 - 18}px`, scale: '1', opacity: 1, offset: .18 },
    { translate: `${(x0 + x1) / 2}px ${Math.min(y0, y1) - lift}px`, scale: '1', opacity: 1, offset: .6 },
    { translate: `${x1}px ${y1}px`, scale: '.6', opacity: 0 },
  ], { duration: 760, easing: EASE.out, fill: 'forwards' });
  const done = () => chip.remove();
  a.finished.then(() => { done(); flash(); }, done);
}

/** The streak flame flares once (a check-in), on top of its continuous burn. Animates the wrapper's `scale`. */
export function flare(el) {
  if (!el || !can() || reduced()) return;
  el.style.transformOrigin = '50% 100%';
  el.animate([{ scale: '1' }, { scale: '1.12', filter: 'brightness(1.15)', offset: .35 }, { scale: '1' }], { duration: 620, easing: EASE.out });
}

/** A removed row folds away (height, padding, margin and opacity) instead of the list jumping. Resolves when gone. */
export function collapse(el, { remove = true } = {}) {
  const end = () => { if (remove) el.remove(); };
  if (!el || !el.isConnected) return Promise.resolve();
  if (!can() || reduced()) { end(); return Promise.resolve(); }
  const cs = getComputedStyle(el); const h = el.offsetHeight;
  el.style.overflow = 'hidden';
  const a = el.animate([
    { height: `${h}px`, opacity: 1, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, marginBottom: cs.marginBottom },
    { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' },
  ], { duration: 220, easing: EASE.out, fill: 'forwards' });
  return a.finished.then(end, end);
}

// Progress fills from empty the first time it scrolls into view (goal-gradient), once per bar per session.
const FILL = '[role=progressbar] > i, [role=progressbar] > span, .oz-progress > i, .oz-progress-fill, .oz-abar > i, .oz-lvl-fill, .mer-progress > i';
const filled = new WeakSet();
let fillIO = null;
export function fillOnView(root = document) {
  if (!can() || reduced() || typeof IntersectionObserver !== 'function') return;
  fillIO = fillIO || new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return; fillIO.unobserve(e.target);
    e.target.style.transformOrigin = 'left center';
    e.target.animate([{ scale: '0 1' }, { scale: '1 1' }], { duration: 600, easing: EASE.out, delay: 80, fill: 'backwards' });
  }), { threshold: .6 });
  root.querySelectorAll(FILL).forEach((bar) => { if (filled.has(bar) || !bar.offsetWidth) return; filled.add(bar); fillIO.observe(bar); });
}
