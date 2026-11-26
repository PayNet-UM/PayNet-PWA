import { livePointEarningOn } from '../points-policy.js';
import { pointsSummaryHTML } from '../points-guide.js';
import { INFORMATION_ROUTES } from '../information.js';
// Merchant app: shop setup, readiness, live-deal QR claims, applied discounts and counter poster.
import * as D from '../data.js';
import * as L from '../live-deals.js';
import { merchantDealQRRender, merchantDealQRMount } from '../deal-flow.js';
import { safeImg, $, $$, esc, icon, rm, n, toast, sheet, closeSheet, confirmSheet, busy, errText, fmtDate, fmtTime, timeAgo, confetti, renderQR,
  startScanner, compressImage, onSheetClose, barChart, colorFor, initials, downloadCSV } from '../ui.js';
import { pinPicker, hasPin, inGeoBox } from '../map.js';
import { surveyHTML, surveyMount, merchantLogo, studentShopRender, studentShopMount } from './student.js';
import { avatarSVG, defaultFor } from '../avatar.js';
import { merchantHeading, merchantMetric, merchantEmpty, merchantSetup, merchantAction } from '../merchant-ui.js';
import { closeRender, closeMount } from './close.js';
import { stallSurveyRender, stallSurveyMount } from '../stall-survey-view.js';
import { isCurrentStallSurvey } from '../stall-survey.js';

export const defaultRoute = 'home';

// The merchant assessment (the "stall survey") is required. Once a merchant has sent their shop details, every page except these leads back to
// the survey until it's answered (so clicking away, or reopening the app, brings them back to it).
const OPEN_BEFORE_SURVEY = new Set(['stall-survey', 'shop', 'delete-account']);
export async function gateRoute(app, route) {
  if (!app.merchant || app.stallSurveyDone) return null;
  // If the survey can't be read (e.g. offline), don't lock the merchant out of their own app.
  // Answers to an earlier version count as not done, so those merchants are asked the new questions.
  if (app.stallSurveyDone === undefined) app.stallSurveyDone = await D.getStallSurvey(app.ctx).then(isCurrentStallSurvey).catch(() => true);
  if (app.stallSurveyDone || OPEN_BEFORE_SURVEY.has(route)) return null;
  return 'stall-survey';
}
export const gateMessage = 'Finish the merchant assessment first. It takes about 5 minutes.';
const toMs = D.toMs;
const statusBadge = (m) => !m ? '<span class="badge grey">Not applied</span>'
  : m.status === 'verified' ? `<span class="badge ok">${icon('badge-check')}Verified</span>`
  : m.status === 'rejected' ? '<span class="badge bad">Needs changes</span>'
  : m.status === 'suspended' ? '<span class="badge bad">Suspended</span>' : '<span class="badge warn">The Admin team is reviewing</span>';

function needVerified(app) {
  if (app.merchant && app.merchant.status === 'verified') return null;
  return `<div class="card empty mer-access-card" style="margin-top:16px"><span class="mer-access-icon">${icon('store')}</span><h3>${app.merchant ? 'Waiting for the Admin team to verify your shop' : 'Apply to join first'}</h3>
    <p>${app.merchant ? 'Usually reviewed within 1–2 working days.' : 'Submit your shop details for Admin team verification.'}</p>
    <a class="btn primary" style="margin-top:12px" href="#/shop">${app.merchant ? 'View application' : 'Apply now'}</a></div>`;
}

