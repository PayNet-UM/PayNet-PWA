// Student app: +Onz hub, merchant map (Niaga Kita), check-outs, rewards, events, community,
// cashless guide (Bayar Kita), learning, avatar and profile.
import * as D from '../data.js';
import { feskumCard, feskumRender, feskumMount } from '../feskum.js';
import { eventCarousel, mountEventCarousel } from '../event-carousel.js';
import { CAFES } from '../cafes.js';
import { createMap, shopPinMap, hasPin, directionsUrl, wazeUrl, distanceM, fmtDistance, watchLocation, locate, UM_CENTER } from '../map.js';
import * as AV from '../avatar.js';
import { hereNowSection, mountHereNow, mapSettingsSheet } from '../herenow.js';
import { safeImg, $, $$, esc, icon, n, toast, sheet, closeSheet, confirmSheet, busy, errText, fmtDate, fmtDateTime, fmtTime, timeAgo,
  confetti, pointsFx, fxOn, setFx, renderQR, colorFor, initials, chevron, countUp } from '../ui.js';

export const defaultRoute = 'home';
const toMs = D.toMs;
const IDEA_SEGMENT = 'Temporary student entrepreneur';

// ------------------------------------------------------------- derived student facts
export const LEVELS = [[0, 'Starter'], [200, 'Regular'], [600, 'Explorer'], [1500, 'Campus champion'], [4000, 'Legend']];
const LEVEL_NAMES = LEVELS.map((l) => l[1]);
function levelOf(earned) {
  let i = 0; while (i + 1 < LEVELS.length && earned >= LEVELS[i + 1][0]) i++;
  const next = LEVELS[i + 1];
  return { name: LEVELS[i][1], next: next ? next[1] : null, pct: next ? Math.round(((earned - LEVELS[i][0]) / (next[0] - LEVELS[i][0])) * 100) : 100, toNext: next ? next[0] - earned : 0 };
}
const earnedTotal = (ledger) => ledger.filter((l) => l.delta > 0).reduce((s, l) => s + l.delta, 0);
function streak(visits) {
  const days = new Set(visits.map((v) => v.day));
  let s = 0; let d = Date.now();
  if (!days.has(D.dayKey(d))) d -= 86400000;
  while (days.has(D.dayKey(d))) { s++; d -= 86400000; }
  return s;
}
const firstName = (p) => (p?.name || '').split(' ')[0];
export const myAvatar = (app) => app.profile?.avatar || AV.defaultFor(app.ctx?.uid);
export const merchantLogo = (m, cls = 'logo') => (safeImg(m.logo) ? `<img class="${cls}" src="${safeImg(m.logo)}" alt="">`
  : `<span class="${cls}" style="background:${colorFor(m.name)}">${esc(initials(m.name))}</span>`);
const isIdea = (m) => m.segment === IDEA_SEGMENT;

// ------------------------------------------------------------- home: the +Onz hub
const PILLARS = [
  ['explore', 'Shops', 'shops', 'Find stalls that take QR.'],
  ['rewards', 'Rewards', 'rewards', 'Check out. Earn. Redeem.'],
  ['community', 'KK League', 'league', 'Your college vs the rest.'],
  ['learn', 'Financial Literacy', 'lessons', 'Learn more. Earn more.'],
];
// Use the supplied artwork directly, framed as sprites by CSS (no redraws).
const directoryArt = key => `<span class="onz-directory-art onz-art-${key}" aria-hidden="true"></span>`;
function homeRender(app) {
  const p = app.profile; const lvl = levelOf(earnedTotal(app.ledger)); const st = streak(app.visits);
  const prog = D.missionProgress(app.visits);
  const hasSurvey = app.ledger.some((l) => l.id === 'survey');
  return `
  <div class="onz-home-feature">
  <section class="kk-hero" aria-label="Your +Onz card">
    ${chevron('#ffffff', 16)}
    <a class="kk-hero-avatar" href="#/avatar" aria-label="Customise your avatar">${AV.avatarSVG(myAvatar(app), { size: 108, title: p.name })}<span class="kk-edit">${icon('pencil')}</span></a>
    <div class="kk-hero-text">
      <div class="who">Hi ${esc(firstName(p))}</div>
      <div class="balance"><strong data-bind="points">${n(p.points)}</strong><span>points</span></div>
      <div class="level">${esc(lvl.name)} <span class="progress"><i style="width:${lvl.pct}%"></i></span>${lvl.next ? `<span>${n(lvl.toNext)} to ${esc(lvl.next)}</span>` : ''}</div>
      ${st ? `<span class="streak">${icon('flame')} ${st}-day streak</span>` : ''}
    </div>
  </section>
  ${eventCarousel()}
  </div>
  <h2 class="kk-pillars-title">Explore</h2>
  <nav class="kk-pillars" aria-label="+Onz directories">${PILLARS.filter(([h]) => h !== 'explore' || D.featureOn(app.rules, 'shops')).map(([h, t, art, d]) => `<a href="#/${h}" class="kk-pillar"><span class="onz-art-frame">${directoryArt(art)}</span><h3>${t}</h3><p>${h === 'rewards' && !D.featureOn(app.rules, 'shops') ? 'Earn. Redeem.' : d}</p></a>`).join('')}</nav>
  ${!hasSurvey ? `<a class="card row" href="#/survey" style="margin-top:16px;text-decoration:none;color:inherit">
    <span class="tile-icon orange">${icon('target')}</span><span class="grow" style="flex:1"><h3>Money check</h3>
    <p class="muted" style="font-size:13px">2 minutes · +${app.rules.surveyBonus} points once</p></span>${icon('chevron-right')}</a>` : ''}
  ${D.featureOn(app.rules, 'shops') ? `<section class="section"><div class="head"><h2>Weekly missions</h2><a href="#/rewards">See all</a></div>
    <div class="home-missions">${D.MISSIONS.map((m) => missionTile(m, prog[m.id])).join('')}</div></section>` : ''}
`;
}
function missionTile(mission, progress) {
  const count = Math.min(progress, mission.target);
  const complete = count === mission.target;
  const goal = mission.id === 'five-days' ? 'Check-out days' : 'Different shops';
  return `<article class="card mission-tile ${complete ? 'is-complete' : ''}">
    <div class="row between">
      <span class="tile-icon">${icon(complete ? 'circle-check' : mission.icon)}</span>
      <span class="mission-xp">+${mission.bonus} pts</span>
    </div>
    <h3>${esc(mission.title)}</h3>
    <div class="mission-meter" role="progressbar" aria-label="${esc(mission.title)}"
      aria-valuemin="0" aria-valuemax="${mission.target}" aria-valuenow="${count}">
      ${Array.from({ length: mission.target }, (_, i) => `<span class="${i < count ? 'filled' : ''}"></span>`).join('')}
    </div>
    <div class="row between mission-tally"><span>${goal}</span><b>${count}/${mission.target}</b></div>
  </article>`;
}
function missionRow(m, v) {
  const pct = Math.min(100, Math.round((v / m.target) * 100));
  return `<div class="mission"><div class="ring" style="--p:${pct}"><span>${Math.min(v, m.target)}/${m.target}</span></div>
    <div style="flex:1"><h3>${esc(m.title)}</h3><p class="faint">${esc(m.desc)} · +${m.bonus} points</p></div></div>`;
}
const emptyMerchants = () => `<div class="card empty">${icon('store')}<p>Verified shops will appear here.</p></div>`;
function merchantCard(m, { nav = false, dist = null } = {}) {
  const card = `<a class="mcard" href="#/merchant/${esc(m.id)}">${merchantLogo(m)}<div style="min-width:0"><h3>${esc(m.name)}</h3>
    <p>${esc(m.type)} · ${esc(m.location)}</p>${dist != null ? `<p class="dist">${icon('map-pin')}${fmtDistance(dist)}</p>` : ''}${m.offer ? `<div class="offer">${icon('badge-percent')}${esc(m.offer)}</div>` : ''}
    ${isIdea(m) ? `<div class="offer idea">${icon('lightbulb')}Student venture</div>` : ''}</div></a>`;
  if (!nav || !hasPin(m)) return card;
  return `<div class="mcard-wrap">${card}<a class="mnav" href="${directionsUrl(m)}" target="_blank" rel="noopener" aria-label="Navigate to ${esc(m.name)}" title="Navigate">${icon('navigation')}</a></div>`;
}
function eventCard(c) {
  return `<div class="card"><span class="badge">${esc(c.start ? fmtDate(Date.parse(c.start)) : '')}${c.end ? ' – ' + esc(fmtDate(Date.parse(c.end))) : ''}</span>
    <h3 style="margin-top:8px">${esc(c.name)}</h3><p class="muted" style="font-size:14px">${esc(c.description || '')}</p>${c.location ? `<p class="faint">${icon('map-pin')} ${esc(c.location)}</p>` : ''}</div>`;
}

