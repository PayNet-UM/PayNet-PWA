// Student app: +Onz hub, Overview directory, rewards, events, community,
// cashless guide (Bayar Kita), learning, avatar and profile.
import * as D from '../data.js';
import { tr } from '../i18n.js';
import { friendsRender, friendsMount, usernameTag, mountUsernameCopy } from '../friends.js';
import { feskumCard, feskumRender, feskumMount } from '../feskum.js';
import { eventCarousel, mountEventCarousel } from '../event-carousel.js';
import { CAFES } from '../cafes.js';
import { createMap, shopPinMap, hasPin, directionsUrl, wazeUrl, distanceM, fmtDistance, watchLocation, locate, UM_CENTER } from '../map.js';
import * as AV from '../avatar.js';
import { hereNowSection, mountHereNow } from '../herenow.js';
import { safeImg, $, $$, esc, icon, n, toast, sheet, closeSheet, confirmSheet, busy, errText, fmtDate, fmtDateTime, fmtTime, timeAgo,
  confetti, pointsFx, fxOn, setFx, renderQR, colorFor, initials, countUp } from '../ui.js';

export const defaultRoute = 'home';
export { canonicalPath } from '../student-paths.js';
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
const earnedTotal = (ledger) => ledger.filter((l) => l.delta > 0 && l.type !== 'welfare').reduce((s, l) => s + l.delta, 0);
const firstName = (p) => (p?.name || '').split(' ')[0];
export const myAvatar = (app) => app.profile?.avatar || AV.defaultFor(app.ctx?.uid);
export const merchantLogo = (m, cls = 'logo') => (safeImg(m.logo) ? `<img class="${cls}" src="${safeImg(m.logo)}" alt="">`
  : `<span class="${cls}" style="background:${colorFor(m.name)}">${esc(initials(m.name))}</span>`);
const isIdea = (m) => m.segment === IDEA_SEGMENT;

// ------------------------------------------------------------- home: the +Onz hub
const PILLARS = [
  ['explore', 'Overview', 'shops', 'Find stalls that take QR.'],
  ['rewards', 'Rewards', 'rewards', 'Earn. Save. Redeem.'],
  ['explore/deals', 'Live deals', 'deals', 'Find offers around campus.'],
  ['learn', 'Learn & Earn', 'lessons', 'Learn more. Earn more.'],
];
// Use the supplied artwork directly, framed as sprites by CSS (no redraws).
const directoryArt = key => key === 'deals'
  ? `<span class="onz-deals-art" aria-hidden="true">${icon('badge-percent')}<i>${icon('zap')}</i></span>`
  : `<span class="onz-directory-art onz-art-${key}" aria-hidden="true"></span>`;
async function homeRender(app) {
  const p = app.profile; const lvl = levelOf(earnedTotal(app.ledger));
  const appStreak = D.dailyStreak(app.appDays);
  return `
  <div class="onz-home-feature">
  <section class="kk-hero student-welcome" aria-label="Your +Onz card">
    <a class="kk-hero-avatar" href="#/avatar" aria-label="Customise your avatar">${AV.avatarSVG(myAvatar(app), { size: 108, title: p.name })}<span class="kk-edit">${icon('pencil')}</span></a>
    <div class="kk-hero-text">
      <h1 class="who">Hi ${esc(firstName(p))}</h1>
      ${usernameTag(p.username)}
      <div class="balance"><span class="welcome-coin" aria-hidden="true">${icon('sparkles')}</span><div><strong data-bind="points">${n(p.points)}</strong><span>points</span></div></div>
      <div class="welcome-badges"><button type="button" class="welcome-tier" id="level-guide" aria-haspopup="dialog" aria-label="${esc(lvl.name)} — ways to earn points">${icon('medal')}${esc(lvl.name)}${icon('chevron-right')}</button><a class="streak welcome-streak" href="#/rewards/streak" aria-label="View your daily app streak">${icon('flame')} ${appStreak.current ? `${appStreak.current}-day streak` : 'Start a streak'}${icon('chevron-right')}</a></div>
    </div>
    <div class="welcome-progress">
      <div class="welcome-progress-label"><span>${lvl.next ? 'Next level' : 'Top level'}</span><strong>${lvl.next ? `${n(lvl.toNext)} to ${esc(lvl.next)}` : esc(lvl.name)}</strong></div>
      <div class="welcome-progress-track" role="progressbar" aria-label="Level progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lvl.pct}"><span style="width:${lvl.pct}%"></span></div>
    </div>
  </section>
  ${eventCarousel()}
  </div>
  <h2 class="kk-pillars-title">Explore</h2>
  <nav class="kk-pillars" aria-label="+Onz directories">${PILLARS.map(([h, t, art, d]) => `<a href="#/${h}" class="kk-pillar"><span class="onz-art-frame">${directoryArt(art)}</span><h3>${t}</h3><p>${d}</p></a>`).join('')}</nav>
  <section class="section card row flow-paused"><span class="tile-icon">${icon('trophy')}</span><h2>Weekly missions</h2><span class="badge">Coming soon</span></section>
`;
}
function homeMount(root, app) {
  mountUsernameCopy(root, app);
  $('#level-guide', root).onclick = () => {
    const lvl = levelOf(earnedTotal(app.ledger)), r = app.rules;
    const claimed = new Set(app.ledger.map((entry) => entry.id));
    const remaining = D.LESSONS.filter((_, index) => !claimed.has('lesson' + index)).length;
    const choices = [
      ...(!claimed.has('survey') ? [{
        route: 'survey', glyph: 'target', title: 'Money check', points: '+' + n(r.surveyBonus),
        detail: 'One-time survey bonus.',
      }] : []),
      ...(remaining ? [{
        route: 'learn', glyph: 'book-open', title: 'Learn & Earn', points: '+' + n(r.lessonBonus),
        detail: `${remaining} lessons left · points per correct quiz, once per lesson.`,
      }] : []),

    ];
    sheet(`<div class="points-guide">
      <div class="points-guide-heading"><span class="tile-icon">${icon('medal')}</span><div><span class="faint">${esc(lvl.name)}</span><h2>${lvl.next ? 'Reach ' + esc(lvl.next) : 'Keep earning'}</h2></div></div>
      <p class="points-guide-goal">${lvl.next ? `<strong>${n(lvl.toNext)}</strong> points to your next level` : 'You’ve reached the top level.'}</p>
      <div class="points-guide-choices">${choices.map((choice) => `<a href="#/${choice.route}" class="points-guide-choice" data-close>
        <span class="tile-icon">${icon(choice.glyph)}</span><div><h3>${esc(choice.title)}</h3><p>${esc(choice.detail)}</p></div>
        <span class="points-guide-reward">${choice.points}<small>pts</small></span>${icon('chevron-right')}</a>`).join('')}</div>
      <p class="faint points-guide-note">Levels follow total points earned. Redeeming rewards keeps your level progress.</p>
    </div>`);
  };
  return mountEventCarousel(root, app);
}

