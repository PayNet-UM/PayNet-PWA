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
import { tr, getLang } from '../i18n.js';
import { accountMenuHTML, mountAccountMenu, menuRow, menuGroup, languageRows } from '../account-menu.js';
import { siteUrls } from '../firebase-config.js';
import { friendsRender, friendsMount, usernameTag, mountUsernameCopy } from '../friends.js';
import { feskumCard, feskumRender, feskumMount } from '../feskum.js';
import { eventCarousel, mountEventCarousel, openEventPoster, eventPosterImage } from '../event-carousel.js';
import { activeEventSlides, galleryEvents, eventToday, eventExpired, eventCover } from '../event-catalog.js';
import { categoryLabel } from '../event-categories.js';
import { ozPointsHero, ozListRow, ozSectionHead, ozEmpty, ozButton, ozTag, ozSegmented, ozLiveDealCard, ozFlame } from '../oz-ui.js';
import { ozIcon } from '../oz-icons.js';
import * as motion from '../oz-motion.js';
import { eventGalleryRender, eventGalleryMount, datePosterHTML } from '../event-gallery.js';
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
  ['explore', 'Find campus shops', 'map-pin', 'Browse stalls and get directions.'],
  ['learn', 'Learn & Earn', 'learn', 'One-minute lessons on paying safely.'],
  ['community', 'Student ventures', 'stall', 'Discover student-run businesses.'],
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

// Home events rail (Figma 03 · Home "Upcoming events carousel" 713:15543, Event Poster Card 755:6150): the same
// upcoming events as Campus Events (admin events and posters), swipeable with page dots on phones, two-up on the web.
async function homeEvents(app) {
  const campaigns = await D.listCampaigns(app.ctx).catch(() => []);
  return galleryEvents(campaigns, eventToday()).filter((e) => !e.archive && !eventExpired(e)).slice(0, 6);
}
function homeEventRail(events) {
  const head = `<div class="oz-section-head"><h2 id="home-events-title">Upcoming events</h2><a class="oz-link" href="#/events">All campus events <span aria-hidden="true">→</span></a></div>`;
  if (!events.length) return `<section class="oz-home-events" aria-labelledby="home-events-title">${head}
    <div class="oz-home-noevents">${ozIcon('events')}<p>No upcoming events right now.</p>${ozButton('Browse past events', { kind: 'ghost', size: 'sm', href: '#/events' })}</div></section>`;
  return `<section class="oz-home-events" aria-labelledby="home-events-title">${head}
    <div class="oz-rail" id="home-rail">${events.map((c, i) => {
      const cover = eventCover(c);
      const body = `<span class="oz-poster-img">${cover ? `<img src="${esc(cover)}" alt="" loading="${i ? 'lazy' : 'eager'}" draggable="false">` : datePosterHTML(c)}</span>
        <span class="oz-poster-info"><span class="oz-poster-tag">${esc(c.poster?.tag || categoryLabel(c.category))}</span><span class="oz-poster-title" data-no-i18n>${esc(c.name)}</span>
          <span class="oz-poster-meta">${ozIcon('events')}<span data-no-i18n>${esc(c.when)}</span></span>
          <span class="oz-poster-meta">${ozIcon('map-pin')}<span ${c.location ? 'data-no-i18n' : ''}>${esc(c.location || 'Venue to be announced')}</span></span></span>`;
      return c.poster ? `<button type="button" class="oz-poster-card" data-home-event="${i}" aria-label="View full poster: ${esc(c.name)}">${body}</button>`
        : `<a class="oz-poster-card" href="#/events" aria-label="${esc(c.name)}">${body}</a>`;
    }).join('')}</div>
    ${events.length > 1 ? `<div class="oz-dots" role="tablist" aria-label="Events">${events.map((c, i) => `<button type="button" role="tab" data-dot="${i}" aria-selected="${!i}" aria-label="Show ${esc(c.name)}"><i></i></button>`).join('')}</div>` : ''}
  </section>`;
}
async function homeRender(app) {
  const p = app.profile; const lvl = levelOf(earnedTotal(app.ledger)); const av = AV.clean(myAvatar(app));
  const appStreak = D.dailyStreak(app.appDays);
  const hero = ozPointsHero({
    points: p.points, levelName: lvl.name, streakDays: appStreak.current, progress: lvl.next ? lvl.pct / 100 : 1, hat: av.hat,
    skin: (([id, , , colours]) => [id, colours])(AV.ONZ_SKINS.find((s) => s[0] === av.onz) || AV.ONZ_SKINS[0]),
    wear: AV.heroWear(av), // glasses, scarf and faculty look show on the hero too
    mascotHref: '#/avatar', mascotLabel: 'Customise Onzo', // Figma prototype: tapping Onzo opens the wardrobe
    nextLine: lvl.next ? `Next: ${lvl.next} · ${n(lvl.toNext)} pts` : 'Top level reached',
    levelAttr: { id: 'level-guide', 'aria-haspopup': 'dialog', 'aria-label': `${lvl.name} — ways to earn points` },
    streakHref: '#/rewards/streak', streakLabel: 'View your daily app streak',
  });
  const events = await homeEvents(app); app._homeEvents = events;
  const overview = D.featureOn(app.rules, 'overview');
  // Directory rows; a switched-off directory stays visible as "Coming soon" instead of linking.
  const row = ([h, t, ic, d], cls = '') => (h !== 'explore' || overview
    ? ozListRow({ title: t, sub: d, iconName: ic, href: '#/' + h, cls: `kk-pillar ${cls}` })
    : ozListRow({ title: t, sub: d, iconName: ic, chevron: false, cls: `kk-pillar is-unavailable ${cls}`, trailHtml: ozTag('Coming soon', 'sky'), attr: { 'aria-disabled': 'true' } }));
  // One markup for both layouts (Figma 441:304 phone, 915:33759 web): on phones the columns dissolve and their parts
  // stack hero, Live now, Find campus shops, events, Explore; on the web Explore is the 376 px side column.
  return `<div class="oz-home">
  <h1 class="oz-page-title oz-desktop-only">Home</h1>
  <div class="oz-home-grid">
    <div class="oz-home-main">
      <div class="kk-hero oz-home-hero">${hero}</div>
      ${livePointEarningOn(app.rules) ? `<section class="oz-home-live" aria-labelledby="home-live-title">
        ${ozSectionHead('Live now', { id: 'home-live-title', href: '#/explore/deals', linkLabel: 'All live deals' })}
        <div id="home-live-list">${dealMessage('Finding café deals…')}</div>
      </section>` : ''}
      ${homeEventRail(events)}
    </div>
    <div class="oz-home-side">
      <div class="oz-home-shops">${row(PILLARS[0])}</div>
      <section class="oz-home-explore" aria-labelledby="home-explore-title">
        <div class="oz-section-head"><h2 id="home-explore-title">Explore addOnz</h2><a class="oz-link" href="#/activities">All activities <span aria-hidden="true">→</span></a></div>
        <nav class="kk-pillars" aria-label="+Onz directories">${PILLARS.slice(1).map((pl) => row(pl)).join('')}
          ${ozListRow({ title: 'Campus Events', iconName: 'events', href: '#/events', chevron: false, cls: 'oz-desktop-row' })}
          ${ozListRow({ title: 'How points work', iconName: 'coin', href: '#/points', chevron: false, cls: 'oz-desktop-row' })}</nav>
      </section>
    </div>
  </div></div>`;
}
// All activities (Figma 770:16604): every place in +Onz, grouped. Switched-off features are left out.
async function activitiesRender(app) {
  const on = (f) => D.featureOn(app.rules, f);
  const tile = ([href, label, ic]) => `<a class="oz-activity" href="#/${href}">${ozIcon(ic)}<span>${label}</span></a>`;
  const groups = [
    ['Around campus', [on('overview') && ['explore', 'Campus shops', 'map-pin'], on('overview') && on('dealsAndPay') && ['explore/deals', 'Live deals', 'voucher'],
      ['events', 'Campus events', 'events'], ['community', 'Student ventures', 'stall'], ['feskum', 'FESKUM booths', 'stall']]],
    ['Points & rewards', [['learn', 'Learn & Earn', 'learn'], ['survey', 'Money check', 'check'], ['rewards', 'Rewards', 'rewards'], ['rewards/streak', 'Daily streak', 'streak'], ['avatar', 'Wardrobe', 'hat']]],
    ['Community', [['community', 'Friends', 'community'], ['community/fund', 'Welfare fund', 'heart'], ['leagues', 'Leagues', 'leagues']]],
  ];
  return `<div class="oz-activities"><header class="oz-activities-head"><h1>All activities</h1><a class="av-float oz-activities-close" href="#/home" aria-label="Close">${ozIcon('s:close')}</a></header>
    ${groups.map(([title, items]) => `<section aria-label="${title}"><h2>${title}</h2><div class="oz-activity-grid">${items.filter(Boolean).map(tile).join('')}</div></section>`).join('')}</div>`;
}

function homeMount(root, app) {
  showStreakMotion(root, app);
  mountUsernameCopy(root, app);
  $('#level-guide', root).onclick = () => {
    const lvl = levelOf(earnedTotal(app.ledger)), r = app.rules;
    const claimed = new Set(app.ledger.map((entry) => entry.id));
    const remaining = D.LESSONS.filter((_, index) => !claimed.has('lesson' + index)).length;
    // Ways to reach the next level, as design-system rows: icon, title + one short line, then a one-line points tag.
    const choices = [
      { route: 'rewards/streak', glyph: 'streak', title: 'Daily check-in streak', points: pointsRules(r).streakBonus, detail: 'Every 7 days in a row' },
      ...(!claimed.has('survey') ? [{ route: 'survey', glyph: 'target', title: 'Money check', points: r.surveyBonus, detail: 'One-time bonus' }] : []),
      ...(remaining ? [{ route: 'learn', glyph: 'learn', title: 'Learn & Earn', points: r.lessonBonus, detail: `${remaining} lessons left` }] : []),
      ...(livePointEarningOn(r) ? [{ route: 'explore/deals', glyph: 'voucher', title: 'Live deals', points: r.liveDealPoints, detail: 'Per eligible deal' }] : []),
    ];
    sheet(`<div class="oz-lvl">
      <div class="oz-lvl-head"><span class="oz-lvl-badge" aria-hidden="true">${ozIcon('medal')}</span><div><p class="oz-lvl-now">${esc(lvl.name)}</p><h2>${lvl.next ? 'Reach ' + esc(lvl.next) : 'Keep earning'}</h2></div></div>
      <p class="oz-lvl-goal">${lvl.next ? `<strong>${n(lvl.toNext)}</strong><span>points to your next level</span>` : '<span>You’ve reached the top level.</span>'}</p>
      <div class="oz-lvl-list">${choices.map((c) => ozListRow({ title: c.title, sub: c.detail, iconName: c.glyph, href: '#/' + c.route,
        trailHtml: ozTag(`+${n(c.points)} pts`, 'points'), attr: { 'data-close': true } })).join('')}</div>
      <a class="oz-link oz-lvl-guide" href="#/points" data-close>Full points guide <span aria-hidden="true">→</span></a>
    </div>`);
  };
  const events = app._homeEvents || [];
  $$('[data-home-event]', root).forEach((b) => { b.onclick = () => openEventPoster(events[Number(b.dataset.homeEvent)].poster, { trigger: b.querySelector('img') }); });
  const stopDots = mountRailDots(root);
  const homeDeals = $('#home-live-list', root);
  if (!homeDeals) return stopDots;
  const writeDeals = dealListWriter(homeDeals);
  const liveDeals = mountLiveDeals(app, (rows, message) => {
    const featured = rows.filter(({ status }) => status === 'Available' || status === 'Claimed today' || status === 'Busy right now' || status.startsWith('Opens '))
      .sort(availableFirst)[0];
    writeDeals(featured ? ozLiveDealCard(featured) : dealMessage(message));
  }, () => D.listVerifiedMerchants(app.ctx));
  return () => { stopDots(); liveDeals.stop(); };
}
// Page dots for a swipe rail: the dot follows the card in view; tapping a dot scrolls to its card.
function mountRailDots(root) {
  const rail = $('#home-rail', root), dots = $$('[data-dot]', root);
  if (!rail || !dots.length) return () => {};
  const cards = [...rail.children];
  dots.forEach((d) => { d.onclick = () => cards[Number(d.dataset.dot)].scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', inline: 'start', block: 'nearest' }); });
  const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) dots.forEach((d, i) => d.setAttribute('aria-selected', String(cards[i] === e.target))); }, { root: rail, threshold: 0.6 });
  cards.forEach((c) => io.observe(c));
  return () => io.disconnect();
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
  D.getMerchant(app.ctx, id).then((m) => shopPinMap(el, m, { kit: true })).then((mm) => { if (root.isConnected) map = mm; else mm.remove(); })
    .catch((err) => { el.innerHTML = `<div class="empty">${esc(err.message)}</div>`; });
  return () => { if (map) map.remove(); };
}

function cafeListings() {
  return `<details class="oz-cafes directory-cafes" id="directory-cafes"><summary><span class="oz-cafes-title"><b>Campus cafés</b><small>Public listings and maps</small></span>${icon('chevron-right')}</summary>
    <p class="faint">Public café listings. Hours and prices aren’t verified.</p>
    <div class="oz-cafes-list">${CAFES.map((c) => `<div class="oz-cafe"><span class="oz-cafe-ic">${icon('coffee')}</span><div class="grow"><h3>${esc(c.name)}</h3>
      <p>${esc(c.location)} · ${esc(c.food)}</p></div><a class="oz-shop-go" target="_blank" rel="noopener" aria-label="Map for ${esc(c.name)}" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name + ' ' + c.location + ' Universiti Malaya')}">${icon('map-pin')}</a></div>`).join('')}</div></details>`;
}

