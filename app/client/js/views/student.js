import { POINT_LEVELS, earnedPoints, livePointEarningOn, pointsRules } from '../points-policy.js';
import { pointsSummaryHTML } from '../points-guide.js';
import { INFORMATION_ROUTES, informationLinks } from '../information.js';
// Student app: +Onz hub, Overview directory, rewards, events, community,
// cashless guide (Bayar Kita), learning, avatar and profile.
import * as D from '../data.js';
import { signInEmails, addSignInEmail, removeSignInEmail, linkErrorText } from '../link-email.js';
import { directoryArt } from '../directory-art.js';
import { studentDealClaimRender, studentDealClaimMount } from '../deal-flow.js';
import { claimId } from '../live-deals.js';
import { tr } from '../i18n.js';
import { friendsRender, friendsMount, usernameTag, mountUsernameCopy } from '../friends.js';
import { feskumCard, feskumRender, feskumMount } from '../feskum.js';
import { eventCarousel, mountEventCarousel, openEventPoster, eventPosterImage } from '../event-carousel.js';
import { activeEventSlides } from '../event-catalog.js';
import { ozPointsHero, ozListRow, ozSectionHead, ozEmpty, ozButton, ozTag, ozSegmented, ozLiveDealCard } from '../oz-ui.js';
import { ozIcon } from '../oz-icons.js';
import { eventGalleryRender, eventGalleryMount } from '../event-gallery.js';
import { CAFES } from '../cafes.js';
import { createMap, shopPinMap, hasPin, directionsUrl, wazeUrl, distanceM, fmtDistance, watchLocation, locate, UM_CENTER } from '../map.js';
import * as AV from '../avatar.js';
import { hereNowSection, mountHereNow } from '../herenow.js';
import { closeRender, closeMount } from './close.js';
import { feedbackRender, feedbackMount } from '../feedback.js';
import * as Guide from '../guide.js';
import { safeImg, $, $$, esc, icon, n, rm, toast, sheet, closeSheet, confirmSheet, busy, errText, fmtDate, fmtDateTime, fmtTime, timeAgo,
  confetti, pointsFx, fxOn, setFx, renderQR, colorFor, initials, countUp } from '../ui.js';

export const defaultRoute = 'home';
export { canonicalPath } from '../student-paths.js';
const toMs = D.toMs;
const IDEA_SEGMENT = 'Temporary student entrepreneur';

// ------------------------------------------------------------- derived student facts
export const LEVELS = POINT_LEVELS;
const LEVEL_NAMES = LEVELS.map((l) => l[1]);
function levelOf(earned) {
  let i = 0; while (i + 1 < LEVELS.length && earned >= LEVELS[i + 1][0]) i++;
  const next = LEVELS[i + 1];
  return { name: LEVELS[i][1], next: next ? next[1] : null, pct: next ? Math.round(((earned - LEVELS[i][0]) / (next[0] - LEVELS[i][0])) * 100) : 100, toNext: next ? next[0] - earned : 0 };
}
const earnedTotal = earnedPoints;
const firstName = (p) => (p?.name || '').split(' ')[0];
export const myAvatar = (app) => app.profile?.avatar || AV.defaultFor(app.ctx?.uid);
export const merchantLogo = (m, cls = 'logo') => (safeImg(m.logo) ? `<img class="${cls}" src="${safeImg(m.logo)}" alt="">`
  : `<span class="${cls}" style="background:${colorFor(m.name)}">${esc(initials(m.name))}</span>`);
const isIdea = (m) => m.segment === IDEA_SEGMENT;

// ------------------------------------------------------------- home: the +Onz hub
// Figma 03 · Home (441:304) and W01 · Home · Desktop (915:33759): Points Hero → Upcoming events → Explore.
// Live deals stay behind their switches; manual check-in was removed from production and is not shown.
const PILLARS = [
  ['explore', 'Find campus shops', 'stall', 'Browse stalls and get directions.'],
  ['community', 'Student ventures', 'community', 'Discover student-run businesses.'],
  ['explore/deals', 'Live deals', 's:live', 'Find offers around campus.'],
  ['learn', 'Learn & Earn', 'learn', 'One-minute lessons on paying safely.'],
];
// The daily claim and its points credit are atomic. The existing ledger watcher supplies
// the student's credit, including the original points if HEP changes the award later.
function studentDealRows(app, rows) {
  const now = D.clock(app.ctx), day = D.dayKey(now);
  const credits = new Map(app.ledger.filter((entry) => entry.type === 'liveDeal').map((entry) => [entry.id, entry.delta]));
  return rows.map(({ deal, merchant }) => {
    const credit = credits.get('liveDeal_' + claimId(deal.id, app.ctx.uid, day));
    const status = credit !== undefined ? 'Claimed today' : D.dealStatus(deal, merchant, null, now);
    return {
      deal, merchant, status,
      points: credit ?? app.rules.liveDealPoints,
      minutesLeft: deal.endMin - D.minuteOfDay(now),
      hhmm: D.hhmm,
      claimHref: status === 'Available' && app.ledgerLoaded && livePointEarningOn(app.rules) ? '#/claim-deal/' + deal.id : '',
    };
  });
}
const availableFirst = (a, b) => Number(b.status === 'Available') - Number(a.status === 'Available');
const dealMessage = (message) => `<p class="oz-deal-message" role="status">${esc(message)}</p>`;

function mountLiveDeals(app, render, getMerchants) {
  let rows = [], message = 'Finding café deals…', refreshing = false, disposed = false;
  const draw = () => {
    if (disposed) return;
    if (!navigator.onLine) render([], 'Live deals are unavailable offline.');
    else render(studentDealRows(app, rows), message);
  };
  async function refresh() {
    if (disposed || refreshing) return;
    if (!navigator.onLine) { draw(); return; }
    refreshing = true;
    try {
      const [deals, merchants] = await Promise.all([D.approvedDeals(app.ctx), getMerchants()]);
      const current = await D.dealOverview(app.ctx, deals.filter((deal) => deal.enabled), merchants);
      rows = current.filter((row) => row.merchant);
      message = 'No off-peak deals right now.';
    } catch {
      rows = [];
      message = 'Deals are temporarily unavailable.';
    } finally {
      refreshing = false;
    }
    draw();
  }
  const stopLedger = app.on((topic) => { if (topic === 'ledger') draw(); });
  window.addEventListener('online', refresh);
  window.addEventListener('offline', draw);
  const timer = setInterval(refresh, 30000);
  refresh();
  return { draw, stop() {
    disposed = true;
    clearInterval(timer);
    stopLedger();
    window.removeEventListener('online', refresh);
    window.removeEventListener('offline', draw);
  } };
}

function dealListWriter(list) {
  let previous;
  return (html) => {
    if (html === previous) return;
    previous = html;
    const focusedHref = list.contains(document.activeElement) ? document.activeElement.getAttribute('href') : null;
    list.innerHTML = html;
    if (focusedHref) $$('a', list).find((link) => link.getAttribute('href') === focusedHref)?.focus({ preventScroll: true });
  };
}

