// "Here now": who's at each campus shop right now, without anyone's live location.
// A student appears at a shop for 2 hours after they check out there, only if they switched on
// "Show me on the campus map". Others see their first name, college and avatar, never a position.
// Rules: firestore.rules (presence, waves). Data: data.js (watchPresence, sendWave, setMapVisibility).
import * as D from './data.js';
import * as AV from './avatar.js';
import { $, $$, esc, icon, toast, sheet, closeSheet, busy, errText, timeAgo } from './ui.js';

const face = (p, size = 28) => `<span class="hn-face" style="width:${size}px;height:${size}px" title="${esc(p.first)}">${AV.avatarSVG(p.avatar || AV.defaultFor(p.uid), { variant: 'head', size, title: p.first })}</span>`;
const stack = (people, max = 4, size = 28) => `<span class="hn-stack">${people.slice(0, max).map((p) => face(p, size)).join('')}${people.length > max ? `<span class="hn-more">+${people.length - max}</span>` : ''}</span>`;
const sameCollege = (app, people) => people.filter((p) => p.uid !== app.ctx.uid && p.college && p.college === app.profile?.college).length;
const others = (app, people) => people.filter((p) => p.uid !== app.ctx.uid);
const countText = (n) => (n === 1 ? '1 student here' : `${n} students here`);

// On the map: a little bubble of faces next to each shop pin.
function crowdHTML(app, g) {
  const n = g.people.length; const you = g.people.some((p) => p.uid === app.ctx.uid);
  return `<div class="kk-crowd-anchor"><div class="kk-crowd${you ? ' you' : ''}">${stack(g.people, 3, 24)}<b>${n}</b></div></div>`;
}

export function hereNowSection(app) {
  if (!D.featureOn(app.rules, 'hereNow')) return '';
  const on = !!app.profile?.showOnMap;
  return `<section class="section" id="herenow-sec">
    <div class="head"><h2>${icon('users')} Here now</h2><button class="link" id="hn-settings">${on ? 'You’re visible' : 'Show me'}</button></div>
    ${on ? '' : `<div class="card row hn-invite"><span class="tile-icon">${icon('map-pin')}</span><div class="grow"><h3>See who’s around campus</h3>
      <p class="faint">Switch on “Show me on the campus map” to appear at a shop for 2 hours after you check out there. Only your first name and avatar, never your exact location.</p></div>
      <button class="btn small primary" id="hn-on">Show me</button></div>`}
    <div id="herenow" class="stack" style="margin-top:10px"><p class="faint">Loading who’s around…</p></div>
  </section>`;
}

// Starts the live list (and the map bubbles, when a map is given). Returns a stop function.
export function mountHereNow(root, app, { getMap, merchants = () => app._merchants || [] } = {}) {
  if (!D.featureOn(app.rules, 'hereNow')) return { stop() {}, redraw() {} };
  let groups = [];
  const box = $('#herenow', root);
  const draw = () => {
    const ms = new Map(merchants().map((m) => [m.id, m]));
    const mine = groups.find((g) => g.people.some((p) => p.uid === app.ctx.uid));
    if (box) {
      box.innerHTML = groups.length ? groups.map((g) => {
        const n = g.people.length; const c = sameCollege(app, g.people);
        return `<button class="card hn-zone${mine && mine.zone === g.zone ? ' you' : ''}" data-zone="${esc(g.zone)}">
          ${stack(g.people)}<span class="grow"><b>${esc(g.name)}</b><span class="faint">${countText(n)}${c ? ` · ${c} from ${esc(app.profile.college)}` : ''}${mine && mine.zone === g.zone ? ' · you’re here' : ''}</span></span>${icon('chevron-right')}</button>`;
      }).join('') : `<div class="card empty">${icon('users')}<p>Nobody is showing on the map right now. Check out at a shop to be the first.</p></div>`;
      $$('.hn-zone', box).forEach((b) => { b.onclick = () => zoneSheet(app, groups.find((g) => g.zone === b.dataset.zone), mine); });
    }
    const map = getMap && getMap();
    if (map && map.setCrowds) {
      map.setCrowds(groups.map((g) => { const m = ms.get(g.zone); return m && Number.isFinite(m.lat) ? { lat: m.lat, lng: m.lng, title: `${countText(g.people.length)} at ${g.name}`, html: crowdHTML(app, g), onTap: () => zoneSheet(app, g, mine) } : null; }).filter(Boolean));
    }
  };
  const stop = D.watchPresence(app.ctx, (rows) => { groups = D.groupPresence(rows); draw(); }, (e) => { if (box) box.innerHTML = `<div class="card empty"><p>${esc(errText(e))}</p></div>`; });
  const set = $('#hn-settings', root); if (set) set.onclick = () => mapSettingsSheet(app);
  const onBtn = $('#hn-on', root); if (onBtn) onBtn.onclick = () => mapSettingsSheet(app, true);
  return { stop, redraw: draw };
}