// ------------------------------------------------------------- Central campus directory: nearby discovery, no attendance or points writes
function directoryCategory(type) {
  return ({ 'Food & drinks': ['coffee', 'food'], Laundry: ['shirt', 'laundry'], Printing: ['printer', 'printing'],
    Shops: ['store', 'shops'], Services: ['settings', 'services'], 'Student event stall': ['lightbulb', 'ventures'],
    'Student ventures': ['lightbulb', 'ventures'] })[type] || ['store', 'shops'];
}
// Campus shops (Figma phone 779:2321 / 779:2373 nearest first, web 923:31858). Title + location status, search, one
// compact category row, the map, clean shop rows (tap the row for the shop, a 44px Directions button), then live
// deals and cafés. Hooks kept for tests: #q #cmap #clist .checkout-shop(-action) #nearby-locate #loc-h/#loc-p
// #directory-filters [data-type]/[data-ventures] #directory-deals #checkout-deals #directory-results-count .checkout-card.
async function directoryRender(app, [mode] = []) {
  const merchants = await D.listVerifiedMerchants(app.ctx); app._merchants = merchants;
  const types = ['All', ...new Set(merchants.map((m) => m.type)), 'Student ventures'];
  const selected = mode === 'idea' ? 'Student ventures' : 'All';
  return `<div class="oz-shops overview-directory">
    <header class="oz-shops-head checkout-card"><h1 id="checkout-title">Campus shops</h1>
      <div class="oz-shops-status" role="status"><strong id="loc-h">Location is off</strong><span id="loc-p">You can still browse all campus shops.</span></div></header>
    <div class="oz-shops-layout">
      <section class="oz-shops-panel" aria-labelledby="checkout-title">
        <label class="oz-shops-search">${icon('search')}<input type="search" id="q" placeholder="Search shops or stalls" aria-label="Search shops or stalls"></label>
        <div class="oz-shops-tools">
          <button type="button" class="oz-btn oz-btn-ghost oz-btn-sm" id="nearby-locate">${icon('locate-fixed')}<span>My location</span></button>
          <span class="oz-shops-count"><span id="directory-results-count" aria-label="Matching shops">${n(merchants.length)}</span> shops</span>
        </div>
        <div class="oz-shops-chips" id="directory-filters" aria-label="Filter shops">${types.map((type) => `<button type="button" data-type="${esc(type)}" ${type === 'Student ventures' ? 'data-ventures' : ''} class="${type === selected ? 'on' : ''}" aria-pressed="${type === selected}">${esc(type === 'Student ventures' ? 'Student Ventures' : type)}</button>`).join('')}</div>
        <div class="oz-shops-list" id="clist"></div>
        ${cafeListings()}
      </section>
      <section class="oz-shops-map-area" aria-label="Campus map"><div class="oz-shops-map">
        <span class="oz-shops-verified">Admin verified</span>
        <div id="cmap" class="mmap" aria-label="Campus shops and your location, when permitted"></div>
        <div class="nearby-map-legend"><span class="nearby-location-key oz-map-key" id="nearby-location-key" hidden><img src="assets/onz/map/pin-you.svg" width="17" height="18" alt=""><span>You</span></span>
          <span class="oz-map-key" data-map-key="live" hidden><img src="assets/onz/map/pin-live.svg" width="17" height="18" alt=""><span>Live deal</span></span>
          <span class="oz-map-key" data-map-key="claimed" hidden><img src="assets/onz/map/pin-claimed.svg" width="17" height="18" alt=""><span>Claimed today</span></span></div>
        </div><div class="oz-shops-preview" hidden></div><span class="visually-hidden" role="status" id="shop-pin-status"></span>
      </section>
    </div>
    <section class="oz-shops-deals" id="directory-deals" tabindex="-1" aria-labelledby="checkout-deals-title" ${D.featureOn(app.rules, 'dealsAndPay') ? '' : 'hidden'}>
      ${ozSectionHead('Live deals', { id: 'checkout-deals-title' })}
      <div id="checkout-deals" class="checkout-deal-grid">${dealMessage('Finding café deals…')}</div>
    </section>
    ${hereNowSection(app, { discovery: true })}
  </div>`;
}
function directoryMount(root, app, [mode] = []) {
  let pos = null, map = null, stop = null, disposed = false;
  let activeType = mode === 'idea' ? 'Student ventures' : 'All', query = '', permission = null, watchToken = 0, requested = false, centerOnFix = true;
  const focusId = mode && !['idea', 'deals', 'cafes'].includes(mode) ? mode : null;
  const merchants = [...app._merchants];
  const preview = $('.oz-shops-preview', root);
  let selectedId = focusId;
  let pinState = new Map();
  const stateOf = (m) => pinState.get(m.id) || 'shop';
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
  function selectShop(shop) {
    selectedId = shop?.id ?? null;
    map?.selectPin(selectedId);
    $$('.oz-shop-row', root).forEach((row) => row.classList.toggle('focus', row.dataset.shopId === selectedId));
    preview.hidden = !shop;
    // Peek guide card (Figma 33:3400): your Onzo peeks in from the left; name, where, how far on foot, Navigate.
    const far = shop && pos && hasPin(shop) ? distanceM(pos, shop) : null;
    preview.innerHTML = shop ? `<article class="oz-peek"><span class="oz-peek-tile" aria-hidden="true"><span class="oz-peek-onzo">${AV.avatarSVG(myAvatar(app), { size: 112, bg: false })}</span></span>
      <div class="oz-peek-body"><h3><a href="#/merchant/${encodeURIComponent(shop.id)}" data-no-i18n>${esc(shop.name)}</a></h3>
        <p><span data-no-i18n>${esc(shop.location)}</span>${far != null ? ` · <span>${esc(fmtDistance(far))}</span> · <span>about ${Math.max(1, Math.ceil(far / 80))} min walk</span>` : ''}</p>
        ${hasPin(shop) ? ozButton('Navigate', { kind: 'primary', size: 'sm', href: directionsUrl(shop), attr: { target: '_blank', rel: 'noopener' } }) : ''}</div></article>` : '';
    $('#shop-pin-status', root).textContent = shop?.name ?? '';
  }
  function setPins() {
    const pinned = visibleMerchants().filter(hasPin);
    map?.setPins(pinned, { onSelect: selectShop, state: stateOf }); // the peek card below the map is the pin's card
    $$('[data-map-key]', root).forEach((key) => { key.hidden = !pinned.some((m) => stateOf(m) === key.dataset.mapKey); });
    selectShop(pinned.find((m) => m.id === selectedId));
  }
  function centerMap(animate = false) {
    if (!map) return;
    if (pos) map.setView(pos.lat, pos.lng, 16);
    else {
      const pinned = visibleMerchants().filter(hasPin);
      const focused = pinned.find((m) => m.id === focusId);
      map.fit((focused ? [focused] : pinned).map((m) => [m.lat, m.lng]), { animate });
    }
  }
  const writeDeals = dealListWriter($('#checkout-deals', root));
  const liveDeals = D.featureOn(app.rules, 'dealsAndPay') ? mountLiveDeals(app, (deals, message) => {
    // Pins follow the same rows: a deal you can claim now wins over one you already claimed today.
    const next = new Map();
    deals.forEach(({ merchant, status }) => {
      const st = status === 'Available' ? 'live' : status === 'Claimed today' ? 'claimed' : null;
      if (st && next.get(merchant.id) !== 'live') next.set(merchant.id, st);
    });
    if ([...next].join() !== [...pinState].join()) { pinState = next; setPins(); }
    const visible = new Set(visibleMerchants().map((merchant) => merchant.id));
    const rows = deals.filter(({ merchant }) => visible.has(merchant.id))
      .sort((a, b) => availableFirst(a, b) || (pos ? distance(a.merchant) - distance(b.merchant) : 0));
    const primary = mode === 'deals' ? rows.find((row) => row.claimHref) : null;
    writeDeals(rows.map((row) => {
      const { merchant } = row;
      const footerHtml = ozButton('View shop', { kind: 'secondary', size: 'sm', href: '#/merchant/' + merchant.id }) + (hasPin(merchant)
        ? ozButton('Directions', { kind: 'ghost', size: 'sm', iconName: 'navigation', href: directionsUrl(merchant), attr: { target: '_blank', rel: 'noopener' } }) : '');
      return ozLiveDealCard({ ...row, primary: row === primary, claimLabel: 'Scan to claim', footerHtml });
    }).join('') || dealMessage(message));
  }, () => merchants) : null;
  function draw() {
    if (disposed) return;
    const rows = sortedMerchants();
    $('#directory-results-count', root).textContent = n(rows.length);
    $('#clist', root).innerHTML = rows.map((m) => `<article class="oz-shop-row checkout-shop ${m.id === selectedId ? 'focus' : ''}" data-shop-id="${esc(m.id)}">
      <div class="oz-shop-main"><span class="oz-shop-logo">${merchantLogo(m)}</span><span class="oz-shop-copy"><h3><a class="oz-shop-link" href="#/merchant/${esc(m.id)}">${esc(m.name)}</a></h3>
        <span class="oz-shop-meta">${esc(m.type)} · ${esc(m.location)}</span>${pos && hasPin(m) ? `<span class="nearby-distance">${esc(fmtDistance(distanceM(pos, m)))}</span>` : ''}</span></div>
      <span class="checkout-shop-action">${hasPin(m) ? `<a class="oz-shop-go" href="${directionsUrl(m)}" target="_blank" rel="noopener" aria-label="Directions to ${esc(m.name)}">${icon('navigation')}</a>` : ''}</span></article>`).join('')
      || `<div class="oz-shops-empty">${icon('search')}<p>No shops match. Try another word or category.</p></div>`;
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
  $('#q', root).oninput = (event) => { query = event.target.value.trim().toLowerCase(); setPins(); hn.redraw(); if (!pos) centerMap(true); draw(); };
  const filterButtons = $$('#directory-filters button', root);
  filterButtons.forEach((button) => {
    button.onclick = () => {
      activeType = button.dataset.type;
      filterButtons.forEach((item) => { item.classList.toggle('on', item === button); item.setAttribute('aria-pressed', String(item === button)); });
      setPins(); hn.redraw(); if (!pos) centerMap(true); draw();
    };
  });
  const hn = mountHereNow(root, app, { getMap: () => map, merchants: visibleMerchants, discovery: true });
  createMap($('#cmap', root), {
    center: UM_CENTER, zoom: 16, kit: true,
    userMarker: {
      html: '<img class="kk-me oz-user-pin" src="assets/onz/map/pin-you.svg" width="42" height="45" alt="">',
      size: [42, 45], anchor: [21, 36.6],
    },
  }).then((m) => {
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

// Daily app streak: facts shared by the Streak page and its calendar.
function streakFacts(app, now = Date.now()) {
  const today = D.dayKey(now);
  const { current, todayDone, days } = D.dailyStreak(app.appDays, now);
  const bonus = pointsRules(app.rules).streakBonus, credited = app.ledger.find((e) => e.type === 'appStreak' && e.day === today);
  const pending = todayDone && current > 0 && current % 7 === 0 && !credited;
  const status = credited ? `+${n(credited.delta)} pts earned` : pending ? 'Bonus on the way' : todayDone ? 'Today counted' : current ? 'Ready for today' : 'Start a streak';
  return { now, today, current, todayDone, days, bonus, credited, pending, status };
}
function showStreakMotion(root, app) {
  const cue = app.streakMotion;
  if (!cue || cue.day !== D.dayKey()) return;
  const home = $('.oz-home-hero a[href="#/rewards/streak"] img', root);
  const flame = $('.oz-streak-hero .oz-flame', root);
  if (home && !cue.home) {
    cue.home = true;
    home.classList.add('oz-streak-ignite'); motion.flare(home);
  }
  // Today's cell fills from the centre and the flame flares once (Speak / Brilliant streak moments on Mobbin).
  const dot = $('.oz-cal-day.is-today, .streak-calendar .today.checked .streak-day', root);
  if (flame && dot && !cue.streak) {
    cue.streak = true;
    flame.classList.add('oz-streak-ignite'); motion.flare(flame.closest('.oz-streak-hero') || flame);
    dot.classList.add('oz-streak-today');
  }
  // One small confirmation per day, wherever the student lands first (Brilliant "1 · Nice work today").
  if (!cue.toast && (home || flame)) {
    cue.toast = true;
    const days = streakFacts(app).current;
    if (days > 0) setTimeout(() => toast(`Day ${n(days)} of your streak. Nice work today.`), 650);
  }
  const bonus = $('.oz-streak-status', root);
  if (bonus && !cue.bonus && app.ledger.some((e) => e.type === 'appStreak' && e.day === cue.day)) {
    cue.bonus = true;
    bonus.classList.add('oz-earned-highlight');
    flame?.classList.add('oz-streak-bonus-glow');
  }
}
function appStreakSection(app) {
  const f = streakFacts(app); const { now, today, current, todayDone, days, bonus, credited, pending } = f;
  const next = pending ? current : (Math.floor(current / 7) + 1) * 7, progress = pending ? 7 : current % 7;
  const recent = Array.from({ length: 7 }, (_, i) => {
    const time = now - (6 - i) * 86400000, day = D.dayKey(time), completed = days.has(day);
    const label = new Date(time).toLocaleDateString('en-MY', { weekday: 'short', timeZone: 'Asia/Kuala_Lumpur' });
    return `<li class="${completed ? 'checked' : ''} ${day === today ? 'today' : ''}" aria-label="${day}: ${completed ? 'App opened' : 'No app activity'}"><span>${label}</span><span class="streak-day" aria-hidden="true">${completed ? ozIcon('s:check') : '<i class="oz-streak-dash"></i>'}</span></li>`;
  }).join('');
  const status = credited ? `+${n(credited.delta)} <span>pts earned</span>` : esc(f.status);
  const sub = current ? '' : `Open +Onz 7 days in a row to earn ${n(bonus)} pts.`;
  // Figma 29 · Rewards · Streak (708:15284) and Web · Rewards · Streak (929:34615): on the web the parts sit in one 800px card.
  // #rewards-streak, .streak-calendar and .streak-guidance are test hooks.
  return `<section class="oz-streak rewards-streak app-streak" id="rewards-streak" tabindex="-1" aria-labelledby="app-streak-heading">
    <div class="oz-streak-hero"><button type="button" class="oz-flame-tap" aria-label="Stoke the flame">${ozFlame(120, 'oz-streak-flame', current)}</button>
      <div class="oz-streak-hero-text"><h2 id="app-streak-heading"><strong>${current}</strong> ${current === 1 ? 'day running' : 'days running'}</h2>
      <span class="oz-streak-status badge">${status}</span>${sub ? `<p class="oz-streak-sub">${sub}</p>` : ''}</div></div>
    <div class="oz-streak-card"><div class="oz-streak-row"><h3 class="oz-streak-label">Past 7 days</h3><a class="oz-link oz-streak-cal-link" href="#/rewards/streak/calendar">${ozIcon('events')}<span>View calendar</span></a></div>
      <ul class="streak-calendar" aria-label="App activity over the past seven days">${recent}</ul></div>
    <div class="oz-streak-card"><div class="oz-streak-next"><p class="streak-guidance"><span class="oz-streak-label">Next bonus</span><span class="oz-streak-day"><span>Day</span> <strong>${next}</strong></span></p>
      <span class="streak-bonus">✦ +${n(bonus)} <span>pts</span></span></div>
      <div class="streak-bonus-progress" role="progressbar" aria-label="Days towards the next streak bonus" aria-valuemin="0" aria-valuemax="7" aria-valuenow="${progress}"><span style="width:${progress / 7 * 100}%"></span></div>
      <p class="oz-streak-count">${progress} of 7 days</p></div>
  </section>`;
}
// Streak calendar (Figma Mobile 1190:66731, Desktop 1190:67162): one month, Monday first. Counted days in a row join
// into one lime band per week; today has an orange ring; days not yet reached are faded. Prev/Next change the month in place.
const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad2 = (v) => String(v).padStart(2, '0');
function streakMonthHTML(f, ym) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)), daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let w = 0; w < cells.length; w += 7) {
    const row = cells.slice(w, w + 7).map((d) => (d ? { d, key: `${y}-${pad2(m)}-${pad2(d)}` } : null));
    weeks.push(`<div class="oz-cal-week" role="row">${row.map((c, i) => {
      if (!c) return '<span class="oz-cal-day is-empty" role="gridcell"></span>';
      const counted = f.days.has(c.key), future = c.key > f.today, today = c.key === f.today;
      const prev = i > 0 && row[i - 1] && f.days.has(row[i - 1].key), nextOn = i < 6 && row[i + 1] && f.days.has(row[i + 1].key);
      const band = counted ? ` is-counted${prev ? ' band-l' : ''}${nextOn ? ' band-r' : ''}` : '';
      const state = counted ? 'Counted' : future ? 'Not yet' : 'Not counted';
      return `<span class="oz-cal-day${band}${future ? ' is-future' : ''}${today ? ' is-today' : ''}" role="gridcell" aria-label="${c.d} ${CAL_MONTHS[m - 1]}: ${state}${today ? ', today' : ''}"${today ? ' aria-current="date"' : ''}>${c.d}</span>`;
    }).join('')}</div>`);
  }
  return `<div class="oz-cal-grid" role="grid" aria-label="${CAL_MONTHS[m - 1]} ${y}"><div class="oz-cal-week oz-cal-dow" role="row" aria-hidden="true">${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => `<span><span class="dow-long">${d.slice(0, 3)}</span><span class="dow-short">${d[0]}</span></span>`).join('')}</div>${weeks.join('')}</div>`;
}
function streakCalendarHTML(app) {
  const f = streakFacts(app); const ym = f.today.slice(0, 7);
  return `<section class="oz-streak-cal" aria-labelledby="streak-cal-title">
    <div class="oz-streak-cal-summary"><button type="button" class="oz-flame-tap" aria-label="Stoke the flame">${ozFlame(84, '', f.current)}</button>
      <div><h2 id="streak-cal-title">${f.current}-day streak</h2><p class="oz-streak-cal-status">${esc(f.status)}</p></div></div>
    <div class="oz-cal-nav">${ozButton('Prev', { kind: 'ghost', size: 'sm', attr: { 'data-cal': '-1', 'aria-label': 'Previous month' } })}<p class="oz-cal-month" id="cal-month" aria-live="polite">${CAL_MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}</p>
      ${ozButton('Next', { kind: 'ghost', size: 'sm', attr: { 'data-cal': '1', 'aria-label': 'Next month', disabled: true } })}</div>
    <div id="cal-body" data-month="${ym}">${streakMonthHTML(f, ym)}</div>
    <ul class="oz-cal-legend"><li><i class="is-counted"></i>Counted</li><li><i class="is-today"></i>Today</li><li><i></i>Not counted</li></ul>
    ${ozButton('Back to streak', { kind: 'ghost', href: '#/rewards/streak', cls: 'oz-cal-back' })}
  </section>`;
}
function mountStreakCalendar(root, app) {
  const body = $('#cal-body', root); if (!body) return;
  const f = streakFacts(app); const now = f.today.slice(0, 7);
  const earliest = [...f.days].sort()[0]?.slice(0, 7) || now;
  const shift = (ym, by) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + by, 1)); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`; };
  const show = (ym) => {
    body.dataset.month = ym; body.innerHTML = streakMonthHTML(f, ym);
    $('#cal-month', root).textContent = `${CAL_MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
    $('[data-cal="-1"]', root).disabled = ym <= earliest; $('[data-cal="1"]', root).disabled = ym >= now;
  };
  $$('[data-cal]', root).forEach((b) => { b.onclick = () => show(shift(body.dataset.month, Number(b.dataset.cal))); });
  show(now);
}