function homeEventRail() {
  const slides = activeEventSlides();
  const head = `<div class="oz-section-head"><h2 id="home-events-title">Upcoming events</h2><a class="oz-link" href="#/events">All campus events <span aria-hidden="true">→</span></a></div>`;
  if (!slides.length) return `<section class="oz-home-events" aria-labelledby="home-events-title">${head}
    ${ozEmpty({ title: 'No upcoming events right now', body: 'New campus events appear here as soon as they are announced.', actionHtml: ozButton('Browse past events', { kind: 'ghost', size: 'sm', href: '#/events' }) })}</section>`;
  return `<section class="oz-home-events" aria-labelledby="home-events-title">${head}
    <div class="oz-rail">${slides.map((s, i) => `<button type="button" class="oz-poster-card" data-home-event="${i}" aria-label="View full poster: ${esc(s.title)}">
      <span class="oz-poster-img"><img src="${eventPosterImage(s)}" alt="" width="1600" height="710" loading="${i ? 'lazy' : 'eager'}" draggable="false"></span>
      <span class="oz-poster-info">${s.tag ? `<span class="oz-poster-tag">${esc(s.tag)}</span>` : ''}<span class="oz-poster-title">${esc(s.title)}</span>
        ${s.when ? `<span class="oz-poster-meta">${ozIcon('events')}<span>${esc(s.when)}</span></span>` : ''}${s.where ? `<span class="oz-poster-meta">${ozIcon('map-pin')}<span>${esc(s.where)}</span></span>` : ''}</span>
    </button>`).join('')}</div></section>`;
}
async function homeRender(app) {
  const p = app.profile; const lvl = levelOf(earnedTotal(app.ledger));
  const appStreak = D.dailyStreak(app.appDays);
  const hero = ozPointsHero({
    points: p.points, levelName: lvl.name, streakDays: appStreak.current, progress: lvl.next ? lvl.pct / 100 : 1, hat: AV.clean(myAvatar(app)).hat,
    nextLine: lvl.next ? `Next: ${lvl.next} · ${n(lvl.toNext)} pts` : 'Top level reached',
    levelAttr: { id: 'level-guide', 'aria-haspopup': 'dialog', 'aria-label': `${lvl.name} — ways to earn points` },
    streakHref: '#/rewards/streak', streakLabel: 'View your daily app streak',
  });
  return `<div class="oz-home">
  <h1 class="oz-page-title oz-desktop-only">Home</h1>
  <div class="oz-home-grid">
    <div class="oz-home-main">
      <div class="kk-hero oz-home-hero">${hero}</div>
      ${livePointEarningOn(app.rules) ? `<section class="oz-home-live" aria-labelledby="home-live-title">
        ${ozSectionHead('Live now', { id: 'home-live-title', href: '#/explore/deals', linkLabel: 'All live deals' })}
        <div id="home-live-list">${dealMessage('Finding café deals…')}</div>
      </section>` : ''}
      ${homeEventRail()}
    </div>
    <div class="oz-home-side">
      <div class="oz-section-head"><h2>Explore +Onz</h2></div>
      <nav class="kk-pillars" aria-label="+Onz directories">${PILLARS.map(([h, t, ic, d]) => {
        const enabled = (h !== 'explore' && h !== 'explore/deals') || (D.featureOn(app.rules, 'overview') && (h !== 'explore/deals' || D.featureOn(app.rules, 'dealsAndPay')));
        return enabled ? ozListRow({ title: t, sub: d, iconName: ic, href: '#/' + h, cls: 'kk-pillar' })
          : ozListRow({ title: t, sub: d, iconName: ic, chevron: false, cls: 'kk-pillar is-unavailable', trailHtml: ozTag('Coming soon', 'sky'), attr: { 'aria-disabled': 'true' } });
      }).join('')}</nav>
      <div class="oz-explore-more">
        ${ozListRow({ title: 'Campus Events', sub: 'Posters, calendar and past events.', iconName: 'events', href: '#/events' })}
        ${ozListRow({ title: 'How points work', sub: 'Levels, streaks and ways to earn.', iconName: 'coin', href: '#/points' })}
      </div>
    </div>
  </div></div>`;
}