const emptyMerchants = () => `<div class="card empty">${icon('store')}<p>Verified shops will appear here.</p></div>`;
function merchantCard(m, { nav = false, dist = null } = {}) {
  const card = `<a class="mcard" href="#/merchant/${esc(m.id)}">${merchantLogo(m)}<div style="min-width:0"><h3>${esc(m.name)}</h3>
    <p>${esc(m.type)} · ${esc(m.location)}</p>${dist != null ? `<p class="dist">${icon('map-pin')}${fmtDistance(dist)}</p>` : ''}${m.offer ? `<div class="offer">${icon('badge-percent')}${esc(m.offer)}</div>` : ''}
    ${isIdea(m) ? `<div class="offer idea">${icon('lightbulb')}Student venture</div>` : ''}</div></a>`;
  if (!nav || !hasPin(m)) return card;
  return `<div class="mcard-wrap">${card}<a class="mnav" href="${directionsUrl(m)}" target="_blank" rel="noopener" aria-label="Navigate to ${esc(m.name)}" title="Navigate">${icon('navigation')}</a></div>`;
}
function eventCard(c, index = 0) {
  const today = D.dayKey();
  const date = c.start ? Date.parse(c.start) : NaN;
  const hasDate = Number.isFinite(date);
  const status = c.start > today ? 'Upcoming' : c.start && c.start <= today && (c.end || c.start) >= today ? 'Happening now' : 'Campus event';
  return `<details class="card campus-event-card event-colour-${index % 3}">
    <summary>
      <span class="campus-event-date" ${hasDate ? `aria-label="${esc(fmtDate(date))}"` : ''}>
        ${hasDate ? `<strong>${esc(fmtDate(date, { day: 'numeric' }))}</strong><span>${esc(fmtDate(date, { month: 'short' }))}</span>` : icon('calendar')}
      </span>
      <div class="campus-event-copy"><span class="campus-event-status">${status}</span><h3>${esc(c.name)}</h3>
        ${c.location ? `<p class="campus-event-location">${icon('map-pin')}<span>${esc(c.location)}</span></p>` : ''}
        ${hasDate ? `<p class="campus-event-range">${esc(fmtDate(date))}${c.end && c.end !== c.start ? ' – ' + esc(fmtDate(Date.parse(c.end))) : ''}</p>` : ''}</div>
      <span class="campus-event-toggle" aria-hidden="true">${icon('chevron-right')}</span>
    </summary>
    <div class="campus-event-description">${esc(c.description || 'More details soon.')}</div>
  </details>`;
}

async function merchantRender(app, [id]) {
  const m = await D.getMerchant(app.ctx, id).catch(() => null);
  if (!m || m.status !== 'verified') return `<a class="back" href="#/explore">${icon('arrow-left')} Overview</a><div class="card empty">${icon('store')}<h3>This merchant isn’t on +Onz yet</h3><p>Only HEP-verified merchants are listed.</p></div>`;
  const deals = (await D.approvedDeals(app.ctx)).filter((d) => d.merchantId === id && d.enabled);
  return `<a class="back" href="#/explore">${icon('arrow-left')} Overview</a>
    <div class="card pad-lg" style="margin-top:8px"><div class="row" style="gap:14px">${merchantLogo(m, 'logo big')}
      <div><h1 style="font-size:26px">${esc(m.name)}</h1><p class="muted">${esc(m.type)} · ${esc(m.location)}</p></div></div>
      <div class="row" style="margin-top:14px">${isIdea(m) ? `<span class="badge warn">${icon('lightbulb')}Student venture</span>` : ''}${m.ready ? `<span class="badge ok">${icon('badge-check')}Cashless ready</span>` : ''}<span class="badge">${icon('shield-check')}HEP verified</span></div>
      ${m.offer ? `<div class="notice" style="margin-top:14px">${icon('badge-percent')}<span>${esc(m.offer)}</span></div>` : ''}
    </div>
    ${hasPin(m) ? `<section class="section"><div class="head"><h2>Getting there</h2><a href="${wazeUrl(m)}" target="_blank" rel="noopener">Open in Waze</a></div>
      <div class="card map-card"><div id="shop-map" class="mmap small" aria-label="Map showing ${esc(m.name)}"></div>
        <div class="map-bar"><a class="btn primary block" href="${directionsUrl(m)}" target="_blank" rel="noopener">${icon('navigation')} Navigate there</a></div></div></section>` : ''}
    <section class="section"><div class="head"><h2>Visit this shop</h2></div><div class="card steps">
      <div class="step"><span class="n">1</span><div><h3>Walk over</h3><p>Use the map to find ${esc(m.name)}.</p></div></div>
      <div class="step"><span class="n">2</span><div><h3>Pay cashless if you buy</h3><p>${esc(m.name)} accepts DuitNow QR. Check the name and amount in your banking app before you pay.</p></div></div>
    </div></section>
    ${deals.length ? `<section class="section"><div class="head"><h2>Live deals</h2></div><div class="stack">${deals.map((d) => `<div class="card row between"><div><h3>${esc(d.title)}</h3><p class="faint">${D.hhmm(d.startMin)}–${D.hhmm(d.endMin)} MYT</p></div>${icon('zap')}</div>`).join('')}</div></section>` : ''}
    <div style="position:sticky;bottom:calc(var(--nav-h) + 12px);margin-top:20px"><a class="btn primary block" href="#/explore/${esc(m.id)}">${icon('map')} View nearby shops</a></div>`;
}
function merchantMount(root, app, [id]) {
  const el = $('#shop-map', root); if (!el) return;
  let map = null;
  D.getMerchant(app.ctx, id).then((m) => shopPinMap(el, m)).then((mm) => { if (root.isConnected) map = mm; else mm.remove(); })
    .catch((err) => { el.innerHTML = `<div class="empty">${esc(err.message)}</div>`; });
  return () => { if (map) map.remove(); };
}

