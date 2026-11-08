// Attendance-based friend place sharing is paused. Friendship management remains active.
import * as D from './data.js';
import * as AV from './avatar.js';
import { $, $$, esc, icon, toast, sheet, closeSheet, busy, errText, timeAgo } from './ui.js';

const face = (p, size = 28) => `<span class="hn-face" style="width:${size}px;height:${size}px" title="${esc(p.first)}">${AV.avatarSVG(p.avatar || AV.defaultFor(p.uid), { variant: 'head', size, title: p.first })}</span>`;
const stack = (people, max = 4, size = 28) => `<span class="hn-stack">${people.slice(0, max).map((p) => face(p, size)).join('')}${people.length > max ? `<span class="hn-more">+${people.length - max}</span>` : ''}</span>`;
const sameCollege = (app, people) => people.filter((p) => p.uid !== app.ctx.uid && p.college && p.college === app.profile?.college).length;
const countText = (n) => (n === 1 ? '1 person here' : `${n} people here`);

// On the map: a little bubble of faces next to each shop pin.
function crowdHTML(app, g) {
  const n = g.people.length; const you = g.people.some((p) => p.uid === app.ctx.uid);
  return `<div class="kk-crowd-anchor"><div class="kk-crowd${you ? ' you' : ''}">${stack(g.people, 3, 24)}<b>${n}</b></div></div>`;
}

export function hereNowSection() {
  return `<section class="section directory-friends"><div class="head"><h2>${icon('users')} Friends</h2><a href="#/community/friends">Manage friends ${icon('chevron-right')}</a></div><p class="faint">Place sharing is paused. Your GPS location stays private.</p></section>`;
}
export function mountHereNow() { return { stop() {}, redraw() {} }; }
export function mapSettingsSheet(app) {
  const el = sheet(`<h2>Place sharing is paused</h2><p class="muted">Your GPS location stays private.</p><a class="btn primary block" href="#/community/friends" data-close>Manage friends</a>`);
}

// Waves for me: a short message while the app is open.
export function startWaveListener(app) {
  return D.watchWaves(app.ctx, (w) => {
    toast(`${w.fromFirst} waved at you at ${w.zoneName}`);
    try { navigator.vibrate && navigator.vibrate([40, 30, 40]); } catch { /* not allowed */ }
    D.clearWave(app.ctx, w.id);
  });
}