function homeMount(root, app) {
  mountUsernameCopy(root, app);
  $('#level-guide', root).onclick = () => {
    const lvl = levelOf(earnedTotal(app.ledger)), r = app.rules;
    const claimed = new Set(app.ledger.map((entry) => entry.id));
    const remaining = D.LESSONS.filter((_, index) => !claimed.has('lesson' + index)).length;
    const choices = [
      {route:'rewards/streak',glyph:'flame',title:'Daily check-in streak',points:'+'+n(pointsRules(r).streakBonus),detail:'Open daily. Earn points every 7 days.'},
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
      ${livePointEarningOn(app.rules)?`<a class="points-guide-deals" href="#/explore/deals" data-close>${icon('qr-code')} Live deals <b>+${n(app.rules.liveDealPoints)} <span>pts per eligible deal</span></b>${icon('chevron-right')}</a>`:''}
      <p class="faint points-guide-note">Levels count positive earned points, excluding welfare grants. Spending or donating keeps your progress and unlocked hats.</p><a class="points-policy-link" href="#/points" data-close>${icon('info')} Full points guide ${icon('arrow-right')}</a>
    </div>`);
  };
  const slides = activeEventSlides();
  $$('[data-home-event]', root).forEach((b) => { b.onclick = () => openEventPoster(slides[Number(b.dataset.homeEvent)]); });
  const homeDeals = $('#home-live-list', root);
  if (!homeDeals) return null;
  const writeDeals = dealListWriter(homeDeals);
  const liveDeals = mountLiveDeals(app, (rows, message) => {
    const featured = rows.filter(({ status }) => status === 'Available' || status === 'Claimed today' || status === 'Busy right now' || status.startsWith('Opens '))
      .sort(availableFirst)[0];
    writeDeals(featured ? ozLiveDealCard(featured) : dealMessage(message));
  }, () => D.listVerifiedMerchants(app.ctx));
  return liveDeals.stop;
}

const emptyMerchants = () => `<div class="card empty">${icon('store')}<p>Verified shops will appear here.</p></div>`;
function merchantCard(m, { nav = false, dist = null } = {}) {
  const card = `<a class="mcard" href="#/merchant/${esc(m.id)}">${merchantLogo(m)}<div style="min-width:0"><h3>${esc(m.name)}</h3>
    <p>${esc(m.type)} · ${esc(m.location)}</p>${dist != null ? `<p class="dist">${icon('map-pin')}${fmtDistance(dist)}</p>` : ''}
    ${isIdea(m) ? `<div class="offer idea">${icon('lightbulb')}Student venture</div>` : ''}</div></a>`;
  if (!nav || !hasPin(m)) return card;
  return `<div class="mcard-wrap">${card}<a class="mnav" href="${directionsUrl(m)}" target="_blank" rel="noopener" aria-label="Navigate to ${esc(m.name)}" title="Navigate">${icon('navigation')}</a></div>`;
}

async function merchantRender(app, [id]) {
  const m = await D.getMerchant(app.ctx, id).catch(() => null);
  if (!m || m.status !== 'verified') return `<a class="back" href="#/explore">${icon('arrow-left')} Overview</a><div class="card empty">${icon('store')}<h3>This merchant isn’t on +Onz yet</h3><p>Only Admin-verified merchants are listed.</p></div>`;
  const deals = D.featureOn(app.rules, 'dealsAndPay') ? (await D.approvedDeals(app.ctx)).filter((d) => d.merchantId === id && d.enabled) : [];
  return `<a class="back" href="#/explore">${icon('arrow-left')} Overview</a>
    <div class="card pad-lg" style="margin-top:8px"><div class="row" style="gap:14px">${merchantLogo(m, 'logo big')}
      <div><h1 style="font-size:26px">${esc(m.name)}</h1><p class="muted">${esc(m.type)} · ${esc(m.location)}</p></div></div>
      <div class="row" style="margin-top:14px">${isIdea(m) ? `<span class="badge warn">${icon('lightbulb')}Student venture</span>` : ''}${m.ready ? `<span class="badge ok">${icon('badge-check')}Cashless ready</span>` : ''}<span class="badge">${icon('shield-check')}Admin verified</span></div>
    </div>
    ${hasPin(m) ? `<section class="section"><div class="head"><h2>Getting there</h2><a href="${wazeUrl(m)}" target="_blank" rel="noopener">Open in Waze</a></div>
      <div class="card map-card"><div id="shop-map" class="mmap small" aria-label="Map showing ${esc(m.name)}"></div>
        <div class="map-bar"><a class="btn primary block" href="${directionsUrl(m)}" target="_blank" rel="noopener">${icon('navigation')} Navigate there</a></div></div></section>` : ''}
    <section class="section"><div class="head"><h2>Visit this shop</h2></div><div class="card steps">
      <div class="step"><span class="n">1</span><div><h3>Walk over</h3><p>Use the map to find ${esc(m.name)}.</p></div></div>
      ${D.featureOn(app.rules, 'dealsAndPay') ? `<div class="step"><span class="n">2</span><div><h3>Pay cashless if you buy</h3><p>${esc(m.name)} accepts DuitNow QR. Check the name and amount in your banking app before you pay.</p></div></div>` : ''}
    </div></section>
    ${deals.length ? `<section class="section"><div class="head"><h2>Live deals</h2></div><div class="stack">${deals.map((d) => `<div class="card row between"><div><h3>${esc(d.title)}</h3><p class="faint">${D.hhmm(d.startMin)}–${D.hhmm(d.endMin)} MYT</p></div><a class="btn primary small" href="#/claim-deal/${esc(d.id)}">${icon('qr-code')} Scan to claim</a></div>`).join('')}</div></section>` : ''}
    <div style="position:sticky;bottom:calc(var(--nav-h) + 12px);margin-top:20px"><a class="btn primary block" href="#/explore/${esc(m.id)}">${icon('map')} View nearby shops</a></div>`;
}
// The merchant app reuses this page for "Preview as a student".
export const studentShopRender = (app, args) => merchantRender(app, args);
export const studentShopMount = (root, app, args) => merchantMount(root, app, args);
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
      <button type="button" class="btn ${mode === 'deals' ? 'primary' : 'go'}" id="nearby-locate">${icon('locate-fixed')} My location</button></div>
    </section>
    <section class="checkout-shops" aria-labelledby="checkout-shops-title"><div class="checkout-section-heading"><h2 id="checkout-shops-title">${icon('store')} Nearby shops</h2><span class="overview-result-count" id="directory-results-count" aria-label="Matching shops">${n(merchants.length)}</span></div>
      <div class="overview-search">${icon('search')}<input type="search" id="q" placeholder="Search by name or place" aria-label="Search merchants"></div>
      <div class="chips checkout-filters" id="directory-filters" aria-label="Merchant filters">${types.map((type) => { const [glyph, tone] = directoryCategory(type); return `<button type="button" data-type="${esc(type)}" data-tone="${tone}" ${type === 'Student ventures' ? 'data-ventures' : ''} class="${type === selected ? 'on' : ''}" aria-pressed="${type === selected}"><span class="overview-category-icon">${icon(type === 'All' ? 'compass' : glyph)}</span><span>${esc(type === 'Student ventures' ? 'Student Ventures' : type)}</span></button>`; }).join('')}</div>
      <div class="checkout-shops-layout"><div class="card map-card checkout-map"><div class="overview-map-title">${icon('map')}<strong>Campus map</strong><span>${icon('badge-check')}<span>Admin verified</span></span></div><div id="cmap" class="mmap small" aria-label="Campus shops and your location, when permitted"></div><div class="nearby-map-legend"><span class="nearby-location-key" id="nearby-location-key" hidden><span class="nearby-you-dot" aria-hidden="true"></span><span>Your location</span></span><span>${icon('store')} Campus shops</span></div></div>
        <div class="stack" id="clist"></div></div>
    </section>
    <section class="section checkout-deals" id="directory-deals" tabindex="-1" aria-labelledby="checkout-deals-title" ${D.featureOn(app.rules, 'dealsAndPay') ? '' : 'hidden'}>
      ${ozSectionHead('Live deals', { id: 'checkout-deals-title' })}
      <div id="checkout-deals" class="checkout-deal-grid">${dealMessage('Finding café deals…')}</div>
    </section>
    ${hereNowSection(app, { discovery: true })}${cafeListings()}
  </div>`;
}
function directoryMount(root, app, [mode] = []) {
  let pos = null, map = null, stop = null, disposed = false;
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
  const writeDeals = dealListWriter($('#checkout-deals', root));
  const liveDeals = D.featureOn(app.rules, 'dealsAndPay') ? mountLiveDeals(app, (deals, message) => {
    const visible = new Set(visibleMerchants().map((merchant) => merchant.id));
    const rows = deals.filter(({ merchant }) => visible.has(merchant.id))
      .sort((a, b) => availableFirst(a, b) || (pos ? distance(a.merchant) - distance(b.merchant) : 0));
    const primary = mode === 'deals' ? rows.find((row) => row.claimHref) : null;
    writeDeals(rows.map((row) => {
      const { merchant } = row;
      const footerHtml = `<a class="oz-link" href="#/merchant/${esc(merchant.id)}">View shop</a>${hasPin(merchant)
        ? `<a class="oz-link" href="${esc(directionsUrl(merchant))}" target="_blank" rel="noopener">Directions</a>` : ''}`;
      return ozLiveDealCard({ ...row, primary: row === primary, claimLabel: 'Scan to claim', footerHtml });
    }).join('') || dealMessage(message));
  }, () => merchants) : null;
  function draw() {
    if (disposed) return;
    const rows = sortedMerchants();
    $('#directory-results-count', root).textContent = n(rows.length);
    $('#clist', root).innerHTML = rows.map((m) => { const [glyph, tone] = directoryCategory(m.type); return `<article class="card checkout-shop ${m.id === focusId ? 'focus' : ''}" data-tone="${tone}">
      <span class="overview-shop-logo">${merchantLogo(m)}<span class="overview-verified" title="Admin verified">${icon('badge-check')}</span></span><div class="checkout-shop-copy"><h3><a href="#/merchant/${esc(m.id)}">${esc(m.name)}</a></h3>
        <span class="overview-shop-category">${icon(glyph)}<span>${esc(m.type)}</span></span><p>${icon('map-pin')}<span>${esc(m.location)}</span></p>
        ${pos && hasPin(m) ? `<span class="nearby-distance">${icon('navigation')} ${esc(fmtDistance(distanceM(pos, m)))}</span>` : ''}</div>
      <div class="checkout-shop-action">${hasPin(m) ? `<a class="btn small" href="${directionsUrl(m)}" target="_blank" rel="noopener">${icon('navigation')} Directions</a>` : `<a class="btn small" href="#/merchant/${esc(m.id)}">View shop ${icon('chevron-right')}</a>`}</div></article>`; }).join('')
      || `<div class="card empty">${icon('search')}<p>No merchants match. Try another word or filter.</p></div>`;
    liveDeals?.draw();
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
  draw();
  const section = mode === 'deals' ? $('#directory-deals', root) : mode === 'cafes' ? $('#directory-cafes', root) : null;
  if (section) { if (mode === 'cafes') section.open = true; section.scrollIntoView({ block: 'start' }); }
  return () => { disposed = true; ++watchToken; liveDeals?.stop(); if (stop) stop(); permission?.removeEventListener('change', permissionChanged); hn.stop(); if (map) map.remove(); };
}

function appStreakSection(app) {
  const now = Date.now(), today = D.dayKey(now);
  const { current, todayDone, days } = D.dailyStreak(app.appDays, now);
  const bonus=pointsRules(app.rules).streakBonus,credited=app.ledger.find(e=>e.type==='appStreak'&&e.day===today);
  const pending=todayDone&&current>0&&current%7===0&&!credited;
  const next=pending?current:(Math.floor(current/7)+1)*7,progress=pending?7:current%7;
  const recent = Array.from({ length: 7 }, (_, i) => {
    const time = now - (6 - i) * 86400000, day = D.dayKey(time), completed = days.has(day);
    const label = new Date(time).toLocaleDateString('en-MY', { weekday: 'short', timeZone: 'Asia/Kuala_Lumpur' });
    return `<li class="${completed ? 'checked' : ''} ${day === today ? 'today' : ''}" aria-label="${day}: ${completed ? 'App opened' : 'No app activity'}"><span>${label}</span><span class="streak-day" aria-hidden="true">${ozIcon('s:check')}</span></li>`;
  }).join('');
  const status = credited ? `+${n(credited.delta)} <span>pts earned</span>` : pending ? 'Bonus on the way' : todayDone ? 'Today counted' : 'Ready for today';
  // Figma 29 · Rewards · Streak (708:15284). #rewards-streak, .streak-calendar and .streak-guidance are test hooks.
  return `<section class="oz-streak rewards-streak app-streak" id="rewards-streak" tabindex="-1" aria-labelledby="app-streak-heading">
    <div class="oz-streak-hero"><img class="oz-streak-flame" src="assets/onz/streak/flame.svg" alt="" width="120" height="120">
      <h2 id="app-streak-heading"><strong>${current}</strong> ${current === 1 ? 'day running' : 'days running'}</h2>
      <span class="oz-streak-status badge">${status}</span></div>
    <div class="oz-streak-card"><h3 class="oz-streak-label">Past 7 days</h3><ul class="streak-calendar" aria-label="App activity over the past seven days">${recent}</ul></div>
    <div class="oz-streak-card"><div class="oz-streak-next"><p class="streak-guidance"><span class="oz-streak-label">Next bonus</span><span class="oz-streak-day"><span>Day</span> <strong>${next}</strong></span></p>
      <span class="streak-bonus">✦ +${n(bonus)} <span>pts</span></span></div>
      <div class="streak-bonus-progress" role="progressbar" aria-label="Days towards the next streak bonus" aria-valuemin="0" aria-valuemax="7" aria-valuenow="${progress}"><span style="width:${progress/7*100}%"></span></div>
      <p class="oz-streak-count">${progress} of 7 days</p></div>
  </section>`;
}

// ------------------------------------------------------------- rewards, vouchers and learning streaks
// Figma 10 · Rewards (696:13830) and W · Rewards (915:34184). Rewards come from Firestore and are redeemed with the Admin team.
async function rewardsRender(app) {
  const [section] = arguments[1] || []; // route parts, e.g. #/rewards/streak
  const p = app.profile;
  if (section === 'streak') {
    return `<div class="rewards-page oz-rewards oz-streak-page">
      <div class="oz-page-head"><a class="oz-back" href="#/rewards">${ozIcon('s:chevron-left')}<span>Rewards</span></a><h1 class="oz-page-head-title">Streak</h1></div>
      ${appStreakSection(app)}</div>`;
  }
  const rewards = await D.listRewards(app.ctx);
  const achievements = badges(app);
  const live = livePointEarningOn(app.rules) && D.featureOn(app.rules, 'overview') && D.featureOn(app.rules, 'dealsAndPay');
  return `<div class="rewards-page oz-rewards">
    <h1 class="oz-page-title">Rewards</h1>
    <div class="oz-rewards-top">
      <div class="rewards-hero oz-balance"><p class="oz-balance-value" data-bind="points">${n(p.points)}</p><p class="oz-balance-label">Available points</p></div>
      ${pointsSummaryHTML(app)}
      ${ozListRow({ title: 'Daily check-in streak', sub: `${D.dailyStreak(app.appDays).current} ${D.dailyStreak(app.appDays).current === 1 ? 'day running' : 'days running'} · +${n(pointsRules(app.rules).streakBonus)} pts every 7 days`, iconName: 'streak', href: '#/rewards/streak' })}
      ${live ? ozListRow({ title: 'Earn with live deals', sub: `+${n(app.rules.liveDealPoints)} pts per eligible deal`, iconName: 'stall', href: '#/explore/deals' }) : ''}
    </div>
    ${ozSegmented([{ key: 'shop', label: 'Shop' }, { key: 'vouchers', label: 'My vouchers' }, { key: 'badges', label: 'Badges' }], 'shop', { label: 'Rewards sections', cls: 'oz-rewards-tabs' })}
    <section class="oz-rewards-panel rewards-shelf" id="reward-shelf" data-panel="shop" tabindex="-1" aria-label="Swap points">
      <div class="reward-grid">${rewards.filter((r) => r.active).map((r) => {
        const left = (r.stock || 0) - (r.issued || 0); const can = p.points >= r.cost && left > 0;
        return `<article class="oz-voucher reward-prize ${left <= 0 ? 'sold-out' : ''}">
          <div class="oz-voucher-value"><strong>${rm(r.valueCents).replace(/\.00$/, '')}</strong><span>voucher value</span></div>
          <div class="oz-voucher-body"><h3>${esc(r.title)}</h3><p class="oz-voucher-where">Redeem with the Admin team · valid ${n(Number(r.validDays) || 30)} days</p>
            <div class="oz-voucher-foot"><span class="oz-voucher-meta"><span class="oz-voucher-cost">${n(r.cost)} pts</span>${left > 0 ? ozTag(`${left} left`, 'sky') : ozTag('All claimed', 'expiry')}</span>
            ${ozButton(left <= 0 ? 'All claimed' : can ? 'Swap' : `${n(Math.max(0, r.cost - p.points))} more`, { size: 'sm', kind: can ? 'primary' : 'ghost', attr: { 'data-redeem': r.id, disabled: !can } })}</div></div></article>`;
      }).join('') || ozEmpty({ title: 'No rewards yet', body: 'The Admin team hasn’t added rewards yet.' })}</div>
    </section>
    <section class="oz-rewards-panel rewards-wallet" data-panel="vouchers" hidden aria-label="My vouchers"><div id="vouchers" class="oz-voucher-list"><div class="skeleton" style="height:80px"></div></div></section>
    <section class="oz-rewards-panel rewards-badges" data-panel="badges" hidden aria-label="Badges">
      <p class="oz-badge-count"><span class="rewards-badge-count" aria-label="Badges earned">${achievements.filter(([got]) => got).length}/${achievements.length}</span> earned</p>
      <div class="awards" role="list">${achievements.map(([got, ic, label]) => `<div class="award oz-badge ${got ? 'got' : ''}" role="listitem"><span class="oz-badge-icon" aria-hidden="true">${icon(ic)}</span><span class="oz-badge-label">${esc(label)}</span>${ozTag(got ? 'Earned' : 'Locked', got ? 'success' : 'lilac')}</div>`).join('')}</div></section>
    <div class="oz-rewards-more">
      ${ozButton('Learn & Earn', { kind: 'ghost', href: '#/learn', block: true })}
      ${ozListRow({ title: 'Give to the welfare fund', sub: 'Points you donate support UM students in need.', iconName: 's:fund', href: '#/community', cls: 'reward-extra welfare-extra' })}
    </div></div>`;
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
  if (section === 'streak') { $('#rewards-streak', root)?.focus({ preventScroll: true }); return null; }
  const tabs = $$('.oz-rewards-tabs [data-seg]', root);
  const show = (key) => {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.seg === key)));
    $$('[data-panel]', root).forEach((panel) => { panel.hidden = panel.dataset.panel !== key; });
  };
  tabs.forEach((t) => { t.onclick = () => show(t.dataset.seg); });
  $$('[data-redeem]', root).forEach((b) => {
    b.onclick = async () => {
      const r = (await D.listRewards(app.ctx)).find((x) => x.id === b.dataset.redeem);
      if (!(await confirmSheet(`Swap ${n(r.cost)} points for ${r.title}?`, `You’ll have ${n(app.profile.points - r.cost)} points left. The voucher is valid for ${n(Number(r.validDays) || 30)} days.`, 'Swap points'))) return;
      try { const vid = await D.redeemReward(app.ctx, r); confetti(); toast('Voucher added. Show it to the Admin team for redemption.'); await app.render(); showVoucher(app, vid, [{ id: vid, title: r.title, merchantId: r.merchantId, status: 'issued' }]); }
      catch (e) { toast(errText(e), true); }
    };
  });
  const unsub = D.watchMyVouchers(app.ctx, (vs) => {
    const el = $('#vouchers', root); if (!el) return;
    vs.sort((a, b) => (toMs(b.createdAt) || 0) - (toMs(a.createdAt) || 0));
    el.innerHTML = vs.map((v) => {
      const dead = v.status === 'used' || D.voucherExpired(v);
      return `<button type="button" class="oz-voucher oz-voucher-ticket ticket ${dead ? 'used' : ''}" data-voucher="${esc(v.id)}">
        <span class="oz-voucher-value">${ozIcon('voucher')}</span><span class="oz-voucher-body"><span class="oz-voucher-title">${esc(v.title)}</span>
        <span class="oz-voucher-where">${v.status === 'used' ? `Used ${fmtDate(v.usedAt)}` : D.voucherExpired(v) ? 'Expired' : `Code ${esc(v.code)} · tap to show`}</span></span>${ozIcon('s:chevron-right', 'oz-row-chev')}</button>`;
    }).join('') || ozEmpty({ title: 'No vouchers yet', body: 'Vouchers you swap points for appear here.' });
    $$('[data-voucher]', el).forEach((b) => { b.onclick = () => showVoucher(app, b.dataset.voucher, vs); });
  }, () => {});
  return unsub;
}
function showVoucher(app, vid, list) {
  const v = list ? list.find((x) => x.id === vid) : null;
  const el = sheet(`<div class="qr-stage"><h2>${esc(v ? v.title : 'Your voucher')}</h2>
    <p class="muted">${v?.status==='used'?'This voucher has been used.':v&&D.voucherExpired(v)?'This voucher has expired.':'Show this voucher to the Admin team for redemption.'}</p>
    <div class="qr-frame ${v&&(v.status==='used'||D.voucherExpired(v))?'dead':''}"><div id="vqr"></div></div><p>Code <span class="code-text">${esc(vid.slice(0, 8).toUpperCase())}</span></p></div>`);
  renderQR($('#vqr', el), 'UMV1:' + vid, 240);
}