// ------------------------------------------------------------- home
// New merchants don't know the app yet, so Home says what each part is for and what to do next:
// a "Start here" path until the shop is fully set up, clearer tiles, and numbers that explain themselves.
// Each step: [icon, title, help, route, done, canDo]. done is true, false, 'waiting' (the Admin team's turn)
// or 'claims' (ticked in homeMount once claims load). canDo says whether the merchant can act on it right now.
function startSteps(app, m, deals, liveOn, stall) {
  const verified = m?.status === 'verified', rejected = m?.status === 'rejected', assessed = isCurrentStallSurvey(stall);
  // Step 1 is everything the app asks for together: shop details (with logo and map pin) and then the required assessment.
  const apply = !m ? ['store', 'Apply to join +Onz', 'Send your shop details, logo and map pin, then answer the merchant assessment (about 5 minutes).', 'shop', false, true]
    : rejected ? ['store', 'Update your application', 'The Admin team asked for changes. Fix them and send it again.', 'shop', false, true]
    : !assessed ? ['list-checks', 'Finish the merchant assessment', 'Your details are sent. Answer 15 questions about your business (about 5 minutes).', 'stall-survey', false, true]
    : ['store', 'Apply to join +Onz', 'Shop details sent and merchant assessment done.', 'shop', true, true];
  return [
    apply,
    ['badge-check', 'Get verified by the Admin team', m?.status === 'pending' ? 'You’ve applied. We check your details in 1–2 working days.' : 'The Admin team checks your details in 1–2 working days.', 'shop',
      verified ? true : m?.status === 'pending' ? 'waiting' : false, false],
    ['shield-check', 'Get your staff ready', 'A short checklist so everyone at the counter knows what to do.', 'shop/ready', D.merchantReadinessCurrent(m, app.rules), !!m && !rejected],
    ...(liveOn ? [
      ['badge-percent', 'Create your first live deal', 'A discount for your quiet hours. It goes live straight away.', 'promote', deals > 0, verified],
      ['qr-code', 'Show your deal QR at the counter', 'Students scan it to claim the discount. You’ll see the claim on your screen.', 'scan', 'claims', verified && deals > 0],
    ] : []),
  ];
}
// Once a merchant has finished every step on this device, the banner stays away (no flash while claims load).
const START_DONE = (uid) => `onz-merchant-start-done:${uid}`;
const startDone = (uid) => { try { return localStorage.getItem(START_DONE(uid)) === '1'; } catch { return false; } };
const markStartDone = (uid) => { try { localStorage.setItem(START_DONE(uid), '1'); } catch { /* private mode */ } };
function startHereHTML(steps) {
  // The last step ("claims") can only be ticked once the claims load, in homeMount.
  // "Next" is the first step the merchant can actually do; while they wait for the Admin team, that's usually the stall survey.
  if (!steps.some(([, , , , done]) => done !== true)) return '';
  const next = steps.find(([, , , , done, canDo]) => done !== true && canDo) || steps.find(([, , , , done]) => done !== true);
  const doneCount = steps.filter(([, , , , done]) => done === true).length;
  return `<section class="section mer-start" id="start-here"><div class="mer-voucher-card mer-start-card">
    <div class="mer-voucher-head"><span class="mer-voucher-new">Start here</span><h2>Get your shop ready for students</h2></div>
    <p class="mer-start-lead">Follow these steps in order. Each one ticks off when it’s done. <b data-start-count>${doneCount} of ${steps.length} done</b></p>
    <ol class="mer-start-steps">${steps.map(([, title, desc, route, done], i) => `<li class="${done === true ? 'is-done' : next[1] === title ? 'is-next' : done === 'waiting' ? 'is-waiting' : ''}" ${done === 'claims' ? 'data-step-claims' : ''}><a href="#/${route}">
        <span class="mer-start-num" aria-hidden="true">${done === true ? icon('check') : i + 1}</span>
        <span><b>${title}</b><small>${desc}</small></span>${done === 'waiting' ? '<span class="mer-start-wait">In progress</span>' : icon('chevron-right')}</a></li>`).join('')}</ol>
    <div><a class="btn mer-voucher-cta" href="#/${next[3]}">${icon(next[0])} Next: ${next[1]} ${icon('arrow-right')}</a></div>
  </div></section>`;
}
async function homeRender(app) {
  const m = app.merchant; const name = m ? m.name : app.profile.name;
  const liveOn=livePointEarningOn(app.rules);
  const verified = m?.status === 'verified'; const toolsOn = D.featureOn(app.rules, 'merchantTools');
  const deals = verified && liveOn ? (await D.myDeals(app.ctx).catch(() => [])).length : 0;
  // A new readiness update from the Admin team for a shop that was already set up shows the readiness card
  // (with the Admin team's message), not the whole "Start here" path again.
  const updated = !!m?.ready && !D.merchantReadinessCurrent(m, app.rules);
  const stall = m ? await D.getStallSurvey(app.ctx).catch(() => null) : null;
  const start = updated || startDone(app.ctx.uid) ? '' : startHereHTML(startSteps(app, m, deals, liveOn, stall));
  const readiness = start ? '' : merchantSetup(m, hasPin, app.rules);
  const shortcuts = [
    ['shop', 'store', 'My shop', 'Your shop details, logo, map pin and counter poster.'],
    ...(m ? [['stall-survey', 'list-checks', 'Merchant assessment', isCurrentStallSurvey(stall) ? 'Done. See your stall type or edit your answers.' : '15 questions about your business. See your stall type.']] : []),
    ...(verified && liveOn ? [
      ['scan', 'qr-code', 'Deal QR', 'Show this at your counter. Students scan it to claim your deal.'],
      ['promote', 'badge-percent', 'Promote your shop', 'Live deals, where students earn points, and the voucher program, where they spend them.'],
    ] : []),
    ...(toolsOn ? [['survey', 'target', 'Cashless readiness check', '7 quick questions so we know how to help your shop.']] : []),
  ];
  return `<div class="merchant-page mer-home"><section class="kk-hero merchant-home-hero">
      <div class="merchant-home-logo">${m ? merchantLogo(m) : icon('store')}</div>
      <div class="mer-home-copy"><span class="mer-eyebrow">Your merchant hub</span><h1>${esc(name)}</h1>${m?.location ? `<p class="mer-hero-location">${icon('map-pin')} ${esc(m.location)}</p>` : ''}<div class="row merchant-home-status">${statusBadge(m)}${D.merchantReadinessCurrent(m, app.rules) ? `<span class="badge ok">${icon('shield-check')}Staff ready</span>` : ''}</div></div>
      <div class="mer-hero-art" aria-hidden="true"><span>${icon('store')}</span><i>${icon('star')}</i><b>+</b></div>
    </section>
    ${start}
    ${verified && !hasPin(m) && !start ? `<div class="notice" style="margin-top:12px">${icon('map-pin')}<span>Students can’t find you on the map yet. <a href="#/shop">Add your shop location</a> so they can walk straight to you.</span></div>` : ''}
    <div class="mer-home-grid ${readiness ? '' : 'is-ready'}"><section class="mer-quick-section"><div class="mer-section-head"><h2>Explore</h2><span class="mer-eyebrow">Let's go</span></div>
      <p class="mer-section-lead">Everything for your shop. You can also find these in the menu.</p>
      <nav class="mer-actions" aria-label="Merchant shortcuts">${shortcuts.map((args, index) => merchantAction(...args, index)).join('')}</nav></section>
      ${readiness}</div>
    ${pointsSummaryHTML(app)}
    ${verified ? `
      <section class="section"><div class="mer-section-head"><h2>Live-deal activity</h2>${toolsOn ? `<a href="#/insights">Insights ${icon('arrow-right')}</a>` : ''}</div>
      <p class="mer-section-lead">What has happened with your live deals so far.</p>
      <div class="stats mer-stats" id="merchant-wallet"><div class="skeleton" style="height:130px"></div></div><div id="merchant-wallet-empty"></div></section>` : ''}</div>`;
}
function homeMount(root, app) {
  const off = app.on((topic) => { if (topic === 'merchant' || topic === 'merchant-readiness') app.render(); });
  const stop = $('#merchant-wallet', root) ? L.watchMerchantClaims(app.ctx, (claims) => {
    const waiting = claims.filter((c) => c.status === 'claimed' && !L.claimExpired(c)).length;
    $('#merchant-wallet', root).innerHTML = merchantMetric('Deal claims', n(claims.length), 'qr-code', 'violet', 'Students who scanned your deal QR.')
      + merchantMetric('Discounts applied', n(claims.filter((c) => c.status === 'applied').length), 'badge-percent', 'lime', 'Claims you gave the discount for.')
      + merchantMetric('Awaiting discount', n(waiting), 'clock', 'sky', waiting ? 'Open Deal QR and tap Apply discount.' : 'Students waiting for their discount right now.');
    $('#merchant-wallet-empty', root).innerHTML = claims.length ? '' : `<div class="mer-empty-hint">${icon('info')}<span>No claims yet. Create a live deal, then show its QR at your counter.</span><a class="btn small primary" href="#/promote">Create a deal</a></div>`;
    // The last "Start here" step ticks off once a student has claimed a deal.
    const li = $('[data-step-claims]', root);
    if (li && claims.length) { li.classList.remove('is-next'); li.classList.add('is-done'); $('.mer-start-num', li).innerHTML = icon('check'); }
    // Every step done: the banner goes away for good.
    const banner = $('#start-here', root);
    if (banner && !$('#start-here li:not(.is-done)', root)) { markStartDone(app.ctx.uid); banner.remove(); }
  }, () => {}) : () => {};
  return () => { off(); stop(); };
}
const miniStat = (label, value, ic, alert = false) => `<div class="mer-mini ${alert && value ? 'is-alert' : ''}"><span aria-hidden="true">${icon(ic)}</span><b class="num">${typeof value === 'number' ? n(value) : esc(value)}</b><small>${label}</small></div>`;

// ------------------------------------------------------------- café occupancy: how full the café is right now
// Big − and + buttons for the counter. Each tap shows straight away; the change is saved once tapping stops.
function seatsWidget(m) {
  const seats = Math.max(0, Number(m?.seats) || 0), occupied = Math.min(seats, Math.max(0, Number(m?.occupied) || 0));
  const pct = seats ? Math.round(occupied / seats * 100) : 0;
  return `<section class="card mer-seats" id="seats" data-seats="${seats}" data-occupied="${occupied}">
    <div class="mer-section-head"><h2>${icon('coffee')} Café occupancy</h2></div>
    ${seats ? `<div class="mer-stepper">
        <button type="button" class="mer-step" data-step="-1" aria-label="One fewer seat taken" ${occupied ? '' : 'disabled'}>−</button>
        <div class="mer-stepper-value"><div class="mer-progress-ring" data-ring style="--progress:${pct}%" aria-hidden="true"><span><b data-pct>${pct}</b><small>%</small></span></div>
          <p aria-live="polite"><b class="num" data-occupied>${n(occupied)}</b> <span>of <span class="num">${n(seats)}</span> seats taken</span></p></div>
        <button type="button" class="mer-step" data-step="1" aria-label="One more seat taken" ${occupied < seats ? '' : 'disabled'}>+</button></div>
      <div class="mer-seats-foot"><span data-saved>${m.occupancyAt ? `Updated ${timeAgo(m.occupancyAt)}` : 'Tap − or + as people come and go.'}</span><button type="button" class="btn small ghost" data-edit-seats>${icon('pencil')} Change total seats</button></div>`
    : `<p class="mer-seats-empty">Set how many seats you have. A live deal only shows while your café is less full than the deal’s limit.</p><button type="button" class="btn primary" data-edit-seats>${icon('coffee')} Set my seats</button>`}
    ${seats ? '<p class="mer-seats-note">A live deal only shows while your café is less full than the deal’s limit.</p>' : ''}
  </section>`;
}
function seatsMount(root, app) {
  const box = $('#seats', root); if (!box) return () => {};
  let seats = +box.dataset.seats, occupied = +box.dataset.occupied, saved = occupied, timer = 0;
  const draw = () => {
    $('[data-occupied]', box).textContent = n(occupied);
    const pct = seats ? Math.round(occupied / seats * 100) : 0;
    $('[data-ring]', box).style.setProperty('--progress', `${pct}%`); $('[data-pct]', box).textContent = pct;
    $('[data-step="-1"]', box).disabled = occupied <= 0; $('[data-step="1"]', box).disabled = occupied >= seats;
  };
  const save = async () => {
    timer = 0; if (occupied === saved) return;
    const want = occupied; $('[data-saved]', box).textContent = 'Saving…';
    try { await D.setOccupancy(app.ctx, seats, want); saved = want; if (box.isConnected) $('[data-saved]', box).textContent = 'Saved just now'; }
    catch (err) { occupied = saved; if (box.isConnected) { draw(); $('[data-saved]', box).textContent = ''; } toast(errText(err), true); }
  };
  $$('[data-step]', box).forEach((b) => { b.onclick = () => {
    occupied = Math.min(seats, Math.max(0, occupied + Number(b.dataset.step))); draw();
    clearTimeout(timer); timer = setTimeout(save, 700);
  }; });
  $('[data-edit-seats]', box).onclick = () => {
    const el = sheet(`<h2>Your seats</h2><form id="seats-form" class="stack" style="margin-top:12px">
      <div class="grid-2"><label class="field">Total seats<input name="seats" type="number" inputmode="numeric" min="1" max="2000" required value="${seats || ''}"></label>
      <label class="field">Seats taken now<input name="occupied" type="number" inputmode="numeric" min="0" max="2000" required value="${seats ? occupied : ''}"></label></div>
      <button class="btn primary">${icon('check')} Save seats</button></form>`);
    $('#seats-form', el).onsubmit = (e) => {
      e.preventDefault(); const s = Math.floor(+e.target.seats.value), o = Math.floor(+e.target.occupied.value);
      if (o > s) return toast('Seats taken can’t be more than total seats.', true);
      busy($('button', el), async () => { try { clearTimeout(timer); await D.setOccupancy(app.ctx, s, o); closeSheet(); toast('Seats updated.'); app.render(); } catch (err) { toast(errText(err), true); } });
    };
  };
  // Leaving the page mid-tap still saves the last count.
  return () => { if (timer) { clearTimeout(timer); save(); } };
}