// ------------------------------------------------------------- rewards, vouchers and learning streaks
// Figma 10 · Rewards (696:13830) and W · Rewards (915:34184). Rewards come from Firestore and are redeemed with the Admin team.
async function rewardsRender(app) {
  const [section] = arguments[1] || []; // route parts, e.g. #/rewards/streak
  const p = app.profile;
  if (section === 'streak') {
    const cal = arguments[1]?.[1] === 'calendar';
    return `<div class="rewards-page oz-streak-page${cal ? ' oz-streak-cal-page' : ''}">
      <div class="oz-page-head"><a class="oz-back" href="${cal ? '#/rewards/streak' : '#/rewards'}">${ozIcon('s:chevron-left')}<span>${cal ? 'Streak' : 'Rewards'}</span></a><h1 class="oz-page-head-title">${cal ? 'Streak calendar' : 'Streak'}</h1></div>
      ${cal ? streakCalendarHTML(app) : appStreakSection(app)}</div>`;
  }
  const rewards = (await D.listRewards(app.ctx)).filter((reward) => reward.active);
  const available = (reward) => (reward.stock || 0) - (reward.issued || 0);
  const canSwap = (reward) => p.points >= reward.cost && available(reward) > 0;
  rewards.sort((a, b) => Number(canSwap(b)) - Number(canSwap(a)) || Number(available(b) > 0) - Number(available(a) > 0));
  const achievements = badges(app);
  const live = livePointEarningOn(app.rules) && D.featureOn(app.rules, 'overview') && D.featureOn(app.rules, 'dealsAndPay');
  return `<div class="rewards-page oz-rewards">
    <h1 class="oz-page-title">Rewards</h1>
    <div class="rewards-hero oz-balance"><p class="oz-balance-value"><span class="oz-plus" aria-hidden="true"></span><span data-bind="points">${n(p.points)}</span><span class="oz-balance-unit">pts</span></p><p class="oz-balance-label">Available points</p></div>
    ${ozSegmented([{ key: 'shop', label: 'Shop' }, { key: 'vouchers', label: 'Vouchers' }, { key: 'badges', label: 'Badges' }], 'shop', { label: 'Rewards sections', cls: 'oz-rewards-tabs' })}
    <section class="oz-rewards-panel rewards-shelf" id="reward-shelf" data-panel="shop" tabindex="-1" aria-label="Swap points">
      <div class="reward-grid">${rewards.map((r) => {
        const left = available(r); const can = canSwap(r);
        return `<article class="oz-voucher reward-prize ${left <= 0 ? 'sold-out' : ''}">
          <div class="oz-voucher-value"><strong>${rm(r.valueCents).replace(/\.00$/, '')}</strong><span>voucher value</span></div>
          <div class="oz-voucher-body"><h3>${esc(r.title)}</h3><p class="oz-voucher-where">Redeem with the Admin team · valid ${n(Number(r.validDays) || 30)} days</p>
            <div class="oz-voucher-foot"><span class="oz-voucher-meta"><span class="oz-voucher-cost">${n(r.cost)} pts</span>${left > 0 ? `<span class="oz-voucher-left">${n(left)} left</span>` : ozTag('All claimed', 'expiry')}</span>
            ${ozButton(left <= 0 ? 'All claimed' : can ? 'Swap' : `${n(Math.max(0, r.cost - p.points))} more`, { size: 'sm', kind: can ? 'primary' : 'ghost', attr: { 'data-redeem': r.id, disabled: !can } })}</div></div></article>`;
      }).join('') || ozEmpty({ title: 'No rewards yet', body: 'The Admin team hasn’t added rewards yet.' })}</div>
    </section>
    <section class="oz-rewards-panel rewards-wallet" data-panel="vouchers" hidden aria-label="My vouchers"><div id="vouchers" class="oz-voucher-list"><div class="skeleton" style="height:80px"></div></div></section>
    <section class="oz-rewards-panel rewards-badges" data-panel="badges" hidden aria-label="Badges">
      <p class="oz-badge-count"><span class="rewards-badge-count" aria-label="Badges earned">${achievements.filter(([got]) => got).length}/${achievements.length}</span> earned</p>
      <div class="awards" role="list">${achievements.map(([got, ic, label]) => `<div class="award oz-badge ${got ? 'got' : ''}" role="listitem"><span class="oz-badge-icon" aria-hidden="true">${icon(ic)}</span><span class="oz-badge-label">${esc(label)}</span><span class="oz-badge-state">${got ? 'Earned' : 'Locked'}</span></div>`).join('')}</div></section>
    <section class="oz-rewards-earn"><h2 class="oz-rewards-side-title">Earn more points</h2>
      ${pointsSummaryHTML(app)}
      ${ozListRow({ title: 'Daily check-in streak', sub: `${D.dailyStreak(app.appDays).current} ${D.dailyStreak(app.appDays).current === 1 ? 'day running' : 'days running'} · +${n(pointsRules(app.rules).streakBonus)} pts every 7 days`, iconName: 'streak', href: '#/rewards/streak' })}
      ${live ? ozListRow({ title: 'Earn with live deals', sub: `+${n(app.rules.liveDealPoints)} pts per eligible deal`, iconName: 'stall', href: '#/explore/deals' }) : ''}</section>
    <div class="oz-rewards-more">
      ${ozButton('Learn & Earn', { kind: 'ghost', href: '#/learn', block: true })}
      ${ozListRow({ title: 'Give to the welfare fund', sub: 'Points you donate support UM students in need.', iconName: 'fund', href: '#/community/fund', cls: 'reward-extra welfare-extra' })}
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
function rewardsMount(root, app, [section, sub] = []) {
  if (section === 'streak') {
    // Tapping the flame stokes it: each tap feeds it, it grows, burns faster and throws embers, then cools down.
    const stoke = $$('.oz-flame-tap', root).map((b) => motion.stokeFlame(b));
    if (sub === 'calendar') mountStreakCalendar(root, app);
    else { showStreakMotion(root, app); $('#rewards-streak', root)?.focus({ preventScroll: true }); }
    return () => stoke.forEach((off) => off());
  }
  const tabs = $$('.oz-rewards-tabs [data-seg]', root);
  const revealNewVoucher = () => {
    const cue = app.redeemMotion;
    const ticket = cue?.id && $$('[data-voucher]', root).find((b) => b.dataset.voucher === cue.id);
    if (!ticket || ticket.closest('[hidden]')) return;
    $('.oz-voucher-title', ticket)?.classList.add('oz-earned-highlight');
    app.redeemMotion = null;
  };
  const balance = $('.oz-balance-value', root);
  if (balance && app.redeemMotion?.from != null && app.profile.points !== app.redeemMotion.from) {
    balance.dataset.v = app.redeemMotion.from;
    countUp(balance, app.profile.points, 220);
    delete app.redeemMotion.from;
  }
  const show = (key) => {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.seg === key)));
    $$('[data-panel]', root).forEach((panel) => { panel.hidden = panel.dataset.panel !== key; });
    if (key === 'vouchers') revealNewVoucher();
  };
  tabs.forEach((t) => { t.onclick = () => show(t.dataset.seg); });
  $$('[data-redeem]', root).forEach((b) => {
    b.onclick = async () => {
      const r = (await D.listRewards(app.ctx)).find((x) => x.id === b.dataset.redeem);
      if (!(await confirmSheet(`Swap ${n(r.cost)} points for ${r.title}?`, `You’ll have ${n(app.profile.points - r.cost)} points left. The voucher is valid for ${n(Number(r.validDays) || 30)} days.`, 'Swap points'))) return;
      const from = app.profile.points;
      try {
        const vid = await D.redeemReward(app.ctx, r);
        app.redeemMotion = { id: vid, from };
        toast('Voucher added. Show it to the Admin team for redemption.');
        if (!root.isConnected || !location.hash.startsWith('#/rewards')) return;
        await app.render();
        showVoucher(app, vid, [{ id: vid, title: r.title, merchantId: r.merchantId, status: 'issued' }]);
      }
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
    revealNewVoucher();
  }, () => {});
  return unsub;
}
function showVoucher(app, vid, list) {
  const v = list ? list.find((x) => x.id === vid) : null;
  // Design-system voucher sheet: the title is centred on the sheet itself (equal space both sides, so the close button
  // no longer pushes it left), then the QR, then the code as a readable chip (Inter, not monospace). .code-text is a test hook.
  const dead = !!v && (v.status === 'used' || D.voucherExpired(v));
  const el = sheet(`<div class="oz-vsheet"><h2 class="oz-vsheet-title" data-no-i18n>${esc(v ? v.title : 'Your voucher')}</h2>
    <p class="oz-vsheet-note">${v?.status === 'used' ? 'This voucher has been used.' : dead ? 'This voucher has expired.' : 'Show this voucher to the Admin team for redemption.'}</p>
    <div class="oz-vsheet-qr${dead ? ' is-dead' : ''}"><div id="vqr"></div></div>
    <p class="oz-vsheet-code"><span>Code</span><b class="code-text" data-no-i18n>${esc(vid.slice(0, 8).toUpperCase())}</b></p></div>`);
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
// Learn & Earn (Figma 17 · Learn & Earn 696:13554, Web · Learn & Earn 929:34376). [data-lesson] rows are the test hooks.
async function learnRender(app) {
  const done = new Set(app.ledger.map((l) => l.id)), r = app.rules;
  const lessons = D.LESSONS.map((l, i) => ({ ...l, i, done: done.has('lesson' + i) }));
  const surveyDone = done.has('survey');
  const total = lessons.length * r.lessonBonus + r.surveyBonus;
  const earned = lessons.filter((l) => l.done).length * r.lessonBonus + (surveyDone ? r.surveyBonus : 0);
  const nextLesson = lessons.find((l) => !l.done);
  const next = nextLesson ? [nextLesson.title, r.lessonBonus] : !surveyDone ? ['Money check', r.surveyBonus] : null;
  const rows = lessons.map((l) => `<li><button type="button" class="oz-learn-row${l.done ? ' is-done' : ''}" data-lesson="${l.i}" aria-label="${esc(l.title)}: ${l.done ? 'done, practise again' : `start, +${n(r.lessonBonus)} pts`}">
      <span class="oz-learn-dot" aria-hidden="true"></span><span class="oz-learn-name">${esc(l.title)}</span>${ozTag(`+${n(r.lessonBonus)} pts`, 'points')}</button></li>`).join('');
  return `<div class="oz-learn">
    <header class="oz-learn-head"><h1 class="oz-page-title">Learn &amp; Earn</h1><p class="oz-learn-lede">Short money lessons. One question each, points earned once.</p></header>
    <div class="oz-learn-grid">
      <section class="oz-learn-list" aria-labelledby="learn-practice-title"><h2 id="learn-practice-title">Practice anytime</h2><ul>${rows}</ul>
</section>
      <aside class="oz-learn-side" aria-label="Your progress">
        <div class="oz-learn-progress">${next ? `<p class="oz-learn-eyebrow">Up next</p><div class="oz-learn-next"><strong>${esc(next[0])}</strong>${ozTag(`+${n(next[1])} pts`, 'points')}</div>`
            : '<div class="oz-learn-next"><strong>All lessons and the Money check done</strong></div>'}
          <div class="oz-learn-track" role="progressbar" aria-label="Learn &amp; Earn points earned" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${earned}"><i style="width:${total ? (earned / total * 100).toFixed(1) : 0}%"></i></div>
          <p class="oz-learn-count"><b>${n(earned)}</b> / ${n(total)} pts earned</p></div>
        <span class="oz-learn-onzo" aria-hidden="true">${AV.avatarSVG(myAvatar(app), { size: 88, bg: false })}</span>
        ${ozButton(surveyDone ? 'See your Money Check' : 'Open Money Check survey', { kind: surveyDone ? 'ghost' : 'secondary', href: '#/survey', block: true, cls: 'oz-learn-survey' })}
      </aside>
    </div>
  </div>`;
}
function learnMount(root, app) {
  $$('[data-lesson]', root).forEach((b) => {
    b.onclick = () => {
      const i = +b.dataset.lesson; const l = D.LESSONS[i];
      // Quiz sheet (Figma lesson 492:8585 / try again 492:8686): label, title, the question in its own card, then evenly
      // spaced full-width answers (min 56px: easy to hit) and a calm hint card on a wrong answer.
      let refresh = false;
      const el = sheet(`<div class="oz-quiz"><p class="oz-quiz-kicker">Lesson · 1 question</p><h2>${esc(l.title)}</h2>
        <div class="oz-quiz-meter"><progress class="oz-quiz-progress visually-hidden" max="1" value="0" aria-label="Lesson progress"></progress><span aria-hidden="true"></span></div><div class="oz-quiz-q"><p>${esc(l.q)}</p></div>
        <div class="oz-quiz-options" role="group" aria-label="Answers">${l.options.map((o, j) => `<button type="button" class="oz-quiz-opt" data-a="${j}"><span class="oz-quiz-key" aria-hidden="true">${'ABCD'[j]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        <div id="fb" class="oz-quiz-fb" role="status" hidden></div></div>`, { onClose: () => { if (refresh && root.isConnected) app.render(); } });
      const answers = $$('[data-a]', el);
      let submitting = false;
      answers.forEach((a) => {
        a.onclick = async () => {
          if (submitting) return;
          submitting = true;
          const practice = app.ledger.some((entry) => entry.id === 'lesson' + i);
          const r = await (practice ? D.practiceLesson : D.answerLesson)(app.ctx, i, +a.dataset.a, app.rules).catch((e) => { toast(errText(e), true); return null; });
          if (!el.closest('dialog')?.open || !a.isConnected) { if (r === 'correct' && root.isConnected) app.render(); return; }
          if (r === 'correct' || r === 'practised' || r === 'done') {
            refresh = true;
            answers.forEach((answer) => { answer.disabled = true; });
            if (r !== 'done') {
              a.classList.remove('warn');
              a.removeAttribute('aria-invalid');
              a.classList.add('is-correct');
              $('.oz-quiz-progress', el).value = 1;
            }
            const message = r === 'correct' ? 'Correct. Points added to your balance.'
              : r === 'practised' ? 'Correct practice. No repeat points.' : 'You’ve already earned points for this lesson.';
            const fb = $('#fb', el);
            fb.hidden = false;
            fb.innerHTML = '<p>' + esc(tr(message)) + '</p>' + ozButton(tr('Continue'), { block: true, attr: { 'data-quiz-continue': true } });
            if (r === 'correct') $('p', fb).classList.add('oz-earned-highlight');
            const next = $('[data-quiz-continue]', fb);
            next.onclick = closeSheet;
            next.focus();
            return;
          }
          else if (r === 'wrong') { a.classList.add('warn'); a.setAttribute('aria-invalid', 'true'); motion.shake(a); /* shake as well as turning red */ const fb = $('#fb', el); fb.hidden = false; fb.textContent = 'Not quite. Think about what keeps your money safe, then try again.'; }
          submitting = false;
        };
      });
    };
  });
}