// ------------------------------------------------------------- Niaga Kita: map + directory, live location
let exploreFilter = 'All', exploreQuery = '', myPos = null;
async function exploreRender(app, [mode]) {
  const merchants = await D.listVerifiedMerchants(app.ctx);
  app._merchants = merchants;
  if (mode === 'idea') exploreFilter = 'Student ventures';
  else if (exploreFilter === 'Student ventures') exploreFilter = 'All';
  const types = ['All', ...new Set(merchants.map((m) => m.type))];
  if (merchants.some(isIdea)) types.push('Student ventures');
  return `<div class="page-title"><h1>${mode === 'idea' ? 'Student Ventures' : 'Campus Shops'}</h1><p>${mode === 'idea' ? 'Student-run stalls and businesses.' : 'HEP-verified shops and student businesses.'}</p></div>
    <input type="search" id="q" placeholder="Search by name or place" value="${esc(exploreQuery)}" aria-label="Search merchants">
    <div class="chips" style="margin-top:12px" id="types">${types.map((t) => `<button class="${t === exploreFilter ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div class="card map-card"><div id="mmap" class="mmap" aria-label="Map of +Onz merchants"></div>
      <div class="row between map-bar"><button class="btn small" id="near" aria-pressed="false">${icon('locate-fixed')} Show where I am</button><span class="faint" id="map-note"></span></div></div>
    ${hereNowSection(app)}
    <div class="mgrid" id="mlist" style="margin-top:12px"></div>
    <p class="faint" style="margin-top:14px;font-size:13px">Tap a shop for directions. See the <a href="#/cafes">café directory</a>.</p>`;
}
function exploreMount(root, app) {
  let map = null, stopWatch = null, firstFix = true;
  const rowsNow = () => {
    const q = exploreQuery.toLowerCase();
    const rows = app._merchants.filter((m) => (exploreFilter === 'All' || m.type === exploreFilter || (exploreFilter === 'Student ventures' && isIdea(m)))
      && `${m.name} ${m.location} ${m.zone}`.toLowerCase().includes(q));
    if (myPos) rows.sort((a, b) => (hasPin(a) ? distanceM(myPos, a) : 1e9) - (hasPin(b) ? distanceM(myPos, b) : 1e9));
    return rows;
  };
  const popup = (m) => `<div class="mpop">${merchantLogo(m, 'mpop-logo')}<b>${esc(m.name)}</b><p>${esc(m.type)} · ${esc(m.location)}</p>${myPos ? `<p class="dist">${fmtDistance(distanceM(myPos, m))}</p>` : ''}
    <div class="row"><a class="btn small primary" href="${directionsUrl(m)}" target="_blank" rel="noopener">${icon('navigation')} Navigate</a><a class="btn small" href="#/merchant/${esc(m.id)}">View shop</a></div></div>`;
  const drawMap = (rows, refit = true) => {
    if (!map) return;
    const pinned = rows.filter(hasPin);
    map.setPins(pinned, { popup });
    const missing = rows.length - pinned.length;
    $('#map-note', root).textContent = missing ? `${missing} not on the map yet` : '';
    if (refit) { const pts = pinned.map((m) => [m.lat, m.lng]); if (myPos) pts.push([myPos.lat, myPos.lng]); map.fit(pts); }
  };
  const drawList = (rows) => {
    $('#mlist', root).innerHTML = rows.map((m) => merchantCard(m, { nav: true, dist: myPos && hasPin(m) ? distanceM(myPos, m) : null })).join('')
      || `<div class="card empty">${icon('search')}<p>No merchants match. Try another word or filter.</p></div>`;
  };
  const draw = (refit = true) => { const rows = rowsNow(); drawList(rows); drawMap(rows, refit); };
  $('#q', root).oninput = (e) => { exploreQuery = e.target.value; draw(); };
  $$('#types button', root).forEach((b) => { b.onclick = () => { exploreFilter = b.dataset.t; $$('#types button', root).forEach((x) => x.classList.toggle('on', x === b)); draw(); }; });
  const near = $('#near', root);
  near.onclick = () => {
    if (stopWatch) { stopWatch(); stopWatch = null; near.setAttribute('aria-pressed', 'false'); near.classList.remove('primary'); return; }
    near.setAttribute('aria-pressed', 'true'); near.classList.add('primary'); firstFix = true;
    stopWatch = watchLocation((pos) => {
      myPos = pos; if (map) map.setMe(pos);
      drawList(rowsNow()); if (firstFix) { firstFix = false; drawMap(rowsNow(), true); }
    }, (err) => { toast(err.message, true); near.click(); });
  };
  draw();
  const hn = mountHereNow(root, app, { getMap: () => map });
  createMap($('#mmap', root), { center: UM_CENTER, zoom: 15 }).then((m) => {
    if (!root.isConnected) { m.remove(); return; }
    map = m; if (myPos) map.setMe(myPos); drawMap(rowsNow()); hn.redraw();
  }).catch((err) => { $('#mmap', root).innerHTML = `<div class="empty">${esc(err.message)}</div>`; });
  return () => { hn.stop(); if (stopWatch) stopWatch(); if (map) map.remove(); };
}

async function merchantRender(app, [id]) {
  const m = await D.getMerchant(app.ctx, id).catch(() => null);
  if (!m || m.status !== 'verified') return `<a class="back" href="#/explore">${icon('arrow-left')} Campus Shops</a><div class="card empty">${icon('store')}<h3>This merchant isn’t on +Onz yet</h3><p>Only HEP-verified merchants are listed.</p></div>`;
  const deals = D.featureOn(app.rules, 'dealsAndPay') ? (await D.approvedDeals(app.ctx)).filter((d) => d.merchantId === id && d.enabled) : [];
  return `<a class="back" href="#/explore">${icon('arrow-left')} Campus Shops</a>
    <div class="card pad-lg" style="margin-top:8px"><div class="row" style="gap:14px">${merchantLogo(m, 'logo big')}
      <div><h1 style="font-size:26px">${esc(m.name)}</h1><p class="muted">${esc(m.type)} · ${esc(m.location)}</p></div></div>
      <div class="row" style="margin-top:14px">${isIdea(m) ? `<span class="badge warn">${icon('lightbulb')}Student venture</span>` : ''}${m.ready ? `<span class="badge ok">${icon('badge-check')}Cashless ready</span>` : ''}<span class="badge">${icon('shield-check')}HEP verified</span></div>
      ${m.offer ? `<div class="notice" style="margin-top:14px">${icon('badge-percent')}<span>${esc(m.offer)}</span></div>` : ''}
    </div>
    ${hasPin(m) ? `<section class="section"><div class="head"><h2>Getting there</h2><a href="${wazeUrl(m)}" target="_blank" rel="noopener">Open in Waze</a></div>
      <div class="card map-card"><div id="shop-map" class="mmap small" aria-label="Map showing ${esc(m.name)}"></div>
        <div class="map-bar"><a class="btn primary block" href="${directionsUrl(m)}" target="_blank" rel="noopener">${icon('navigation')} Navigate there</a></div></div></section>` : ''}
    <section class="section"><div class="head"><h2>Earn here</h2></div><div class="card steps">
      <div class="step"><span class="n">1</span><div><h3>Walk over</h3><p>Use the map to find ${esc(m.name)}.</p></div></div>
      <div class="step"><span class="n">2</span><div><h3>Check out at the shop</h3><p>Open Check out while you’re at the shop. You get ${app.rules.checkinPoints} points, once every ${app.rules.checkinCooldownH} hours here.</p></div></div>
      <div class="step"><span class="n">3</span><div><h3>Pay cashless if you buy</h3><p>${esc(m.name)} accepts DuitNow QR. Check the name and amount in your banking app before you pay.</p></div></div>
    </div></section>
    ${deals.length ? `<section class="section"><div class="head"><h2>Quiet-hour bonuses</h2></div><div class="stack">${deals.map((d) => `<div class="card row between"><div><h3>${esc(d.title)}</h3><p class="faint">Check out ${D.hhmm(d.startMin)}–${D.hhmm(d.endMin)} while it’s quiet</p></div><span class="badge warn">+${d.bonus} pts</span></div>`).join('')}</div></section>` : ''}
    <div style="position:sticky;bottom:calc(var(--nav-h) + 12px);margin-top:20px"><a class="btn primary block" href="#/checkin/${esc(m.id)}">${icon('map-pin-check')} Check out here</a></div>`;
}
function merchantMount(root, app, [id]) {
  const el = $('#shop-map', root); if (!el) return;
  let map = null;
  D.getMerchant(app.ctx, id).then((m) => shopPinMap(el, m)).then((mm) => { if (root.isConnected) map = mm; else mm.remove(); })
    .catch((err) => { el.innerHTML = `<div class="empty">${esc(err.message)}</div>`; });
  return () => { if (map) map.remove(); };
}

async function cafesRender() {
  return `<a class="back" href="#/explore">${icon('arrow-left')} Campus Shops</a><div class="page-title"><h1>Campus cafés</h1>
    <p>Public listings of where to eat on campus. Only places in Campus Shops give +Onz points.</p></div>
    <div class="card list">${CAFES.map((c) => `<div class="item"><span class="tile-icon">${icon('coffee')}</span><div class="grow"><h3>${esc(c.name)}</h3>
      <p>${esc(c.location)} · ${esc(c.food)}</p></div><a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name + ' ' + c.location + ' Universiti Malaya')}">${icon('map-pin')} Map</a></div>`).join('')}</div>
    <p class="faint" style="margin-top:12px">Sources: <a href="${CAFES[6].source}" target="_blank" rel="noopener">UM food and vendor listings</a> and <a href="${CAFES[0].source}" target="_blank" rel="noopener">campus food guide (2023)</a>. Hours and prices aren’t verified.</p>`;
}

// ------------------------------------------------------------- check out: be at the merchant's pin
async function checkinRender(app) {
  const merchants = await D.listVerifiedMerchants(app.ctx); app._merchants = merchants.filter(hasPin);
  const r = app.rules;
  return `<section class="card checkout-card" aria-labelledby="checkout-title">
      <div class="row checkout-heading"><div><span class="checkout-kicker">Points run</span><h1 id="checkout-title">Check out</h1></div>
        <span class="checkout-reward">${icon('zap')} +${r.checkinPoints} pts</span></div>
      <div class="checkout-location" role="status"><strong id="loc-h">Finding your location…</strong><p id="loc-p">Allow location to find nearby shops.</p></div>
      <div id="checkout-action" hidden></div>
      <p class="checkout-limits">Every ${r.checkinCooldownH}h per shop · ${r.checkinDailyCap} per day</p>
    </section>
    <section class="section checkout-deals" aria-labelledby="checkout-deals-title" ${D.featureOn(r, 'dealsAndPay') ? '' : 'style="display:none"'}>
      <div class="head"><h2 id="checkout-deals-title">${icon('zap')} Live deals</h2></div>
      <p class="faint">Off-peak bonuses apply automatically at checkout.</p>
      <div id="checkout-deals" class="stack"><p class="card faint">Finding café deals…</p></div>
    </section>
    <details class="card" style="margin-bottom:12px${D.featureOn(r, 'dealsAndPay') ? '' : ';display:none'}"><summary>Pay Cashless</summary>
      ${cashlessSteps()}
    </details>
    <div class="chips" style="margin-bottom:12px" id="checkin-filters" aria-label="Check-out merchant filters">
      <button type="button" class="on" aria-pressed="true">All</button>
      <button type="button" data-ventures aria-pressed="false">Student Ventures</button>
    </div>
    ${app.backend.mode === 'demo' ? `<div class="card demo-teleport"><p class="faint"><b>Demo:</b> pretend you’re standing at</p><div class="chips" id="tp">${app._merchants.map((m) => `<button data-tp="${esc(m.id)}">${esc(m.name)}</button>`).join('')}</div></div>` : ''}
    <div class="card map-card"><div id="cmap" class="mmap small" aria-label="Map of merchants near you"></div></div>
    <div class="stack" id="clist" style="margin-top:12px"></div>`;
}
function checkinMount(root, app, [focusId]) {
  let pos = null, map = null, stop = null, busyId = null; const prevs = {};
  const r = app.rules;
  let venturesOnly = false;
  const visibleMerchants = () => venturesOnly ? app._merchants.filter(isIdea) : app._merchants;
  let dealRows = [], dealMessage = 'Finding café deals…', disposed = false, refreshing = false;
  const dealPanel = $('#checkout-deals', root);
  let renderedDeals;
  async function refreshDeals() {
    if (refreshing || disposed || !D.featureOn(r, 'dealsAndPay')) return;
    refreshing = true;
    try {
      const [approved, merchants] = await Promise.all([D.approvedDeals(app.ctx), D.listVerifiedMerchants(app.ctx)]);
      dealRows = await D.dealOverview(app.ctx, approved.filter((d) => d.enabled), merchants);
      dealMessage = 'No off-peak deals right now.';
    } catch {
      dealRows = [];
      dealMessage = 'Deals are temporarily unavailable.';
    } finally {
      refreshing = false;
    }
    if (!disposed) draw();
  }
  function drawDeals() {
    const ids = new Set(visibleMerchants().map((m) => m.id));
    const rows = dealRows.filter(({ merchant }) => merchant && ids.has(merchant.id))
      .sort((a, b) => Number(b.status === 'Available') - Number(a.status === 'Available'));
    const html = rows.map(({ deal, merchant, used, status }) => {
      const live = status === 'Available';
      const remaining = Math.max(0, deal.limit - used);
      return `<article class="card checkout-deal ${live ? 'is-live' : ''}">
        <div class="checkout-deal-top">
          <div>
            <span class="checkout-deal-status">${icon(live ? 'zap' : 'clock')} ${esc(live ? 'Live now' : status)}</span>
            <h3>${esc(deal.title)}</h3>
            <p class="checkout-deal-shop">${esc(merchant.name)} · ${D.hhmm(deal.startMin)}–${D.hhmm(deal.endMin)} MYT</p>
          </div>
          <div class="checkout-deal-points"><strong>+${deal.bonus}</strong><span>bonus pts</span></div>
        </div>
        ${live ? `<div class="checkout-deal-stock">
          <p><strong>${remaining} of ${deal.limit}</strong> claims left today</p>
          <progress value="${remaining}" max="${deal.limit}" aria-label="Claims left today"></progress>
        </div>` : ''}
        <a class="btn small checkout-deal-directions" href="${directionsUrl(merchant)}" target="_blank" rel="noopener">${icon('navigation')} Directions</a>
      </article>`;
    }).join('') || `<p class="card faint">${dealMessage}</p>`;
    if (renderedDeals !== html) {
      dealPanel.innerHTML = html;
      renderedDeals = html;
    }
  }
  Promise.all(app._merchants.map(async (m) => { prevs[m.id] = await D.lastCheckin(app.ctx, m.id).catch(() => null); })).then(draw);
  const action = $('#checkout-action', root);
  const atShop = (m) => pos && distanceM(pos, m) <= r.checkinRadiusM && (pos.accuracy || 0) <= 100;
  const status = (heading, detail) => {
    const title = $('#loc-h', root);
    const description = $('#loc-p', root);
    if (title.textContent !== heading) title.textContent = heading;
    if (description.textContent !== detail) description.textContent = detail;
  };
  function checkoutButton(m, prominent = false) {
    return `<button type="button" class="btn ${prominent ? 'checkout-go' : 'small go'}" data-ci="${esc(m.id)}">${icon('map-pin-check')} Check out${prominent ? '' : ` +${r.checkinPoints}`}</button>`;
  }
  function row(m, primaryId) {
    const d = pos ? distanceM(pos, m) : null;
    const here = atShop(m);
    const block = D.checkinBlock(r, app.profile, prevs[m.id]);
    const btn = block?.why === 'cap' ? '<span class="badge grey">Daily limit reached</span>'
      : block?.why === 'cooldown' ? `<span class="badge grey">Again at ${fmtTime(block.until)}</span>`
        : here ? (m.id === primaryId ? '' : checkoutButton(m))
          : `<a class="btn small" href="${directionsUrl(m)}" target="_blank" rel="noopener">${icon('navigation')} ${d != null ? fmtDistance(d) : 'Navigate'}</a>`;
    return `<div class="card row ${m.id === focusId ? 'focus' : ''} ${here ? 'here' : ''}" style="gap:12px">${merchantLogo(m)}<div style="flex:1;min-width:0"><h3>${esc(m.name)}</h3>
      <p class="faint">${esc(m.location)}${here ? ' · You’re here' : ''}</p></div>${btn}</div>`;
  }
  function draw() {
    const list = [...visibleMerchants()].sort((a, b) => (pos ? distanceM(pos, a) - distanceM(pos, b) : 0) || (a.id === focusId ? -1 : b.id === focusId ? 1 : 0));
    if (focusId) list.sort((a, b) => (a.id === focusId ? -1 : b.id === focusId ? 1 : 0));
    const primary = list.find((m) => atShop(m) && !D.checkinBlock(r, app.profile, prevs[m.id]));
    if (action.firstElementChild?.dataset.ci !== primary?.id) {
      action.innerHTML = primary ? checkoutButton(primary, true) : '';
    }
    action.hidden = !primary;
    const bonus = primary ? Math.max(0, ...dealRows.filter(({ deal, status }) =>
      deal.merchantId === primary.id && status === 'Available').map(({ deal }) => deal.bonus)) : 0;
    if (primary) status(primary.name, bonus ? `+${bonus} live deal bonus on this checkout` : 'Ready to collect points');
    else if (pos?.accuracy > 100) status('Location is approximate', 'Step outside for a better signal.');
    else if (pos) {
      const nearby = list.find(atShop);
      const block = nearby && D.checkinBlock(r, app.profile, prevs[nearby.id]);
      if (block?.why === 'cap') status('Daily limit reached', 'Come back tomorrow.');
      else if (block?.why === 'cooldown') status(nearby.name, `Try again at ${fmtTime(block.until)}.`);
      else status('Head to a shop', list.length ? 'Use the map to find a +Onz merchant.' : 'No shops in this view.');
    }
    $('#clist', root).innerHTML = list.map((m) => row(m, primary?.id)).join('') || (venturesOnly
      ? '<p class="card empty">No student ventures available for check-out yet.</p>'
      : emptyMerchants());
    drawDeals();
    $$('[data-ci]', root).forEach((b) => { b.onclick = () => doCheckIn(app._merchants.find((m) => m.id === b.dataset.ci), b); });
  }
  function onPos(p) {
    pos = p; if (map) map.setMe(p);
    draw();
  }
  async function doCheckIn(m, b) {
    if (busyId) return; busyId = m.id;
    await busy(b, async () => {
      try {
        const fresh = await locate().catch(() => pos);
        if (fresh && !app._teleport) pos = fresh;
        if (!pos || distanceM(pos, m) > r.checkinRadiusM) { toast(`Move closer to ${m.name} to check out.`, true); return; }
        const best = !D.featureOn(r, 'dealsAndPay') ? null : await Promise.all([D.approvedDeals(app.ctx), D.getMerchant(app.ctx, m.id)])
          .then(([approved, merchant]) => D.dealOverview(app.ctx, approved.filter((d) => d.merchantId === m.id && d.enabled), merchant ? [merchant] : []))
          .then((rows) => rows.filter(({ status }) => status === 'Available')
            .sort((a, b) => b.deal.bonus - a.deal.bonus)[0]?.deal)
          .catch(() => null);
        let res; let dealNote = '';
        try { res = await D.checkIn(app.ctx, m, pos, r, best); if (best) dealNote = `+${best.bonus} quiet-hour bonus included`; }
        catch (e) {
          if (best && e.code === 'permission-denied') { res = await D.checkIn(app.ctx, m, pos, r, null); dealNote = 'The quiet-hour bonus wasn’t available, so you got the normal points.'; }
          else throw e;
        }
        app.ctx.profile = app.profile = await D.getProfile(app.ctx);
        const extra = [];
        if (app.profile.inviterUid && !(await D.hasLedger(app.ctx, 'referral_friend'))) {
          try { await D.claimFriendBonus(app.ctx, r); extra.push(`+${r.friendBonus} welcome bonus from your referral`); } catch { /* not yet */ }
        }
        prevs[m.id] = await D.lastCheckin(app.ctx, m.id).catch(() => prevs[m.id]);
        confetti(); pointsFx(true);
        sheet(`<div class="qr-stage"><div class="kk-celebrate">${AV.avatarSVG(myAvatar(app), { size: 120 })}</div>
          <span class="state-pill" style="background:var(--mint-wash);color:#00783A">${icon('circle-check')} Checked out at ${esc(m.name)}</span>
          <div class="amount-big" style="font-size:56px;color:#00783A">+${res.points}</div><p class="muted">points</p>
          ${dealNote ? `<p class="badge ${dealNote.startsWith('+') ? 'ok' : 'warn'}">${esc(dealNote)}</p>` : ''}${extra.map((x) => `<p class="badge ok">${esc(x)}</p>`).join('')}
          <p>Your balance: <b data-bind="points">${n(app.profile.points)}</b> points</p>
          ${app.profile.showOnMap && D.featureOn(r, 'hereNow') ? `<p class="faint">${icon('users')} You’re on the campus map at ${esc(m.name)} for 2 hours. <a href="#/explore" data-close>See who’s here</a></p>`
            : `<p class="faint">Want friends to see you’re here? <button class="link" id="ci-showmap">Show me on the campus map</button></p>`}
          <div class="row" style="justify-content:center;margin-top:8px"><a class="btn primary" href="#/rewards" data-close>Use my points</a><button class="btn" data-close>Done</button></div></div>`);
        const sm = document.getElementById('ci-showmap'); if (sm) sm.onclick = () => { closeSheet(); mapSettingsSheet(app, true); };
        draw();
        refreshDeals();
      } catch (e) { toast(e.code === 'permission-denied' ? 'Couldn’t check out. You may be too far away, or you already checked out here recently.' : errText(e), true); }
    });
    busyId = null;
  }
  const filterButtons = $$('#checkin-filters button', root);
  filterButtons.forEach((button) => {
    button.onclick = () => {
      venturesOnly = button.hasAttribute('data-ventures');
      filterButtons.forEach((item) => {
        item.classList.toggle('on', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      const merchants = visibleMerchants();
      $$('[data-tp]', root).forEach((item) => {
        item.hidden = !merchants.some((merchant) => merchant.id === item.dataset.tp);
      });
      if (map) {
        map.setPins(merchants);
        if (merchants.length) map.fit(merchants.map((merchant) => [merchant.lat, merchant.lng]));
      }
      if (pos) onPos(pos);
      else draw();
    };
  });
  $$('[data-tp]', root).forEach((b) => { b.onclick = () => { const m = app._merchants.find((x) => x.id === b.dataset.tp); app._teleport = true; if (stop) { stop(); stop = null; } onPos({ lat: m.lat + 0.00008, lng: m.lng - 0.00006, accuracy: 12 }); if (map) map.fit([[m.lat, m.lng]]); }; });
  stop = watchLocation((p) => { if (!app._teleport) onPos(p); }, (err) => { if (!pos) status('Location is off', err.message); });
  createMap($('#cmap', root), { center: UM_CENTER, zoom: 16 }).then((m) => {
    if (!root.isConnected) { m.remove(); return; }
    map = m; map.setPins(visibleMerchants()); if (pos) { map.setMe(pos); map.fit([[pos.lat, pos.lng]]); } else if (visibleMerchants().length) map.fit(visibleMerchants().map((x) => [x.lat, x.lng]));
  }).catch(() => { $('#cmap', root).closest('.map-card').remove(); });
  draw();
  refreshDeals();
  const dealTimer = setInterval(refreshDeals, 30000);
  return () => { disposed = true; clearInterval(dealTimer); if (stop) stop(); if (map) map.remove(); app._teleport = false; };
}

// ------------------------------------------------------------- Ganjaran Kita: rewards, vouchers, missions, badges
async function rewardsRender(app) {
  const [rewards, claims] = await Promise.all([D.listRewards(app.ctx), D.myMissionClaims(app.ctx)]);
  const shops = rewards.some((r) => r.active && r.merchantId) ? await D.listVerifiedMerchants(app.ctx).catch(() => []) : [];
  // Where a voucher can be used, shown before the student spends points.
  const whereTo = (r) => (r.merchantId
    ? `<span>Use at</span> <b>${shops.find((m) => m.id === r.merchantId) ? esc(shops.find((m) => m.id === r.merchantId).name) : 'a selected shop'}</b>`
    : 'Collect at the HEP counter');
  const prog = D.missionProgress(app.visits);
  const p = app.profile;
  return `<div class="page-title"><h1>Rewards</h1><p>You have <b data-bind="points">${n(p.points)}</b> points available.</p></div>
    <section><div class="head" style="display:flex;justify-content:space-between;margin-bottom:12px"><h2>Swap points</h2></div>
      <div class="stack">${rewards.filter((r) => r.active && (!r.merchantId || D.featureOn(app.rules, 'shops'))).map((r) => {
        const left = (r.stock || 0) - (r.issued || 0); const can = p.points >= r.cost && left > 0;
        return `<div class="card row" style="gap:14px"><span class="tile-icon orange">${icon(r.icon || 'gift')}</span><div style="flex:1;min-width:0"><h3>${esc(r.title)}</h3>
          <p class="faint">${n(r.cost)} points · ${left > 0 ? `${left} left` : 'All claimed'} · valid ${r.validDays || 30} days</p><p class="faint reward-where">${whereTo(r)}</p></div>
          <button class="btn small ${can ? 'primary' : ''}" data-redeem="${esc(r.id)}" ${can ? '' : 'disabled'}>${can ? 'Swap' : `${n(Math.max(0, r.cost - p.points))} more`}</button></div>`;
      }).join('') || `<div class="card empty">${icon('gift')}<p>HEP hasn’t added rewards yet.</p></div>`}</div></section>
    <section class="section"><div class="head"><h2>My vouchers</h2></div><div id="vouchers" class="stack"><div class="skeleton" style="height:80px"></div></div></section>
    ${D.featureOn(app.rules, 'shops') ? `<section class="section"><div class="head"><h2>Missions this week</h2><span class="faint">Reset every Monday</span></div>
      <div class="card stack">${D.MISSIONS.map((m) => {
        const v = prog[m.id]; const claim = claims.find((c) => c.week === prog.week && c.mission === m.id);
        const btn = claim ? `<span class="badge ${claim.status === 'approved' ? 'ok' : claim.status === 'rejected' ? 'bad' : 'warn'}">${claim.status === 'approved' ? 'Points added' : claim.status === 'rejected' ? 'Not approved' : 'HEP is checking'}</span>`
          : v >= m.target ? `<button class="btn small go" data-mission="${m.id}">Claim +${m.bonus}</button>` : '';
        return `<div class="row" style="gap:0;align-items:center">${missionRow(m, v)}<span style="margin-left:auto">${btn}</span></div>`;
      }).join('')}<p class="faint">Claims reviewed by HEP, usually within a day.</p></div></section>` : ''}
    <section class="section"><div class="head"><h2>Badges</h2></div><div class="awards">${badges(app).filter(([, ic]) => D.featureOn(app.rules, 'shops') || !['map-pin-check', 'compass', 'flame'].includes(ic)).map(([got, ic, label]) => `<div class="award ${got ? 'got' : ''}">${icon(ic)}${esc(label)}</div>`).join('')}</div></section>
    <section class="section"><div class="card row"><span class="tile-icon">${icon('palette')}</span><div style="flex:1"><h3>Unlock avatar hats</h3><p class="faint">Unlock hats as you earn points.</p></div><a class="btn small" href="#/avatar">Open</a></div></section>
    <section class="section"><div class="card row"><span class="tile-icon mint">${icon('hand-heart')}</span><div style="flex:1"><h3>Give to the welfare fund</h3><p class="faint">Points you donate support UM students in need.</p></div><a class="btn small" href="#/community">Donate</a></div></section>`;
}
function badges(app) {
  const v = app.visits; const ids = new Set(app.ledger.map((l) => l.id));
  return [
    [v.length >= 1, 'map-pin-check', 'First check-out'], [new Set(v.map((x) => x.merchantId)).size >= 3, 'compass', '3 merchants'],
    [streak(v) >= 3, 'flame', '3-day streak'], [ids.has('survey'), 'target', 'Money check done'],
    [['lesson0', 'lesson1', 'lesson2'].every((x) => ids.has(x)), 'graduation-cap', 'All lessons'],
    [app.ledger.some((l) => l.type === 'donate'), 'hand-heart', 'Welfare donor'],
  ];
}
function rewardsMount(root, app) {
  $$('[data-redeem]', root).forEach((b) => {
    b.onclick = async () => {
      const r = (await D.listRewards(app.ctx)).find((x) => x.id === b.dataset.redeem);
      if (!(await confirmSheet(`Swap ${n(r.cost)} points for ${r.title}?`, `You’ll have ${n(app.profile.points - r.cost)} points left. The voucher is valid for ${r.validDays || 30} days.`, 'Swap points'))) return;
      try { const vid = await D.redeemReward(app.ctx, r); confetti(); toast('Voucher added. Show it at the counter.'); await app.render(); showVoucher(app, vid, [{ id: vid, title: r.title, merchantId: r.merchantId, status: 'issued' }]); }
      catch (e) { toast(errText(e), true); }
    };
  });
  $$('[data-mission]', root).forEach((b) => {
    b.onclick = () => busy(b, async () => {
      const m = D.MISSIONS.find((x) => x.id === b.dataset.mission); const prog = D.missionProgress(app.visits);
      try { await D.claimMission(app.ctx, m, prog.week, prog[m.id]); toast('Claim sent to HEP.'); app.render(); } catch (e) { toast(errText(e), true); }
    });
  });
  const unsub = D.watchMyVouchers(app.ctx, (vs) => {
    const el = $('#vouchers', root); if (!el) return;
    vs.sort((a, b) => (toMs(b.createdAt) || 0) - (toMs(a.createdAt) || 0));
    el.innerHTML = vs.map((v) => `<button class="ticket ${v.status === 'used' ? 'used' : ''}" data-voucher="${esc(v.id)}" style="text-align:left;cursor:pointer;width:100%;font:inherit;padding:0">
      <span class="stub">${icon('ticket')}</span><span class="body"><h3>${esc(v.title)}</h3><p class="faint">${v.status === 'used' ? `Used ${fmtDate(v.usedAt)}` : `Code ${esc(v.code)} · tap to show`}</p></span></button>`).join('')
      || `<div class="card empty">${icon('ticket')}<p>Vouchers you swap points for appear here.</p></div>`;
    $$('[data-voucher]', el).forEach((b) => { b.onclick = () => showVoucher(app, b.dataset.voucher, vs); });
  }, () => {});
  return unsub;
}
function showVoucher(app, vid, list) {
  const v = list ? list.find((x) => x.id === vid) : null;
  const el = sheet(`<div class="qr-stage"><h2>${esc(v ? v.title : 'Your voucher')}</h2>
    <p class="muted">${v && v.status === 'used' ? 'This voucher has been used.' : v && !v.merchantId ? 'Show this to HEP at the welfare counter to collect.' : 'Show this to the cashier. They scan it to apply the discount.'}</p>
    <div class="qr-frame ${v && v.status === 'used' ? 'dead' : ''}"><div id="vqr"></div></div><p>Code <span class="code-text">${esc(vid.slice(0, 8).toUpperCase())}</span></p></div>`);
  renderQR($('#vqr', el), 'UMV1:' + vid, 240);
}

// ------------------------------------------------------------- quiet-hour bonuses

// ------------------------------------------------------------- Aktiviti Kita
async function eventsRender(app) {
  const camps = (await D.listCampaigns(app.ctx).catch(() => [])).filter((c) => !c.end || c.end >= D.dayKey()).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return `${eventCarousel({page:true})}<div class="head" style="margin-bottom:14px"><h2>Other events</h2></div>
    <div class="stack">${camps.map(eventCard).join('') || `<div class="card empty">${icon('calendar')}<p>No events listed right now.</p></div>`}</div>
    ${D.featureOn(app.rules, 'shops') && D.featureOn(app.rules, 'dealsAndPay') ? `<section class="section"><div class="card row"><span class="tile-icon">${icon('clock')}</span><div style="flex:1"><h3>Quiet-hour bonuses</h3><p class="faint">Check out at quiet cafés for extra points.</p></div><a class="btn small" href="#/deals">Open</a></div></section>` : ''}`;
}

// ------------------------------------------------------------- Bayar Kita: how to pay cashless (no tracking)
const cashlessSteps = () => `<div class="card steps">
      <div class="step"><span class="n">1</span><div><h3>Open your banking or e-wallet app</h3><p>Any app that supports DuitNow QR works.</p></div></div>
      <div class="step"><span class="n">2</span><div><h3>Scan the merchant’s DuitNow QR</h3><p>Check the recipient name matches the shop and the amount is right before you confirm.</p></div></div>
      <div class="step"><span class="n">3</span><div><h3>Keep your receipt</h3><p>Your bank app keeps the record. +Onz never asks for your banking details or OTP.</p></div></div>
    </div>`;

async function bayarRender(app) {
  const shopsOn = D.featureOn(app.rules, 'shops');
  const merchants = shopsOn ? await D.listVerifiedMerchants(app.ctx) : [];
  return `<div class="page-title"><h1>Pay Cashless</h1><p>Pay with DuitNow QR in your bank or e-wallet app.</p></div>
    ${cashlessSteps()}
    ${shopsOn ? `<section class="section"><div class="head"><h2>Participating merchants</h2><a href="#/explore">All ${merchants.length}</a></div>
      <div class="mgrid">${merchants.slice(0, 6).map((m) => merchantCard(m)).join('') || emptyMerchants()}</div></section>` : ''}
    <section class="section"><div class="card row"><span class="tile-icon orange">${icon('shield-alert')}</span><div style="flex:1"><h3>Learn and earn</h3><p class="faint">Scams & budgeting · +${app.rules.lessonBonus} points per lesson</p></div><a class="btn small" href="#/learn">Start</a></div></section>`;
}

// ------------------------------------------------------------- learn
async function learnRender(app) {
  const done = new Set(app.ledger.map((l) => l.id));
  return `${D.featureOn(app.rules, 'dealsAndPay') ? `<a class="back" href="#/bayar">${icon('arrow-left')} Pay Cashless</a>` : `<a class="back" href="#/home">${icon('arrow-left')} Home</a>`}<div class="page-title"><h1>Learn and earn</h1>
    <p>One-minute lessons on paying safely. Answer correctly to earn ${app.rules.lessonBonus} points each, once.</p></div>
    <div class="stack">${D.LESSONS.map((l, i) => `<div class="card row" style="gap:14px"><span class="tile-icon ${done.has('lesson' + i) ? 'mint' : ''}">${icon(done.has('lesson' + i) ? 'circle-check' : l.icon)}</span>
      <div style="flex:1"><h3>${esc(l.title)}</h3><p class="faint">${done.has('lesson' + i) ? 'Completed' : `1 question · +${app.rules.lessonBonus} points`}</p></div>
      <button class="btn small ${done.has('lesson' + i) ? '' : 'primary'}" data-lesson="${i}" ${done.has('lesson' + i) ? 'disabled' : ''}>${done.has('lesson' + i) ? 'Done' : 'Start'}</button></div>`).join('')}</div>
    <div class="card row" style="margin-top:16px"><span class="tile-icon orange">${icon('target')}</span><div style="flex:1"><h3>Money check</h3><p class="faint">See where you stand on payment safety and budgeting.</p></div><a class="btn small" href="#/survey">Open</a></div>`;
}
function learnMount(root, app) {
  $$('[data-lesson]', root).forEach((b) => {
    b.onclick = () => {
      const i = +b.dataset.lesson; const l = D.LESSONS[i];
      const el = sheet(`<h2>${esc(l.title)}</h2><p class="muted">${esc(l.q)}</p><div class="stack" style="margin-top:16px">${l.options.map((o, j) => `<button class="btn block" style="white-space:normal;height:auto;padding:12px 16px;text-align:left;justify-content:flex-start" data-a="${j}">${esc(o)}</button>`).join('')}</div><p id="fb" class="faint" style="margin-top:12px"></p>`);
      $$('[data-a]', el).forEach((a) => {
        a.onclick = () => busy(a, async () => {
          const r = await D.answerLesson(app.ctx, i, +a.dataset.a, app.rules).catch((e) => { toast(errText(e), true); return null; });
          if (r === 'correct') { closeSheet(); confetti(); pointsFx(); toast(`Correct. +${app.rules.lessonBonus} points`); app.render(); }
          else if (r === 'done') { closeSheet(); toast('You’ve already earned points for this lesson.'); }
          else if (r === 'wrong') { a.classList.add('warn'); $('#fb', el).textContent = 'Not quite. Think about what keeps your money safe, then try again.'; }
        });
      });
    };
  });
}

// ------------------------------------------------------------- survey (students and merchants share it)
export function surveyHTML(role, existing) {
  const q = (name, text, answers) => `<fieldset class="card" style="border:1px solid var(--line)"><legend style="font-weight:700;padding:0 4px">${esc(text)}</legend>
    <div class="stack" style="gap:4px;margin-top:6px">${answers.map((a, i) => `<label class="check" style="padding:6px 0"><input type="radio" name="${name}" value="${i}" required> ${esc(a)}</label>`).join('')}</div></fieldset>`;
  return `${existing ? `<div class="card row" style="gap:16px"><span style="font-size:44px;font-weight:800;color:var(--blue)">${esc(existing.grade)}</span><div><h3>Your last result: ${existing.score}/100</h3>
      <p class="faint">Knowledge ${existing.knowledge}% · Digital confidence ${existing.digital}%</p></div></div>` : ''}
    <form id="survey" class="stack" style="margin-top:16px">
      ${D.SURVEY_KNOWLEDGE.map(([t, a], i) => q('k' + i, t, a)).join('')}
      ${D.SURVEY_DIGITAL[role].map(([t, a], i) => q('d' + i, t, a)).join('')}
      <button class="btn primary block">${existing ? 'Update my answers' : 'See my result'}</button></form>`;
}
export function surveyResultText(role, r) {
  const st = { A: 'Confident and ready', B: 'Nearly there', C: 'Some support will help', D: 'Start with the basics' }[r.grade];
  const tip = role === 'student' ? (r.knowledge < 75 ? 'Try the Learn and earn lessons next.' : 'You’re set. Find a merchant and start earning.')
    : (r.digital < 70 ? 'Ask an ambassador to help set up your business QR and train staff.' : 'Finish the staff checklist and create a quiet-hour deal.');
  return { title: `${r.grade}: ${st}`, tip };
}
async function surveyRender(app) {
  const existing = await D.getSurvey(app.ctx).catch(() => null);
  return `<a class="back" href="#/home">${icon('arrow-left')} Home</a><div class="page-title"><h1>Money check</h1>
    <p>Four scenario questions and three about your confidence. It helps HEP plan support; it isn’t a test. First completion: ${app.rules.surveyBonus} points.</p></div>${surveyHTML('student', existing)}`;
}
export function surveyMount(root, app, role, back) {
  $('#survey', root).onsubmit = (e) => {
    e.preventDefault(); const answers = {};
    for (const [k, v] of new FormData(e.target)) answers[k] = +v;
    busy($('button', e.target), async () => {
      try {
        const r = D.scoreSurvey(role, answers); const bonus = await D.submitSurvey(app.ctx, r, app.rules);
        const t = surveyResultText(role, r); if (bonus) { confetti(); pointsFx(); }
        sheet(`<h2>${esc(t.title)}</h2><p class="muted">Knowledge ${r.knowledge}% · Digital confidence ${r.digital}%. ${esc(t.tip)}</p>${bonus ? `<p class="badge ok" style="margin-top:12px">+${bonus} points</p>` : ''}
          <div class="row end" style="margin-top:16px"><a class="btn primary" href="#/${back}" data-close>Continue</a></div>`);
      } catch (err) { toast(errText(err), true); }
    });
  };
}

// ------------------------------------------------------------- Komuniti Kita: colleges, welfare, ventures
async function communityRender(app) {
  const shopsOn = D.featureOn(app.rules, 'shops');
  const merchants = shopsOn ? await D.listVerifiedMerchants(app.ctx) : [];
  const ventures = merchants.filter(isIdea);
  return `<div class="page-title"><h1>Community</h1>${shopsOn ? `<p>Your check-outs count for ${esc(D.COLLEGES.find(([k]) => k === app.profile.college)?.[1] || 'your college')}.</p>` : ''}</div>
    ${shopsOn ? `<section class="card pad-lg"><div class="row between"><h2>College leaderboard</h2><span class="faint">Check-outs</span></div><div id="lb" style="margin-top:10px"><div class="skeleton" style="height:120px"></div></div></section>` : ''}
    <section class="section"><div class="card pad-lg" style="background:var(--ink);color:#fff;border:0;position:relative;overflow:hidden">${chevron('#00D669', 14, 'style="position:absolute;right:-90px;top:-40px;width:240px;height:240px"')}
      <h2>Student welfare fund</h2><p style="color:#C9D4E3;margin-top:6px;max-width:42ch">Points given here are pooled for UM students who need help with essentials.</p>
      <div style="font-size:44px;font-weight:800;letter-spacing:-0.03em;margin-top:12px" id="welfare">—</div><p style="color:#C9D4E3">points given so far</p>
      <button class="btn" style="margin-top:14px" id="donate">${icon('hand-heart')} Give points</button></div></section>
    ${shopsOn ? `<section class="section"><div class="head"><h2>Student Ventures</h2><a href="#/explore/idea">See all</a></div>
      <div class="mgrid">${ventures.slice(0, 4).map((m) => merchantCard(m)).join('') || `<div class="card empty">${icon('lightbulb')}<p>Running a stall or small business? Ask HEP about joining as a student entrepreneur.</p></div>`}</div></section>
    <section class="section"><div class="card row"><span class="tile-icon">${icon('user-plus')}</span><div style="flex:1"><h3>Invite friends</h3><p class="faint">You both get bonus points after their first check-out.</p></div><a class="btn small" href="#/me">Invite</a></div></section>` : ''}`;
}
function communityMount(root, app) {
  const u1 = D.watchStats(app.ctx, 'campus', (s) => {
    const el = $('#lb', root); if (!el || !s) return;
    const rows = Object.entries(s.colleges || {}).sort((a, b) => b[1] - a[1]); const max = Math.max(1, ...rows.map((r) => r[1]));
    el.innerHTML = rows.slice(0, 8).map(([k, v], i) => `<div class="lb-row ${k === app.profile.college ? 'me' : ''}"><span class="rank">${i + 1}</span>
      <div><span class="name">${esc(D.COLLEGES.find(([c]) => c === k)?.[1] || k)}</span><div class="bar"><i style="width:${Math.round((v / max) * 100)}%"></i></div></div><b class="num">${n(v)}</b></div>`).join('')
      || '<p class="faint">No check-outs yet. Yours could put your college first.</p>';
  }, () => {});
  const u2 = D.watchStats(app.ctx, 'welfare', (s) => { const el = $('#welfare', root); if (el && s) countUp(el, s.points || 0); }, () => {});
  $('#donate', root).onclick = () => {
    const el = sheet(`<h2>Give points to the welfare fund</h2><p class="muted">You have ${n(app.profile.points)} points.</p>
      <form id="don" class="stack" style="margin-top:14px"><div class="chips">${[20, 50, 100, 250].map((v) => `<button type="button" data-v="${v}">${v}</button>`).join('')}</div>
      <label class="field">Points to give<input name="pts" type="number" min="1" max="${app.profile.points}" step="1" required value="${Math.min(50, app.profile.points)}"></label>
      <button class="btn go block">Give points</button></form>`);
    $$('[data-v]', el).forEach((b) => { b.onclick = () => { el.querySelector('[name=pts]').value = b.dataset.v; }; });
    $('#don', el).onsubmit = (e) => {
      e.preventDefault(); const v = Math.floor(+e.target.pts.value);
      if (!v || v < 1) return; if (v > app.profile.points) return toast('You don’t have that many points.', true);
      busy($('button.go', el), async () => { try { await D.donatePoints(app.ctx, v); closeSheet(); confetti(); toast(`Thank you. ${v} points given.`); } catch (err) { toast(errText(err), true); } });
    };
  };
  return () => { u1(); u2(); };
}

// ------------------------------------------------------------- avatar editor
async function avatarRender(app) {
  return `<a class="back" href="#/me">${icon('arrow-left')} Me</a><div class="page-title"><h1>Your avatar</h1><p>Build your look. Earn points to unlock hats.</p></div>
    <div class="av-editor"><div class="av-stage card"><div class="av-stage-meta"><span>Live preview</span><span id="av-level"></span></div><div id="av-prev"></div>
      <div class="row" style="justify-content:center;gap:8px;margin-top:10px"><button class="btn small" id="av-rand">${icon('dices')} Shuffle</button><button class="btn small ghost" id="av-reset">${icon('rotate-ccw')} Undo changes</button></div></div>
      <div class="av-panel card" id="av-panel"></div></div>`;
}
function avatarMount(root, app) {
  const start = AV.clean(myAvatar(app)); let a = { ...start };
  const lvl = levelOf(earnedTotal(app.ledger)).name;
  $('#av-level', root).textContent = lvl;
  const range = (k, colors, label) => {
    return `<label class="av-label">${label}<input type="range" class="av-range" data-k="${k}" min="0" max="${colors.length - 1}" step="1" value="${a[k]}"
      style="--track:linear-gradient(90deg,${colors.join(',')})" aria-label="${label}"></label>`;
  };
  const swatches = (k, colors, label) => `<div class="av-label">${label}<div class="av-swatches" role="radiogroup" aria-label="${label}">${colors.map((c, i) => `<button type="button" role="radio" aria-checked="${a[k] === i}" data-k="${k}" data-v="${i}" style="--sw:${c}" aria-label="${label} ${i + 1}"></button>`).join('')}</div></div>`;
  const thumbs = (k, list, label) => `<div class="av-label">${label}<div class="av-opts" data-group="${k}">${list.map(([id, name, lock]) => {
    const locked = k === 'hat' && !AV.hatUnlocked(id, lvl, LEVEL_NAMES);
    const nameAttribute = k === 'bg'
      ? `aria-label="${esc(name)}"`
      : `title="${esc(name)}${locked ? ` (reach ${esc(lock)})` : ''}"`;
    return `<button type="button" data-k="${k}" data-v="${id}" aria-pressed="${a[k] === id}" ${nameAttribute} ${locked ? 'data-locked="1"' : ''}>
      <span class="av-thumb"></span>${locked ? `<span class="av-lock">${icon('lock')}</span>` : ''}${k === 'bg' ? '' : `<span class="av-name">${esc(name)}</span>`}${locked ? `<small class="av-unlock">${esc(lock)}</small>` : ''}</button>`;
  }).join('')}</div></div>`;
  $('#av-panel', root).innerHTML = `
    <div class="av-categories" role="group" aria-label="Avatar categories">
      <button type="button" aria-controls="av-style" aria-pressed="true">${icon('sparkles')} Style</button>
      <button type="button" aria-controls="av-gear" aria-pressed="false">${icon('shopping-bag')} Accessories</button>
      <button type="button" aria-controls="av-scene" aria-pressed="false">${icon('image')} Background</button>
    </div>
    <div class="av-category" id="av-style">${thumbs('hair', AV.HAIRS.filter(([id]) => id !== 'tudung'), 'Hairstyle')}${range('hairColor', AV.HAIR_COLORS, 'Hair or tudung colour')}${range('skin', AV.SKIN, 'Skin tone')}
    ${thumbs('face', AV.FACES, 'Face')}<div class="chips av-toggles"><button type="button" data-t="glasses" class="${a.glasses ? 'on' : ''}">${icon('glasses')} Glasses</button><button type="button" data-t="freckles" class="${a.freckles ? 'on' : ''}">${icon('sparkles')} Freckles</button></div>
    </div><div class="av-category" id="av-gear" hidden>
    ${thumbs('outfit', AV.OUTFITS, 'Outfit')}${swatches('outfitColor', AV.OUTFIT_COLORS, 'Outfit colour')}
    ${thumbs('hat', AV.HATS, 'Hat')}${thumbs('bag', AV.BAGS, 'Bag')}${swatches('accent', AV.ACCENT_COLORS, 'Hat and bag colour')}</div><div class="av-category" id="av-scene" hidden>${thumbs('bg', AV.BG_COLORS.map((_, i) => [i, `Background ${i + 1}`]), 'Background')}</div>
    <button class="btn primary block" id="av-save" style="margin-top:8px">${icon('check')} Save avatar</button>`;
  const categories = $$('.av-categories button', root);
  categories.forEach((button) => {
    button.onclick = () => {
      categories.forEach((item) => {
        const selected = item === button;
        item.setAttribute('aria-pressed', String(selected));
        $('#' + item.getAttribute('aria-controls'), root).hidden = !selected;
      });
    };
  });
  const paint = () => {
    $('#av-prev', root).innerHTML = AV.avatarSVG(a, { size: 200, title: 'Your avatar' });
    $$('.av-opts [data-k]', root).forEach((b) => {
      const k = b.dataset.k;
      const v = k === 'bg' ? Number(b.dataset.v) : b.dataset.v;
      b.setAttribute('aria-pressed', String(a[k] === v));
      const fullPreview = k === 'outfit' || k === 'bag' || k === 'bg';
      const variant = k === 'bag' ? 'bag' : fullPreview ? 'full' : k === 'hair' && AV.isTudung(v) ? 'bust' : 'head';
      b.querySelector('.av-thumb').innerHTML = AV.avatarSVG({ ...a, [k]: v, ...(k === 'hat' && AV.isTudung(a.hair) && !['crown', 'grad', 'none'].includes(v) ? { hair: 'short' } : {}) }, { variant, size: fullPreview ? 72 : 56 });
    });
    $$('.av-swatches [data-k]', root).forEach((b) => b.setAttribute('aria-checked', String(a[b.dataset.k] === +b.dataset.v)));
    $$('[data-t]', root).forEach((b) => b.classList.toggle('on', !!a[b.dataset.t]));
    $$('.av-range', root).forEach((r) => { r.value = a[r.dataset.k]; });
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k], button[data-t]'); if (!b || !root.contains(b)) return;
    if (b.dataset.t) { a[b.dataset.t] = !a[b.dataset.t]; return paint(); }
    if (b.dataset.locked) { const h = AV.HATS.find((x) => x[0] === b.dataset.v); return toast(`Reach ${h[2]} level to unlock the ${h[1].toLowerCase()}.`); }
    const k = b.dataset.k; a[k] = /^\d+$/.test(b.dataset.v) && k !== 'hair' && k !== 'hat' && k !== 'face' && k !== 'outfit' && k !== 'bag' ? +b.dataset.v : b.dataset.v;
    paint();
  });
  $$('.av-range', root).forEach((r) => { r.oninput = () => { a[r.dataset.k] = +r.value; paint(); }; });
  $('#av-rand', root).onclick = () => { const rnd = AV.randomAvatar(); if (!AV.hatUnlocked(rnd.hat, lvl, LEVEL_NAMES)) rnd.hat = 'none'; a = { ...a, ...rnd }; paint(); };
  $('#av-reset', root).onclick = () => { a = { ...start }; paint(); };
  $('#av-save', root).onclick = (e) => busy(e.currentTarget, async () => {
    try { await D.saveAvatar(app.ctx, AV.clean(a)); toast('Avatar saved.'); confetti(); app.go('me'); } catch (err) { toast(errText(err), true); }
  });
  paint();
}

// ------------------------------------------------------------- me: avatar, referrals, profile, history
async function meRender(app) {
  const p = app.profile; const refs = await D.myReferrals(app.ctx).catch(() => []);
  const claimed = new Set(app.ledger.map((l) => l.id));
  const capLeft = app.rules.referralCap - (p.refMonth === D.monthKey() ? p.refCount || 0 : 0);
  const lvl = levelOf(earnedTotal(app.ledger));
  const history = app.ledger.slice(0, 30);
  return `<section class="card pad-lg me-card"><a href="#/avatar" class="me-avatar" aria-label="Customise your avatar">${AV.avatarSVG(myAvatar(app), { size: 120, title: p.name })}</a>
      <div><h1 style="font-size:24px">${esc(p.name)}</h1><p class="muted">${esc(D.COLLEGES.find(([k]) => k === p.college)?.[1] || '')}</p>
      <p class="row" style="gap:6px;margin-top:6px"><span class="badge ok">${icon('medal')}${esc(lvl.name)}</span>${D.featureOn(app.rules, 'shops') ? `<span class="badge">${n(app.visits.length)} check-outs</span>` : ''}</p>
      <a class="btn small primary" href="#/avatar" style="margin-top:10px">${icon('palette')} Customise avatar</a></div></section>
    ${D.featureOn(app.rules, 'shops') ? `<section class="section card invite-card">
      <div class="row invite-heading"><span class="tile-icon">${icon('user-plus')}</span><h2>Invite friends</h2></div>
      <div class="invite-code">
        <div><span class="faint">Your referral code</span><strong class="code-text">${esc(p.referralCode)}</strong></div>
        <button class="btn small" type="button" id="copy-referral" aria-label="Copy referral code">Copy</button>
        <button class="btn primary" id="share">${icon('share-2')} Share</button>
      </div>
      <div class="row invite-rewards">
        <span class="badge invite-bonus">You +${n(app.rules.referrerBonus)} pts</span>
        <span class="badge invite-bonus">Friend +${n(app.rules.friendBonus)} pts</span>
      </div>
      <p class="faint">Your friend signs up with your code and checks in to unlock both bonuses.</p>
      ${refs.length ? `<details class="invite-activity" ${capLeft > 0 && refs.some((r) => r.qualified && !claimed.has('ref_' + r.id)) ? 'open' : ''}>
        <summary>Referral activity <span class="badge">${n(refs.length)}</span></summary>
        <div class="list">${refs.map((r) => `<div class="item"><span class="tile-icon">${icon('user-plus')}</span><div class="grow"><h3>${esc(r.friendName)}</h3><p>${r.qualified ? 'Checked out for the first time' : 'Hasn’t checked out yet'}</p></div>
        ${claimed.has('ref_' + r.id) ? '<span class="badge ok">Points added</span>' : r.qualified ? `<button class="btn small go" data-ref="${esc(r.id)}" ${capLeft > 0 ? '' : 'disabled'}>Claim +${app.rules.referrerBonus}</button>` : '<span class="badge grey">Waiting</span>'}</div>`).join('')}</div>
      </details>` : ''}
      ${capLeft <= 0 ? `<p class="faint">You’ve reached this month’s limit of ${app.rules.referralCap} referral bonuses.</p>` : ''}
      ${!p.inviterUid && !p.firstVisit && !p.firstTx ? `<form id="inv" class="row" style="margin-top:14px;flex-wrap:nowrap"><input name="code" placeholder="Friend’s code, e.g. AINA-7K2Q" required aria-label="Friend’s referral code"><button class="btn">Add</button></form>` : p.inviterCode ? `<p class="faint" style="margin-top:12px">You joined with code ${esc(p.inviterCode)}.</p>` : ''}
    </section>` : ''}
    <section class="section"><div class="head"><h2>Profile</h2></div><form id="prof" class="card stack">
      <label class="field">Name<input name="name" required minlength="2" value="${esc(p.name)}"></label>
      <label class="field">Matric number<input value="${esc(p.matric || '')}" readonly aria-readonly="true"></label>
      <label class="field">Residential college<select name="college">${D.COLLEGES.map(([k, v]) => `<option value="${k}" ${k === p.college ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label class="field">Faculty<select name="faculty">${D.FACULTIES.map((f) => `<option value="${esc(f)}" ${f === p.faculty ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
      <button class="btn primary">Save profile</button></form></section>
    <section class="section"><div class="head"><h2>Points history</h2></div>
      <div class="card points-history">
        ${history.slice(0, 3).map(pointsHistoryRow).join('') || `<div class="empty">${icon('sparkles')}<p>Points you earn and spend appear here.</p></div>`}
        ${history.length > 3 ? `<details class="points-history-more"><summary>Older activity</summary>
          ${history.slice(3).map(pointsHistoryRow).join('')}</details>` : ''}
      </div>
    </section>
    ${D.featureOn(app.rules, 'hereNow') ? `<section class="section"><div class="card row" style="flex-direction:row;flex-wrap:nowrap;align-items:center;gap:12px"><span class="tile-icon">${icon('users')}</span><div class="grow" style="flex:1;min-width:0"><h3>Campus map</h3><p class="faint">${app.profile.showOnMap ? `Visible to ${app.profile.mapAudience === 'college' ? 'your college' : 'all students'} for 2 hours after each check-out.` : 'Hidden. Switch on to show at shops after you check out.'}</p></div>
      <button class="btn small" id="mapvis">${app.profile.showOnMap ? 'Change' : 'Show me'}</button></div></section>` : ''}
    <section class="section"><div class="card row" style="flex-direction:row;flex-wrap:nowrap;align-items:center;gap:12px"><span class="tile-icon">${icon('bell')}</span><div class="grow" style="flex:1;min-width:0"><h3>Sound and vibration</h3><p class="faint">Play a chime and buzz when you earn points.</p></div>
      <label class="switch"><input type="checkbox" id="fx" ${fxOn() ? 'checked' : ''} aria-label="Sound and vibration when you earn points"><span></span></label></div></section>
    <section class="section stack"><button class="btn block" id="install">${icon('smartphone')} Install the app</button>
      <button class="btn block warn" id="out">${icon('log-out')} Sign out</button></section>`;
}
function pointsHistoryRow(entry) {
  const glyph = { checkin: 'map-pin-check', purchase: 'wallet', survey: 'target', lesson: 'book-open',
    friend: 'user-plus', inviter: 'user-plus', offpeak: 'clock', redeem: 'ticket', donate: 'hand-heart' }[entry.type] || 'sparkles';
  const earned = entry.delta > 0;
  return `<div class="points-history-row">
    <span class="points-history-icon" aria-hidden="true">${icon(glyph)}</span>
    <div class="points-history-copy"><b>${esc(ledgerLabel(entry))}</b><small>${fmtDateTime(entry.createdAt)}</small></div>
    <span class="points-history-amount ${earned ? 'earned' : ''}">${earned ? '+' : ''}${n(entry.delta)}</span>
  </div>`;
}
function ledgerLabel(l) {
  if (l.type === 'checkin') return `Checked out at ${l.merchantName || 'a merchant'}`;
  return { purchase: 'Cashless purchase', survey: 'Money check completed', lesson: 'Lesson completed', friend: 'Referral welcome bonus', inviter: 'Friend joined with your code',
    offpeak: 'Quiet-hour bonus', redeem: 'Swapped for a voucher', donate: 'Given to the welfare fund', adjust: l.note || 'Adjustment by HEP' }[l.type] || l.type;
}
function meMount(root, app) {
  if ($('#copy-referral', root)) $('#copy-referral', root).onclick = async () => {
    try {
      await navigator.clipboard.writeText(app.profile.referralCode);
      toast('Referral code copied.');
    } catch {
      toast('Couldn’t copy. Select the referral code to copy it manually.', true);
    }
  };
  if ($('#share', root)) $('#share', root).onclick = async () => {
    const text = `Join +Onz, UM’s campus app for merchants, events and rewards. Use my code ${app.profile.referralCode} for a welcome bonus: ${location.origin}${location.pathname}`;
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Invite copied. Paste it to a friend.'); } } catch { /* cancelled */ }
  };
  $$('[data-ref]', root).forEach((b) => { b.onclick = () => busy(b, async () => { try { await D.claimInviterBonus(app.ctx, b.dataset.ref, app.rules); confetti(); pointsFx(); toast(`+${app.rules.referrerBonus} points`); app.render(); } catch (e) { toast(errText(e), true); } }); });
  if ($('#inv', root)) $('#inv', root).onsubmit = (e) => { e.preventDefault(); busy($('button', e.target), async () => { try { await D.applyInviterCode(app.ctx, e.target.code.value); toast('Code added. Your bonus arrives after your first check-out.'); app.render(); } catch (err) { toast(err.code ? errText(err) : err.message, true); } }); };
  $('#prof', root).onsubmit = (e) => {
    e.preventDefault(); const f = e.target;
    busy($('button', f), async () => { try { await D.updateProfile(app.ctx, { name: f.name.value.trim(), college: f.college.value, faculty: f.faculty.value }); toast('Profile saved.'); } catch (err) { toast(errText(err), true); } });
  };
  $('#install', root).onclick = () => app.installApp();
  if ($('#mapvis', root)) $('#mapvis', root).onclick = () => mapSettingsSheet(app);
  $('#fx', root).onchange = (e) => { setFx(e.target.checked); if (e.target.checked) pointsFx(); };
  $('#out', root).onclick = () => app.backend.sdk.signOut(app.backend.auth);
}

// ------------------------------------------------------------- routes
const live = (fn) => (root, app, params) => {
  const c1 = fn ? fn(root, app, params) : null;
  let t; const off = app.on((topic) => { if (topic === 'visits' || topic === 'ledger') { clearTimeout(t); t = setTimeout(() => { if (!document.querySelector('#sheet[open]') && !root.contains(document.activeElement)) app.render(); }, 400); } });
  return () => { off(); clearTimeout(t); c1 && c1(); };
};
export const routes = {
  home: { title: 'Home', render: homeRender, mount: live(mountEventCarousel) },
  explore: { title: 'Campus Shops', render: exploreRender, mount: exploreMount, feature: 'shops' },
  merchant: { title: 'Merchant', render: merchantRender, mount: merchantMount, tab: 'explore', feature: 'shops' },
  cafes: { title: 'Campus cafés', render: cafesRender, tab: 'explore', feature: 'shops' },
  checkin: { title: 'Check out', render: checkinRender, mount: checkinMount, feature: 'shops' },
  rewards: { title: 'Rewards', render: rewardsRender, mount: rewardsMount },
  deals: { title: 'Live deals', render: checkinRender, mount: checkinMount, tab: 'checkin', feature: ['shops', 'dealsAndPay'] },
  feskum: { title: 'FESKUM 2026', render: feskumRender, mount: feskumMount, tab: 'events', wide: true },
  events: { title: 'Campus Events', render: eventsRender, mount: mountEventCarousel, tab: 'events' },
  bayar: { title: 'Pay Cashless', render: bayarRender, tab: 'home', feature: 'dealsAndPay' },
  learn: { title: 'Learn and earn', render: learnRender, mount: learnMount, tab: 'home' },
  survey: { title: 'Money check', render: surveyRender, mount: (r, a) => surveyMount(r, a, 'student', 'home'), tab: 'home' },
  community: { title: 'Community', render: communityRender, mount: communityMount, tab: 'home' },
  avatar: { title: 'Your avatar', render: avatarRender, mount: avatarMount, tab: 'me' },
  me: { title: 'Me', render: meRender, mount: meMount },
};