// ------------------------------------------------------------- shop: application, readiness, seats, poster
const READY_TEXT = {
  English: [['How to check a payment', 'Open your own banking app or terminal. Match the payer, the amount and the time. A customer’s screenshot is not proof of payment.'],
    ['How DuitNow QR money reaches you', 'Payments settle into the account linked to your QR. Ask your bank for the settlement schedule, any fees and how refunds work.']],
  'Bahasa Malaysia': [['Cara menyemak bayaran', 'Buka aplikasi bank atau terminal anda sendiri. Padankan pembayar, jumlah dan masa. Tangkap layar pelanggan bukan bukti bayaran.'],
    ['Bagaimana wang DuitNow QR sampai kepada anda', 'Bayaran masuk ke akaun yang dipautkan pada QR anda. Tanya bank anda tentang jadual penyelesaian, caj dan proses bayaran balik.']],
  '中文': [['如何确认付款', '打开您自己的银行应用或终端，核对付款人、金额和时间。顾客的截图不能作为付款证明。'],
    ['DuitNow QR 款项如何到账', '款项会存入与您的二维码关联的账户。请向银行确认结算时间、费用和退款流程。']],
};
const READY_CHECKS = ['Staff confirm every payment in our own banking app or terminal', 'Staff know how to show a live-deal QR and apply the discount',
  'The name on our DuitNow QR matches our registered business name', 'Our +Onz poster is displayed next to our DuitNow QR'];
let readyLang = 'English';
// A file picker that looks like a button (the browser's "Choose File / No file chosen" can't be styled or translated).
// The real input stays in the page, visually hidden, so keyboard, screen readers and tests still use it.
const uploadField = (name, accept, label, help, { required = false, current = '' } = {}) => `<div class="field mer-upload-field"><span>${label}</span>
  <label class="mer-upload"><input type="file" name="${name}" accept="${accept}" class="visually-hidden" ${required ? 'required' : ''}>
    <span class="btn small">${icon('image')} ${current ? 'Choose a new photo' : 'Choose a photo'}</span><span class="mer-upload-name" data-file-name>${current ? esc(current) : 'No photo chosen yet'}</span></label>
  ${help ? `<small>${help}</small>` : ''}</div>`;
function mountUploads(root) {
  $$('.mer-upload input[type=file]', root).forEach((input) => input.addEventListener('change', () => {
    const name = input.files[0]?.name; const out = $('[data-file-name]', input.closest('.mer-upload'));
    if (name && out) { out.textContent = name; out.setAttribute('data-no-i18n', ''); }
  }));
}