// ------------------------------------------------------------- survey (students and merchants share it)
// Money Check (Figma 523:10141 / 492:8638): one card per question, evenly spaced answer rows (whole row is the target),
// the chosen answer highlighted. Same form, field names and submit as before (students and merchants share it).
export function surveyHTML(role, existing) {
  const q = (name, text, answers, num) => `<fieldset class="oz-survey-q"><legend><span class="oz-survey-num">${num}</span>${esc(text)}</legend>
    <div class="oz-survey-opts">${answers.map((a, i) => `<label class="oz-survey-opt"><input type="radio" name="${name}" value="${i}" required><span>${esc(a)}</span></label>`).join('')}</div></fieldset>`;
  const all = [...D.SURVEY_KNOWLEDGE.map(([t, a], i) => ['k' + i, t, a]), ...D.SURVEY_DIGITAL[role].map(([t, a], i) => ['d' + i, t, a])];
  return `${existing ? `<div class="oz-survey-last"><span class="oz-survey-grade" data-no-i18n>${esc(existing.grade)}</span><div><h3>Your last result: ${existing.score}/100</h3>
      <p>Knowledge ${existing.knowledge}% · Digital confidence ${existing.digital}%</p></div></div>` : ''}
    <form id="survey" class="oz-survey">
      ${all.map(([name, t, a], i) => q(name, t, a, i + 1)).join('')}
      <button class="oz-btn oz-btn-primary oz-btn-md oz-btn-block">${existing ? 'Update my answers' : 'See my result'}</button></form>`;
}
export function surveyResultText(role, r) {
  const st = { A: 'Confident and ready', B: 'Nearly there', C: 'Some support will help', D: 'Start with the basics' }[r.grade];
  const tip = role === 'student' ? (r.knowledge < 75 ? 'Try the Learn & Earn lessons next.' : 'Keep learning with Learn & Earn. Your survey bonus is awarded once.')
    : (r.digital < 70 ? 'Ask an ambassador to help set up your business QR and train staff.' : 'Review your shop readiness. Live deals are available only when enabled by the Admin team.');
  return { title: `${r.grade}: ${st}`, tip };
}
async function surveyRender(app) {
  const existing = await D.getSurvey(app.ctx).catch(() => null);
  const count = D.SURVEY_KNOWLEDGE.length + D.SURVEY_DIGITAL.student.length, firstTime = !app.ledger.some((l) => l.id === 'survey');
  // Written for the student: how long it takes and what they get. (Why the Admin team runs it is in the Points guide.)
  return `<div class="oz-survey-page"><a class="oz-help-back" href="#/learn">${ozIcon('s:chevron-left')} Learn &amp; Earn</a>
    <header class="oz-survey-head"><h1 class="oz-page-title">Money check</h1>
      <p class="oz-survey-lede"><span>${n(count)} quick questions · about 2 minutes</span>${firstTime ? ozTag(`+${n(app.rules.surveyBonus)} pts`, 'points') : ''}</p></header>
    ${surveyHTML('student', existing)}</div>`;
}
export function surveyMount(root, app, role, back) {
  $('#survey', root).onsubmit = (e) => {
    e.preventDefault(); const answers = {};
    for (const [k, v] of new FormData(e.target)) answers[k] = +v;
    busy($('button', e.target), async () => {
      try {
        const r = D.scoreSurvey(role, answers); const bonus = await D.submitSurvey(app.ctx, r, app.rules);
        const t = surveyResultText(role, r); if (bonus) { confetti(); pointsFx(); }
        sheet(`<div class="oz-fsheet oz-fsheet-center"><h2 class="oz-fsheet-title">${esc(t.title)}</h2>
          <div class="oz-fsheet-stats"><span><b>${r.knowledge}%</b><small>Knowledge</small></span><span><b>${r.digital}%</b><small>Digital confidence</small></span></div>
          ${bonus ? ozTag(`+${n(bonus)} pts`, 'points') : ''}<p class="oz-fsheet-fine">${esc(t.tip)}</p>
          <a class="oz-btn oz-btn-primary oz-btn-md oz-btn-block" href="#/${back}" data-close><span>Continue</span></a></div>`);
      } catch (err) { toast(errText(err), true); }
    });
  };
}

// ------------------------------------------------------------- Leagues: KK League, Faculty League, top referrers
// Both leagues count points earned (stats/league, kept by the server); spending or donating never lowers them.
// Figma: Leagues · Production 696:13575 / web 934:40986, Faculty 696:13590 / 934:41136, Referrers 696:13601 / 934:41320.
// The boards hide nothing: every college and faculty is listed, including those without points yet, ties share a rank,
// and your own entry says exactly how far it is from the next place.
const FACULTY_INFO = {
  'Faculty of Science': ['SCI', 'Science'], 'Faculty of Engineering': ['ENG', 'Engineering'],
  'Faculty of Business and Economics': ['BUS', 'Business & Economics'], 'Faculty of Arts and Social Sciences': ['FASS', 'Arts & Social Sciences'],
  'Faculty of Computer Science and Information Technology': ['FSKTM', 'Computer Science & IT'], 'Faculty of Medicine': ['MED', 'Medicine'],
  'Faculty of Dentistry': ['DEN', 'Dentistry'], 'Faculty of Pharmacy': ['PHA', 'Pharmacy'], 'Faculty of Law': ['LAW', 'Law'],
  'Faculty of Education': ['EDU', 'Education'], 'Faculty of Built Environment': ['FBE', 'Built Environment'],
  'Academy of Malay Studies': ['APM', 'Malay Studies'], 'Academy of Islamic Studies': ['API', 'Islamic Studies'],
  'Faculty of Languages and Linguistics': ['LAN', 'Languages & Linguistics'], 'Faculty of Creative Arts': ['CRE', 'Creative Arts'],
  'Faculty of Sport and Exercise Sciences': ['SPT', 'Sport & Exercise Sciences'],
};
const facultyCode = (f) => FACULTY_INFO[f]?.[0] || (f.match(/\b[A-Z]/g) || []).join('').slice(0, 5) || f.slice(0, 3);
// Faculty mascots composed from the Figma "Faculty mascot · <code>" layers; "Other" has no faculty artwork, so it gets plain Sir Onz.
const facultyArt = (f) => (FACULTY_INFO[f] ? `<img class="oz-lg-fac" src="assets/onz/faculty/${FACULTY_INFO[f][0].toLowerCase()}.svg" alt="" width="40" height="56">` : AV.collegeLionSVG('', { size: 40 }));
const LEAGUE_TABS = [['kk', 'KK League'], ['faculty', 'Faculty'], ['referrals', 'Referrers']];
const leagueBoardOf = (section) => (LEAGUE_TABS.some(([k]) => k === section) ? section : 'kk');

/** Every entry ranked by points, then code (the production tie order). Ties share a rank: 1, 2, 2, 4. */
export function rankLeague(totals, keys) {
  const all = new Map(keys.map((k) => [k, 0]));
  for (const [k, v] of Object.entries(totals || {})) all.set(k, Number(v) || 0);
  const rows = [...all].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true }));
  let rank = 0;
  return rows.map(([key, points], i) => { if (!i || points !== rows[i - 1][1]) rank = i + 1; return { key, points, rank }; });
}
/** How your entry stands against its neighbours, from real scores only. */
function leagueGap(rows, mine, noun) {
  const above = rows.filter((r) => r.points > mine.points).at(-1);
  if (above) return `Your ${noun} · ${n(above.points - mine.points)} pts behind #${above.rank}`;
  const tied = rows.filter((r) => r.points === mine.points).length > 1;
  if (tied) return `Your ${noun} · tied at #${mine.rank}`;
  const below = rows.find((r) => r.points < mine.points);
  return below ? `Your ${noun} · leading by ${n(mine.points - below.points)} pts` : `Your ${noun}`;
}

function leagueBoard({ id, noun, findLabel, mine, mineCode, active, guide = false, mascot = '' }) {
  return `<section class="oz-lg-board" id="${id}" tabindex="-1" aria-labelledby="${id}-title"${active ? '' : ' hidden'}>
    <div class="oz-lg-top">
      <i class="oz-lg-card" aria-hidden="true"></i>
      <div class="oz-lg-sum-wrap"><div class="oz-lg-summary oz-lg-race">
        <div class="oz-lg-race-hero"><span class="oz-lg-race-me" aria-hidden="true">${mascot}</span>
          ${mine ? '<span class="oz-lg-race-rank" data-no-i18n data-rank>—</span>' : ''}</div>
        <div class="oz-lg-sum-text"><p class="oz-lg-sum-label"><span>Your ${noun}</span></p>
          <p class="oz-lg-sum-value">${mine ? `<span data-no-i18n>${esc(mineCode)}</span> · <span data-points>—</span>` : `<span>No ${noun} set</span>`}</p></div>
        ${mine ? '<div class="oz-lg-race-track" data-track hidden></div><p class="oz-lg-race-gap" data-gap hidden></p>' : ''}
        ${mine ? `<button type="button" class="oz-lg-find" data-find>${esc(findLabel)}</button>` : '<a class="oz-lg-find" href="#/me">Add it in Me</a>'}
      </div></div>
      <div class="oz-lg-standings-head"><h2 id="${id}-title">Overall standings</h2>
        <button type="button" class="oz-lg-link" ${guide ? 'id="league-help"' : 'data-rules'} aria-haspopup="dialog">Scoring rules</button></div>
      <ol class="oz-lg-podium" data-podium aria-label="Top three">${'<li class="oz-lg-pod skeleton"></li>'.repeat(3)}</ol>
    </div>
    <ol class="oz-lg-ranks" data-board aria-label="All standings">${'<li class="oz-lg-row skeleton"></li>'.repeat(4)}</ol>
    <div class="oz-lg-unranked" data-unranked-wrap hidden><h3 class="oz-lg-subhead">Yet to score <span class="oz-lg-subcount" data-unranked-count></span></h3>
      <ol class="oz-lg-unranked-list" data-unranked aria-label="Yet to score"></ol></div>
    <button type="button" class="oz-lg-totop" data-totop><span aria-hidden="true">↑</span> Back to top</button>
  </section>`;
}