function zoneSheet(app, g, mine) {
  if (!g) return;
  const here = mine && mine.zone === g.zone;
  const me = g.people.find((p) => p.uid === app.ctx.uid);
  const el = sheet(`<h2>${esc(g.name)}</h2><p class="muted">${countText(g.people.length)} right now. People show here for 2 hours after they check out.</p>
    <div class="stack" style="margin-top:12px">${g.people.map((p) => `<div class="row hn-person">${face(p, 44)}
      <div class="grow"><b>${esc(p.first)}${p.uid === app.ctx.uid ? ' (you)' : ''}</b><span class="faint">${esc(p.college || '')} · ${esc(timeAgo(D.toMs(p.at)))}</span></div>
      ${p.uid !== app.ctx.uid && here ? `<button class="btn small" data-wave="${esc(p.uid)}">${icon('hand')} Wave</button>` : ''}</div>`).join('')}</div>
    ${!here ? `<p class="faint" style="margin-top:12px">Check out here to say hi: you can wave at people at the same shop.</p>` : ''}
    ${me ? `<button class="btn ghost block" id="hn-hide" style="margin-top:14px">${icon('eye-off')} Hide me now</button>` : ''}`);
  $$('[data-wave]', el).forEach((b) => {
    b.onclick = async () => {
      const sent = await busy(b, async () => {
        try { await D.sendWave(app.ctx, b.dataset.wave, { first: me.first, avatar: me.avatar }, g.name); return true; }
        catch (e) { toast(errText(e), true); return false; }
      });
      if (sent) { b.innerHTML = `${icon('check')} Waved`; b.disabled = true; }
    };
  });
  const hide = $('#hn-hide', el);
  if (hide) hide.onclick = () => busy(hide, async () => { await D.hideMe(app.ctx); closeSheet(); toast('You’re off the map. You’ll appear again at your next check-out.'); });
}

// The privacy choice: off by default; everyone or only your college.
export function mapSettingsSheet(app, turnOn = false) {
  const p = app.profile || {}; const on = turnOn || !!p.showOnMap; const aud = p.mapAudience === 'college' ? 'college' : 'everyone';
  const el = sheet(`<h2>Show me on the campus map</h2>
    <p class="muted">When this is on, you appear at a shop for <b>2 hours</b> after you check out there, so friends can see you’re around and say hi.</p>
    <ul class="hn-rules">
      <li>${icon('check')}<span>Others see your <b>first name, college and avatar</b>.</span></li>
      <li>${icon('check')}<span>Never your exact location, and never between check-outs.</span></li>
      <li>${icon('check')}<span>Merchants can’t see it. You can hide yourself any time.</span></li>
    </ul>
    <form id="hn-form" class="stack" style="margin-top:12px">
      <label class="row between" style="gap:12px"><span><b>Show me on the campus map</b></span><span class="switch"><input type="checkbox" name="on" ${on ? 'checked' : ''} aria-label="Show me on the campus map"><span></span></span></label>
      <fieldset class="stack" style="border:0;padding:0;margin:0"><legend class="faint">Who can see me</legend>
        <label class="check"><input type="radio" name="aud" value="everyone" ${aud === 'everyone' ? 'checked' : ''}> All +Onz students</label>
        <label class="check"><input type="radio" name="aud" value="college" ${aud === 'college' ? 'checked' : ''}> Only students from my college${p.college ? ` (${esc(p.college)})` : ''}</label>
      </fieldset>
      <button class="btn primary block">Save</button>
    </form>
    <p class="faint" style="margin-top:10px">Saving takes you off the map now; you’ll appear with the new setting at your next check-out.</p>`);
  $('#hn-form', el).onsubmit = (e) => {
    e.preventDefault(); const f = e.target; const btn = $('button', f);
    busy(btn, async () => {
      try {
        await D.setMapVisibility(app.ctx, f.on.checked, f.aud.value);
        app.profile = { ...app.profile, showOnMap: f.on.checked, mapAudience: f.aud.value }; app.ctx.profile = app.profile;
        closeSheet(); toast(f.on.checked ? 'Done. You’ll show on the map after your next check-out.' : 'You won’t show on the campus map.');
        const link = document.getElementById('hn-settings'); if (link) link.textContent = f.on.checked ? 'You’re visible' : 'Show me';
        const inv = document.querySelector('.hn-invite'); if (inv && f.on.checked) inv.remove();
      } catch (err) { toast(errText(err), true); }
    });
  };
}

// Waves for me: a short message while the app is open.
export function startWaveListener(app) {
  return D.watchWaves(app.ctx, (w) => {
    toast(`${w.fromFirst} waved at you at ${w.zoneName}`);
    try { navigator.vibrate && navigator.vibrate([40, 30, 40]); } catch { /* not allowed */ }
    D.clearWave(app.ctx, w.id);
  });
}