async function shopRender(app) {
  const m = app.merchant; const priv = m ? await D.getMerchantPrivate(app.ctx, app.ctx.uid).catch(() => null) : null;
  const editable = !m || m.status !== 'verified';
  const ready = D.merchantReadinessCurrent(m, app.rules);
  const v = (k) => esc((m && m[k]) || (priv && priv[k]) || '');
  const sel = (name, opts, cur) => `<select name="${name}">${opts.map((o) => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const head = `${merchantHeading('My shop', 'How students see your shop, and what you need at the counter.', 'store')}
    ${m && m.status === 'rejected' ? `<div class="notice bad">${icon('circle-alert')}<span>The Admin team asked for changes: ${esc(m.reviewNote || 'see details')}. Update and send again.</span></div>` : ''}
    ${m && m.status === 'pending' ? `<div class="notice">${icon('clock')}<span>Sent ${fmtDate(m.submittedAt)}. The Admin team will check that your QR name matches your business.</span></div>` : ''}`;

  // Not verified yet: the application form, with friendlier upload buttons.
  if (editable) return `<div class="merchant-page mer-shop">${head}
    <section class="section mer-business"><div class="head"><h2>${icon('store')} ${m ? 'Your application' : 'Apply to join +Onz'}</h2></div>
    <form id="app-form" class="card stack">
      <label class="field">Business name, as students know it<input name="name" required minlength="2" maxlength="100" value="${v('name')}"></label>
      <label class="field">Account name on your DuitNow QR<input name="accountName" required value="${v('accountName')}"><small>The Admin team checks this matches the QR.</small></label>
      <div class="grid-2"><label class="field">Type${sel('type', D.MERCHANT_TYPES, m?.type)}</label><label class="field">Category${sel('segment', D.SEGMENTS, m?.segment)}</label></div>
      <div class="grid-2"><label class="field">Location<input name="location" required placeholder="e.g. KK3 cafeteria" value="${v('location')}"></label><label class="field">Campus zone${sel('zone', D.ZONES, m?.zone)}</label></div>
      <div class="grid-2"><label class="field">Contact phone<input name="phone" type="tel" value="${v('phone')}"></label><label class="field">Ambassador ID (optional)<input name="ambassadorId" value="${v('ambassadorId')}" placeholder="e.g. AMB-003"></label></div>
      <div id="event-fields" class="grid-2"><label class="field">Event name<input name="eventName" value="${v('eventName')}"></label><label class="field">Event ends<input name="eventEnd" type="date" value="${v('eventEnd')}"></label></div>
      ${logoBlock(m)}
      ${pinBlock(m)}
      ${uploadField('qr', 'image/*', 'Photo of your DuitNow QR', 'A clear, straight photo. It goes on the monthly list PayNet uses to count your transactions.', { required: !(priv && priv.qrImage), current: priv && priv.qrImage ? 'Photo uploaded' : '' })}
      ${priv && safeImg(priv.qrImage) ? `<img class="qr-thumb" style="width:120px;height:120px" src="${safeImg(priv.qrImage)}" alt="Your uploaded DuitNow QR">` : ''}
      <button class="btn primary">${m ? 'Send updated details to the Admin team' : 'Send to the Admin team for verification'}</button>
    </form></section></div>`;

  // Verified: the things a merchant changes or uses first, the locked details last as a plain list.
  const details = [['Business name', m.name], ['Account name on your DuitNow QR', priv?.accountName], ['Type', m.type], ['Category', m.segment],
    ['Location', m.location], ['Campus zone', m.zone], ['Contact phone', priv?.phone || m.phone], ['Ambassador ID', priv?.ambassadorId || m.ambassadorId],
    ...(m.eventName ? [['Event', `${m.eventName}${m.eventEnd ? ` · until ${m.eventEnd}` : ''}`]] : [])].filter(([, val]) => val);
  const facts = [m.type, m.zone].filter(Boolean);
  return `<div class="merchant-page mer-shop">
    <form id="logo-form" class="kk-hero merchant-home-hero mer-shop-hero">
      <label class="mer-logo-pick" title="Change logo"><input name="logo" type="file" accept="image/png,image/jpeg,image/webp" class="visually-hidden" aria-label="Change your shop logo">
        <span class="logo-preview" id="logo-prev">${safeImg(m.logo) ? `<img src="${safeImg(m.logo)}" alt="Your logo">` : icon('image')}</span><span class="mer-logo-edit" aria-hidden="true">${icon('pencil')}</span></label>
      <input type="hidden" name="logoData" value="">
      <div class="mer-home-copy"><span class="mer-eyebrow">My shop</span><h1 data-no-i18n>${esc(m.name)}</h1>${m.location ? `<p class="mer-hero-location">${icon('map-pin')} <span data-no-i18n>${esc(m.location)}</span></p>` : ''}
        <div class="row merchant-home-status">${statusBadge(m)}${ready ? `<span class="badge ok">${icon('shield-check')}Staff ready</span>` : ''}</div>
        <a class="btn small mer-hero-preview" href="#/preview">${icon('eye')} Preview as a student</a>
        ${facts.length ? `<p class="mer-shop-facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</p>` : ''}
        <small class="mer-logo-help">Tap your logo to change it. Square works best.</small>
        <button class="btn small mer-hero-save" id="logo-save" hidden>${icon('check')} Save new logo</button></div>
      <div class="mer-hero-art" aria-hidden="true"><span>${icon('store')}</span><i>${icon('star')}</i><b>+</b></div>
    </form>
    <div class="mer-shop-grid is-verified">
      <section class="section mer-shop-map"><div class="head"><h2>${icon('map-pin')} Where students find you</h2></div>
        <form id="pin-form" class="card stack">${pinBlock(m, true)}<button class="btn primary" id="pin-save" hidden>${icon('map-pin')} Save new location</button></form></section>
      <div class="mer-shop-side"><section class="section mer-counter-kit"><div class="head"><h2>${icon('printer')} Poster for your counter</h2></div>
        <div class="card mer-poster-card"><div class="mer-poster-copy"><p>Print it and put it next to your DuitNow QR. Students scan it to open your shop in +Onz.</p><a class="btn primary" href="#/poster">${icon('printer')} Open poster</a></div>
          <a class="mer-poster-mini" href="#/poster" aria-label="Open your poster"><img src="icons/onz-logo-dark.svg" alt="" width="680" height="214"><b>Find us on +Onz.</b><span id="poster-mini-qr" aria-hidden="true"></span><small data-no-i18n>${esc(m.name)}</small></a></div></section>
      <section class="section mer-readiness" id="ready" tabindex="-1">
        ${ready ? `<details class="card mer-ready-done"><summary><span class="mer-ready-tick">${icon('check')}</span><span><b>Staff readiness</b><small>Done ${fmtDate(m.readyAt)}. Tap to review the checklist.</small></span>${icon('chevron-right')}</summary>${readinessBody(app, m, ready)}</details>`
          : `<div class="head"><h2>${icon('shield-check')} Staff readiness</h2><span class="badge warn">To do</span></div>
        ${app.rules.merchantReadinessUpdate?.message ? `<div class="notice mer-readiness-notice">${icon('bell')}<div><strong>New readiness update</strong><p data-no-i18n>${esc(app.rules.merchantReadinessUpdate.message)}</p></div></div>` : ''}
        <div class="card">${readinessBody(app, m, ready)}</div>`}
      </section></div>
      <section class="section mer-shop-details" id="shop-details"><div class="head"><h2>${icon('store')} Business details</h2><span class="badge grey">${icon('lock')} Locked</span></div>
        <div class="card"><dl class="mer-details">${details.map(([k, val]) => `<div><dt>${k}</dt><dd data-no-i18n>${esc(val)}</dd></div>`).join('')}
          ${priv && safeImg(priv.qrImage) ? `<div><dt>Your DuitNow QR</dt><dd><img class="qr-thumb" src="${safeImg(priv.qrImage)}" alt="Your uploaded DuitNow QR"></dd></div>` : ''}</dl>
          <p class="mer-details-note">${icon('info')}<span>These were checked by the Admin team, so they’re locked. Need to change something? <a href="#/contact">Contact the Admin team</a>.</span></p></div></section>
    </div></div>`;
}
function readinessBody(app, m, ready) {
  return `<div class="stack mer-readiness-content"><div class="chips">${Object.keys(READY_TEXT).map((l) => `<button type="button" data-lang="${l}" class="${l === readyLang ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${READY_TEXT[readyLang].map(([t, d]) => `<div><h3>${esc(t)}</h3><p class="muted" style="font-size:14px;margin-top:4px">${esc(d)}</p></div>`).join('')}
    <form id="ready-form" data-update="${toMs(app.rules.merchantReadinessUpdate?.publishedAt) || 0}">${READY_CHECKS.map((c) => `<label class="check"><input type="checkbox" required ${ready ? 'checked' : ''}> ${esc(c)}</label>`).join('')}
      <button class="btn ${ready ? '' : 'primary'}" ${m.status === 'rejected' ? 'disabled' : ''}>${ready ? 'Checklist complete' : 'Confirm my staff are ready'}</button></form></div>`;
}
function logoBlock(m) {
  return `<div class="field logo-field"><span>Shop logo</span>
    <div class="row" style="gap:14px;flex-wrap:nowrap"><span class="logo-preview" id="logo-prev">${m && safeImg(m.logo) ? `<img src="${safeImg(m.logo)}" alt="Your logo">` : icon('image')}</span>
      <div style="flex:1"><label class="mer-upload"><input name="logo" type="file" accept="image/png,image/jpeg,image/webp" class="visually-hidden" ${m && m.logo ? '' : 'required'} aria-label="Upload your logo">
        <span class="btn small">${icon('image')} ${m && m.logo ? 'Choose a new logo' : 'Choose your logo'}</span></label>
      <small>Square works best. It appears on the map pin and your shop page. Shrunk to 256 px automatically.</small></div></div>
    <input type="hidden" name="logoData" value=""></div>`;
}
// Square-crop and shrink a logo to 256 px so it stays small in Firestore.
function prepareLogo(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const side = Math.min(img.width, img.height); const S = 256;
      const c = document.createElement('canvas'); c.width = S; c.height = S; const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, S, S);
      x.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
      URL.revokeObjectURL(url);
      let q = 0.86, out = c.toDataURL('image/jpeg', q);
      while (out.length > 150000 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file isn’t an image we can read. Upload a JPG or PNG logo.')); };
    img.src = url;
  });
}
function mountLogo(root, form) {
  if (!form || !form.logo) return;
  form.logo.onchange = async () => {
    const f = form.logo.files[0]; if (!f) return;
    try { const data = await prepareLogo(f); form.logoData.value = data; $('#logo-prev', root).innerHTML = `<img src="${data}" alt="Your logo">`; const save = $('#logo-save', root); if (save) save.hidden = false; }
    catch (err) { toast(err.message, true); form.logo.value = ''; }
  };
}
function pinBlock(m, standalone = false) {
  const has = hasPin(m);
  return `<div class="field pin-field">${standalone ? '' : '<span>Shop location on the map</span>'}
    <div class="pin-map" id="pin-map" aria-label="Map to place your shop"></div>
    <div class="row between pin-bar"><button type="button" class="btn small" id="locate">${icon('locate-fixed')} Use my current location</button>
      <span class="mer-pin-status ${has ? 'is-set' : ''}" id="pin-read" ${has ? `data-lat="${m.lat}" data-lng="${m.lng}"` : ''}>${has ? `${icon('check')} Your pin is set. Students can walk straight to you.` : 'No pin yet. Tap the map or use your current location.'}</span></div>
    <small>Stand at your counter and tap “Use my current location”, or tap the map and drag the pin to your exact spot. Students use this pin for directions to your shop.</small>
    <input type="hidden" name="lat" value="${has ? m.lat : ''}"><input type="hidden" name="lng" value="${has ? m.lng : ''}"></div>`;
}
async function mountPin(root, form, onMove = () => {}) {
  const el = $('#pin-map', root); if (!el || !form) return null;
  const read = $('#pin-read', root);
  let placed = false; // the map reports its starting pin too; only count moves after that
  try {
    const picker = await pinPicker(el, { lat: parseFloat(form.lat.value), lng: parseFloat(form.lng.value) }, ({ lat, lng }) => {
      form.lat.value = lat; form.lng.value = lng; read.dataset.lat = lat; read.dataset.lng = lng;
      const ok = inGeoBox(lat, lng);
      read.innerHTML = ok ? `${icon('check')} ${placed ? 'Pin placed. Students will walk straight to this spot.' : 'Your pin is set. Students can walk straight to you.'}` : `${icon('circle-alert')} This spot is outside the UM campus. Drag the pin to your shop.`;
      read.classList.toggle('bad-text', !ok); read.classList.toggle('is-set', ok); if (placed) onMove();
    });
    placed = true;
    $('#locate', root).onclick = (e) => busy(e.currentTarget, async () => {
      try { const p = await picker.useMyLocation(); if (!inGeoBox(p.lat, p.lng)) toast('That location is outside the UM campus area. Drag the pin to your shop.', true); else toast(p.accuracy > 50 ? `Pin placed (accurate to about ${p.accuracy} m). Drag it if it’s off.` : 'Pin placed at your location.'); }
      catch (err) { toast(err.message, true); }
    });
    return picker;
  } catch (err) { el.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return null; }
}
function pinValues(form, required) {
  const lat = parseFloat(form.lat.value), lng = parseFloat(form.lng.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) { if (required) throw new Error('Place your shop on the map first.'); return {}; }
  if (!inGeoBox(lat, lng)) throw new Error('The pin must be on the UM campus or just outside a gate.');
  return { lat, lng };
}
function shopMount(root, app, [section] = []) {
  if (section === 'ready' && $('#ready', root)) { $('#ready', root).focus({ preventScroll: true }); $('#ready', root).scrollIntoView({ block: 'start' }); }
  const f = $('#app-form', root);
  if (f) { const syncEvent = () => { $('#event-fields', root).classList.toggle('hidden', f.segment.value !== 'Temporary student entrepreneur'); };
    f.segment.onchange = syncEvent; syncEvent(); }
  const pf = $('#pin-form', root); const lf = $('#logo-form', root);
  mountPin(root, pf || f, () => { const b = $('#pin-save', root); if (b) b.hidden = false; });
  mountLogo(root, lf || f);
  mountUploads(root);
  if ($('#poster-mini-qr', root)) renderQR($('#poster-mini-qr', root), `${location.origin}${location.pathname}#/merchant/${app.ctx.uid}`, 120);
  if (lf) lf.onsubmit = (e) => {
    e.preventDefault();
    busy($('#logo-save', lf), async () => {
      if (!lf.logoData.value) return toast('Choose a logo image first.', true);
      try { await D.setMerchantLogo(app.ctx, lf.logoData.value); toast('Logo saved.'); $('#logo-save', lf).hidden = true; } catch (err) { toast(errText(err), true); }
    });
  };
  if (pf) pf.onsubmit = (e) => {
    e.preventDefault();
    busy($('#pin-save', pf), async () => {
      try { const { lat, lng } = pinValues(pf, true); await D.setMerchantPin(app.ctx, lat, lng); toast('Location saved. Students can now find you on the map.'); $('#pin-save', pf).hidden = true; }
      catch (err) { toast(err.code ? errText(err) : err.message, true); }
    });
  };
  if (f) f.onsubmit = (e) => {
    e.preventDefault();
    busy($('button', f), async () => {
      try {
        const pin = pinValues(f, true);
        const logo = f.logoData.value || null;
        if (!logo && !(app.merchant && app.merchant.logo)) throw new Error('Upload your shop logo first.');
        let qrImage = null; const file = f.qr.files[0];
        if (file) qrImage = await compressImage(file);
        await D.submitApplication(app.ctx, { name: f.name.value, accountName: f.accountName.value, type: f.type.value, segment: f.segment.value,
          location: f.location.value, zone: f.zone.value, phone: f.phone.value, ambassadorId: f.ambassadorId.value,
          eventName: f.eventName.value, eventEnd: f.eventEnd.value, qrImage, logo, ...pin });
        // First time: go straight on to the stall survey while they're here.
        const firstTime = !app.merchant;
        const doneSurvey = await D.getStallSurvey(app.ctx).then(isCurrentStallSurvey).catch(() => true);
        if (!doneSurvey) { toast(firstTime ? 'Sent to the Admin team. Next, a short assessment about your business.' : 'Sent to the Admin team. You haven’t done the merchant assessment yet.'); setTimeout(() => { location.hash = '#/stall-survey'; }, 300); return; }
        toast('Sent to the Admin team. You’ll see the status here.'); setTimeout(() => app.render(), 300);
      } catch (err) { toast(err.code ? errText(err) : err.message, true); }
    });
  };
  $$('[data-lang]', root).forEach((b) => { b.onclick = () => { readyLang = b.dataset.lang; app.render(); }; });
  const rf = $('#ready-form', root);
  if (rf) rf.onsubmit = (e) => {
    e.preventDefault();
    if (Number(rf.dataset.update) !== (toMs(app.rules.merchantReadinessUpdate?.publishedAt) || 0)) { app.render(); toast('A new readiness update is available. Review it before confirming.', true); return; }
    if (D.merchantReadinessCurrent(app.merchant, app.rules)) return;
    busy($('button', rf), async () => { try { await D.setReadiness(app.ctx); toast('Readiness recorded.'); app.render(); } catch (err) { toast(errText(err), true); } });
  };
  const off = app.on((t) => { if ((t === 'merchant' || t === 'merchant-readiness') && !root.contains(document.activeElement)) app.render(); });
  return off;
}