async function leaguesRender(app, [section] = []) {
  const p = app.profile;
  const board = leagueBoardOf(section);
  const refs = board === 'referrals';
  return `<div class="oz-leagues" data-board-active="${board}">
    <header class="oz-lg-head"><h1 id="leagues-title">${refs ? 'Top referrers' : 'Leagues'}</h1>
      ${refs ? '<p class="oz-lg-sub">The 10 students whose codes were used most.</p>' : ''}</header>
    <nav class="oz-seg oz-lg-tabs" aria-label="Leagues">${LEAGUE_TABS.map(([k, label]) =>
      `<a class="oz-seg-item" href="#/leagues/${k}" data-tab-board="${k}"${k === board ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    ${leagueBoard({ id: 'league-kk', noun: 'college', findLabel: 'Find my KK', mine: p.college && p.college !== 'OFF' ? p.college : '', mineCode: p.college, active: board === 'kk', guide: true, mascot: AV.collegeLionSVG(p.college && p.college !== 'OFF' ? p.college : '', { size: 120 }) })}
    ${leagueBoard({ id: 'league-faculty', noun: 'faculty', findLabel: 'Find my faculty', mine: FACULTY_INFO[p.faculty] || p.faculty === 'Other' ? p.faculty : '', mineCode: facultyCode(p.faculty || ''), active: board === 'faculty', mascot: facultyArt(p.faculty) })}
    <section class="oz-lg-board oz-lg-refs" id="league-referrals" tabindex="-1" aria-labelledby="leagues-title"${refs ? '' : ' hidden'}>
      <ol class="oz-lg-ranks oz-lg-ref-list" id="referral-list" aria-label="Top referrers"><li class="oz-lg-row skeleton"></li></ol>
      <section class="oz-lg-invite" aria-labelledby="invite-title">
        <div class="oz-lg-invite-head"><span class="oz-lg-invite-ic" aria-hidden="true">${ozIcon('friend-add')}</span>
          <div><h2 id="invite-title">Invite a friend</h2><p>Referrals count toward Top referrers</p></div></div>
        <div class="oz-lg-code"><strong data-no-i18n>${esc(p.referralCode || '')}</strong><button type="button" class="oz-lg-link" id="copy-referral" aria-label="Copy referral code">Copy</button></div>
        ${ozButton('Share invite', { kind: 'primary', block: true, attr: { id: 'share-referral' } })}
      </section>
    </section>
  </div>`;
}

function leagueRules(app, kind) {
  const kk = kind === 'kk';
  const el = sheet(`<div class="oz-lg-rules"><h2>${kk ? 'How the KK League is scored' : 'How the Faculty League is scored'}</h2>
    <ul>
      <li>${kk ? 'Every point you earn adds to your residential college (KK).' : 'Your earned points also count for your faculty, whichever college you live in.'}</li>
      <li>Positive earned points count, excluding welfare grants. Spending or donating never lowers a score.</li>
      <li>Deleted accounts no longer contribute.</li>
      <li>${kk ? 'Every college is listed, including colleges with no points yet.' : 'Every faculty is listed, including faculties with no points yet.'}</li>
      <li>Entries with the same points share a rank.</li>
      <li>The server keeps the totals; this page updates by itself.</li>
      ${kk ? '<li>The KK with the most points wins prizes!</li>' : ''}
    </ul>
    ${kk ? ozButton('Show me around', { kind: 'secondary', attr: { 'data-tour': '' } }) : ''}</div>`);
  const tour = $('[data-tour]', el);
  if (tour) tour.onclick = () => { closeSheet(); Guide.startPageTour(app, 'leagues', { replay: true }); };
}

function fillLeague(root, totals, { keys, mineKey, noun, nameOf, codeOf, artOf, crest = true, empty }) {
  const pod = $('[data-podium]', root), list = $('[data-board]', root); if (!pod || !list) return;
  if (!totals) { pod.innerHTML = ''; list.innerHTML = `<li class="oz-lg-empty">${esc('Scores are syncing.')}</li>`; return; }
  const rows = rankLeague(totals, keys);
  const mine = rows.find((r) => r.key === mineKey);
  const rankEl = $('[data-rank]', root), ptsEl = $('[data-points]', root);
  if (rankEl) { rankEl.textContent = mine && mine.points > 0 ? '#' + mine.rank : '—'; rankEl.hidden = !(mine && mine.points > 0); } // no ribbon until it ranks
  if (ptsEl) ptsEl.textContent = `${n(mine ? mine.points : 0)} pts`;
  raceBanner(root, rows, mine, { codeOf, artOf });
  // Everyone is listed (Leagues: "be transparent"): ranked entries as rows, and those with no points yet in a compact
  // "Yet to score" grid underneath instead of a long run of "– 0 pts" rows.
  const wrap = $('[data-unranked-wrap]', root), un = $('[data-unranked]', root);
  const unranked = rows.filter((r) => r.points <= 0);
  const fillUnranked = () => {
    if (!wrap || !un) return;
    wrap.hidden = !unranked.length; $('[data-unranked-count]', root).textContent = unranked.length ? `· ${unranked.length}` : '';
    un.innerHTML = unranked.map((r) => leagueRow(r, { mine: r.key === mineKey, noun, nameOf, codeOf, artOf, crest, rows, compact: true })).join('');
  };
  if (!rows.some((r) => r.points > 0)) {
    pod.innerHTML = ''; list.classList.add('is-flat'); list.hidden = false;
    list.innerHTML = `<li class="oz-lg-empty">${ozEmpty({ title: empty, mascot: false })}</li>`;
    fillUnranked();
    return;
  }
  // Only entries that have earned points stand on the podium; empty places say so rather than leaving a gap.
  const podium = rows.slice(0, 3).filter((r) => r.points > 0), rest = rows.slice(podium.length).filter((r) => r.points > 0);
  pod.innerHTML = podium.map((r, i) => `<li class="oz-lg-pod${r.key === mineKey ? ' is-mine' : ''}" aria-label="${esc(`#${r.rank} ${codeOf(r.key)}, ${n(r.points)} pts`)}">
    <span class="oz-lg-pod-place">${ozIcon(i ? 'medal' : 'leagues')}<span data-no-i18n>#${r.rank}</span></span>
    <span class="oz-lg-pod-art" aria-hidden="true">${artOf(r.key)}</span>
    <strong class="oz-lg-pod-name" data-no-i18n>${esc(codeOf(r.key))}</strong><span class="oz-lg-pod-pts">${n(r.points)} pts</span></li>`).join('');
  // No placeholder cards for places nobody holds yet (they were mostly empty space). The podium sizes to what's
  // there: one leader is a single row card, two share the width, three is the full podium.
  pod.dataset.count = String(podium.length);
  list.innerHTML = rest.map((r) => leagueRow(r, { mine: r.key === mineKey, noun, nameOf, codeOf, artOf, crest, rows })).join('');
  list.hidden = !rest.length;
  fillUnranked();
  list.classList.remove('is-flat');
  list.style.setProperty('--oz-lg-half', String(Math.max(1, Math.ceil(rest.length / 2)))); // web: two rank columns
}
// Race card (HOD request). Mobbin: Brilliant / Mimo / Transit (the team emblem big and centred with a rank ribbon),
// Life Reset ("166 XP to Silver IV"), Fi (you between your neighbours). Your KK's lion or your faculty's mascot, then a track: the entry behind runs along the lime fill toward the
// entry ahead (you chasing the place above, or the runner-up chasing you at #1). Real scores only.
function raceBanner(root, rows, mine, { codeOf, artOf }) {
  const card = $('.oz-lg-race', root), track = $('[data-track]', root), gap = $('[data-gap]', root); if (!card) return;
  const onzo = $('.oz-lg-race-me svg', card); // college lions have a face; faculty mascots are artwork
  if (onzo && mine && mine.points > 0 && !card.dataset.cheered) { card.dataset.cheered = '1'; AV.showExpression(onzo, mine.rank === 1 ? 'celebrate' : 'happy', 1800); }
  if (!track) return;
  let runner, goal, text;
  if (mine && mine.points > 0) {
    const above = rows.filter((r) => r.points > mine.points).at(-1);
    const chaser = rows.find((r) => r.points < mine.points && r.points > 0);
    if (above) { runner = mine; goal = above; text = `${n(above.points - mine.points)} pts to pass ${codeOf(above.key)}`; }
    else if (rows.filter((r) => r.points === mine.points).length > 1) text = `Tied at #${mine.rank}`;
    else if (chaser) { runner = chaser; goal = mine; text = `${n(mine.points - chaser.points)} pts ahead of ${codeOf(chaser.key)}`; }
  }
  gap.textContent = text || ''; gap.hidden = !text; track.hidden = !runner;
  if (!runner) { track.innerHTML = ''; return; }
  const pct = runner ? Math.max(4, Math.min(100, Math.round(runner.points / goal.points * 100))) : 100;
  const crest = (r, where) => `<span class="oz-lg-race-crest${r === mine ? ' is-mine' : ''}" style="${where}">${artOf(r.key)}</span>`;
  track.innerHTML = (runner ? `<div class="oz-lg-race-bar" role="progressbar" aria-label="${esc(text)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
      <span class="oz-lg-race-rail"></span><i style="width:${pct}%"></i>
      ${crest(goal, 'left:calc(100% - 16px)')}${crest(runner, `left:clamp(16px, ${pct}%, calc(100% - 56px))`)}</div>` : '');
}
function leagueRow(r, { mine, noun, nameOf, codeOf, artOf, crest, rows, compact = false }) {
  const name = nameOf(r.key), code = codeOf(r.key);
  return `<li class="oz-lg-row${compact ? ' is-unranked' : ''}${mine ? ' is-mine' : ''}" data-key="${esc(r.key)}"${mine ? ' tabindex="-1"' : ''}>
    <span class="oz-lg-rank" data-no-i18n${r.points > 0 ? '' : ' aria-label="Unranked"'}>${r.points > 0 ? '#' + r.rank : '–'}</span>
    <span class="oz-lg-crest${crest ? '' : ' is-plain'}" aria-hidden="true">${artOf(r.key)}</span>
    <span class="oz-lg-name"><strong data-no-i18n>${esc(name)}</strong>${name !== code ? `<small data-no-i18n>${esc(code)}</small>` : ''}
      ${mine ? `<em class="oz-lg-gap">${esc(leagueGap(rows, r, noun))}</em>` : ''}</span>
    <span class="oz-lg-pts">${n(r.points)} pts</span></li>`;
}

function leaguesMount(root, app, [section] = []) {
  const board = leagueBoardOf(section);
  const target = $(`#league-${board}`, root);
  if (section && target) target.focus({ preventScroll: true });
  const p = app.profile;
  const facultyNames = new Set(D.FACULTIES);
  // The first time a student opens Leagues on the KK board, explain the KK League once the leaderboard is on screen.
  // "Scoring rules" explains the scoring and can replay the tour.
  let tourTried = board !== 'kk';
  $('#league-help', root).onclick = () => leagueRules(app, 'kk');
  $$('[data-rules]', root).forEach((b) => { b.onclick = () => leagueRules(app, 'faculty'); });
  $$('[data-find]', root).forEach((b) => { b.onclick = () => {
    const row = $('.oz-lg-row.is-mine, .oz-lg-pod.is-mine', b.closest('.oz-lg-board'));
    if (row) { row.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); if (row.tabIndex === -1) row.focus({ preventScroll: true }); row.classList.add('is-found'); setTimeout(() => row.classList.remove('is-found'), 1600); }
  }; });
  $$('[data-totop]', root).forEach((b) => { b.onclick = () => { scrollTo({ top: 0, behavior: 'smooth' }); $('#leagues-title', root)?.focus?.({ preventScroll: true }); }; });
  const colleges = D.COLLEGES.map(([k]) => k).filter((k) => k !== 'OFF');
  const collegeName = (k) => D.COLLEGES.find(([c]) => c === k)?.[1] || k;
  const stop = D.watchStats(app.ctx, 'league', (s) => {
    if (!tourTried) { tourTried = true; setTimeout(() => { if (root.isConnected) Guide.startPageTour(app, 'leagues'); }, 350); }
    fillLeague($('#league-kk', root), s ? s.colleges || {} : null, { keys: colleges, mineKey: p.college, noun: 'college',
      nameOf: (k) => k, codeOf: (k) => k, artOf: (k) => AV.collegeLionSVG(k, { size: 40 }), empty: 'No points earned yet. Get your KK started.' });
    $$('#league-kk .oz-lg-row', root).forEach((li) => li.setAttribute('aria-label', `${collegeName(li.dataset.key)}, ${li.querySelector('.oz-lg-pts').textContent}`));
    // Only real faculties are shown, so a made-up faculty name can never appear on the public board.
    const faculties = s ? Object.fromEntries(Object.entries(s.faculties || {}).filter(([k]) => facultyNames.has(k))) : null;
    fillLeague($('#league-faculty', root), faculties, { keys: D.FACULTIES.filter((f) => f !== 'Other'), mineKey: p.faculty, noun: 'faculty',
      nameOf: (k) => FACULTY_INFO[k]?.[1] || k, codeOf: facultyCode, artOf: facultyArt, crest: false, empty: 'No points earned yet. Get your faculty started.' });
  }, () => { $$('[data-board]', root).forEach((el) => { el.innerHTML = `<li class="oz-lg-empty">${esc('League is temporarily unavailable.')}</li>`; }); $$('[data-podium]', root).forEach((el) => { el.innerHTML = ''; }); });
  const stopRefs = D.watchStats(app.ctx, 'referrals', (s) => {
    const el = $('#referral-list', root); if (!el) return;
    const top = s?.top || [];
    el.innerHTML = top.length ? top.map((r, i) => `<li class="oz-lg-row${r.uid === app.ctx.uid ? ' is-mine' : ''}">
      <span class="oz-lg-rank" data-no-i18n>#${i + 1}</span><span class="oz-lg-crest" aria-hidden="true">${AV.collegeLionSVG(r.college, { size: 40 })}</span>
      <span class="oz-lg-name"><strong data-no-i18n>${esc(r.label)}</strong>${r.college || r.uid === app.ctx.uid ? `<small class="oz-lg-ref-meta">${r.college ? `<span data-no-i18n>${esc(r.college)}</span>` : ''}${r.college && r.uid === app.ctx.uid ? ' · ' : ''}${r.uid === app.ctx.uid ? '<em class="oz-lg-gap">You</em>' : ''}</small>` : ''}</span>
      <span class="oz-lg-pts">${n(r.count)} ${r.count === 1 ? 'friend' : 'friends'}</span></li>`).join('')
      : `<li class="oz-lg-ref-empty">${ozEmpty({ title: 'No one has joined with a code yet. Be the first.' })}</li>`;
  }, () => { const el = $('#referral-list', root); if (el) el.innerHTML = `<li class="oz-lg-empty">${esc('The board is temporarily unavailable.')}</li>`; });
  $('#copy-referral', root).onclick = (e) => motion.copyWithFeedback(e.currentTarget, p.referralCode, 'Couldn’t copy. Select the referral code to copy it manually.');
  $('#share-referral', root).onclick = async () => {
    const text = tr(`Join +Onz, UM’s campus app for merchants, events and rewards. Enter my referral code ${p.referralCode} when you sign up: ${location.origin}${location.pathname}`);
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Referral message copied. Paste it to a friend.'); } } catch { /* cancelled */ }
  };
  return () => { stop(); stopRefs(); };
}