// ------------------------------------------------------------- quiet-hour bonuses

// ------------------------------------------------------------- Aktiviti Kita
async function eventsRender(app) {
  return eventGalleryRender(app);
}

// ------------------------------------------------------------- Bayar Kita: how to pay cashless (no tracking)
const cashlessSteps = () => `<div class="card steps">
      <div class="step"><span class="n">1</span><div><h3>Open your banking or e-wallet app</h3><p>Any app that supports DuitNow QR works.</p></div></div>
      <div class="step"><span class="n">2</span><div><h3>Scan the merchant’s DuitNow QR</h3><p>Check the recipient name matches the shop and the amount is right before you confirm.</p></div></div>
      <div class="step"><span class="n">3</span><div><h3>Keep your receipt</h3><p>Your bank app keeps the record. +Onz never asks for your banking details or OTP.</p></div></div>
    </div>`;

async function bayarRender(app) {
  const overviewOn = D.featureOn(app.rules, 'overview');
  const merchants = overviewOn ? await D.listVerifiedMerchants(app.ctx) : [];
  return `<div class="page-title"><h1>Pay Cashless</h1><p>Pay with DuitNow QR in your bank or e-wallet app.</p></div>
    ${cashlessSteps()}
    ${overviewOn ? `<section class="section"><div class="head"><h2>Participating merchants</h2><a href="#/explore">All ${merchants.length}</a></div>
      <div class="mgrid">${merchants.slice(0, 6).map((m) => merchantCard(m)).join('') || emptyMerchants()}</div></section>` : ''}
    <section class="section"><div class="card row"><span class="tile-icon orange">${icon('shield-alert')}</span><div style="flex:1"><h3>Learn &amp; Earn</h3><p class="faint">Scams & budgeting · +${app.rules.lessonBonus} points per lesson</p></div><a class="btn small" href="#/learn">Start</a></div></section>`;
}