function cafeListings() {
  return `<details class="card directory-cafes" id="directory-cafes"><summary>${icon('coffee')} Campus cafés ${icon('chevron-right')}</summary>
    <p class="faint">Public café listings. Hours and prices aren’t verified.</p>
    <div class="list">${CAFES.map((c) => `<div class="item"><span class="tile-icon">${icon('coffee')}</span><div class="grow"><h3>${esc(c.name)}</h3>
      <p>${esc(c.location)} · ${esc(c.food)}</p></div><a class="btn small" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name + ' ' + c.location + ' Universiti Malaya')}">${icon('map-pin')} Map</a></div>`).join('')}</div>
    <p class="faint">Sources: <a href="${CAFES[6].source}" target="_blank" rel="noopener">UM food and vendor listings</a> · <a href="${CAFES[0].source}" target="_blank" rel="noopener">campus food guide (2023)</a></p></details>`;
}

// ------------------------------------------------------------- Central campus directory: nearby discovery, no attendance or points writes
function directoryCategory(type) {
  return ({ 'Food & drinks': ['coffee', 'food'], Laundry: ['shirt', 'laundry'], Printing: ['printer', 'printing'],
    Shops: ['store', 'shops'], Services: ['settings', 'services'], 'Student event stall': ['lightbulb', 'ventures'],
    'Student ventures': ['lightbulb', 'ventures'] })[type] || ['store', 'shops'];
}
async function directoryRender(app, [mode] = []) {
  const merchants = await D.listVerifiedMerchants(app.ctx); app._merchants = merchants;
  const types = ['All', ...new Set(merchants.map((m) => m.type)), 'Student ventures'];
  const selected = mode === 'idea' ? 'Student ventures' : 'All';
  return `<div class="checkout-page checkout-discovery overview-directory"><section class="card checkout-card" aria-labelledby="checkout-title">
      <div class="checkout-hero-top"><div class="checkout-heading"><span class="checkout-kicker">Around you</span><h1 id="checkout-title">Overview</h1>
        <div class="overview-stats"><span>${icon('store')}<strong>${n(merchants.length)}</strong> <span>Shops</span></span><span>${icon('lightbulb')}<strong>${n(merchants.filter(isIdea).length)}</strong> <span>Student Ventures</span></span></div></div>
        <div class="checkout-pin-art" aria-hidden="true">${icon('map')}<span>${icon('navigation')}</span><i class="overview-spot spot-coffee">${icon('coffee')}</i><i class="overview-spot spot-store">${icon('store')}</i></div></div>
      <div class="overview-location-bar"><div class="checkout-location" role="status"><span class="checkout-location-icon" aria-hidden="true">${icon('navigation')}</span><div><strong id="loc-h">Explore campus</strong><p id="loc-p">Allow location to see what’s nearby.</p></div></div>
      <button type="button" class="btn go" id="nearby-locate">${icon('locate-fixed')} My location</button></div>
    </section>
    <section class="checkout-shops" aria-labelledby="checkout-shops-title"><div class="checkout-section-heading"><h2 id="checkout-shops-title">${icon('store')} Nearby shops</h2><span class="overview-result-count" id="directory-results-count" aria-label="Matching shops">${n(merchants.length)}</span></div>
      <div class="overview-search">${icon('search')}<input type="search" id="q" placeholder="Search by name or place" aria-label="Search merchants"></div>
      <div class="chips checkout-filters" id="directory-filters" aria-label="Merchant filters">${types.map((type) => { const [glyph, tone] = directoryCategory(type); return `<button type="button" data-type="${esc(type)}" data-tone="${tone}" ${type === 'Student ventures' ? 'data-ventures' : ''} class="${type === selected ? 'on' : ''}" aria-pressed="${type === selected}"><span class="overview-category-icon">${icon(type === 'All' ? 'compass' : glyph)}</span><span>${esc(type === 'Student ventures' ? 'Student Ventures' : type)}</span></button>`; }).join('')}</div>
      <div class="checkout-shops-layout"><div class="card map-card checkout-map"><div class="overview-map-title">${icon('map')}<strong>Campus map</strong><span>${icon('badge-check')}<span>HEP verified</span></span></div><div id="cmap" class="mmap small" aria-label="Campus shops and your location, when permitted"></div><div class="nearby-map-legend"><span class="nearby-location-key" id="nearby-location-key" hidden><span class="nearby-you-dot" aria-hidden="true"></span><span>Your location</span></span><span>${icon('store')} Campus shops</span></div></div>
        <div class="stack" id="clist"></div></div>
    </section>
    <section class="section checkout-deals" id="directory-deals" tabindex="-1" aria-labelledby="checkout-deals-title"><div class="checkout-section-heading"><h2 id="checkout-deals-title">${icon('zap')} Live deals</h2></div>
      <div id="checkout-deals" class="checkout-deal-grid"><div class="card checkout-deals-empty">${icon('zap')}<p>Finding café deals…</p></div></div>
    </section>
    ${hereNowSection(app, { discovery: true })}${cafeListings()}
  </div>`;
}
function directoryMount(root, app, [mode] = []) {
  let pos = null, map = null, stop = null, disposed = false, refreshing = false;
  let activeType = mode === 'idea' ? 'Student ventures' : 'All', query = '', permission = null, watchToken = 0, requested = false, centerOnFix = true;
  const focusId = mode && !['idea', 'deals', 'cafes'].includes(mode) ? mode : null;
  const merchants = [...app._merchants];
  const visibleMerchants = () => merchants.filter((m) =>
    (activeType === 'All' || (activeType === 'Student ventures' ? isIdea(m) : m.type === activeType))
    && `${m.name} ${m.location} ${m.zone || ''}`.toLowerCase().includes(query));
  const distance = (m) => pos && hasPin(m) ? distanceM(pos, m) : Infinity;
  const sortedMerchants = () => [...visibleMerchants()].sort((a, b) =>
    (pos ? distance(a) - distance(b) : 0) || a.name.localeCompare(b.name));
  const status = (heading, detail) => {
    if (disposed) return;
    $('#loc-h', root).textContent = heading;
    $('#loc-p', root).textContent = detail;
    $('.checkout-card', root).classList.toggle('location-found', !!pos);
    $('#nearby-location-key', root).hidden = !pos;
  };
  const popup = (m) => `<div class="mpop">${merchantLogo(m, 'mpop-logo')}<b>${esc(m.name)}</b><p>${esc(m.type)} · ${esc(m.location)}</p>
    ${pos ? `<p class="dist">${esc(fmtDistance(distanceM(pos, m)))}</p>` : ''}
    <a href="#/merchant/${esc(m.id)}">View shop</a><a href="${directionsUrl(m)}" target="_blank" rel="noopener">Directions ↗</a></div>`;
  function setPins() { if (map) map.setPins(visibleMerchants().filter(hasPin), { popup }); }
  function centerMap() {
    if (!map) return;
    if (pos) map.setView(pos.lat, pos.lng, 16);
    else {
      const pinned = visibleMerchants().filter(hasPin);
      const focused = pinned.find((m) => m.id === focusId);
      map.fit((focused ? [focused] : pinned).map((m) => [m.lat, m.lng]));
    }
  }
  let dealRows = [], dealMessage = 'Finding café deals…', renderedDeals;
  function drawDeals() {
    const ids = new Set(visibleMerchants().map((m) => m.id));
    const rows = dealRows.filter(({ merchant }) => merchant && ids.has(merchant.id))
      .sort((a, b) => Number(b.status === 'Available') - Number(a.status === 'Available')
        || (pos ? distance(a.merchant) - distance(b.merchant) : 0));
    const html = rows.map(({ deal, merchant, status: dealStatus }) => {
      const live = dealStatus === 'Available';
      return `<article class="card checkout-deal nearby-deal ${live ? 'is-live' : ''}"><div class="checkout-deal-top"><div>
        <span class="checkout-deal-status">${icon(live ? 'zap' : 'clock')} ${esc(live ? 'Live now' : dealStatus)}</span>
        <h3>${esc(deal.title)}</h3><p class="checkout-deal-shop">${esc(merchant.name)} · ${D.hhmm(deal.startMin)}–${D.hhmm(deal.endMin)} MYT</p></div>
        <span class="nearby-deal-icon" aria-hidden="true">${icon('coffee')}</span></div>
        <div class="nearby-deal-links"><a href="#/merchant/${esc(merchant.id)}">View shop ${icon('chevron-right')}</a>${hasPin(merchant) ? `<a class="btn small checkout-deal-directions" href="${directionsUrl(merchant)}" target="_blank" rel="noopener">${icon('navigation')} Directions</a>` : ''}</div></article>`;
    }).join('') || `<div class="card checkout-deals-empty">${icon('zap')}<p>${esc(dealMessage)}</p></div>`;
    if (html !== renderedDeals) { $('#checkout-deals', root).innerHTML = html; renderedDeals = html; }
  }
  async function refreshDeals() {
    if (refreshing || disposed) return;
    refreshing = true;
    try {
      const approved = await D.approvedDeals(app.ctx);
      dealRows = await D.dealOverview(app.ctx, approved.filter((d) => d.enabled), merchants);
      dealMessage = 'No off-peak deals right now.';
    } catch { dealRows = []; dealMessage = 'Deals are temporarily unavailable.'; }
    finally { refreshing = false; }
    if (!disposed) drawDeals();
  }
  function draw() {
    if (disposed) return;
    const rows = sortedMerchants();
    $('#directory-results-count', root).textContent = n(rows.length);
    $('#clist', root).innerHTML = rows.map((m) => { const [glyph, tone] = directoryCategory(m.type); return `<article class="card checkout-shop ${m.id === focusId ? 'focus' : ''}" data-tone="${tone}">
      <span class="overview-shop-logo">${merchantLogo(m)}<span class="overview-verified" title="HEP verified">${icon('badge-check')}</span></span><div class="checkout-shop-copy"><h3><a href="#/merchant/${esc(m.id)}">${esc(m.name)}</a></h3>
        <span class="overview-shop-category">${icon(glyph)}<span>${esc(m.type)}</span></span><p>${icon('map-pin')}<span>${esc(m.location)}</span></p>
        ${m.offer ? `<p class="overview-shop-offer">${icon('tag')}<span>${esc(m.offer)}</span></p>` : ''}
        ${pos && hasPin(m) ? `<span class="nearby-distance">${icon('navigation')} ${esc(fmtDistance(distanceM(pos, m)))}</span>` : ''}</div>
      <div class="checkout-shop-action">${hasPin(m) ? `<a class="btn small" href="${directionsUrl(m)}" target="_blank" rel="noopener">${icon('navigation')} Directions</a>` : `<a class="btn small" href="#/merchant/${esc(m.id)}">View shop ${icon('chevron-right')}</a>`}</div></article>`; }).join('')
      || `<div class="card empty">${icon('search')}<p>No merchants match. Try another word or filter.</p></div>`;
    drawDeals();
  }
  function clearLocation(err) {
    pos = null;
    if (map) { map.setMe(null); centerMap(); }
    status('Location is off', err?.message || 'Browse campus shops or allow location to see what’s nearby.');
    draw();
  }
  function startLocation() {
    if (disposed) return;
    requested = true; centerOnFix = true;
    const token = ++watchToken;
    if (stop) stop();
    status('Finding your location…', 'Allow location to find nearby shops.');
    stop = watchLocation((p) => {
      if (disposed || token !== watchToken) return;
      pos = p;
      if (map) { map.setMe(p); if (centerOnFix) { centerMap(); centerOnFix = false; } }
      status(p.accuracy > 100 ? 'Location is approximate' : 'You’re on the map', 'Shops are sorted nearest first.');
      draw();
    }, (err) => { if (!disposed && token === watchToken) clearLocation(err); });
  }
  $('#nearby-locate', root).onclick = startLocation;
  const permissionChanged = () => {
    if (disposed) return;
    if (permission.state === 'granted') startLocation();
    else { ++watchToken; if (stop) stop(); stop = null; clearLocation(); }
  };
  // Already-granted permission can show a live position immediately. Otherwise
  // wait for the location button; never infer attendance or publish presence.
  if (navigator.permissions?.query) navigator.permissions.query({ name: 'geolocation' }).then((result) => {
    if (disposed) return;
    permission = result; permission.addEventListener('change', permissionChanged);
    if (permission.state === 'granted' && !requested) startLocation();
    else if (permission.state === 'denied') clearLocation();
  }).catch(() => {});
  $('#q', root).oninput = (event) => { query = event.target.value.trim().toLowerCase(); setPins(); hn.redraw(); if (!pos) centerMap(); draw(); };
  const filterButtons = $$('#directory-filters button', root);
  filterButtons.forEach((button) => {
    button.onclick = () => {
      activeType = button.dataset.type;
      filterButtons.forEach((item) => { item.classList.toggle('on', item === button); item.setAttribute('aria-pressed', String(item === button)); });
      setPins(); hn.redraw(); if (!pos) centerMap(); draw();
    };
  });
  const hn = mountHereNow(root, app, { getMap: () => map, merchants: visibleMerchants, discovery: true });
  createMap($('#cmap', root), { center: UM_CENTER, zoom: 16 }).then((m) => {
    if (disposed) { m.remove(); return; }
    map = m; setPins(); if (pos) { map.setMe(pos); centerOnFix = false; } centerMap(); hn.redraw();
  }).catch(() => {
    if (!disposed) $('#cmap', root).innerHTML = `<div class="empty">${icon('map')}<p>Map unavailable. Browse shops below.</p></div>`;
  });
  draw(); refreshDeals();
  const section = mode === 'deals' ? $('#directory-deals', root) : mode === 'cafes' ? $('#directory-cafes', root) : null;
  if (section) { if (mode === 'cafes') section.open = true; section.scrollIntoView({ block: 'start' }); }
  const dealTimer = setInterval(refreshDeals, 30000);
  return () => { disposed = true; ++watchToken; clearInterval(dealTimer); if (stop) stop(); permission?.removeEventListener('change', permissionChanged); hn.stop(); if (map) map.remove(); };
}

function appStreakSection(app) {
  const now = Date.now(), today = D.dayKey(now);
  const { current, todayDone, days } = D.dailyStreak(app.appDays, now);
  const recent = Array.from({ length: 7 }, (_, i) => {
    const time = now - (6 - i) * 86400000, day = D.dayKey(time), completed = days.has(day);
    const label = new Date(time).toLocaleDateString('en-MY', { weekday: 'short', timeZone: 'Asia/Kuala_Lumpur' });
    return `<li class="${completed ? 'checked' : ''} ${day === today ? 'today' : ''}" aria-label="${day}: ${completed ? 'App opened' : 'No app activity'}"><span>${label}</span><span class="streak-day" aria-hidden="true">${icon(completed ? 'check' : day === today ? 'flame' : 'circle-check')}</span></li>`;
  }).join('');
  return `<section class="section card rewards-streak app-streak" id="rewards-streak" tabindex="-1" aria-labelledby="app-streak-heading"><div class="streak-heading"><span class="streak-emblem" aria-hidden="true">${icon('flame')}</span><div><h2 id="app-streak-heading">Daily check-in streak</h2><p><strong>${current}</strong> ${current === 1 ? 'day running' : 'days running'}</p></div><span class="badge">${todayDone ? 'Today counted' : 'Ready for today'}</span></div>
    <ul class="streak-calendar" aria-label="App activity over the past seven days">${recent}</ul><div class="streak-footer"><p class="streak-guidance">Open +Onz each day to keep your streak.</p><span class="badge">Automatic</span></div></section>`;
}

// ------------------------------------------------------------- rewards, vouchers and learning streaks
async function rewardsRender(app) {
  const rewards = await D.listRewards(app.ctx);
  const shops = rewards.some((r) => r.active && r.merchantId) ? await D.listVerifiedMerchants(app.ctx).catch(() => []) : [];
  // Where a voucher can be used, shown before the student spends points.
  const whereTo = (r) => (r.merchantId
    ? `<span>Use at</span> <b>${shops.find((m) => m.id === r.merchantId) ? esc(shops.find((m) => m.id === r.merchantId).name) : 'a selected shop'}</b>`
    : 'Collect at the HEP counter');
  const p = app.profile;
  const achievements = badges(app);
  return `<div class="rewards-page"><div class="rewards-hero"><div class="rewards-hero-copy"><h1>Rewards</h1>
    <p>Available points</p><div class="rewards-balance">${icon('sparkles')}<strong data-bind="points">${n(p.points)}</strong><span>pts</span></div>
    <button class="btn go" type="button" id="browse-rewards">Swap points ${icon('chevron-right')}</button></div>
    <div class="rewards-hero-art" aria-hidden="true"><span class="rewards-orbit orbit-one">${icon('star')}</span><span class="rewards-gift">${icon('gift')}</span><span class="rewards-orbit orbit-two">${icon('sparkles')}</span></div></div>
    ${appStreakSection(app)}
    <section class="rewards-shelf" id="reward-shelf" tabindex="-1"><div class="rewards-section-heading"><h2>${icon('gift')} Swap points</h2></div>
      <div class="reward-grid">${rewards.filter((r) => r.active).map((r, index) => {
        const left = (r.stock || 0) - (r.issued || 0); const can = p.points >= r.cost && left > 0;
        return `<article class="card reward-prize prize-colour-${index % 3} ${left <= 0 ? 'sold-out' : ''}"><div class="reward-prize-art"><span class="reward-prize-icon" aria-hidden="true">${icon(r.icon || 'gift')}</span><span class="reward-stock">${left > 0 ? `${left} left` : 'All claimed'}</span></div>
          <div class="reward-prize-copy"><h3>${esc(r.title)}</h3><p class="reward-where">${whereTo(r)}</p><p class="reward-valid">${icon('clock')} valid ${r.validDays || 30} days</p>
          <div class="reward-prize-footer"><span class="reward-price">${icon('sparkles')}<strong>${n(r.cost)}</strong><span>pts</span></span>
          <button class="btn small ${can ? 'primary' : ''}" data-redeem="${esc(r.id)}" ${can ? '' : 'disabled'}>${left <= 0 ? 'All claimed' : can ? 'Swap' : `${n(Math.max(0, r.cost - p.points))} more`}</button></div></div></article>`;
      }).join('') || `<div class="card empty">${icon('gift')}<p>HEP hasn’t added rewards yet.</p></div>`}</div></section>
    <section class="section rewards-wallet"><div class="rewards-section-heading"><h2>${icon('ticket')} My vouchers</h2></div><div id="vouchers" class="stack"><div class="skeleton" style="height:80px"></div></div></section>
    <section class="section rewards-badges"><div class="rewards-section-heading"><h2>${icon('trophy')} Badges</h2><span class="rewards-badge-count" aria-label="Badges earned">${achievements.filter(([got]) => got).length}/${achievements.length}</span></div>
      <div class="awards" role="list" style="--achievement-count:${achievements.length}">${achievements.map(([got, ic, label]) => `<div class="award ${got ? 'got' : ''}" role="listitem"><span class="reward-medal" aria-hidden="true">${icon(ic)}<span class="reward-medal-state">${icon(got ? 'check' : 'lock')}</span></span><span class="reward-badge-label">${esc(label)}</span><span class="reward-badge-status">${got ? 'Earned' : 'Locked'}</span></div>`).join('')}</div></section>
    <div class="rewards-extras"><a class="reward-extra welfare-extra" href="#/community"><span class="reward-extra-icon">${icon('hand-heart')}</span><div><h3>Give to the welfare fund</h3><p>Points you donate support UM students in need.</p></div>${icon('chevron-right')}</a></div></div>`;
}
function badges(app) {
  const ids = new Set(app.ledger.map((l) => l.id));
  return [
    [ids.has('survey'), 'target', 'Money check done'],
    [['lesson0', 'lesson1', 'lesson2'].every((x) => ids.has(x)), 'graduation-cap', 'All lessons'],
    [app.ledger.some((l) => l.type === 'donate'), 'hand-heart', 'Welfare donor'],
  ];
}
function rewardsMount(root, app, [section] = []) {
  if (section === 'streak') {
    const target = $('#rewards-streak', root);
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  $('#browse-rewards', root).onclick = (event) => {
    event.preventDefault();
    const shelf = $('#reward-shelf', root);
    shelf.focus({ preventScroll: true });
    shelf.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  $$('[data-redeem]', root).forEach((b) => {
    b.onclick = async () => {
      const r = (await D.listRewards(app.ctx)).find((x) => x.id === b.dataset.redeem);
      if (!(await confirmSheet(`Swap ${n(r.cost)} points for ${r.title}?`, `You’ll have ${n(app.profile.points - r.cost)} points left. The voucher is valid for ${r.validDays || 30} days.`, 'Swap points'))) return;
      try { const vid = await D.redeemReward(app.ctx, r); confetti(); toast('Voucher added. Show it at the counter.'); await app.render(); showVoucher(app, vid, [{ id: vid, title: r.title, merchantId: r.merchantId, status: 'issued' }]); }
      catch (e) { toast(errText(e), true); }
    };
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
  return `${eventCarousel({page:true})}<section class="other-campus-events" aria-labelledby="other-events-heading"><div class="head"><h2 id="other-events-heading">${icon('sparkles')} Other events</h2><span class="other-events-count" aria-label="Event count">${camps.length}</span></div>
    <div class="other-events-grid">${camps.map(eventCard).join('') || `<div class="card empty">${icon('calendar')}<p>No events listed right now.</p></div>`}</div></section>`;
}

// ------------------------------------------------------------- Bayar Kita: how to pay cashless (no tracking)
const cashlessSteps = () => `<div class="card steps">
      <div class="step"><span class="n">1</span><div><h3>Open your banking or e-wallet app</h3><p>Any app that supports DuitNow QR works.</p></div></div>
      <div class="step"><span class="n">2</span><div><h3>Scan the merchant’s DuitNow QR</h3><p>Check the recipient name matches the shop and the amount is right before you confirm.</p></div></div>
      <div class="step"><span class="n">3</span><div><h3>Keep your receipt</h3><p>Your bank app keeps the record. +Onz never asks for your banking details or OTP.</p></div></div>
    </div>`;

async function bayarRender(app) {
  const merchants = await D.listVerifiedMerchants(app.ctx);
  return `<div class="page-title"><h1>Pay Cashless</h1><p>Pay with DuitNow QR in your bank or e-wallet app.</p></div>
    ${cashlessSteps()}
    <section class="section"><div class="head"><h2>Participating merchants</h2><a href="#/explore">All ${merchants.length}</a></div>
      <div class="mgrid">${merchants.slice(0, 6).map((m) => merchantCard(m)).join('') || emptyMerchants()}</div></section>
    <section class="section"><div class="card row"><span class="tile-icon orange">${icon('shield-alert')}</span><div style="flex:1"><h3>Learn &amp; Earn</h3><p class="faint">Scams & budgeting · +${app.rules.lessonBonus} points per lesson</p></div><a class="btn small" href="#/learn">Start</a></div></section>`;
}

// ------------------------------------------------------------- learn
async function learnRender(app) {
  const done = new Set(app.ledger.map((l) => l.id));
  return `<a class="back" href="#/bayar">${icon('arrow-left')} Pay Cashless</a><div class="page-title"><h1>Learn &amp; Earn</h1>
    <p>One-minute lessons on paying safely. Answer correctly to earn ${app.rules.lessonBonus} points each, once.</p></div>
    <div class="stack">${D.LESSONS.map((l, i) => `<div class="card row" style="gap:14px"><span class="tile-icon ${done.has('lesson' + i) ? 'mint' : ''}">${icon(done.has('lesson' + i) ? 'circle-check' : l.icon)}</span>
      <div style="flex:1"><h3>${esc(l.title)}</h3><p class="faint">${done.has('lesson' + i) ? 'Completed' : `1 question · +${app.rules.lessonBonus} points`}</p></div>
      <button class="btn small ${done.has('lesson' + i) ? '' : 'primary'}" data-lesson="${i}">${done.has('lesson' + i) ? 'Practise' : 'Start'}</button></div>`).join('')}</div>
    <p class="faint learning-practice-note">Practice is always available. Lesson points are earned once.</p>
    <div class="card row" style="margin-top:16px"><span class="tile-icon orange">${icon('target')}</span><div style="flex:1"><h3>Money check</h3><p class="faint">See where you stand on payment safety and budgeting.</p></div><a class="btn small" href="#/survey">Open</a></div>`;
}
function learnMount(root, app) {
  $$('[data-lesson]', root).forEach((b) => {
    b.onclick = () => {
      const i = +b.dataset.lesson; const l = D.LESSONS[i];
      const el = sheet(`<h2>${esc(l.title)}</h2><p class="muted">${esc(l.q)}</p><div class="stack" style="margin-top:16px">${l.options.map((o, j) => `<button class="btn block" style="white-space:normal;height:auto;padding:12px 16px;text-align:left;justify-content:flex-start" data-a="${j}">${esc(o)}</button>`).join('')}</div><p id="fb" class="faint" style="margin-top:12px"></p>`);
      $$('[data-a]', el).forEach((a) => {
        a.onclick = () => busy(a, async () => {
          const practice = app.ledger.some((entry) => entry.id === 'lesson' + i);
          const r = await (practice ? D.practiceLesson : D.answerLesson)(app.ctx, i, +a.dataset.a, app.rules).catch((e) => { toast(errText(e), true); return null; });
          if (r === 'correct') { closeSheet(); confetti(); pointsFx(); toast(`Correct. +${app.rules.lessonBonus} points`); app.render(); }
          else if (r === 'done') { closeSheet(); toast('You’ve already earned points for this lesson.'); }
          else if (r === 'practised') { closeSheet(); confetti(); toast('Correct practice. No repeat points.'); app.render(); }
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
  const tip = role === 'student' ? (r.knowledge < 75 ? 'Try the Learn & Earn lessons next.' : 'You’re set. Find a merchant and start earning.')
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
  const merchants = await D.listVerifiedMerchants(app.ctx);
  const ventures = merchants.filter(isIdea);
  const college = D.COLLEGES.find(([k]) => k === app.profile.college)?.[1] || 'Your college';
  return `<div class="community-page"><header class="community-hero"><div class="community-hero-copy"><h1>Community</h1><p>Your college vs the rest.</p>
      <span class="community-college">${icon('graduation-cap')}<span>${esc(college)}</span></span></div><div class="community-trophy" aria-hidden="true">${icon('trophy')}<span>${icon('star')}</span></div>
      <div class="community-scoreboard"><div><span>Your rank</span><strong id="community-rank">—</strong></div><div><span>KK points</span><strong id="community-points">—</strong></div><a href="#/explore">${icon('map')} Overview ${icon('chevron-right')}</a></div></header>
    <div class="community-main-grid"><section class="card community-league" aria-labelledby="league-title"><div class="community-section-heading"><h2 id="league-title">${icon('trophy')} KK League</h2><span>Total points earned</span></div><p class="community-league-hint">All students’ earned points count. Redeeming or donating won’t lower your KK’s score.</p><div id="lb"><div class="skeleton" style="height:220px"></div></div></section>
    <div class="community-welfare-pair"><section class="card community-welfare" aria-labelledby="welfare-title"><span class="community-heart" aria-hidden="true">${icon('hand-heart')}</span>
      <h2 id="welfare-title">Student welfare fund</h2><p>Points given here are pooled for UM students who need help with essentials.</p>
      <div class="community-welfare-total">${icon('sparkles')}<strong id="welfare">—</strong></div><span class="community-welfare-caption">points available</span>
      <button class="btn go" id="donate">${icon('hand-heart')} Give points ${icon('chevron-right')}</button></section>
    <section class="card community-support" aria-labelledby="support-title"><span class="community-support-icon" aria-hidden="true">${icon('wallet')}</span><h2 id="support-title">Need support?</h2><p>Ask HEP for pooled welfare points.</p>
      <button class="btn primary" type="button" id="request-welfare">${icon('plus')} Request points ${icon('chevron-right')}</button>
      <details class="welfare-history"><summary>My requests <span id="welfare-request-count">0</span>${icon('chevron-right')}</summary><div id="welfare-requests"><p class="faint">Loading requests…</p></div></details>
    </section></div></div>
    <section class="section community-ventures"><div class="community-section-heading"><h2>${icon('store')} Student Ventures</h2><a href="#/explore/idea">See all ${icon('chevron-right')}</a></div>
      <div class="mgrid">${ventures.slice(0, 4).map((m) => merchantCard(m)).join('') || `<div class="card empty">${icon('lightbulb')}<p>Running a stall or small business? Ask HEP about joining as a student entrepreneur.</p></div>`}</div></section>
    <a class="community-invite" href="#/me"><span class="community-invite-icon">${icon('user-plus')}</span><div><h3>Invite friends</h3><p>Connect with friends using your referral code.</p></div><span class="community-invite-arrow">${icon('chevron-right')}</span></a></div>`;
}
function communityMount(root, app) {
  const u1 = D.watchStats(app.ctx, 'league', (s) => {
    const el = $('#lb', root); if (!el) return;
    const rows = Object.entries(s?.colleges || {}).filter(([, points]) => points > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true })); const max = Math.max(1, ...rows.map((r) => r[1]));
    const myRank = rows.findIndex(([k]) => k === app.profile.college);
    $('#community-rank', root).textContent = myRank >= 0 ? '#' + (myRank + 1) : '—';
    $('#community-points', root).textContent = s ? n(s.colleges?.[app.profile.college] || 0) : '—';
    el.innerHTML = rows.length ? `<div class="community-podium">${rows.slice(0, 3).map(([k, v], i) => `<div class="community-contender place-${i + 1} ${k === app.profile.college ? 'is-mine' : ''}">
      <span class="contender-place">${i === 0 ? icon('trophy') : icon('medal')}<b>#${i + 1}</b></span><span class="contender-crest">${esc(k)}</span>
      <span class="contender-name">${esc(D.COLLEGES.find(([c]) => c === k)?.[1] || k)}</span><strong class="contender-score">${n(v)} <small>pts</small></strong>
      ${k === app.profile.college ? '<span class="contender-mine">Your college</span>' : ''}</div>`).join('')}</div>
      <div class="community-rank-list">${rows.slice(3, 8).map(([k, v], i) => `<div class="lb-row ${k === app.profile.college ? 'me' : ''}"><span class="rank">${i + 4}</span>
      <div><span class="name">${esc(D.COLLEGES.find(([c]) => c === k)?.[1] || k)}</span><div class="bar"><i style="width:${Math.round((v / max) * 100)}%"></i></div></div><b class="num">${n(v)} <small>pts</small></b></div>`).join('')
      }</div>` : `<div class="community-league-empty">${icon('trophy')}<p>${s ? 'No points earned yet. Get your KK started.' : 'Scores are syncing.'}</p><a class="btn small primary" href="#/explore">Overview ${icon('chevron-right')}</a></div>`;
  }, () => { const el = $('#lb', root); if (el) el.innerHTML = '<p class="faint">League is temporarily unavailable.</p>'; });
  const u2 = D.watchStats(app.ctx, 'welfare', (s) => { const el = $('#welfare', root); if (el) countUp(el, s?.points || 0); }, () => {});
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
  $('#request-welfare', root).onclick = () => {
    const el = sheet(`<div class="welfare-form-heading"><span class="community-support-icon">${icon('wallet')}</span><div><h2>Request welfare points</h2><p class="faint">HEP reviews each request.</p></div></div>
      <form id="welfare-request-form" class="stack" style="margin-top:18px"><label class="field">Points requested<input name="amount" type="number" min="1" step="1" inputmode="numeric" required></label>
      <label class="field">What do you need help with?<textarea name="reason" rows="3" minlength="10" maxlength="1000" placeholder="Meals, study materials or other essentials" required></textarea></label>
      <p class="faint">Only you and HEP can see your request.</p><button class="btn primary block" type="submit">Send request ${icon('arrow-right')}</button></form>`);
    $('#welfare-request-form', el).onsubmit = (event) => {
      event.preventDefault(); const form = event.target;
      busy($('button[type=submit]', form), async () => {
        try { await D.submitWelfareRequest(app.ctx, Number(form.amount.value), form.reason.value); closeSheet(); $('.welfare-history', root).open = true; toast('Request sent to HEP.'); }
        catch (error) { toast(errText(error), true); }
      });
    };
  };
  const u3 = D.watchMyWelfareRequests(app.ctx, (requests) => {
    const el = $('#welfare-requests', root); if (!el) return;
    $('#welfare-request-count', root).textContent = n(requests.length);
    el.innerHTML = requests.map((request) => `<details class="welfare-request-entry"><summary><strong>${n(request.amount)} <small>pts</small></strong><span class="welfare-status ${esc(request.status)}">${request.status === 'approved' ? 'Points received' : request.status === 'rejected' ? 'Declined' : 'Pending HEP'}</span>${icon('chevron-right')}</summary>
      <div><p class="faint">${fmtDate(request.createdAt)}</p><p data-no-i18n>${esc(request.reason)}</p>${request.response ? `<p class="welfare-response"><b>HEP:</b> <span data-no-i18n>${esc(request.response)}</span></p>` : ''}</div></details>`).join('') || '<p class="faint welfare-no-requests">No requests yet.</p>';
  }, () => { const el = $('#welfare-requests', root); if (el) el.innerHTML = '<p class="faint">Couldn’t load requests.</p>'; });
  return () => { u1(); u2(); u3(); };
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
  const lvl = levelOf(earnedTotal(app.ledger));
  const history = app.ledger.slice(0, 30);
  return `<section class="card pad-lg me-card"><a href="#/avatar" class="me-avatar" aria-label="Customise your avatar">${AV.avatarSVG(myAvatar(app), { size: 120, title: p.name })}</a>
      <div><h1 style="font-size:24px">${esc(p.name)}</h1><p class="muted">${esc(D.COLLEGES.find(([k]) => k === p.college)?.[1] || '')}</p>
      <p class="row" style="gap:6px;margin-top:6px"><span class="badge ok">${icon('medal')}${esc(lvl.name)}</span></p>
      <a class="btn small primary" href="#/avatar" style="margin-top:10px">${icon('palette')} Customise avatar</a></div></section>
    <section class="section card invite-card">
      <div class="row invite-heading"><span class="tile-icon">${icon('user-plus')}</span><h2>Invite friends</h2></div>
      <div class="invite-code">
        <div><span class="faint">Your referral code</span><strong class="code-text" data-no-i18n>${esc(p.referralCode)}</strong></div>
        <button class="btn small" type="button" id="copy-referral" aria-label="Copy referral code">Copy</button>
        <button class="btn primary" id="share">${icon('share-2')} Share</button>
      </div>
      <p class="faint">Using a referral code sends its owner a friend request.</p>
      ${refs.length ? `<details class="invite-activity"><summary>Referral activity <span class="badge">${n(refs.length)}</span></summary><div class="list">${refs.map((r) => `<div class="item"><span class="tile-icon">${icon('user-plus')}</span><div class="grow"><h3>${esc(r.friendName)}</h3><p>Friend request sent</p></div></div>`).join('')}</div></details>` : ''}
      ${!p.inviterUid ? `<form id="inv" class="row" style="margin-top:14px;flex-wrap:nowrap"><input name="code" placeholder="Friend’s code, e.g. AINA-7K2Q" required aria-label="Friend’s referral code"><button class="btn">Add</button></form>` : p.inviterCode ? `<p class="faint" style="margin-top:12px">You joined with code ${esc(p.inviterCode)}.</p>` : ''}
    </section>
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
    <section class="section"><a class="card row" href="#/friends"><span class="tile-icon">${icon('users')}</span><h3>Friends</h3>${icon('chevron-right')}</a></section>
    <section class="section"><div class="card row" style="flex-direction:row;flex-wrap:nowrap;align-items:center;gap:12px"><span class="tile-icon">${icon('bell')}</span><div class="grow" style="flex:1;min-width:0"><h3>Sound and vibration</h3><p class="faint">Play a chime and buzz when you earn points.</p></div>
      <label class="switch"><input type="checkbox" id="fx" ${fxOn() ? 'checked' : ''} aria-label="Sound and vibration when you earn points"><span></span></label></div></section>
    <section class="section stack"><button class="btn block" id="install">${icon('smartphone')} Install the app</button>
      <button class="btn block warn" id="out">${icon('log-out')} Sign out</button></section>`;
}
function pointsHistoryRow(entry) {
  const glyph = { checkin: 'map-pin-check', purchase: 'wallet', survey: 'target', lesson: 'book-open',
    friend: 'user-plus', inviter: 'user-plus', offpeak: 'clock', redeem: 'ticket', donate: 'hand-heart', welfare: 'hand-heart' }[entry.type] || 'sparkles';
  const earned = entry.delta > 0;
  return `<div class="points-history-row">
    <span class="points-history-icon" aria-hidden="true">${icon(glyph)}</span>
    <div class="points-history-copy"><b>${esc(ledgerLabel(entry))}</b><small>${fmtDateTime(entry.createdAt)}</small></div>
    <span class="points-history-amount ${earned ? 'earned' : ''}">${earned ? '+' : ''}${n(entry.delta)}</span>
  </div>`;
}
function ledgerLabel(l) {
  if (l.type === 'checkin') return 'Archived attendance credit';
  return { purchase: 'Cashless purchase', survey: 'Money check completed', lesson: 'Lesson completed', friend: 'Referral welcome bonus', inviter: 'Friend joined with your code',
    offpeak: 'Quiet-hour bonus', redeem: 'Swapped for a voucher', donate: 'Given to the welfare fund', welfare: 'Welfare support received', adjust: l.note || 'Adjustment by HEP' }[l.type] || l.type;
}
function meMount(root, app) {
  $('#copy-referral', root).onclick = async () => {
    try {
      await navigator.clipboard.writeText(app.profile.referralCode);
      toast('Referral code copied.');
    } catch {
      toast('Couldn’t copy. Select the referral code to copy it manually.', true);
    }
  };
  $('#share', root).onclick = async () => {
    const text = tr(`Join +Onz, UM’s campus app for merchants, events and rewards. Use my code ${app.profile.referralCode} to connect with me: ${location.origin}${location.pathname}`);
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Invite copied. Paste it to a friend.'); } } catch { /* cancelled */ }
  };
  if ($('#inv', root)) $('#inv', root).onsubmit = (e) => { e.preventDefault(); busy($('button', e.target), async () => { try { await D.applyInviterCode(app.ctx, e.target.code.value); toast('Code added. Your friend connection is in Friends.'); app.render(); } catch (err) { toast(err.code ? errText(err) : err.message, true); } }); };
  $('#prof', root).onsubmit = (e) => {
    e.preventDefault(); const f = e.target;
    busy($('button', f), async () => { try { await D.updateProfile(app.ctx, { name: f.name.value.trim(), college: f.college.value, faculty: f.faculty.value }); toast('Profile saved.'); } catch (err) { toast(errText(err), true); } });
  };
  $('#install', root).onclick = () => app.installApp();

  $('#fx', root).onchange = (e) => { setFx(e.target.checked); if (e.target.checked) pointsFx(); };
  $('#out', root).onclick = () => app.backend.sdk.signOut(app.backend.auth);
}

// ------------------------------------------------------------- routes
const live = (fn) => (root, app, params) => {
  const c1 = fn ? fn(root, app, params) : null;
  let t; const off = app.on((topic) => { if (topic === 'app-activity' || topic === 'ledger') { clearTimeout(t); t = setTimeout(() => { if (!document.querySelector('#sheet[open]') && (!root.contains(document.activeElement) || document.activeElement?.id === 'rewards-streak')) app.render(); }, 400); } });
  return () => { off(); clearTimeout(t); c1 && c1(); };
};
export const routes = {
  friends: { title: 'Friends', render: friendsRender, mount: friendsMount },
  home: { title: 'Home', render: homeRender, mount: live(homeMount) },
  explore: { title: 'Overview', render: directoryRender, mount: directoryMount },
  merchant: { title: 'Merchant', render: merchantRender, mount: merchantMount, tab: 'explore' },
  rewards: { title: 'Rewards', render: rewardsRender, mount: live(rewardsMount) },
  feskum: { title: 'FESKUM 2026', render: feskumRender, mount: feskumMount, tab: 'events', wide: true },
  events: { title: 'Campus Events', render: eventsRender, mount: mountEventCarousel, tab: 'events' },
  bayar: { title: 'Pay Cashless', render: bayarRender, tab: 'home' },
  learn: { title: 'Learn & Earn', render: learnRender, mount: learnMount, tab: 'home' },
  survey: { title: 'Money check', render: surveyRender, mount: (r, a) => surveyMount(r, a, 'student', 'home'), tab: 'home' },
  community: { title: 'Community', render: communityRender, mount: communityMount },
  avatar: { title: 'Your avatar', render: avatarRender, mount: avatarMount, tab: 'me' },
  me: { title: 'Me', render: meRender, mount: meMount },
};