// "Preview as a student": the real student shop page, inside a frame, with its buttons switched off.
async function previewRender(app) {
  if (app.merchant?.status !== 'verified') return `<div class="merchant-page"><a class="back" href="#/shop">${icon('arrow-left')} My shop</a><div class="card empty"><h1>Preview as a student</h1><p>Students can see your shop once the Admin team has verified it.</p></div></div>`;
  return `<div class="merchant-page mer-preview"><a class="back" href="#/shop">${icon('arrow-left')} My shop</a>
    <div class="mer-preview-note">${icon('eye')}<div><b>This is what students see</b><p>Your shop page in the student app, with your logo, location and live deals. Buttons are switched off in this preview.</p></div></div>
    <div class="mer-preview-device"><div class="mer-preview-bar"><span>${icon('user')} Student app</span><span>Preview</span></div>
      <div class="mer-preview-screen" tabindex="0" aria-label="Your shop page, as students see it"><div inert>${await studentShopRender(app, [app.ctx.uid])}</div></div></div>
    <p class="mer-preview-tip">Something looks wrong? Change your logo or map pin in <a href="#/shop">My shop</a>. For other details, <a href="#/contact">contact the Admin team</a>.</p></div>`;
}
function previewMount(root, app) { return studentShopMount(root, app, [app.ctx.uid]) || null; }

async function posterRender(app) {
  const m = app.merchant; if (!m) return needVerified(app);
  return `<div class="merchant-page mer-poster"><a class="back no-print" href="#/shop">${icon('arrow-left')} My shop</a>
    <div class="poster" style="margin-top:8px"><img src="icons/onz-logo-dark.svg" alt="+Onz" width="680" height="214" style="width:190px;height:auto;max-width:100%;border-radius:0">
      <h1>Find us on +Onz.</h1><p class="muted" style="max-width:36ch">Find ${esc(m.name)} on +Onz, explore our offers, and pay cashless with DuitNow QR.</p>
      <div class="qr-frame"><div id="pqr"></div></div><p><b>${esc(m.name)}</b><br><span class="faint">Scan to open this shop in +Onz</span></p></div>
    <div class="row no-print" style="justify-content:center;margin-top:16px"><button class="btn primary" onclick="window.print()">${icon('printer')} Print poster</button></div></div>`;
}
function posterMount(root, app) {
  const url = `${location.origin}${location.pathname}#/merchant/${app.ctx.uid}`;
  renderQR($('#pqr', root), url, 300);
}