// ------------------------------------------------------------- Komuniti Kita: colleges, welfare, ventures
async function communityRender(app, [section] = []) {
  const friends = await friendsRender(app);
  const overviewOn = D.featureOn(app.rules, 'overview');
  // Figma Community (441:1092 friends, 441:1156 requests, 492:7479 fund): a Friends / Requests / Fund segmented control
  // over the production sections. Leagues has its own tab in the nav, and referrals live on Me.
  const tab = communityTabOf(section);
  const tabs = `<div class="oz-seg oz-ctabs" role="tablist" aria-label="Community">${COMMUNITY_TABS.map(([k, label]) =>
    `<button type="button" role="tab" class="oz-seg-item" data-ctab="${k}" aria-selected="${k === tab}"><span>${label}</span>${k === 'fund' ? '' : ` <span class="oz-ctab-count" data-ctab-count="${k}" data-no-i18n></span>`}</button>`).join('')}</div>`;
  const venturesRow = overviewOn ? ozListRow({ title: 'Student ventures', sub: 'Find student-run businesses around campus', iconName: 'stall', href: '#/explore/idea', cls: 'oz-cventures' }) : '';
  const aside = venturesRow ? `<div class="oz-caside"><h2 class="oz-caside-title">Campus connections</h2>${venturesRow}</div>` : '';
  const circle = friends.replace('<nav class="community-shortcuts"', `${tabs}<nav class="community-shortcuts"`).replace('</nav>', `</nav>${aside}`);
  return `<div class="community-page${section === 'add' ? ' is-adding' : ''}" data-ctab="${tab}"><section class="community-circle" id="community-circle" aria-label="Your circle" tabindex="-1">${circle}</section>
    <div class="community-main-grid"><div class="community-welfare-pair" id="community-welfare" tabindex="-1"><section class="community-welfare" aria-labelledby="welfare-title"><span class="community-heart" aria-hidden="true">${icon('hand-heart')}</span>
      <h2 id="welfare-title">Student welfare fund</h2>
      <div class="community-welfare-total"><strong id="welfare">—</strong><span class="community-welfare-caption">points available</span></div>
      <button class="oz-btn oz-btn-primary oz-btn-md" type="button" id="donate">Give points</button></section>
    <section class="community-support" aria-labelledby="support-title"><span class="community-support-icon" aria-hidden="true">${icon('wallet')}</span><h2 id="support-title">Need support?</h2><p>Up to 1,000 pts per request</p>
      <button class="oz-btn oz-btn-ghost oz-btn-md" type="button" id="request-welfare">Request points</button>
      <details class="welfare-history oz-smooth"><summary>My requests <span id="welfare-request-count">0</span>${icon('chevron-right')}</summary><div id="welfare-requests"><div class="oz-skel-list" role="status"><span class="visually-hidden">Loading requests…</span><span class="oz-skel oz-skel-row"></span><span class="oz-skel oz-skel-row"></span></div></div></details>
    </section></div></div></div>`;
}
const COMMUNITY_TABS = [['friends', 'Friends'], ['requests', 'Requests'], ['fund', 'Fund']];
const communityTabOf = (section) => ({ requests: 'requests', sent: 'requests', fund: 'fund', welfare: 'fund' }[section] || 'friends');
function communityMount(root, app, [section] = []) {
  const stopFriends = friendsMount(root, app);
  if (section === 'league') { location.hash = '#/leagues'; return stopFriends; }
  const page = $('.community-page', root);
  const show = (k, focus) => {
    page.dataset.ctab = k;
    $$('[data-ctab]', page).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ctab === k)));
    history.replaceState(null, '', k === 'friends' ? '#/community' : `#/community/${k}`);
    if (focus) $({ friends: '#community-circle', requests: '#friend-lists', fund: '#community-welfare' }[k], root)?.focus({ preventScroll: true });
  };
  $$('button[data-ctab]', page).forEach((b) => { b.onclick = () => show(b.dataset.ctab, true); });
  // Figma 915:33979 shows no search card: Add friends opens it in place, just under the button.
  const addBtn = $('.community-shortcuts [data-friends-jump="friend-search"]', page);
  if (addBtn) {
    addBtn.setAttribute('aria-expanded', String(page.classList.contains('is-adding')));
    // The button toggles the search open (slides down under it, input focused) and closed (slides back up).
    addBtn.onclick = () => {
      const form = $('#friend-search', page), open = !page.classList.contains('is-adding');
      addBtn.setAttribute('aria-expanded', String(open));
      if (open) {
        page.classList.add('is-adding'); motion.slideOpen(form);
        const input = $('#friend-search input', page); (input && !input.disabled ? input : form)?.focus({ preventScroll: true });
      } else motion.slideClose(form).then(() => page.classList.remove('is-adding'));
    };
  }
  // The tab counts mirror the live friend totals that friends.js keeps up to date.
  const mirror = () => {
    const set = (k, id) => { const el = $(`[data-ctab-count="${k}"]`, root), v = $('#' + id, root)?.textContent; if (el) el.textContent = v && v !== '—' ? v : ''; };
    set('friends', 'friends-total'); set('requests', 'friends-incoming');
  };
  const obs = new MutationObserver(mirror);
  $$('#friends-total, #friends-incoming', root).forEach((el) => obs.observe(el, { childList: true, characterData: true, subtree: true })); mirror();
  const target = { friends: '#community-circle', add: '#friend-search', welfare: '#community-welfare', fund: '#community-welfare', requests: '#friend-lists' }[section];
  if (target) {
    const el = $(target, root);
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'start' });
  }
  const u2 = D.watchStats(app.ctx, 'welfare', (s) => { const el = $('#welfare', root); if (el) countUp(el, s?.points || 0); }, () => {});
  $('#donate', root).onclick = () => {
    // Mobbin (Alan "How many … do you want to give?", Whatnot tip presets): one question, one amount, presets, one action.
    const have = app.profile.points, start = Math.min(50, have);
    const el = sheet(`<div class="oz-fsheet"><h2 class="oz-fsheet-title">How many points to give?</h2>
      <form id="don" class="oz-fsheet-form">
        <label class="oz-amount"><span class="oz-sr">Points to give</span><input name="pts" type="number" inputmode="numeric" min="1" max="${have}" step="1" required value="${start}"><span class="oz-amount-unit">pts</span></label>
        <p class="oz-fsheet-fine">You have ${n(have)} pts</p>
        <div class="oz-fsheet-presets">${[20, 50, 100, 250].map((v) => `<button type="button" class="oz-chip" data-v="${v}" aria-pressed="${v === start}" ${v > have ? 'disabled' : ''}><span>${v}</span></button>`).join('')}</div>
        <button class="oz-btn oz-btn-primary oz-btn-md oz-btn-block go"><span>Give <span data-give>${n(start)}</span> pts</span></button></form></div>`);
    const ptsIn = el.querySelector('[name=pts]');
    const sync = () => { const v = Math.max(0, Math.floor(+ptsIn.value) || 0); $('[data-give]', el).textContent = n(v); $$('[data-v]', el).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.v === v))); };
    ptsIn.oninput = sync;
    $$('[data-v]', el).forEach((b) => { b.onclick = () => { ptsIn.value = b.dataset.v; sync(); }; });
    $('#don', el).onsubmit = (e) => {
      e.preventDefault(); const v = Math.floor(+e.target.pts.value);
      if (!v || v < 1) return; if (v > app.profile.points) return toast('You don’t have that many points.', true);
      busy($('button.go', el), async () => { try { await D.donatePoints(app.ctx, v); closeSheet(); confetti(); toast(`Thank you. ${v} points given.`); } catch (err) { toast(errText(err), true); } });
    };
  };
  $('#request-welfare', root).onclick = () => {
    const el = sheet(`<div class="oz-fsheet"><h2 class="oz-fsheet-title">Request welfare points</h2>
      <form id="welfare-request-form" class="oz-fsheet-form">
        <label class="oz-amount"><span class="oz-sr">Points requested</span><input name="amount" type="number" inputmode="numeric" min="1" max="${D.WELFARE_MAX_POINTS}" step="1" placeholder="0" required><span class="oz-amount-unit">pts</span></label>
        <p class="oz-fsheet-fine">Up to ${n(D.WELFARE_MAX_POINTS)} pts per request</p>
        <label class="oz-composer-box"><span class="oz-sr">What do you need help with?</span><textarea name="reason" rows="3" minlength="10" maxlength="1000" placeholder="What do you need help with?" required></textarea></label>
        <button class="oz-btn oz-btn-primary oz-btn-md oz-btn-block" type="submit"><span>Send request</span></button>
        <p class="oz-fsheet-fine">Only you and the Admin team see this</p></form></div>`);
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
  return () => { obs.disconnect(); stopFriends(); u2(); u3(); };
}

// ------------------------------------------------------------- avatar editor
// Wardrobe (Figma 15 · Wardrobe · Hats 696:13625, Colours 696:13693, Eyewear 783:1914, Scarves 783:1971,
// Backgrounds 783:2028, Unlock 696:13752; Web 929:35008). Two modes: Faculty looks (whole outfits) and Mix & match
// (hats, eyewear, scarves, colours, backgrounds). Hats and colours unlock with levels; your own faculty's outfit is free;
// nothing here is bought with points (the Onzo shop is not built).
// Art placement inside a 108 px tile, copied from the frames: [left, top, width] in tile pixels.
const HAT_TILE = { beanie: [5.39, 27.99, 97.22], cap: [3.31, 26.47, 92.28], mushroom: [8.81, 17.86, 88.61], grad: [14.23, 20.14, 79.55],
  crown: [7.33, 18.57, 93.33], songkok: [4.7, 9.12, 98.59], party: [0.7, 27.1, 98.6], headband: [2.3, 21.6, 87.5] };