// ------------------------------------------------------------- learn
async function learnRender(app) {
  const done = new Set(app.ledger.map((l) => l.id));
  return `${D.featureOn(app.rules, 'dealsAndPay') ? `<a class="back" href="#/bayar">${icon('arrow-left')} Pay Cashless</a>` : `<a class="back" href="#/home">${icon('arrow-left')} Home</a>`}<div class="page-title"><h1>Learn &amp; Earn</h1>
    <p>One-minute lessons on paying safely. Answer correctly to earn ${app.rules.lessonBonus} points each, once.</p></div>
    <div class="stack">${D.LESSONS.map((l, i) => `<div class="card row" style="gap:14px"><span class="tile-icon ${done.has('lesson' + i) ? 'mint' : ''}">${icon(done.has('lesson' + i) ? 'circle-check' : l.icon)}</span>
      <div style="flex:1"><h3>${esc(l.title)}</h3><p class="faint">${done.has('lesson' + i) ? 'Completed' : `1 question · +${app.rules.lessonBonus} points`}</p></div>
      <button class="btn small ${done.has('lesson' + i) ? '' : 'primary'}" data-lesson="${i}">${done.has('lesson' + i) ? 'Practise' : 'Start'}</button></div>`).join('')}</div>
    <p class="faint learning-practice-note">Practice is always available. Lesson points are earned once.</p>${pointsSummaryHTML(app)}
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
          if (r === 'correct') { closeSheet(); confetti(); pointsFx(); toast('Correct. Points added to your balance.'); app.render(); }
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
  const tip = role === 'student' ? (r.knowledge < 75 ? 'Try the Learn & Earn lessons next.' : 'Keep learning with Learn & Earn. Your survey bonus is awarded once.')
    : (r.digital < 70 ? 'Ask an ambassador to help set up your business QR and train staff.' : 'Review your shop readiness. Live deals are available only when enabled by the Admin team.');
  return { title: `${r.grade}: ${st}`, tip };
}
async function surveyRender(app) {
  const existing = await D.getSurvey(app.ctx).catch(() => null);
  return `<a class="back" href="#/home">${icon('arrow-left')} Home</a><div class="page-title"><h1>Money check</h1>
    <p>Four scenario questions and three about your confidence. It helps the Admin team plan support; it isn’t a test. First completion: ${app.rules.surveyBonus} points.</p></div>${surveyHTML('student', existing)}`;
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

// ------------------------------------------------------------- Leagues: KK League, Faculty League, top referrers
// Both leagues count points earned (stats/league, kept by the server); spending or donating never lowers them.
function leagueBoard({ id, title, iconName, mine, mineLabel, unit, hint, help = '' }) {
  return `<section class="card community-league league-board" id="${id}" tabindex="-1" aria-labelledby="${id}-title"><div class="community-section-heading"><h2 id="${id}-title">${icon(iconName)} ${title}${help}</h2><span>Total points earned</span></div>
    <div class="community-league-summary"><span class="community-college">${icon('graduation-cap')}<span>${esc(mine || mineLabel)}</span></span><div class="community-scoreboard"><div><span>Your rank</span><strong data-rank>—</strong></div><div><span>${unit}</span><strong data-points>—</strong></div></div></div>
    <p class="community-league-hint">${hint}</p><div data-board><div class="skeleton" style="height:220px"></div></div></section>`;
}
function fillBoard(root, totals, { mineKey, nameOf, crestOf, mineLabel, empty }) {
  const el = $('[data-board]', root); if (!el) return;
  const rows = Object.entries(totals || {}).filter(([, points]) => points > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true }));
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const myRank = rows.findIndex(([k]) => k === mineKey);
  $('[data-rank]', root).textContent = myRank >= 0 ? '#' + (myRank + 1) : '—';
  $('[data-points]', root).textContent = totals ? n(totals[mineKey] || 0) : '—';
  el.innerHTML = rows.length ? `<div class="community-podium">${rows.slice(0, 3).map(([k, v], i) => `<div class="community-contender place-${i + 1} ${k === mineKey ? 'is-mine' : ''}">
    <span class="contender-place">${i === 0 ? icon('trophy') : icon('medal')}<b>#${i + 1}</b></span><span class="contender-crest">${esc(crestOf(k))}</span>
    <span class="contender-name">${esc(nameOf(k))}</span><strong class="contender-score">${n(v)} <small>pts</small></strong>
    ${k === mineKey ? `<span class="contender-mine">${mineLabel}</span>` : ''}</div>`).join('')}</div>
    <div class="community-rank-list">${rows.slice(3, 10).map(([k, v], i) => `<div class="lb-row ${k === mineKey ? 'me' : ''}"><span class="rank">${i + 4}</span>
    <div><span class="name">${esc(nameOf(k))}</span><div class="bar"><i style="width:${Math.round((v / max) * 100)}%"></i></div></div><b class="num">${n(v)} <small>pts</small></b></div>`).join('')
    }</div>` : `<div class="community-league-empty">${icon('trophy')}<p>${totals ? empty : 'Scores are syncing.'}</p></div>`;
}
// Short crest for a faculty: its capital letters, e.g. "Faculty of Computer Science and Information Technology" -> FCSIT.
const facultyCrest = (f) => (f.match(/\b[A-Z]/g) || []).join('').slice(0, 5) || f.slice(0, 3);
async function leaguesRender(app) {
  const p = app.profile;
  return `<div class="leagues-page"><div class="page-title"><h1>${icon('trophy')} Leagues</h1><p class="muted">Every point you earn counts for your residential college and your faculty.</p></div>
    <nav class="community-shortcuts leagues-tabs" aria-label="Leagues">
      <a href="#/leagues/kk">${icon('trophy')} KK League</a><a href="#/leagues/faculty">${icon('graduation-cap')} Faculty League</a><a href="#/leagues/referrals">${icon('user-plus')} Top referrers</a></nav>
    <div class="leagues-grid">
    ${leagueBoard({ id: 'league-kk', title: 'KK League', iconName: 'trophy', mine: D.COLLEGES.find(([k]) => k === p.college)?.[1], mineLabel: 'No residential college', unit: 'KK points',
    hint: 'Positive earned points count for your KK, excluding welfare grants. Spending or donating never lowers the score. Deleted accounts no longer contribute.',
    help: ` <button type="button" class="league-help" id="league-help" aria-label="How the KK League works" title="How the KK League works">${icon('info')}</button>` })}
    ${leagueBoard({ id: 'league-faculty', title: 'Faculty League', iconName: 'graduation-cap', mine: p.faculty, mineLabel: 'No faculty set', unit: 'Faculty points',
    hint: 'Your earned points also count for your faculty, whichever college you live in.' })}
    </div>
    <section class="card referral-board" id="league-referrals" tabindex="-1" aria-labelledby="referrals-title"><div class="community-section-heading"><h2 id="referrals-title">${icon('user-plus')} Top referrers</h2><span>Students who joined with their code</span></div>
      <p class="community-league-hint">The 10 students whose referral codes were used most, open to everyone so referrals stay fair.</p>
      <ol class="referral-list" id="referral-list"><li class="skeleton" style="height:160px"></li></ol>
      <a class="btn small ghost" href="#/me">${icon('share-2')} Share your referral code</a></section></div>`;
}
function leaguesMount(root, app, [section] = []) {
  const target = { kk: '#league-kk', faculty: '#league-faculty', referrals: '#league-referrals' }[section];
  if (target) { const el = $(target, root); el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'start' }); }
  const p = app.profile;
  const facultyNames = new Set(D.FACULTIES);
  // The first time a student opens Leagues (not a link to the Faculty League or Top referrers), explain the KK League,
  // once the leaderboard is on screen. The (i) button by the heading shows it again.
  let tourTried = !!section && section !== 'kk';
  $('#league-help', root).onclick = () => Guide.startPageTour(app, 'leagues', { replay: true });
  const stop = D.watchStats(app.ctx, 'league', (s) => {
    if (!tourTried) { tourTried = true; setTimeout(() => { if (root.isConnected) Guide.startPageTour(app, 'leagues'); }, 350); }
    fillBoard($('#league-kk', root), s ? s.colleges || {} : null, { mineKey: p.college, crestOf: (k) => k,
      nameOf: (k) => D.COLLEGES.find(([c]) => c === k)?.[1] || k, mineLabel: 'Your college', empty: 'No points earned yet. Get your KK started.' });
    // Only real faculties are shown, so a made-up faculty name can never appear on the public board.
    const faculties = s ? Object.fromEntries(Object.entries(s.faculties || {}).filter(([k]) => facultyNames.has(k))) : null;
    fillBoard($('#league-faculty', root), faculties, { mineKey: p.faculty, crestOf: facultyCrest, nameOf: (k) => k,
      mineLabel: 'Your faculty', empty: 'No points earned yet. Get your faculty started.' });
  }, () => { $$('[data-board]', root).forEach((el) => { el.innerHTML = '<p class="faint">League is temporarily unavailable.</p>'; }); });
  const stopRefs = D.watchStats(app.ctx, 'referrals', (s) => {
    const el = $('#referral-list', root); if (!el) return;
    const top = s?.top || [];
    el.innerHTML = top.length ? top.map((r, i) => `<li class="lb-row ${r.uid === app.ctx.uid ? 'me' : ''}"><span class="rank">${i + 1}</span>
      <div><span class="name" data-no-i18n>${esc(r.label)}</span>${r.college ? ` <span class="faint">${esc(r.college)}</span>` : ''}${r.uid === app.ctx.uid ? ' <span class="badge">You</span>' : ''}</div>
      <b class="num">${n(r.count)} <small>${r.count === 1 ? 'friend' : 'friends'}</small></b></li>`).join('')
      : `<li class="community-league-empty">${icon('user-plus')}<p>No one has joined with a referral code yet.</p></li>`;
  }, () => { const el = $('#referral-list', root); if (el) el.innerHTML = '<li class="faint">The board is temporarily unavailable.</li>'; });
  return () => { stop(); stopRefs(); };
}

// ------------------------------------------------------------- Komuniti Kita: colleges, welfare, ventures
async function communityRender(app) {
  const friends = await friendsRender(app);
  const overviewOn = D.featureOn(app.rules, 'overview');
  const merchants = overviewOn ? await D.listVerifiedMerchants(app.ctx) : [];
  const ventures = merchants.filter(isIdea);
  return `<div class="community-page"><section class="community-circle" id="community-circle" aria-label="Your circle" tabindex="-1">${friends}</section>
    <a class="community-invite community-leagues-link" href="#/leagues"><span class="community-invite-icon">${icon('trophy')}</span><div><h3>Leagues</h3><p>See how your KK and your faculty rank, and the top referrers.</p></div><span class="community-invite-arrow">${icon('chevron-right')}</span></a>
    <div class="community-main-grid"><div class="community-welfare-pair" id="community-welfare" tabindex="-1"><section class="card community-welfare" aria-labelledby="welfare-title"><span class="community-heart" aria-hidden="true">${icon('hand-heart')}</span>
      <h2 id="welfare-title">Student welfare fund</h2><p>Points given here are pooled for UM students who need help with essentials.</p>
      <div class="community-welfare-total">${icon('sparkles')}<strong id="welfare">—</strong></div><span class="community-welfare-caption">points available</span>
      <button class="btn go" id="donate">${icon('hand-heart')} Give points ${icon('chevron-right')}</button></section>
    <section class="card community-support" aria-labelledby="support-title"><span class="community-support-icon" aria-hidden="true">${icon('wallet')}</span><h2 id="support-title">Need support?</h2><p>Ask the Admin team for up to 1,000 pooled points per request. Grants do not count for levels or leagues.</p>
      <button class="btn primary" type="button" id="request-welfare">${icon('plus')} Request points ${icon('chevron-right')}</button>
      <details class="welfare-history"><summary>My requests <span id="welfare-request-count">0</span>${icon('chevron-right')}</summary><div id="welfare-requests"><p class="faint">Loading requests…</p></div></details>
    </section></div></div>
    ${overviewOn ? `<section class="section community-ventures"><div class="community-section-heading"><h2>${icon('store')} Student Ventures</h2><a href="#/explore/idea">See all ${icon('chevron-right')}</a></div>
      <div class="mgrid">${ventures.slice(0, 4).map((m) => merchantCard(m)).join('') || `<div class="card empty">${icon('lightbulb')}<p>Running a stall or small business? Ask the Admin team about joining as a student entrepreneur.</p></div>`}</div></section>` : ''}
    <a class="community-invite" href="#/me"><span class="community-invite-icon">${icon('ticket')}</span><div><h3>Refer a friend</h3><p>Share your referral code with people who haven’t joined +Onz yet.</p></div><span class="community-invite-arrow">${icon('chevron-right')}</span></a></div>`;
}
function communityMount(root, app, [section] = []) {
  const stopFriends = friendsMount(root, app);
  if (section === 'league') { location.hash = '#/leagues'; return stopFriends; }
  const target = { friends: '#community-circle', add: '#friend-search', welfare: '#community-welfare' }[section];
  if (target) {
    const el = $(target, root);
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'start' });
  }
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
    const el = sheet(`<div class="welfare-form-heading"><span class="community-support-icon">${icon('wallet')}</span><div><h2>Request welfare points</h2><p class="faint">The Admin team reviews each request.</p></div></div>
      <form id="welfare-request-form" class="stack" style="margin-top:18px"><label class="field">Points requested<input name="amount" type="number" min="1" max="${D.WELFARE_MAX_POINTS}" step="1" inputmode="numeric" required></label>
      <label class="field">What do you need help with?<textarea name="reason" rows="3" minlength="10" maxlength="1000" placeholder="Meals, study materials or other essentials" required></textarea></label>
      <p class="faint">Only you and the Admin team can see your request.</p><button class="btn primary block" type="submit">Send request ${icon('arrow-right')}</button></form>`);
    $('#welfare-request-form', el).onsubmit = (event) => {
      event.preventDefault(); const form = event.target;
      busy($('button[type=submit]', form), async () => {
        try { await D.submitWelfareRequest(app.ctx, Number(form.amount.value), form.reason.value); closeSheet(); $('.welfare-history', root).open = true; toast('Request sent to the Admin team.'); }
        catch (error) { toast(errText(error), true); }
      });
    };
  };
  const u3 = D.watchMyWelfareRequests(app.ctx, (requests) => {
    const el = $('#welfare-requests', root); if (!el) return;
    $('#welfare-request-count', root).textContent = n(requests.length);
    el.innerHTML = requests.map((request) => `<details class="welfare-request-entry"><summary><strong>${n(request.amount)} <small>pts</small></strong><span class="welfare-status ${esc(request.status)}">${request.status === 'approved' ? 'Points received' : request.status === 'rejected' ? 'Declined' : 'Pending Admin team'}</span>${icon('chevron-right')}</summary>
      <div><p class="faint">${fmtDate(request.createdAt)}</p><p data-no-i18n>${esc(request.reason)}</p>${request.response ? `<p class="welfare-response"><b>Admin team:</b> <span data-no-i18n>${esc(request.response)}</span></p>` : ''}</div></details>`).join('') || '<p class="faint welfare-no-requests">No requests yet.</p>';
  }, () => { const el = $('#welfare-requests', root); if (el) el.innerHTML = '<p class="faint">Couldn’t load requests.</p>'; });
  return () => { stopFriends(); u2(); u3(); };
}

// ------------------------------------------------------------- avatar editor
// Wardrobe (Figma 15 · Wardrobe · Hats 696:13625 / Colours 696:13693; Web 929:35008).
// Hats and skins unlock with earned levels; nothing here is bought with points.
async function avatarRender(app) {
  return `<div class="oz-wardrobe">
    <h1 class="oz-sr-only">Customise Sir Onz</h1>
    <div class="av-stage" aria-label="Live preview">
      <img class="av-stage-clouds" src="assets/onz/stage/clouds.svg" alt=""><img class="av-stage-ground" src="assets/onz/stage/ground.svg" alt="">
      <img class="av-stage-accents" src="assets/onz/stage/accents.svg" alt=""><img class="av-stage-contact" src="assets/onz/stage/contact.svg" alt="">
      <div id="av-prev"></div>
      <a class="av-float av-close" href="#/me" aria-label="Back to Me">${ozIcon('s:close')}</a>
      <span class="av-level-pill"><span class="oz-plus" aria-hidden="true"></span><span id="av-level"></span></span>
      <button type="button" class="av-save-pill" id="av-save">Save</button>
      <div class="av-float-stack"><button type="button" class="av-float" id="av-rand" aria-label="Shuffle">${ozIcon('search')}</button>
        <button type="button" class="av-float" id="av-reset" aria-label="Undo changes">${ozIcon('s:history')}</button></div>
    </div>
    <div class="av-sheet" id="av-panel">
      <div class="av-categories" role="tablist" aria-label="Wardrobe">
        <button type="button" role="tab" aria-controls="av-hats" aria-pressed="true" aria-selected="true">${ozIcon('hat')}<span>Hats</span></button>
        <button type="button" role="tab" aria-controls="av-colours" aria-pressed="false" aria-selected="false"><span class="av-colour-dot" aria-hidden="true"></span><span>Colours</span></button>
      </div>
      <div class="av-category" id="av-hats" role="tabpanel"><div class="av-opts" data-group="hat"></div></div>
      <div class="av-category" id="av-colours" role="tabpanel" hidden><div class="av-opts" data-group="onz"></div></div>
      <p class="av-note">Hats and colours unlock as you level up. Spending points never takes them away.</p>
    </div></div>`;
}
function avatarMount(root, app) {
  const start = AV.clean(myAvatar(app)); let a = { ...start };
  const lvl = levelOf(earnedTotal(app.ledger)).name;
  $('#av-level', root).textContent = lvl;
  const tile = (k, [id, name, lock]) => {
    const locked = k === 'hat' ? !AV.hatUnlocked(id, lvl, LEVEL_NAMES) : !AV.skinUnlocked(id, lvl, LEVEL_NAMES);
    const preview = k === 'hat' ? (id === 'none' ? '<span class="av-none" aria-hidden="true">⊘</span>' : `<img src="assets/onz/hats/${id}.svg" alt="">`)
      : AV.avatarSVG({ ...a, onz: id, hat: 'none' }, { variant: 'head', size: 96, bg: false });
    return `<button type="button" class="av-tile" data-k="${k}" data-v="${id}" aria-pressed="${a[k] === id}" title="${esc(name)}${locked ? ` (reach ${esc(lock)})` : ''}" ${locked ? 'data-locked="1"' : ''}>
      <span class="av-thumb">${preview}</span><span class="av-name">${esc(name)}</span>${locked ? `<span class="av-lock-pill">${esc(lock === 'Campus champion' ? 'Champion' : lock)}</span>` : ''}
      <span class="av-check" aria-hidden="true">${ozIcon('check')}</span></button>`;
  };
  $('[data-group="hat"]', root).innerHTML = AV.HATS.map((h) => tile('hat', h)).join('');
  const categories = $$('.av-categories button', root);
  categories.forEach((button) => {
    button.onclick = () => categories.forEach((item) => {
      const selected = item === button;
      item.setAttribute('aria-pressed', String(selected)); item.setAttribute('aria-selected', String(selected));
      $('#' + item.getAttribute('aria-controls'), root).hidden = !selected;
    });
  });
  const paint = () => {
    $('#av-prev', root).innerHTML = AV.avatarSVG(a, { size: 200, bg: false, title: 'Your Sir Onz' });
    $('[data-group="onz"]', root).innerHTML = AV.ONZ_SKINS.map((s) => tile('onz', s)).join('');
    $$('.av-opts [data-k]', root).forEach((b) => b.setAttribute('aria-pressed', String(a[b.dataset.k] === b.dataset.v)));
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]'); if (!b || !root.contains(b)) return;
    if (b.dataset.locked) {
      const list = b.dataset.k === 'hat' ? AV.HATS : AV.ONZ_SKINS; const item = list.find((x) => x[0] === b.dataset.v);
      return toast(`Reach ${item[2]} level to unlock ${item[1]}.`);
    }
    a[b.dataset.k] = b.dataset.v; paint();
  });
  $('#av-rand', root).onclick = () => {
    const pick = (list, ok) => { const open = list.filter((x) => ok(x[0], lvl, LEVEL_NAMES)); return open[Math.floor(Math.random() * open.length)][0]; };
    a = { ...a, onz: pick(AV.ONZ_SKINS, AV.skinUnlocked), hat: pick(AV.HATS, AV.hatUnlocked) }; paint();
  };
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
  // Figma 13 · Me (441:2458): profile card, customise, referral card, then the production sections.
  return `<div class="oz-me"><h1 class="oz-page-title">Me</h1>
    <section class="card pad-lg me-card"><a href="#/avatar" class="me-avatar" aria-label="Customise your avatar">${AV.avatarSVG(myAvatar(app), { variant: 'head', size: 72, title: p.name })}</a>
      <div><h2>${esc(p.name)}</h2><p class="muted">${esc([D.COLLEGES.find(([k]) => k === p.college)?.[1], `${n(p.points)} pts`].filter(Boolean).join(' · '))}</p>
      <p class="row" style="gap:6px;margin-top:6px"><span class="badge ok">${icon('medal')}${esc(lvl.name)}</span></p>
      <a class="btn small primary" href="#/avatar" style="margin-top:10px">${icon('palette')} Customise avatar</a></div></section>
    ${ozButton('Customise avatar', { kind: 'ghost', href: '#/avatar', block: true, cls: 'oz-me-customise' })}
    ${signInEmailsCard(app)}
    <section class="section card invite-card" id="referral-card">
      <div class="row invite-heading"><span class="tile-icon">${icon('ticket')}</span><h2>Refer a friend</h2></div>
      <div class="invite-code">
        <div><span class="faint">Your referral code</span><strong class="code-text" data-no-i18n>${esc(p.referralCode)}</strong></div>
        <button class="btn small" type="button" id="copy-referral" aria-label="Copy referral code">Copy</button>
        <button class="btn primary" id="share">${icon('share-2')} Share</button>
      </div>
      <p class="faint">For people who haven’t joined +Onz yet. They enter your code once, when they sign up, and it counts towards your total below. It can’t be used after sign-up.</p>
      <div class="invite-count"><strong>${n(refs.length)}</strong><span>${refs.length === 1 ? 'person has' : 'people have'} joined with your code</span><a class="btn small ghost" href="#/leagues/referrals">${icon('trophy')} Top referrers</a></div>
      ${refs.length ? `<details class="invite-activity"><summary>Who joined with your code <span class="badge">${n(refs.length)}</span></summary><div class="list">${refs.map((r) => `<div class="item"><span class="tile-icon">${icon('user-plus')}</span><div class="grow"><h3>${esc(r.friendName)}</h3><p>Friend request sent</p></div></div>`).join('')}</div></details>` : ''}
      ${p.inviterCode ? `<p class="faint" style="margin-top:12px">You joined with code ${esc(p.inviterCode)}.</p>` : ''}
    </section>
    <section class="section card invite-card" id="add-friends-card">
      <div class="row invite-heading"><span class="tile-icon">${icon('user-plus')}</span><h2>Add friends</h2></div>
      ${p.username ? `<div class="invite-code">
        <div><span class="faint">Your username</span><strong class="code-text" data-no-i18n>@${esc(p.username)}</strong></div>
        <button class="btn small" type="button" id="copy-username" aria-label="Copy username">Copy</button>
        <a class="btn primary" href="#/community/add">${icon('user-plus')} Add</a>
      </div>
      <p class="faint">For friends already on +Onz. Search for their username, or give them yours. You can add friends any time.</p>`
    : `<p class="faint">For friends already on +Onz. Choose a username first, then add friends by theirs any time.</p>
      <a class="btn primary" href="#/community/add">${icon('user')} Choose a username</a>`}
    </section>
    <section class="section"><div class="head"><h2>Profile</h2></div><form id="prof" class="card stack">
      <label class="field">Name<input name="name" required minlength="2" maxlength="100" value="${esc(p.name)}"></label>
      <label class="field">Matric number<input value="${esc(p.matric || '')}" readonly aria-readonly="true"></label>
      <label class="field">Residential college<input value="${esc(D.collegeName(p.college))}" readonly aria-readonly="true" aria-describedby="college-locked">
        <small id="college-locked">${icon('lock')} Your college is set when you sign up, so KK League points stay fair.</small></label>
      ${p.faculty
    ? `<label class="field">Faculty<input value="${esc(p.faculty)}" readonly aria-readonly="true" aria-describedby="faculty-locked">
        <small id="faculty-locked">${icon('lock')} Your faculty is set when you sign up, so Faculty League points stay fair. Picked the wrong one? Ask the Admin team.</small></label>`
    : `<label class="field">Faculty<select name="faculty" aria-describedby="faculty-once"><option value="" selected>Choose your faculty</option>${D.FACULTIES.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select>
        <small id="faculty-once">${icon('lock')} You can only choose your faculty once, so check it’s the right one.</small></label>`}
      <button class="btn primary">Save profile</button></form></section>
    <section class="section"><div class="head"><h2>Points history</h2></div>
      <div class="card points-history">
        ${history.slice(0, 3).map(pointsHistoryRow).join('') || `<div class="empty">${icon('sparkles')}<p>Points you earn and spend appear here.</p></div>`}
        ${history.length > 3 ? `<details class="points-history-more"><summary>Older activity</summary>
          ${history.slice(3).map(pointsHistoryRow).join('')}</details>` : ''}
      </div>
    </section>
    <section class="section"><div class="card row" style="flex-direction:row;flex-wrap:nowrap;align-items:center;gap:12px"><span class="tile-icon">${icon('bell')}</span><div class="grow" style="flex:1;min-width:0"><h3>Sound and vibration</h3><p class="faint">Play a chime and buzz when you earn points.</p></div>
      <label class="switch"><input type="checkbox" id="fx" ${fxOn() ? 'checked' : ''} aria-label="Sound and vibration when you earn points"><span></span></label></div></section>
    ${pointsSummaryHTML(app)}
    ${informationLinks()}
    <section class="section stack"><button class="btn block" id="install">${icon('smartphone')} Install the app</button>
      <button class="btn block" id="terms">${icon('shield-check')} Terms of Use and Privacy Notice</button>
      <button class="btn block warn" id="out">${icon('log-out')} Sign out</button>
      <a class="btn block ghost danger-link" href="#/delete-account">${icon('trash-2')} Delete my account</a></section></div>`;
}
function pointsHistoryRow(entry) {
  const glyph = { checkin: 'map-pin-check', purchase: 'wallet', survey: 'target', lesson: 'book-open',
    appStreak: 'flame', friend: 'user-plus', inviter: 'user-plus', offpeak: 'clock', redeem: 'ticket', donate: 'hand-heart', welfare: 'hand-heart' }[entry.type] || 'sparkles';
  const earned = entry.delta > 0;
  return `<div class="points-history-row">
    <span class="points-history-icon" aria-hidden="true">${icon(glyph)}</span>
    <div class="points-history-copy"><b>${esc(ledgerLabel(entry))}</b><small>${fmtDateTime(entry.createdAt)}</small></div>
    <span class="points-history-amount ${earned ? 'earned' : ''}">${earned ? '+' : ''}${n(entry.delta)}</span>
  </div>`;
}
function ledgerLabel(l) {
  if (l.type === 'checkin') return 'Archived attendance credit';
  if (l.type === 'appStreak') return 'App streak bonus';
  if (l.type === 'liveDeal') return 'Live-deal scan reward';
  return { purchase: 'Cashless purchase', survey: 'Money check completed', lesson: 'Lesson completed', friend: 'Referral welcome bonus', inviter: 'Someone joined with your code',
    offpeak: 'Quiet-hour bonus', redeem: 'Swapped for a voucher', donate: 'Given to the welfare fund', welfare: 'Welfare support received', adjust: l.note || 'Adjustment by the Admin team' }[l.type] || l.type;
}
function meMount(root, app) {
  mountSignInEmails(root, app);
  $('#copy-referral', root).onclick = async () => {
    try {
      await navigator.clipboard.writeText(app.profile.referralCode);
      toast('Referral code copied.');
    } catch {
      toast('Couldn’t copy. Select the referral code to copy it manually.', true);
    }
  };
  const copyUsername = $('#copy-username', root);
  if (copyUsername) copyUsername.onclick = async () => {
    try { await navigator.clipboard.writeText('@' + app.profile.username); toast('Username copied.'); }
    catch { toast('Couldn’t copy. Select your username to copy it manually.', true); }
  };
  $('#share', root).onclick = async () => {
    const text = tr(`Join +Onz, UM’s campus app for merchants, events and rewards. Enter my referral code ${app.profile.referralCode} when you sign up: ${location.origin}${location.pathname}`);
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Referral message copied. Paste it to a friend.'); } } catch { /* cancelled */ }
  };
  $('#prof', root).onsubmit = (e) => {
    e.preventDefault(); const f = e.target;
    busy($('button', f), async () => { try { const fields = { name: f.name.value.trim() };
      if (f.faculty?.value) fields.faculty = f.faculty.value;
      await D.updateProfile(app.ctx, fields); toast('Profile saved.'); if (fields.faculty) app.render(); } catch (err) { toast(errText(err), true); } });
  };
  $('#install', root).onclick = () => app.installApp();

  $('#fx', root).onchange = (e) => { setFx(e.target.checked); if (e.target.checked) pointsFx(); };
  $('#terms', root).onclick = () => import('../terms.js').then((m) => m.termsSheet());
  $('#out', root).onclick = () => app.backend.sdk.signOut(app.backend.auth);
}

// ------------------------------------------------------------- routes
const live = (fn) => (root, app, params) => {
  const c1 = fn ? fn(root, app, params) : null;
  let t; const off = app.on((topic) => { if (topic === 'app-activity' || topic === 'ledger') { clearTimeout(t); t = setTimeout(() => { if (!document.querySelector('#sheet[open]') && (!root.contains(document.activeElement) || document.activeElement?.id === 'rewards-streak')) app.render(); }, 400); } });
  return () => { off(); clearTimeout(t); c1 && c1(); };
};
export const routes = {
  ...INFORMATION_ROUTES,
  'claim-deal': { title: 'Claim a live deal', render: studentDealClaimRender, mount: studentDealClaimMount, tab: 'home', feature: ['overview', 'merchantTools', 'dealsAndPay'] },
  home: { title: 'Home', render: homeRender, mount: live(homeMount) },
  explore: { title: 'Overview', render: directoryRender, mount: directoryMount, tab: 'home', feature: 'overview' },
  merchant: { title: 'Merchant', render: merchantRender, mount: merchantMount, tab: 'home', feature: 'overview' },
  rewards: { title: 'Rewards', render: rewardsRender, mount: live(rewardsMount) },
  feskum: { title: 'FESKUM 2026', render: feskumRender, mount: feskumMount, tab: 'home', wide: true },
  events: { title: 'Campus Events', render: eventsRender, mount: eventGalleryMount, tab: 'home', wide:true },
  bayar: { title: 'Pay Cashless', render: bayarRender, tab: 'home', feature: 'dealsAndPay' },
  learn: { title: 'Learn & Earn', render: learnRender, mount: learnMount, tab: 'home' },
  survey: { title: 'Money check', render: surveyRender, mount: (r, a) => surveyMount(r, a, 'student', 'home'), tab: 'home' },
  community: { title: 'Community', render: communityRender, mount: communityMount },
  leagues: { title: 'Leagues', render: leaguesRender, mount: leaguesMount },
  avatar: { title: 'Your avatar', render: avatarRender, mount: avatarMount, tab: 'me' },
  me: { title: 'Me', render: meRender, mount: meMount },
  feedback: { title: 'Questions and feedback', render: feedbackRender, mount: feedbackMount, tab: 'me' },
  'delete-account': { title: 'Delete my account', render: closeRender, mount: closeMount, tab: 'me' },
};

// ------------------------------------------------------------- Me: emails that sign in to this account
function signInEmailsCard(app) {
  const { own, added } = signInEmails(app);
  const row = (e, removable) => `<div class="item row" style="justify-content:space-between;gap:8px"><span data-no-i18n style="overflow-wrap:anywhere">${esc(e)}</span>${removable
    ? `<button class="btn small ghost" data-remove-email="${esc(e)}" aria-label="Remove ${esc(e)}">Remove</button>` : '<span class="faint">Main email</span>'}</div>`;
  return `<section class="section card pad-lg" id="signin-emails"><div class="row" style="gap:10px"><span class="tile-icon">${icon('mail')}</span><h2>Sign-in emails</h2></div>
    <p class="faint">Any of these opens this same account, with the same points and matric number.</p>
    <div class="list" style="margin-top:8px">${[own && row(own, false), ...added.map((e) => row(e, true))].filter(Boolean).join('')}</div>
    ${added.length < 4 ? `<button class="btn small" id="add-email" style="margin-top:10px">${icon('plus')} Add another Google account</button>
    <p class="faint" style="margin-top:6px">For example, add your siswa email if you signed up with a personal Gmail.</p>` : ''}</section>`;
}
function mountSignInEmails(root, app) {
  const mode = app.backend?.mode;
  // The server saves the change; show it straight away instead of waiting for the profile to refresh.
  const show = (list) => { if (app.profile) app.profile.linkedEmails = list; app.render(); };
  $$('[data-remove-email]', root).forEach((b) => { b.onclick = async () => {
    const email = b.dataset.removeEmail;
    if (!(await confirmSheet('Remove this email?', `<span data-no-i18n>${esc(email)}</span> will no longer open this account.`, 'Remove', true))) return;
    await busy(b, async () => {
      try { await removeSignInEmail(app, email); toast('Email removed.'); show((app.profile?.linkedEmails || []).filter((e) => e !== email)); }
      catch (err) { toast(linkErrorText(err), true); }
    });
  }; });
  const btn = $('#add-email', root); if (!btn) return;
  btn.onclick = () => {
    // The installed iPhone app can't open Google's window; adding an email works in Safari or Chrome.
    if (mode === 'live' && window.matchMedia?.('(display-mode: standalone)').matches)
      return toast('Open addonz.my in Safari or Chrome to add an email, then come back to the app.', true);
    const run = (demoEmail) => busy(btn, async () => {
      try {
        const email = await addSignInEmail(app, demoEmail);
        if (email) { toast('Email added. You can sign in with either one.'); show([...new Set([...(app.profile?.linkedEmails || []), email])]); }
      } catch (err) { toast(linkErrorText(err), true); }
    });
    if (mode !== 'demo') return run('');
    const el = sheet(`<h2>Add another Google account</h2><form id="le" class="stack" style="margin-top:12px"><label class="field">Google email<input name="email" type="email" required placeholder="you@siswa.um.edu.my"></label><button class="btn primary block">Add</button></form>`);
    $('#le', el).onsubmit = (e) => { e.preventDefault(); const v = e.target.email.value; closeSheet(); run(v); };
  };
}