// ------------------------------------------------------------- promote: voucher program, live deals, seats
async function promoteRender(app, [section] = []) {
  const block = needVerified(app); if (block) return block;
  const vouchers = section === 'vouchers';
  const [deals, shop, vapp] = await Promise.all([D.myDeals(app.ctx), D.getMerchant(app.ctx, app.ctx.uid), D.myVoucherApplication(app.ctx).catch(() => null)]);
  const m = shop || app.merchant;
  app._voucherApp = vapp; app._promoDeals = deals;
  // The two tabs only swap the banner; your deals and café occupancy stay below either way.
  // The subtitles keep the difference (earn vs spend) visible. #/promote/vouchers opens on the voucher banner.
  const tabs = `<div class="mer-seg" role="group" aria-label="Ways to promote your shop">
    <button type="button" data-way="deal" class="is-deal ${vouchers ? '' : 'on'}" aria-pressed="${!vouchers}" aria-controls="way-deal"><span class="mer-seg-icon" aria-hidden="true">${icon('badge-percent')}</span><span><b>Live deals</b><small>Students earn points</small></span></button>
    <button type="button" data-way="voucher" class="is-voucher ${vouchers ? 'on' : ''}" aria-pressed="${vouchers}" aria-controls="voucher-program"><span class="mer-seg-icon" aria-hidden="true">${icon('ticket')}</span><span><b>Voucher program</b><small>Students spend points</small></span>${vapp ? '' : '<span class="mer-voucher-new">New</span>'}</button></div>`;
  const liveDeals = await D.dealOverview(app.ctx, deals, [m]);
  const liveNow = liveDeals.filter((d) => d.status === 'Available').length, paused = deals.filter((d) => !d.enabled).length;
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  return `<div class="merchant-page mer-promote" id="promote-view">${merchantHeading('Promote your shop', 'Two ways to bring students to your counter.', 'megaphone')}${tabs}
    <div id="way-deal" ${vouchers ? 'hidden' : ''}>${dealCardHTML(app, deals.length)}</div>
    <div id="way-voucher" ${vouchers ? '' : 'hidden'}>${voucherCardHTML(vapp)}</div>
    <div class="mer-promote-grid">
    <section class="section mer-deals"><div class="mer-section-head"><div><h2>Your live deals</h2>
        <p class="mer-deals-summary">${deals.length ? `<span class="num">${n(liveNow)}</span> <span>live now</span> · <span class="num">${n(paused)}</span> <span>paused</span>` : 'Publish instantly, with no approval needed.'}</p></div></div>
      ${deals.length ? `<p class="mer-deals-results" id="deal-results"></p>` : ''}
      <div class="mer-deal-grid">${liveDeals.map(({ deal: d, status }) => {
        const live = status === 'Available', published = ['approved', 'published'].includes(d.status);
        return `<article class="card mer-deal-card ${live ? 'is-live' : ''}">
        <span class="badge ${live ? 'ok' : d.status === 'rejected' ? 'bad' : d.status === 'pending' ? 'warn' : 'grey'}">${live ? '<span class="mer-live-dot" aria-hidden="true"></span>' : ''}${esc(live ? 'Live now' : status)}</span>
        ${D.dealPosterImage(d)?`<img class="merchant-deal-poster" src="${esc(D.dealPosterImage(d))}" alt="${esc(d.title)}">`:''}<h3 data-no-i18n>${esc(d.title)}</h3>${d.benefit && !same(d.benefit, d.title) ? `<p class="deal-benefit" data-no-i18n>${esc(d.benefit)}</p>` : ''}
        <div class="mer-deal-meta"><span>${icon('clock')} ${D.hhmm(d.startMin)}–${D.hhmm(d.endMin)}</span><span>${icon('users')} under ${d.threshold}% full</span></div>
        <div class="mer-deal-actions">${d.status === 'pending' ? `<button class="btn small primary" data-publish-deal="${esc(d.id)}">${icon('megaphone')} Publish deal</button>` : ''}${live ? `<a class="btn small primary" href="#/scan/${esc(d.id)}">${icon('qr-code')} Show deal QR</a>` : ''}${published ? `<button class="btn small ${d.enabled ? '' : 'primary'}" data-toggle="${esc(d.id)}" data-en="${d.enabled ? '0' : '1'}">${icon(d.enabled ? 'moon' : 'zap')} ${d.enabled ? 'Pause' : 'Resume'}</button>` : ''}</div>
        <div class="mer-deal-manage">${d.status !== 'rejected' ? `<button class="btn small ghost" data-edit-deal="${esc(d.id)}">${icon('pencil')} Edit</button>` : ''}<button class="btn small ghost mer-deal-remove" data-remove-deal="${esc(d.id)}">${icon('trash-2')} Remove</button></div>
      </article>`; }).join('') || merchantEmpty('badge-percent', 'No live deals yet.', 'Open the Live deals tab above and tap Create a deal.')}</div></section>
    ${seatsWidget(m)}
    </div></div>`;
}