const HAT_REACTION = { party: 'celebrate', crown: 'love', cap: 'wink', headband: 'wink' };
const WEAR_TILE = { round: [-5.65, -47.51, 119.3], 'campus-scarf': [-8.96, -52.15, 125.93] };
const WARDROBE_CATEGORIES = [
  ['av-hats', 'Hats', '<img src="assets/onz/hats/beanie.svg" alt="" class="av-ci-hat">'],
  ['av-eyewear', 'Eyewear', '<img src="assets/onz/eyewear/round.svg" alt="" class="av-ci-eye">'],
  ['av-neck', 'Scarves', '<img src="assets/onz/neck/campus-scarf.svg" alt="" class="av-ci-neck">'],
  ['av-colours', 'Colours', '<span class="av-colour-dot"></span>'],
  ['av-backdrops', 'Backgrounds', '<span class="av-bg-swatch"></span>'],
];
const pct = (v) => `${(v / 1.08).toFixed(2)}%`;
async function avatarRender(app) {
  return `<div class="oz-wardrobe">
    <h1 class="av-title" id="av-title"><span>Wardrobe</span><span class="av-title-cat" aria-hidden="true"> · <span id="av-title-cat">Hats</span></span></h1>
    <div class="av-stage" aria-label="Live preview">
      <img class="av-stage-bg" id="av-bg" src="assets/onz/backgrounds/sky.svg" alt=""><img class="av-stage-contact" src="assets/onz/stage/contact.svg" alt="">
      <div id="av-prev"></div>
      <a class="av-float av-close" href="#/me" aria-label="Back to Me">${ozIcon('s:close')}</a>
      <a class="av-points" href="#/me/history" aria-label="Your points"><span class="av-coin" aria-hidden="true"></span><span data-bind="points">${n(app.profile.points || 0)}</span></a>
      <button type="button" class="av-save-pill" id="av-save">Save</button>
      <div class="av-float-stack"><button type="button" class="av-float" id="av-rand" aria-label="Shuffle">${ozIcon('search')}</button>
        <button type="button" class="av-float" id="av-reset" aria-label="Undo changes"><span class="av-undo" aria-hidden="true">↶</span></button>
        <button type="button" class="av-float" id="av-full" aria-label="Full view" aria-pressed="false">${ozIcon('share')}</button></div>
    </div>
    <div class="av-sheet" id="av-panel">
      <div class="av-modes" role="tablist" aria-label="Wardrobe">
        <button type="button" role="tab" data-mode="looks" aria-selected="false">${ozIcon('hat')}<span>Faculty looks</span></button><i aria-hidden="true"></i>
        <button type="button" role="tab" data-mode="mix" aria-selected="true">${ozIcon('edit')}<span>Mix &amp; match</span></button>
      </div>
      <div class="av-mode" data-panel="looks" hidden><div class="av-opts av-opts-looks" data-group="look"></div>
        <p class="av-note">Your faculty’s outfit is yours to wear. The other faculty outfits are coming soon.</p></div>
      <div class="av-mode" data-panel="mix">
        <div class="av-categories" role="tablist" aria-label="Item type">${WARDROBE_CATEGORIES.map(([id, label, art], i) =>
          `<button type="button" role="tab" aria-controls="${id}" aria-pressed="${!i}" aria-selected="${!i}" aria-label="${label}" data-cat="${label}">
            <span class="av-cat-icon">${art}</span><i class="av-cat-bar"></i></button>`).join('')}</div>
        <div class="av-category" id="av-hats" role="tabpanel" aria-label="Hats"><div class="av-opts" data-group="hat"></div></div>
        <div class="av-category" id="av-eyewear" role="tabpanel" aria-label="Eyewear" hidden><div class="av-opts" data-group="eyewear"></div></div>
        <div class="av-category" id="av-neck" role="tabpanel" aria-label="Scarves" hidden><div class="av-opts" data-group="neck"></div></div>
        <div class="av-category" id="av-colours" role="tabpanel" aria-label="Colours" hidden><div class="av-opts" data-group="onz"></div></div>
        <div class="av-category" id="av-backdrops" role="tabpanel" aria-label="Backgrounds" hidden><div class="av-opts" data-group="backdrop"></div></div>
      </div>
    </div></div>`;
}
function avatarMount(root, app) {
  let start = AV.clean(myAvatar(app)); let a = structuredClone(start);
  const earned = earnedTotal(app.ledger); const lvl = levelOf(earned).name;
  const faculty = app.profile.faculty || '';
  const WEAR_KEYS = { look: AV.LOOKS, eyewear: AV.EYEWEAR, neck: AV.NECKWEAR, backdrop: AV.BACKDROPS };
  const current = (k) => (WEAR_KEYS[k] ? a.wear[k] : a[k]);
  const isLocked = (k, id) => (k === 'hat' ? !AV.hatUnlocked(id, lvl, LEVEL_NAMES) : k === 'onz' ? !AV.skinUnlocked(id, lvl, LEVEL_NAMES)
    : k === 'look' ? !AV.lookUnlocked(id, faculty) : false);
  // Tiles: hats show the hat; colours that colour's Onzo; eyewear and scarves the item; backgrounds the scene;
  // faculty looks your Onzo wearing the outfit. Locked items name the level (or "Coming soon") that unlocks them.
  const tile = (k, item) => {
    const [id, name, lock] = item; const locked = isLocked(k, id);
    let art = '', label = '', chip = '';
    if (k === 'hat') { const at = HAT_TILE[id]; art = id === 'none' ? '<span class="av-none"></span>' : `<img src="assets/onz/hats/${id}.svg" alt="" style="left:${pct(at[0])};top:${pct(at[1])};width:${pct(at[2])}">`; }
    else if (k === 'onz') art = AV.avatarSVG({ ...a, onz: id, hat: 'none', wear: { ...a.wear, look: 'none', eyewear: 'none', neck: 'none' } }, { size: 133, bg: false });
    else if (k === 'eyewear' || k === 'neck') { const at = WEAR_TILE[id]; art = id === 'none' ? '<span class="av-none"></span>' : `<img src="assets/onz/${k === 'neck' ? 'neck' : 'eyewear'}/${id}.svg" alt="" style="left:${pct(at[0])};top:${pct(at[1])};width:${pct(at[2])}">`; label = name; }
    else if (k === 'backdrop') { art = `<img class="av-bg-thumb" src="assets/onz/backgrounds/${id}.svg" alt="">`; label = name; }
    else if (k === 'look') { art = id === 'none' ? '<span class="av-none"></span>' : AV.avatarSVG({ ...a, hat: 'none', wear: { ...a.wear, look: id, eyewear: 'none', neck: 'none' } }, { size: 92, bg: false }); label = id === 'none' ? 'None' : id.toUpperCase(); }
    if (locked) chip = k === 'look' ? 'Coming soon' : (lock === 'Campus champion' ? 'Champion' : lock);
    else if (k === 'onz') chip = name;
    else if (k === 'look' && id !== 'none') chip = 'Yours';
    const aria = k === 'look' && id !== 'none' ? `${item[2]}, ${id.toUpperCase()}` : name;
    return `<button type="button" class="av-tile av-tile-${k}" data-k="${k}" data-v="${esc(id)}" aria-pressed="${current(k) === id}" aria-label="${esc(aria)}${locked ? ` (${esc(chip)})` : ''}" ${locked ? 'data-locked="1"' : ''}>
      <span class="av-thumb">${art}</span>${label ? `<span class="av-tile-label"${k === 'look' ? ' data-no-i18n' : ''}>${esc(label)}</span>` : ''}
      ${k === 'look' && locked ? `<span class="av-lock-ic" aria-hidden="true">${ozIcon('lock')}</span>` : chip ? `<span class="${locked && k !== 'onz' ? 'av-lock-pill' : 'av-name'}">${esc(chip)}</span>` : ''}
      <span class="av-check" aria-hidden="true">${ozIcon('check')}</span></button>`;
  };
  const LISTS = { hat: AV.HATS, eyewear: AV.EYEWEAR, neck: AV.NECKWEAR, backdrop: AV.BACKDROPS, onz: AV.ONZ_SKINS, look: [['none', 'None'], ...AV.LOOKS] };
  const fill = (k) => { $(`[data-group="${k}"]`, root).innerHTML = LISTS[k].map((x) => tile(k, x)).join(''); };
  ['hat', 'eyewear', 'neck', 'backdrop'].forEach(fill);
  // Mode tabs (Faculty looks / Mix & match) and item-type tabs.
  const modes = $$('.av-modes [data-mode]', root);
  modes.forEach((b) => { b.onclick = () => {
    modes.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    $$('.av-mode', root).forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.mode; });
    $('#av-title-cat', root).textContent = b.dataset.mode === 'looks' ? 'Faculty looks' : $('.av-categories [aria-selected="true"]', root).dataset.cat;
  }; });
  const categories = $$('.av-categories button', root);
  categories.forEach((button) => {
    button.onclick = () => categories.forEach((item) => {
      const selected = item === button;
      item.setAttribute('aria-pressed', String(selected)); item.setAttribute('aria-selected', String(selected));
      $('#' + item.getAttribute('aria-controls'), root).hidden = !selected;
      if (selected) $('#av-title-cat', root).textContent = item.dataset.cat;
    });
  });
  const wardrobe = $('.oz-wardrobe', root);
  $('#av-full', root).onclick = (e) => {
    const on = wardrobe.classList.toggle('is-full');
    e.currentTarget.setAttribute('aria-pressed', String(on));
  };
  let cancelFace = () => {}; // the expression currently on Onzo (hat reaction or poke)
  let dirty = false; // any change since the last save (drives the leave-without-saving prompt)
  const paint = (changed) => {
    if (changed) dirty = true;
    const prev = $('#av-prev', root); const before = prev.innerHTML;
    prev.innerHTML = AV.avatarSVG(a, { size: 200, bg: false, title: 'Your Onzo' });
    // Animate only the piece that went on (a hat drops onto the head), not a jump of the whole Onzo.
    if (changed) motion.wear(prev, changed === true ? 'all' : changed, before);
    if (changed === 'hat' && a.hat !== 'none') {
      cancelFace?.(); cancelFace = AV.showExpression(prev.querySelector('svg'), HAT_REACTION[a.hat] || 'happy', 1200);
      if (a.hat === 'party') motion.burst(prev, { x: .5, y: .1 });
    }
    const bg = $('#av-bg', root); const src = `assets/onz/backgrounds/${a.wear.backdrop}.svg`;
    if (!bg.src.endsWith(src)) motion.crossfade(bg, src);
    fill('onz'); fill('look');
    $$('.av-opts [data-k]', root).forEach((b) => b.setAttribute('aria-pressed', String(current(b.dataset.k) === b.dataset.v)));
  };
  // Locked item: the Unlock sheet (696:13752) with real progress from the points policy.
  const unlockSheet = (k, id) => {
    const item = LISTS[k].find((x) => x[0] === id);
    if (k === 'look') {
      sheet(`<div class="av-unlock"><div class="av-unlock-art">${AV.avatarSVG({ onz: a.onz, wear: { look: id } }, { size: 120, bg: false })}</div>
        <h2>${esc(item[2])}</h2>${ozTag('Coming soon', 'lilac')}
        <p>Each student wears their own faculty’s outfit for free. The other faculty outfits are coming soon.</p>
        ${ozButton('Back to wardrobe', { kind: 'ghost', block: true, attr: { 'data-close': '' } })}</div>`);
      return;
    }
    const level = LEVELS.find((l) => l[1] === item[2]); const need = level ? level[0] : 0;
    const art = k === 'hat' ? `<img src="assets/onz/hats/${id}.svg" alt="" class="av-unlock-hat">` : AV.avatarSVG({ ...a, onz: id, hat: 'none' }, { variant: 'head', size: 112, bg: false });
    sheet(`<div class="av-unlock"><div class="av-unlock-art">${art}</div><h2>${esc(item[1])}</h2>
      ${ozTag(`Unlocks at ${item[2]}`, 'lilac')}
      <div class="av-unlock-progress" role="img" aria-label="${n(Math.min(earned, need))} of ${n(need)} points earned"><span class="av-unlock-bar"><i style="width:${need ? Math.min(100, Math.round((earned / need) * 100)) : 100}%"></i></span><strong>${n(Math.min(earned, need))} / ${n(need)} pts</strong></div>
      ${ozButton(`Earn ${n(Math.max(0, need - earned))} more points`, { kind: 'primary', block: true, href: '#/points', attr: { 'data-close': '' } })}
      <button type="button" class="av-unlock-back" data-close>Back to wardrobe</button></div>`);
  };
  // root is the shared #view: this listener must be removed when the page unmounts (see the return below). It used
  // to stay attached, so a second visit ran two handlers: the stale one repainted the tiles first, the current one then
  // saw a detached button and ignored the click, and Save stored the old look ("sometimes it doesn't save").
  const onPick = (e) => {
    const b = e.target.closest('button[data-k]'); if (!b || !root.contains(b)) return;
    const k = b.dataset.k; let v = b.dataset.v;
    if (b.dataset.locked) return unlockSheet(k, v);
    // Tapping the glasses, scarf or hat you're wearing takes it off (as outfit pickers do); "None" still works too.
    const removable = k === 'eyewear' || k === 'neck' || k === 'hat';
    const was = current(k);
    if (removable && v !== 'none' && was === v) v = 'none';
    if (WEAR_KEYS[k]) a.wear = { ...a.wear, [k]: v }; else a[k] = v;
    paint(k === 'backdrop' ? false : removable && v === 'none' && was !== 'none' ? k + ':off' : k); // the background cross-fades on its own
  };
  root.addEventListener('click', onPick);
  $('#av-rand', root).onclick = () => {
    const pick = (k) => { const open = LISTS[k].filter((x) => !isLocked(k, x[0])); return open[Math.floor(Math.random() * open.length)][0]; };
    a = { ...a, onz: pick('onz'), hat: pick('hat'), wear: { ...a.wear, eyewear: pick('eyewear'), neck: pick('neck'), backdrop: pick('backdrop') } }; paint(true);
  };
  $('#av-reset', root).onclick = () => { a = structuredClone(start); paint(true); dirty = false; };
  $('#av-save', root).onclick = (e) => busy(e.currentTarget, async () => {
    try {
      const saved = AV.clean(a);
      await D.saveAvatar(app.ctx, saved);
      // Use the saved look right away: the profile listener updates app.profile a moment later, and pages rendered
      // before it fired (Me, Home's hero, the header picture) showed the old Onzo.
      app.profile = { ...app.profile, avatar: saved }; app.ctx.profile = app.profile; start = structuredClone(a); dirty = false;
      toast('Onzo saved.'); confetti(); app.go('me');
    } catch (err) { toast(errText(err), true); }
  });
  // Leaving with unsaved changes asks first (they were silently dropped before, which read as "it didn't save").
  const closeLink = $('.av-close', root);
  if (closeLink) closeLink.onclick = async (e) => {
    if (!dirty) return;
    e.preventDefault();
    if (await confirmSheet('Leave without saving?', 'Your changes to Onzo will be lost.', 'Leave')) { dirty = false; app.go('me'); }
  };
  paint(false);
  // Poke Onzo: each tap shows the next expression from the Figma set (416:8732) with a small emote, then back to Calm.
  const stagePrev = $('#av-prev', root);
  const POKES = ['happy', 'wink', 'love', 'surprised', 'celebrate', 'shy'];
  let pokeAt = 0;
  const pokeOnzo = () => {
    cancelFace();
    const name = POKES[pokeAt++ % POKES.length];
    cancelFace = AV.showExpression(stagePrev.querySelector('svg'), name);
    motion.poke(stagePrev, name);
  };
  stagePrev.setAttribute('role', 'button'); stagePrev.tabIndex = 0; stagePrev.setAttribute('aria-label', 'Poke Onzo');
  stagePrev.onclick = pokeOnzo;
  stagePrev.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pokeOnzo(); } };
  return () => { root.removeEventListener('click', onPick); cancelFace(); };
}

// Me and its pages (Figma 13 · Me 441:2458, Edit profile 449:5060, Points history 449:5109, Account menu 525:10476,
// Settings 449:5184, Language 593:12444; web 915:34264 and 938:50726). #/me is the hub; the rest are pushed pages.
const ME_PAGES = {
  profile: { title: 'Edit profile', back: ['#/me', 'Me'] },
  history: { title: 'Points history', back: ['#/me', 'Me'] },
  account: { title: 'Account', back: ['#/me', 'Me'] },
  settings: { title: 'Settings', back: ['#/me/account', 'Account'] },
  language: { title: 'Language', back: ['#/me/settings', 'Settings'] },
};
// Account opened from the header gear goes back to the page it was opened from (app.accountFrom, set in main.js).
const TAB_LABELS = { home: 'Home', community: 'Community', leagues: 'Leagues', rewards: 'Rewards', me: 'Me' };
const meHeader = (page, app) => { let { title, back: [href, label] } = ME_PAGES[page];
  if (page === 'account' && app?.accountFrom) { href = app.accountFrom; const k = app.accountFrom.slice(2).split('/')[0]; label = TAB_LABELS[routes[k]?.tab || k] || 'Back'; }
  return `<header class="oz-subhead"><a class="oz-subhead-back" href="${href}">${ozIcon('s:chevron-left')}<span>${esc(label)}</span></a><h1>${esc(title)}</h1></header>`; };
const facultyShort = (f) => FACULTY_INFO[f]?.[0] || '';