const wayFacts = (list) => `<ul class="mer-way-facts">${list.map(([ic, t]) => `<li>${icon(ic)}<span>${t}</span></li>`).join('')}</ul>`;
// The live-deal builder, for a new deal or (with a deal) for editing one.
function dealSheet(app, deal = null) {
  let poster=D.dealPosterImage(deal),uploading=false,closed=false;
  const v = (k, d = '') => esc(deal?.[k] ?? d);
  const time = (min, d) => (Number.isFinite(min) ? D.hhmm(Math.min(min, 1439)) : d);
  const el = sheet(`<div class="mer-sheet-head"><span class="mer-panel-emblem">${icon(deal ? 'pencil' : 'megaphone')}</span><div><span class="mer-eyebrow">${deal ? 'Change your deal' : 'Make some noise'}</span><h2>${deal ? 'Edit live deal' : 'New live deal'}</h2></div></div>
    <div class="mer-deal-preview"><img id="deal-preview-poster" class="deal-builder-poster" alt="Deal poster preview" ${poster?`src="${esc(poster)}"`:'hidden'}><span class="mer-eyebrow">Student preview</span><h3 id="deal-preview-title" data-no-i18n></h3><div class="mer-deal-meta"><span>${icon('clock')}<span id="deal-preview-time"></span></span><span>${icon('users')}<span>Occupancy threshold</span><b id="deal-preview-threshold"></b></span></div><span class="badge warn">${deal ? 'Changes show to students straight away' : 'Publish instantly — no approval needed'}</span></div>
    <form id="df" class="stack mer-builder" style="margin-top:18px">
    <label class="field">Name<input name="title" required minlength="3" maxlength="60" placeholder="e.g. Afternoon study break" value="${v('title')}"></label>
    <label class="field">Deal poster (optional)<input id="deal-poster-input" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP. Up to 10 MB.</small></label><button type="button" class="btn small" id="remove-deal-poster" ${poster?'':'hidden'}>Remove poster</button><p id="deal-poster-error" class="event-form-error" role="alert" hidden></p>
    <label class="field">Discount details<input name="benefit" required minlength="3" maxlength="160" placeholder="e.g. 20% off any coffee" value="${v('benefit')}"></label>
    <div class="grid-2"><label class="field">From<input name="start" type="time" required value="${time(deal?.startMin, '14:00')}"></label><label class="field">Until<input name="end" type="time" required value="${time(deal?.endMin, '17:00')}"></label></div>
    <div class="grid-2"><label class="field">Only while seats taken under (%)<input name="threshold" type="number" min="1" max="100" required value="${v('threshold', 60)}"></label></div>
    <ul class="mer-deal-rules"><li>${icon('users')}<span>Each student can claim each deal once a day.</span></li><li>${icon('clock')}<span>A claim lasts 15 minutes. Apply the discount before then.</span></li></ul>
    <button type="submit" class="btn primary">${icon(deal ? 'check' : 'megaphone')} ${deal ? 'Save changes' : 'Publish deal'}</button></form>`);
  onSheetClose(()=>{closed=true;});
  const posterPreview=()=>{const img=$('#deal-preview-poster',el);img.hidden=!poster;if(poster)img.src=poster;else img.removeAttribute('src');$('#remove-deal-poster',el).hidden=!poster;};
  $('#remove-deal-poster',el).onclick=()=>{poster='';posterPreview();};
  $('#deal-poster-input',el).onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    const error=$('#deal-poster-error',el),submit=$('#df button[type=submit]',el);
    error.hidden=true;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){error.textContent='Choose a JPG, PNG or WebP poster under 10 MB.';error.hidden=false;event.target.value='';return;}
    uploading=true;submit.disabled=true;event.target.disabled=true;$('#remove-deal-poster',el).disabled=true;
    try{const image=D.cleanDealPoster(await compressImage(file,1400,.86));if(!closed){poster=image;posterPreview();}}
    catch(err){if(!closed){error.textContent=err.message;error.hidden=false;}}
    finally{uploading=false;if(!closed){submit.disabled=false;event.target.disabled=false;$('#remove-deal-poster',el).disabled=false;event.target.value='';}}
  };
  const preview = () => {
    const form = $('#df', el);
    const title = $('#deal-preview-title', el);
    if (form.title.value.trim()) { title.setAttribute('data-no-i18n', ''); title.textContent = form.title.value.trim(); }
    else { title.removeAttribute('data-no-i18n'); title.textContent = 'Your next live deal'; }
    $('#deal-preview-time', el).textContent = `${form.start.value || '—'}–${form.end.value || '—'} MYT`;
    $('#deal-preview-threshold', el).textContent = `${form.threshold.value || '—'}%`;
  };
  $('#df', el).addEventListener('input', preview); preview();
  $('#df', el).onsubmit = (e) => {
    e.preventDefault();if(uploading)return; const f = e.target; const s = D.parseHHMM(f.start.value), en = D.parseHHMM(f.end.value);
    if (en <= s) return toast('The end time must be after the start time.', true);
    const fields = { title: f.title.value, benefit: f.benefit.value, posterImage:poster, startMin: s, endMin: en, threshold: Math.floor(+f.threshold.value) };
    busy($('#df button[type=submit]', el), async () => {
      try {
        if (deal) { await D.editDeal(app.ctx, deal.id, fields); toast('Deal updated.'); }
        else { await D.createDeal(app.ctx, { ...fields, bonus: 0, limit: 1 }); toast('Live deal published.'); }
        closeSheet(); app.render();
      } catch (err) { toast(errText(err), true); }
    });
  };
}
// Live deals: students EARN points at your counter.
function dealCardHTML(app, dealCount) {
  const pts = Number(app.rules?.liveDealPoints) || 0;
  return `<section class="section mer-ways"><article class="mer-way is-deal">
    <h2 class="mer-way-title">Students <em>earn</em> points</h2>
    <p class="mer-way-lead">A discount you give at your counter during your quiet hours.</p>
    ${wayFacts([['zap', 'You set it up yourself. It goes live straight away.'], ['qr-code', `Students scan your deal QR${pts ? ` and earn ${pts} points` : ''}.`], ['store', 'You give the discount at your counter.']])}
    <button type="button" class="btn mer-way-cta" id="new-deal">${icon('plus')} ${dealCount ? 'Create another deal' : 'Create a deal'} ${icon('arrow-right')}</button>
  </article></section>`;
}
// Voucher program: students SPEND points on your shop's voucher.
function voucherCardHTML(a) {
  const status = a ? `<div class="mer-voucher-status is-${esc(a.status)}"><div class="row between"><b>Your application</b><span class="badge ${a.status === 'approved' ? 'ok' : a.status === 'declined' ? 'bad' : 'warn'}">${esc(D.VOUCHER_APP_STATUS[a.status] || 'Sent')}</span></div>
      <p data-no-i18n><b>${esc(a.offer)}</b></p><p class="faint"><span>Value</span> ${rm(a.valueCents)} · <span data-no-i18n>${n(a.perMonth)}</span> <span>a month</span> · <span>Sent</span> ${fmtDate(a.submittedAt)}</p>
      ${a.reviewNote ? `<p class="mer-voucher-note"><b>Note from the Admin team:</b> <span data-no-i18n>${esc(a.reviewNote)}</span></p>` : ''}
      ${a.status === 'approved' ? '<p class="faint">The Admin team will contact you to set up your voucher.</p>' : a.status === 'pending' ? '<p class="faint">We’ll contact you within a few working days.</p>' : ''}</div>` : '';
  const button = !a ? `<button class="btn mer-voucher-cta" id="voucher-apply">${icon('ticket')} Apply to join ${icon('arrow-right')}</button>`
    : a.status === 'pending' ? `<button class="btn mer-voucher-ghost" id="voucher-apply">${icon('pencil')} Edit application</button>`
    : a.status === 'declined' ? `<button class="btn mer-voucher-cta" id="voucher-apply">${icon('ticket')} Apply again</button>` : '';
  return `<section class="section mer-ways" id="voucher-program"><article class="mer-way is-voucher mer-voucher">
    <h2 class="mer-way-title">Students <em>spend</em> points</h2>
    <p class="mer-way-lead">A voucher for your shop that students swap their points for in Rewards.</p>
    ${wayFacts([['ticket', 'You apply. The Admin team agrees the details with you.'], ['sparkles', 'Students spend their points to get your voucher.'], ['shield-check', 'Applying is free and doesn’t commit you to anything.']])}
    ${status}${button ? `<div>${button}</div>` : ''}
  </article></section>`;
}
function voucherForm(app) {
  const a = app._voucherApp; const v = (k, d = '') => esc(a?.[k] ?? d);
  const el = sheet(`<div class="mer-sheet-head"><span class="mer-panel-emblem">${icon('ticket')}</span><div><span class="mer-eyebrow">Voucher program</span><h2>Apply to join</h2></div></div>
    <form id="vf" class="stack" style="margin-top:18px">
      <label class="field">What students get<input name="offer" required minlength="3" maxlength="160" value="${v('offer')}" placeholder="e.g. RM5 off any meal"></label>
      <div class="grid-2"><label class="field">Voucher value (RM)<input name="value" type="number" min="0.5" max="1000" step="0.5" required value="${a ? a.valueCents / 100 : ''}" placeholder="e.g. 5"></label>
        <label class="field">Vouchers you can honour a month<input name="perMonth" type="number" min="1" max="10000" step="1" required value="${v('perMonth')}" placeholder="e.g. 50"></label></div>
      <label class="field">Conditions (optional)<textarea name="conditions" rows="3" maxlength="500" placeholder="e.g. Minimum spend RM10. Weekdays only, 2–5 pm.">${v('conditions')}</textarea></label>
      <div class="grid-2"><label class="field">Contact person<input name="contactName" required minlength="2" maxlength="80" value="${v('contactName', app.profile?.name || '')}"></label>
        <label class="field">Contact phone<input name="contactPhone" type="tel" required minlength="8" maxlength="20" value="${v('contactPhone', app._merchantPhone || '')}" placeholder="e.g. 012-345 6789"></label></div>
      <button class="btn primary">${icon('ticket')} ${a ? 'Send updated application' : 'Send application'}</button></form>`);
  $('#vf', el).onsubmit = (e) => {
    e.preventDefault(); const f = e.target;
    busy($('button', el), async () => {
      try { await D.applyVoucherProgram(app.ctx, { offer: f.offer.value, value: f.value.value, perMonth: f.perMonth.value, conditions: f.conditions.value, contactName: f.contactName.value, contactPhone: f.contactPhone.value });
        closeSheet(); toast('Application sent. The Admin team will be in touch.'); app.render(); }
      catch (err) { toast(errText(err), true); }
    });
  };
}
function promoteMount(root, app) {
  if (!$('#promote-view', root)) return null;
  const stopSeats = seatsMount(root, app);
  // "3 claims this week · See insights": a reason to check Insights, and proof the deals are working.
  const results = $('#deal-results', root), insightsOn = D.featureOn(app.rules, 'merchantTools');
  const stopResults = results ? L.watchMerchantClaims(app.ctx, (claims) => {
    const since = D.clock(app.ctx) - 7 * 86400000, week = claims.filter((c) => (toMs(c.createdAt) || 0) >= since).length;
    results.innerHTML = `${icon('chart-column')}<span>${week ? `${n(week)} ${week === 1 ? 'claim' : 'claims'} in the last 7 days` : 'No claims in the last 7 days yet.'}</span>${insightsOn ? `<a href="#/insights">See insights ${icon('arrow-right')}</a>` : ''}`;
  }, () => {}) : () => {};
  $$('[data-way]', root).forEach((b) => { b.onclick = () => {
    const voucher = b.dataset.way === 'voucher';
    $$('[data-way]', root).forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    $('#way-deal', root).hidden = voucher; $('#way-voucher', root).hidden = !voucher;
    // Keep the address in step (without reloading the page) so Back and shared links land on the same banner.
    history.replaceState(null, '', voucher ? '#/promote/vouchers' : '#/promote');
  }; });
  if ($('#new-deal', root)) $('#new-deal', root).onclick = () => dealSheet(app);
  $$('[data-edit-deal]', root).forEach((b) => { b.onclick = () => dealSheet(app, (app._promoDeals || []).find((d) => d.id === b.dataset.editDeal)); });
  $$('[data-remove-deal]', root).forEach((b) => { b.onclick = async () => {
    const d = (app._promoDeals || []).find((x) => x.id === b.dataset.removeDeal); if (!d) return;
    const ok = await confirmSheet(`Remove “${d.title}”?`, 'Students won’t see it any more, and it disappears from your list. Claims students already made stay in your Insights.', 'Remove deal', true);
    if (!ok) return;
    try { await D.removeDeal(app.ctx, d.id); toast('Deal removed.'); app.render(); } catch (err) { toast(errText(err), true); }
  }; });
  if ($('#voucher-apply', root)) $('#voucher-apply', root).onclick = async () => {
    if (app._merchantPhone === undefined) app._merchantPhone = (await D.getMerchantPrivate(app.ctx, app.ctx.uid).catch(() => null))?.phone || '';
    voucherForm(app);
  };
  $$('[data-publish-deal]', root).forEach((button) => { button.onclick = () => busy(button, async () => { try { await D.publishDeal(app.ctx, button.dataset.publishDeal); toast('Live deal published.'); app.render(); } catch (error) { toast(errText(error), true); } }); });
  $$('[data-toggle]', root).forEach((b) => { b.onclick = () => busy(b, async () => { await D.toggleDeal(app.ctx, b.dataset.toggle, b.dataset.en === '1'); app.render(); }); });

  const off = app.on((t) => { if (t === 'merchant' && !root.contains(document.activeElement) && !document.querySelector('#sheet[open]')) app.render(); });
  return () => { off(); stopSeats(); stopResults(); };
}

// ------------------------------------------------------------- insights: live-deal claims over time
// A period switch, the totals for it, claims per day for the last 7 days and the busiest times of day.
const PERIODS = [['today', 'Today', 1], ['week', '7 days', 7], ['month', '30 days', 30]];
let insightsPeriod = 'week';
const MYT = 8 * 3600000, DAY = 86400000;
const hourOf = (ms) => new Date(ms + MYT).getUTCHours();
const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
async function insightsRender(app) {
  const block = needVerified(app); if (block) return block;
  return `<div class="merchant-page mer-insights">${merchantHeading('Insights', 'When students claim your live deals, and how many become sales.', 'chart-column')}
    <div class="chips mer-period" role="group" aria-label="Period">${PERIODS.map(([k, l]) => `<button type="button" data-period="${k}" class="${k === insightsPeriod ? 'on' : ''}" aria-pressed="${k === insightsPeriod}">${l}</button>`).join('')}</div>
    <div id="ins"><div class="skeleton" style="height:140px"></div></div></div>`;
}
function insightsMount(root, app) {
  if (!$('#ins', root)) return null;
  let claims = [];
  const draw = () => {
    const now = D.clock(app.ctx), todayKey = D.dayKey(now), days = PERIODS.find(([k]) => k === insightsPeriod)[2];
    // Midnight MYT today, then back (days - 1) more days.
    const start = Date.parse(todayKey + 'T00:00:00+08:00') - (days - 1) * DAY;
    const inPeriod = claims.filter((c) => (toMs(c.createdAt) || 0) >= start);
    const applied = inPeriod.filter((c) => c.status === 'applied').length;
    const rate = inPeriod.length ? Math.round(applied / inPeriod.length * 100) : 0;
    const week = Array.from({ length: 7 }, (_, i) => {
      const dayStart = Date.parse(todayKey + 'T00:00:00+08:00') - (6 - i) * DAY;
      return { label: new Date(dayStart + MYT).toLocaleDateString('en-MY', { weekday: 'short', timeZone: 'UTC' }), count: claims.filter((c) => { const t = toMs(c.createdAt) || 0; return t >= dayStart && t < dayStart + DAY; }).length };
    });
    const busiestDay = week.reduce((a, b) => (b.count > a.count ? b : a), week[0]);
    // Two-hour blocks across the hours that had claims in this period.
    const hours = inPeriod.map((c) => hourOf(toMs(c.createdAt) || 0));
    let blocks = [];
    if (hours.length) {
      const lo = Math.floor(Math.min(...hours) / 2) * 2, hi = Math.floor(Math.max(...hours) / 2) * 2;
      for (let h = lo; h <= hi; h += 2) blocks.push({ label: hourLabel(h), h, count: hours.filter((x) => x >= h && x < h + 2).length });
    }
    const busiest = blocks.reduce((a, b) => (!a || b.count > a.count ? b : a), null);
    const sorted = [...inPeriod].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    $('#ins', root).innerHTML = `<div class="mer-mini-stats">${miniStat('Deal claims', inPeriod.length, 'qr-code')}${miniStat('Discounts applied', applied, 'badge-percent')}${miniStat('Claims used at the counter', `${rate}%`, 'check')}</div>
      <section class="section card mer-chart"><div class="mer-section-head"><h2>Claims in the last 7 days</h2></div>
        ${barChart(week.map((d) => d.count), week.map((d) => d.label), { highlight: 6 })}
        <p class="mer-chart-note">${busiestDay.count ? `Busiest day: ${esc(busiestDay.label)}, ${n(busiestDay.count)} ${busiestDay.count === 1 ? 'claim' : 'claims'}.` : 'No claims in the last 7 days yet.'}</p></section>
      ${blocks.length ? `<section class="section card mer-chart"><div class="mer-section-head"><h2>Busiest times</h2></div>
        ${barChart(blocks.map((b) => b.count), blocks.map((b) => b.label), { highlight: blocks.indexOf(busiest) })}
        <p class="mer-chart-note">Most claims come in between ${hourLabel(busiest.h)} and ${hourLabel((busiest.h + 2) % 24)}. Run deals in your quieter hours to fill seats.</p></section>` : ''}
      <section class="section card mer-redemption-history"><div class="mer-section-head"><h2>Recent deal claims</h2><span class="mer-count">${n(inPeriod.length)}</span></div><div class="list">${sorted.slice(0, 50).map((c) => `<div class="item"><span class="mer-redemption-stamp">${icon('qr-code')}</span><div class="grow"><h3 data-no-i18n>${esc(c.title)}</h3><p><span data-no-i18n>${esc(c.studentName)}</span> · ${fmtDate(c.createdAt)} ${fmtTime(c.createdAt)}</p></div><span class="badge ${c.status === 'applied' ? 'ok' : 'grey'}">${c.status === 'applied' ? 'Discount applied' : L.claimExpired(c, now) ? 'Expired' : 'Claim confirmed'}</span></div>`).join('') || merchantEmpty('qr-code', 'No deal claims in this period.', 'Student QR scans will appear here.')}</div></section>`;
  };
  $$('[data-period]', root).forEach((b) => { b.onclick = () => { insightsPeriod = b.dataset.period; $$('[data-period]', root).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); draw(); }; });
  return L.watchMerchantClaims(app.ctx, (list) => { claims = list; draw(); }, () => {});
}

async function surveyRender(app) {
  const existing = await D.getSurvey(app.ctx).catch(() => null);
  return `<div class="merchant-page mer-survey"><a class="back" href="#/home">${icon('arrow-left')} Home</a>${merchantHeading('Cashless readiness check', 'Your answers help the Admin team decide who needs an ambassador visit or staff training.', 'target', 'Build your confidence')}${surveyHTML('merchant', existing)}</div>`;
}

export const routes = {
  ...INFORMATION_ROUTES,
  home: { title: 'Home', render: homeRender, mount: homeMount, wide: true },
  scan: { title: 'Deal QR', render: merchantDealQRRender, mount: merchantDealQRMount, feature: ['merchantTools', 'dealsAndPay', 'overview'], wide: true },
  shop: { title: 'My shop', render: shopRender, mount: shopMount, wide: true },
  poster: { title: 'Poster', render: posterRender, mount: posterMount, tab: 'shop' },
  preview: { title: 'Preview as a student', render: previewRender, mount: previewMount, tab: 'shop', wide: true },
  promote: { title: 'Promote your shop', render: promoteRender, mount: promoteMount, feature: ['merchantTools', 'dealsAndPay', 'overview'], wide: true },
  insights: { title: 'Insights', render: insightsRender, mount: insightsMount, feature: 'merchantTools', wide: true },
  'stall-survey': { title: 'Merchant assessment', render: stallSurveyRender, mount: stallSurveyMount, tab: 'home', wide: true },
  survey: { title: 'Readiness check', render: surveyRender, mount: (r, a) => surveyMount(r, a, 'merchant', 'home'), tab: 'home', feature: 'merchantTools', wide: true },
  'delete-account': { title: 'Close my account', render: closeRender, mount: closeMount, tab: 'home' },
};