async function meRender(app, [page] = []) {
  const p = app.profile;
  if (page === 'profile') return meProfileHTML(app);
  if (page === 'history') return meHistoryHTML(app);
  if (page === 'account') return `<div class="oz-me oz-me-page">${meHeader('account', app)}${accountMenuHTML(app, { page: true })}</div>`;
  if (page === 'settings') return `<div class="oz-me oz-me-page">${meHeader('settings')}
    ${menuGroup('Preferences', [
      `<div class="oz-menu-row oz-menu-toggle"><label class="oz-menu-label oz-menu-stack" for="fx"><span>Sound and vibration</span><small>When you earn points</small></label>
        <span class="oz-toggle"><input type="checkbox" role="switch" id="fx" ${fxOn() ? 'checked' : ''}><i aria-hidden="true"></i></span></div>`,
      menuRow('Language', { href: '#/me/language', value: getLang() === 'ms' ? '<span data-no-i18n>Bahasa Malaysia</span>' : '<span data-no-i18n>English</span>' })])}
    ${menuGroup('Account actions', [
      ...(app.isMpp ? [menuRow('Open the Admin dashboard', { href: siteUrls.admin, id: 'to-mpp' })] : []),
      menuRow('Sign out', { id: 'out' }), menuRow('Delete account', { href: '#/delete-account' })])}</div>`;
  if (page === 'language') return `<div class="oz-me oz-me-page">${meHeader('language')}
    <section class="oz-menu-section"><h2 class="oz-menu-title" id="lang-title">App language</h2>
      <div class="oz-menu-group oz-lang" role="group" aria-labelledby="lang-title" data-no-i18n>${languageRows()}</div></section></div>`;
  const refs = await D.myReferrals(app.ctx).catch(() => []);
  const meta = [facultyShort(p.faculty), p.college && p.college !== 'OFF' ? p.college : '', `${n(p.points)} pts`].filter(Boolean);
  return `<div class="oz-me oz-me-hub"><h1 class="oz-page-title">Me</h1>
    <section class="me-card oz-me-id"><a href="#/avatar" class="me-avatar" aria-label="Customise Onzo">${AV.avatarSVG(myAvatar(app), { variant: 'head', size: 72, title: p.name })}</a>
      <div class="oz-me-id-text"><h2>${esc(p.name)}</h2><p>${meta.map((m, i) => `<span${i < meta.length - 1 ? ' data-no-i18n' : ''}>${esc(m)}</span>`).join(' · ')}</p></div></section>
    ${ozButton('Customise Onzo', { kind: 'ghost', href: '#/avatar', block: true, cls: 'oz-me-customise' })}
    ${inviteCardHTML(p, refs, app.ledger)}
    <nav class="oz-menu-group oz-me-links" aria-label="Me">${menuRow('Personal info', { href: '#/me/profile' })}${menuRow('Account and settings', { href: '#/me/account' })}${menuRow('About +Onz', { href: '#/about' })}</nav>
  </div>`;
}
// Referral card (the Me frame's invite card; the same component as Top referrers). Counts come from real referrals only.
function inviteCardHTML(p, refs, ledger = []) {
  // Subtitle from the ledger: points actually earned from people who joined with this code (Me 441:2458).
  const earnedFromInvites = ledger.filter((l) => l.type === 'inviter' && l.delta > 0).reduce((s, l) => s + l.delta, 0);
  const sub = earnedFromInvites ? `You’ve earned ${n(earnedFromInvites)} pts from ${n(refs.length)} ${refs.length === 1 ? 'invite' : 'invites'}` : refs.length === 1 ? '1 person has joined with your code' : `${n(refs.length)} people have joined with your code`;
  return `<section class="oz-lg-invite oz-me-invite" id="referral-card" aria-labelledby="referral-title">
    <div class="oz-lg-invite-head"><span class="oz-lg-invite-ic" aria-hidden="true">${ozIcon('friend-add')}</span>
      <div><h2 id="referral-title">Invite a friend</h2><p>${sub}</p></div></div>
    <div class="oz-lg-code"><strong data-no-i18n>${esc(p.referralCode)}</strong><button type="button" class="oz-lg-link" id="copy-referral" aria-label="Copy referral code">Copy</button></div>
    ${ozButton('Share invite', { kind: 'primary', block: true, attr: { id: 'share' } })}
    ${refs.length ? `<details class="oz-me-details"><summary>Who joined with your code <span class="oz-tag oz-tag-sky">${n(refs.length)}</span></summary>
      <ul>${refs.map((r) => `<li><strong data-no-i18n>${esc(r.friendName)}</strong><span>Friend request sent</span></li>`).join('')}</ul></details>` : ''}
    ${p.inviterCode ? `<p class="oz-me-note">You joined with code ${esc(p.inviterCode)}.</p>` : ''}
  </section>`;
}
function meProfileHTML(app) {
  const p = app.profile;
  return `<div class="oz-me oz-me-page">${meHeader('profile')}
    <form id="prof" class="oz-form">
      <label class="oz-field"><span>Name</span><input name="name" required minlength="2" maxlength="100" value="${esc(p.name)}" autocomplete="name"></label>
      <label class="oz-field"><span>Matric number</span><input value="${esc(p.matric || '')}" readonly aria-readonly="true"></label>
      <label class="oz-field"><span>Residential college</span><input value="${esc(D.collegeName(p.college))}" readonly aria-readonly="true" aria-describedby="college-locked">
        <small id="college-locked">${ozIcon('lock')} Picked the wrong one? Ask the Admin team.</small></label>
      ${p.faculty
    ? `<label class="oz-field"><span>Faculty</span><input value="${esc(p.faculty)}" readonly aria-readonly="true" aria-describedby="faculty-locked">
        <small id="faculty-locked">${ozIcon('lock')} Picked the wrong one? Ask the Admin team.</small></label>`
    : `<label class="oz-field"><span>Faculty</span><select name="faculty" aria-describedby="faculty-once"><option value="" selected>Choose your faculty</option>${D.FACULTIES.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}</select>
        <small id="faculty-once">${ozIcon('lock')} You can only choose your faculty once, so check it’s the right one.</small></label>`}
      ${ozButton('Save profile', { kind: 'primary', block: true, attr: { type: 'submit' } }).replace('type="button" ', '')}
    </form>
    ${signInEmailsCard(app)}
    <section class="oz-lg-invite" id="add-friends-card" aria-labelledby="add-friends-title">
      <div class="oz-lg-invite-head"><span class="oz-lg-invite-ic" aria-hidden="true">${ozIcon('community')}</span>
        <div><h2 id="add-friends-title">Add friends</h2><p>For friends already on +Onz</p></div></div>
      ${p.username ? `<div class="oz-lg-code"><strong data-no-i18n>@${esc(p.username)}</strong><button type="button" class="oz-lg-link" id="copy-username" aria-label="Copy username">Copy</button></div>
        ${ozButton('Add friends', { kind: 'ghost', block: true, href: '#/community/add' })}`
    : `<p class="oz-me-note">Choose a username first, then add friends by theirs any time.</p>${ozButton('Choose a username', { kind: 'ghost', block: true, href: '#/community/add' })}`}
    </section></div>`;
}
// Points history (449:5109): your real balance and this week's earnings, a filter, then entries by week.
// The frame's "Pending" figure has no production equivalent and is not shown.
function meHistoryHTML(app) {
  const ledger = app.ledger.slice(0, 30);
  const weekAgo = Date.now() - 7 * 864e5;
  const at = (l) => (l.createdAt?.toMillis ? l.createdAt.toMillis() : +new Date(l.createdAt || 0));
  const earnedWeek = ledger.filter((l) => at(l) >= weekAgo && l.delta > 0 && l.type !== 'welfare').reduce((s, l) => s + l.delta, 0);
  const week = ledger.filter((l) => at(l) >= weekAgo), older = ledger.filter((l) => at(l) < weekAgo);
  const list = (rows) => `<div class="oz-menu-group oz-hist">${rows.map(pointsHistoryRow).join('')}</div>`;
  return `<div class="oz-me oz-me-page">${meHeader('history')}
    <section class="oz-hist-strip" aria-label="Summary"><div><strong data-bind="points">${n(app.profile.points)}</strong><span>Available</span></div>
      <div><strong class="is-up">+${n(earnedWeek)}</strong><span>This week</span></div></section>
    ${ozSegmented([{ key: 'all', label: 'All' }, { key: 'earned', label: 'Earned' }, { key: 'spent', label: 'Spent' }], 'all', { label: 'Show', cls: 'oz-hist-filter' })}
    ${ledger.length ? `${week.length ? `<h2 class="oz-hist-head">This week</h2>${list(week)}` : ''}
      ${older.length ? `${week.length ? `<details class="oz-hist-older"><summary class="oz-btn oz-btn-ghost oz-btn-md oz-btn-block">Older activity</summary><h2 class="oz-hist-head">Earlier</h2>${list(older)}</details>` : `<h2 class="oz-hist-head">Earlier</h2>${list(older)}`}` : ''}
      <p class="oz-hist-none" hidden>Nothing to show for this filter.</p>`
    : ozEmpty({ title: 'Points you earn and spend appear here.' })}
    ${pointsSummaryHTML(app)}</div>`;
}
function pointsHistoryRow(entry) {
  const glyph = { purchase: 'wallet', lesson: 'learn', appStreak: 'streak', friend: 'friend-add', inviter: 'friend-add', redeem: 'voucher', donate: 'heart', welfare: 'heart', liveDeal: 'scan', survey: 'learn' }[entry.type] || 'coin';
  const earned = entry.delta > 0;
  return `<div class="oz-menu-row oz-hist-row" data-kind="${earned ? 'earned' : 'spent'}">
    <span class="oz-hist-ic" aria-hidden="true">${ozIcon(glyph)}</span>
    <span class="oz-menu-label oz-menu-stack"><span>${esc(ledgerLabel(entry))}</span><small>${fmtDateTime(entry.createdAt)} · <b class="${earned ? 'is-up' : ''}">${earned ? '+' : ''}${n(entry.delta)}</b></small></span></div>`;
}
function ledgerLabel(l) {
  if (l.type === 'checkin') return 'Archived attendance credit';
  if (l.type === 'appStreak') return 'App streak bonus';
  if (l.type === 'liveDeal') return 'Live-deal scan reward';
  return { purchase: 'Cashless purchase', survey: 'Money check completed', lesson: 'Lesson completed', friend: 'Referral welcome bonus', inviter: 'Someone joined with your code',
    offpeak: 'Quiet-hour bonus', redeem: 'Swapped for a voucher', donate: 'Given to the welfare fund', welfare: 'Welfare support received', adjust: l.note || 'Adjustment by the Admin team' }[l.type] || l.type;
}
function meMount(root, app, [page] = []) {
  const on = (sel, ev, fn) => { const el = $(sel, root); if (el) el[ev] = fn; };
  if (page === 'account') { mountAccountMenu(root, app); return; }
  if (page === 'settings') {
    on('#fx', 'onchange', (e) => { setFx(e.target.checked); if (e.target.checked) pointsFx(); });
    on('#out', 'onclick', () => app.backend.sdk.signOut(app.backend.auth));
    return;
  }
  if (page === 'history') {
    $$('.oz-hist-filter [data-seg]', root).forEach((b) => { b.onclick = () => {
      $$('.oz-hist-filter [data-seg]', root).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      const k = b.dataset.seg; let shown = 0;
      $$('.oz-hist-row', root).forEach((r) => { r.hidden = k !== 'all' && r.dataset.kind !== k; if (!r.hidden) shown++; });
      const older = $('.oz-hist-older', root); if (older && k !== 'all') older.open = true;
      const none = $('.oz-hist-none', root); if (none) none.hidden = shown > 0;
    }; });
    return;
  }
  if (page === 'profile') {
    mountSignInEmails(root, app);
    on('#copy-username', 'onclick', (e) => motion.copyWithFeedback(e.currentTarget, '@' + app.profile.username, 'Couldn’t copy. Select your username to copy it manually.'));
    on('#prof', 'onsubmit', (e) => {
      e.preventDefault(); const f = e.target;
      busy($('button', f), async () => { try { const fields = { name: f.name.value.trim() };
        if (f.faculty?.value) fields.faculty = f.faculty.value;
        await D.updateProfile(app.ctx, fields); toast('Profile saved.'); if (fields.faculty) app.render(); } catch (err) { toast(errText(err), true); } });
    });
    return;
  }
  on('#copy-referral', 'onclick', (e) => motion.copyWithFeedback(e.currentTarget, app.profile.referralCode, 'Couldn’t copy. Select the referral code to copy it manually.'));
  on('#share', 'onclick', async () => {
    const text = tr(`Join +Onz, UM’s campus app for merchants, events and rewards. Enter my referral code ${app.profile.referralCode} when you sign up: ${location.origin}${location.pathname}`);
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Referral message copied. Paste it to a friend.'); } } catch { /* cancelled */ }
  });
}

// ------------------------------------------------------------- routes
const live = (fn) => (root, app, params) => {
  const c1 = fn ? fn(root, app, params) : null;
  let t; const off = app.on((topic) => { if (topic === 'streak-recorded' || topic === 'app-activity' || topic === 'ledger') showStreakMotion(root, app); if (topic === 'app-activity' || topic === 'ledger' || topic === 'profile') { clearTimeout(t); t = setTimeout(() => { if (!document.querySelector('#sheet[open]') && (!root.contains(document.activeElement) || document.activeElement?.id === 'rewards-streak')) app.render(); }, 400); } });
  return () => { off(); clearTimeout(t); c1 && c1(); };
};
export const routes = {
  ...INFORMATION_ROUTES,
  'claim-deal': { title: 'Claim a live deal', render: studentDealClaimRender, mount: studentDealClaimMount, tab: 'home', wide: true, feature: ['overview', 'merchantTools', 'dealsAndPay'] },
  home: { title: 'Home', render: homeRender, mount: live(homeMount) },
  activities: { title: 'All activities', render: activitiesRender, tab: 'home' },
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
  // Same card component as the referral and Add friends cards (Referral Card 433:907), with List Rows for the emails.
  const row = (e, removable) => `<div class="oz-menu-row oz-email-row"><span class="oz-menu-label" data-no-i18n>${esc(e)}</span>${removable
    ? `<button type="button" class="oz-lg-link" data-remove-email="${esc(e)}" aria-label="Remove ${esc(e)}">Remove</button>` : '<span class="oz-menu-value">Main email</span>'}</div>`;
  return `<section class="oz-lg-invite" id="signin-emails" aria-labelledby="signin-emails-title">
    <div class="oz-lg-invite-head"><span class="oz-lg-invite-ic" aria-hidden="true">${icon('mail')}</span>
      <div><h2 id="signin-emails-title">Sign-in emails</h2><p>Any of these opens this same account, with the same points and matric number.</p></div></div>
    <div class="oz-menu-group oz-email-list">${[own && row(own, false), ...added.map((e) => row(e, true))].filter(Boolean).join('')}</div>
    ${added.length < 4 ? `${ozButton('Add another Google account', { kind: 'ghost', block: true, iconName: 's:plus', attr: { id: 'add-email' } })}
    <p class="oz-me-note">For example, add your siswa email if you signed up with a personal Gmail.</p>` : ''}</section>`;
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
    const el = sheet(`<div class="oz-fsheet"><h2 class="oz-fsheet-title">Add another Google account</h2><form id="le" class="oz-fsheet-form"><label class="oz-field"><span>Google email</span><input name="email" type="email" required placeholder="you@siswa.um.edu.my" autocomplete="email"></label><button class="oz-btn oz-btn-primary oz-btn-md oz-btn-block"><span>Add</span></button></form></div>`);
    $('#le', el).onsubmit = (e) => { e.preventDefault(); const v = e.target.email.value; closeSheet(); run(v); };
  };
}
