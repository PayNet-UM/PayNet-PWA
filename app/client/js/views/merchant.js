import { livePointEarningOn } from '../points-policy.js';
import { learningPlan } from '../points-policy.js';
import { INFORMATION_ROUTES } from '../information.js';
// Merchant app: shop setup, readiness, live-deal QR claims, applied discounts and counter poster.
import * as D from '../data.js';
import * as L from '../live-deals.js';
import { merchantDealQRRender, merchantDealQRMount } from '../deal-flow.js';
import { safeImg, $, $$, esc, icon, rm, n, toast, sheet, closeSheet, confirmSheet, busy, errText, fmtDate, fmtTime, timeAgo, confetti, renderQR,
  startScanner, compressImage, barChart, colorFor, initials, downloadCSV } from '../ui.js';
import { pinPicker, hasPin, inGeoBox } from '../map.js';
import { surveyHTML, surveyMount, merchantLogo, studentShopRender, studentShopMount } from './student.js';
import { avatarSVG, defaultFor } from '../avatar.js';
import { merchantHeading, merchantMetric, merchantEmpty, merchantSetup, merchantAction } from '../merchant-ui.js';
import { closeRender, closeMount } from './close.js';
import { stallSurveyRender, stallSurveyMount } from '../stall-survey-view.js';
import { isCurrentStallSurvey } from '../stall-survey.js';
import { ozIcon } from '../oz-icons.js';
import { ozListRow, ozButton, ozTag } from '../oz-ui.js';
import { merchantBack } from '../merchant-ui.js';

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
const statusText = (m) => !m ? 'Not applied' : m.status === 'verified' ? 'Admin verified' : m.status === 'rejected' ? 'Needs changes'
  : m.status === 'suspended' ? 'Suspended' : 'The Admin team is reviewing';

const merchantEmptyTile = (glyph) => `<span class="oz-mzero-ic" aria-hidden="true">${ozIcon(glyph)}</span>`;
function needVerified(app) {
  if (app.merchant && app.merchant.status === 'verified') return null;
  // Figma "Merchant · Verification required" 523:11969.
  return `<div class="oz-mpage"><section class="oz-mcard oz-mzero-card mer-access-card">${merchantEmptyTile('shield')}<h2>${app.merchant ? 'Waiting for the Admin team to verify your shop' : 'Apply to join first'}</h2>
    <p>${app.merchant ? 'Usually reviewed within 1–2 working days.' : 'Submit your shop details for Admin team verification.'}</p>
    ${ozButton(app.merchant ? 'View application' : 'Apply now', { href: '#/shop', block: true })}</section></div>`;
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
// Figma "Start here" card (phone 1102:58335, web 1102:59069): progress bar, one status per step, next step's help,
// one lime action. Same steps and logic as before; mount still ticks the claims step ([data-step-claims]).
const STEP_ICON = { store: 'stall', 'list-checks': 'learn', 'badge-check': 'shield', 'shield-check': 'check', 'badge-percent': 'voucher', 'qr-code': 'scan' };
function startHereHTML(steps) {
  if (!steps.some(([, , , , done]) => done !== true)) return '';
  const next = steps.find(([, , , , done, canDo]) => done !== true && canDo) || steps.find(([, , , , done]) => done !== true);
  const doneCount = steps.filter(([, , , , done]) => done === true).length;
  const state = (done, title, canDo) => done === true ? ['is-done', 'Completed'] : next[1] === title ? ['is-next', 'Next step'] : done === 'waiting' ? ['is-waiting', 'In progress'] : canDo ? ['', 'To do'] : ['is-locked', 'Not started'];
  return `<section class="oz-mstart mer-start" id="start-here" aria-labelledby="start-title">
    <p class="oz-mstart-kicker">Start here</p><h2 id="start-title">Get your shop ready for students</h2>
    <p class="oz-mstart-count" data-start-count>${doneCount} of ${steps.length} done</p>
    <span class="oz-mstart-bar" aria-hidden="true"><i style="width:${Math.round((doneCount / steps.length) * 100)}%"></i></span>
    <ol class="oz-mstart-steps">${steps.map(([glyph, title, , route, done, canDo]) => { const [cls, label] = state(done, title, canDo);
      return `<li class="${cls}" ${done === 'claims' ? 'data-step-claims' : ''}><a href="#/${route}">
        <span class="oz-mstart-ic mer-start-num" aria-hidden="true">${ozIcon(done === true ? 'check' : cls === 'is-locked' ? 'lock' : STEP_ICON[glyph] || 'check')}</span>
        <span class="oz-mstart-text"><b>${title}</b><small class="oz-mstart-state">${label}</small></span></a></li>`; }).join('')}</ol>
    <p class="oz-mstart-help">${next[2]}</p>
    <a class="oz-btn oz-btn-primary oz-btn-md oz-mstart-cta" href="#/${next[3]}"><span>Next: ${next[1]}</span></a>
  </section>`;
}
async function homeRender(app) {
  const m = app.merchant; const name = m ? m.name : app.profile.name;
  const liveOn = livePointEarningOn(app.rules);
  const verified = m?.status === 'verified'; const toolsOn = D.featureOn(app.rules, 'merchantTools');
  const deals = verified && liveOn ? (await D.myDeals(app.ctx).catch(() => [])).length : 0;
  // A new readiness update from the Admin team for a shop that was already set up shows the readiness card
  // (with the Admin team's message), not the whole "Start here" path again.
  const updated = !!m?.ready && !D.merchantReadinessCurrent(m, app.rules);
  const stall = m ? await D.getStallSurvey(app.ctx).catch(() => null) : null;
  const start = updated || startDone(app.ctx.uid) ? '' : startHereHTML(startSteps(app, m, deals, liveOn, stall));
  const readiness = start ? '' : merchantSetup(m, hasPin, app.rules);
  const staffReady = D.merchantReadinessCurrent(m, app.rules);
  const status = !m ? 'Not applied yet' : m.status === 'verified' ? 'Admin verified' : m.status === 'rejected' ? 'Needs changes' : m.status === 'suspended' ? 'Suspended' : 'The Admin team is reviewing';
  // "Your shop" rows (Figma order). Production conditions decide which rows exist.
  const rows = [
    ['shop', 'stall', 'My shop', 'Profile, verification and map location'],
    ...(m ? [['stall-survey', 'learn', 'Merchant assessment', isCurrentStallSurvey(stall) ? 'See your stall type and answers' : '15 questions about your business']] : []),
    ...(toolsOn ? [['survey', 'check', 'Cashless readiness', 'Review your QR readiness']] : []),
    ...(verified && liveOn ? [['promote', 'voucher', 'Promote your shop', 'Live deals and voucher program'], ['scan', 'scan', 'Deal QR', 'Show your deal QR at the counter']] : []),
    ...(toolsOn && verified ? [['insights', 'wallet', 'Insights', 'Claims and performance']] : []),
  ];
  return `<div class="oz-mhome merchant-page mer-home"><h1 class="oz-mhome-title">Merchant home</h1>
    <div class="oz-mhome-grid mer-home-grid ${readiness ? '' : 'is-ready'}">
      <div class="oz-mhome-main">
        <section class="oz-mhub" aria-label="Your merchant hub"><p class="oz-mhub-kicker">Your merchant hub</p><h2 data-no-i18n>${esc(name)}</h2>
          <p class="oz-mhub-status">${verified ? ozIcon('check') : ''}<span>${status}${staffReady ? ' · Staff ready' : ''}</span></p></section>
        ${start}
        ${verified && !hasPin(m) && !start ? `<a class="oz-mnotice" href="#/shop">${ozIcon('map-pin')}<span><b>Add your shop location</b><small>Students can’t find you on the map yet.</small></span>${ozIcon('s:chevron-right')}</a>` : ''}
        ${readiness}
        ${verified ? `<section class="oz-mactivity" aria-labelledby="mact-title"><div class="oz-mhome-head"><h2 id="mact-title">Live-deal activity</h2>${toolsOn ? '<a class="oz-link" href="#/insights">Insights</a>' : ''}</div>
          <div class="oz-mstats stats mer-stats" id="merchant-wallet"><span class="oz-skel oz-skel-md"></span><span class="oz-skel oz-skel-md"></span><span class="oz-skel oz-skel-md"></span></div><div id="merchant-wallet-empty"></div></section>` : ''}
        <a class="oz-mlink" href="#/points"><span class="oz-mlink-ic" aria-hidden="true">${ozIcon('sparkles')}</span>
          <span class="oz-mlink-text"><b>Student points explained</b><small>How students earn points at your counter. Vouchers are fulfilled by the Admin team.</small></span>
          <span class="oz-tag oz-tag-points"><span class="num">${n(learningPlan(app.rules).total)}</span>&nbsp;pts</span>${ozIcon('s:chevron-right')}</a>
      </div>
      <aside class="oz-mhome-side"><h2 class="oz-mhome-side-title">Your shop</h2>
        <nav class="oz-mrows mer-actions" aria-label="Your shop">${rows.map(([route, glyph, title, sub]) => ozListRow({ title, sub, iconName: glyph, href: '#/' + route, chevron: false })).join('')}</nav>
      </aside>
    </div></div>`;
}
function homeMount(root, app) {
  const off = app.on((topic) => { if (topic === 'merchant' || topic === 'merchant-readiness') app.render(); });
  const stop = $('#merchant-wallet', root) ? L.watchMerchantClaims(app.ctx, (claims) => {
    const waiting = claims.filter((c) => c.status === 'claimed' && !L.claimExpired(c)).length;
    const stat = (label, value, hint) => `<div class="oz-mstat stat"><span class="oz-mstat-label">${label}</span><strong>${value}</strong><small>${hint}</small></div>`;
    $('#merchant-wallet', root).innerHTML = stat('Deal claims', n(claims.length), 'Students who scanned your deal QR')
      + stat('Discounts applied', n(claims.filter((c) => c.status === 'applied').length), 'Claims you gave the discount for')
      + stat('Awaiting discount', n(waiting), waiting ? 'Open Deal QR and tap Apply discount' : 'Nobody waiting right now');
    $('#merchant-wallet-empty', root).innerHTML = claims.length ? '' : `<div class="oz-mempty">${ozIcon('info')}<span>No claims yet. Create a live deal, then show its QR at your counter.</span><a class="oz-btn oz-btn-primary oz-btn-sm" href="#/promote"><span>Create a deal</span></a></div>`;
    // The last "Start here" step ticks off once a student has claimed a deal.
    const li = $('[data-step-claims]', root);
    if (li && claims.length) { li.classList.remove('is-next', 'is-locked'); li.classList.add('is-done'); $('.mer-start-num', li).innerHTML = ozIcon('check'); const st = $('.oz-mstart-state', li); if (st) st.textContent = 'Completed'; }
    // Every step done: the banner goes away for good.
    const banner = $('#start-here', root);
    if (banner && !$('#start-here li:not(.is-done)', root)) { markStartDone(app.ctx.uid); banner.remove(); }
  }, () => {}) : () => {};
  return () => { off(); stop(); };
}
const miniStat = (label, value) => `<div class="oz-mstat mer-mini"><span class="oz-mstat-label">${label}</span><strong class="num">${typeof value === 'number' ? n(value) : esc(value)}</strong></div>`;

// ------------------------------------------------------------- café occupancy: how full the café is right now
// Counting people one tap at a time is slow at a busy counter, so the card offers three speeds:
//  - drag the slider to any count (one gesture for "the lunch rush just arrived")
//  - quick-set chips: Empty, ¼, Half, ¾, Full
//  - − / + for one seat; press and hold to keep counting (accelerates after a moment)
// Every change shows straight away and is saved once the merchant stops (700 ms debounce).
const SEAT_PRESETS = [['Empty', 0], ['¼', 0.25], ['Half', 0.5], ['¾', 0.75], ['Full', 1]];
function seatsWidget(m) {
  const seats = Math.max(0, Number(m?.seats) || 0), occupied = Math.min(seats, Math.max(0, Number(m?.occupied) || 0));
  const pct = seats ? Math.round(occupied / seats * 100) : 0;
  return `<section class="oz-mcard oz-mseats mer-seats" id="seats" data-seats="${seats}" data-occupied="${occupied}" aria-labelledby="seats-title">
    <div class="oz-mcard-head oz-mseats-head"><div><h2 id="seats-title">Café occupancy</h2>${seats ? `<p class="oz-mseats-foot" data-saved>${m.occupancyAt ? `Updated ${timeAgo(m.occupancyAt)}` : 'Drag, tap a level, or hold + to count fast.'}</p>` : ''}</div>${seats ? `<button type="button" class="oz-link" data-edit-seats>Edit total</button>` : ''}</div>
    ${seats ? `<div class="oz-mseats-read" aria-live="polite"><strong class="num" data-occupied>${n(occupied)}</strong><span>of <span class="num">${n(seats)}</span> seats taken</span><b class="oz-mseats-pct"><span data-pct>${pct}</span>%</b></div>
      <div class="oz-mseats-ctl">
        <button type="button" class="oz-mstep" data-step="-1" aria-label="One fewer seat taken" ${occupied ? '' : 'disabled'}>${ozIcon('s:minus')}</button>
        <input type="range" class="oz-mseats-range" data-ring style="--progress:${pct}%" min="0" max="${seats}" step="1" value="${occupied}" aria-label="Seats taken now" aria-valuetext="${n(occupied)} of ${n(seats)} seats taken">
        <button type="button" class="oz-mstep" data-step="1" aria-label="One more seat taken" ${occupied < seats ? '' : 'disabled'}>${ozIcon('s:plus')}</button>
      </div>
      <div class="oz-mseats-presets" role="group" aria-label="Set quickly">${SEAT_PRESETS.map(([label, f]) => `<button type="button" data-seat-preset="${f}" aria-pressed="${occupied === Math.round(seats * f)}">${label}</button>`).join('')}</div>
      <p class="oz-mnote oz-mseats-note">Live deals show only while you’re below their seat limit.</p>`
    : `<p class="oz-mnote">Set how many seats you have. A live deal only shows while your café is less full than the deal’s limit.</p>${ozButton('Set my seats', { block: true, attr: { 'data-edit-seats': '' } })}`}
  </section>`;
}
function seatsMount(root, app) {
  const box = $('#seats', root); if (!box) return () => {};
  let seats = +box.dataset.seats, occupied = +box.dataset.occupied, saved = occupied, timer = 0, hold = 0;
  const range = $('.oz-mseats-range', box);
  const draw = () => {
    if (!range) return;
    $('[data-occupied]', box).textContent = n(occupied);
    const pct = seats ? Math.round(occupied / seats * 100) : 0;
    range.value = occupied; range.style.setProperty('--progress', `${pct}%`); range.setAttribute('aria-valuetext', `${occupied} of ${seats} seats taken`);
    $('[data-pct]', box).textContent = pct;
    $('[data-step="-1"]', box).disabled = occupied <= 0; $('[data-step="1"]', box).disabled = occupied >= seats;
    $$('[data-seat-preset]', box).forEach((b) => b.setAttribute('aria-pressed', String(occupied === Math.round(seats * +b.dataset.seatPreset))));
  };
  const save = async () => {
    timer = 0; if (occupied === saved) return;
    const want = occupied; $('[data-saved]', box).textContent = 'Saving…';
    try { await D.setOccupancy(app.ctx, seats, want); saved = want; if (box.isConnected) $('[data-saved]', box).textContent = 'Saved just now'; }
    catch (err) { occupied = saved; if (box.isConnected) { draw(); $('[data-saved]', box).textContent = ''; } toast(errText(err), true); }
  };
  const set = (v) => { occupied = Math.min(seats, Math.max(0, v)); draw(); clearTimeout(timer); timer = setTimeout(save, 700); };
  // Press and hold: one step now, repeat after 400 ms, faster (and by 5) after a second.
  const stopHold = () => { clearTimeout(hold); hold = 0; };
  $$('[data-step]', box).forEach((b) => {
    const step = Number(b.dataset.step); let held = false;
    b.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return; held = false; const t0 = performance.now();
      const tick = () => { held = true; const fast = performance.now() - t0 > 1400; set(occupied + step * (fast ? 5 : 1)); if (b.disabled) return stopHold(); hold = setTimeout(tick, fast ? 90 : 140); };
      hold = setTimeout(tick, 400);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => b.addEventListener(t, stopHold));
    b.onclick = () => { if (held) { held = false; return; } set(occupied + step); };
  });
  if (range) range.oninput = () => set(Math.round(+range.value));
  $$('[data-seat-preset]', box).forEach((b) => { b.onclick = () => set(Math.round(seats * +b.dataset.seatPreset)); });
  $('[data-edit-seats]', box).onclick = () => {
    const el = sheet(`<h2 class="oz-msheet-title">Change total seats</h2><form id="seats-form" class="oz-form">
      <div class="oz-mgrid2"><label class="oz-field">Total seats<input name="seats" type="number" inputmode="numeric" min="1" max="2000" required value="${seats || ''}"></label>
      <label class="oz-field">Seats taken<input name="occupied" type="number" inputmode="numeric" min="0" max="2000" required value="${seats ? occupied : ''}"></label></div>
      <button class="oz-btn oz-btn-primary oz-btn-md oz-btn-block"><span>Save seats</span></button></form>`);
    $('#seats-form', el).onsubmit = (e) => {
      e.preventDefault(); const s = Math.floor(+e.target.seats.value), o = Math.floor(+e.target.occupied.value);
      if (o > s) return toast('Seats taken can’t be more than total seats.', true);
      busy($('button', el), async () => { try { clearTimeout(timer); await D.setOccupancy(app.ctx, s, o); closeSheet(); toast('Seats updated.'); app.render(); } catch (err) { toast(errText(err), true); } });
    };
  };
  // Leaving the page mid-tap still saves the last count.
  return () => { stopHold(); if (timer) { clearTimeout(timer); save(); } };
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
const uploadField = (name, accept, label, help, { required = false, current = '' } = {}) => `<div class="oz-field mer-upload-field"><span>${label}</span>
  <label class="mer-upload"><input type="file" name="${name}" accept="${accept}" class="visually-hidden" ${required ? 'required' : ''}>
    <span class="oz-btn oz-btn-ghost oz-btn-sm"><span>${current ? 'Choose a new photo' : 'Choose a photo'}</span></span><span class="mer-upload-name" data-file-name>${current ? esc(current) : 'No photo chosen yet'}</span></label>
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
    ${m && m.status === 'rejected' ? `<div class="oz-mnotice is-bad">${ozIcon('alert')}<span><b>Needs changes</b><small>The Admin team asked for changes: ${esc(m.reviewNote || 'see details')}. Update and send again.</small></span></div>` : ''}
    ${m && m.status === 'pending' ? `<div class="oz-mnotice">${ozIcon('clock')}<span><b>Verification pending</b><small>Sent ${fmtDate(m.submittedAt)}. The Admin team will check that your QR name matches your business.</small></span></div>` : ''}`;

  // Not verified yet: the application form, with friendlier upload buttons.
  if (editable) return `<div class="merchant-page mer-shop">${head}
    <section class="oz-msection mer-business"><div class="oz-mcard-head"><h2>${m ? 'Your application' : 'Apply to join +Onz'}</h2></div>
    <form id="app-form" class="oz-mcard oz-form">
      <label class="oz-field">Business name, as students know it<input name="name" required minlength="2" maxlength="100" value="${v('name')}"></label>
      <label class="oz-field">Account name on your DuitNow QR<input name="accountName" required value="${v('accountName')}"><small>The Admin team checks this matches the QR.</small></label>
      <div class="oz-mgrid2"><label class="oz-field">Type${sel('type', D.MERCHANT_TYPES, m?.type)}</label><label class="oz-field">Category${sel('segment', D.SEGMENTS, m?.segment)}</label></div>
      <div class="oz-mgrid2"><label class="oz-field">Location<input name="location" required placeholder="e.g. KK3 cafeteria" value="${v('location')}"></label><label class="oz-field">Campus zone${sel('zone', D.ZONES, m?.zone)}</label></div>
      <div class="oz-mgrid2"><label class="oz-field">Contact phone<input name="phone" type="tel" value="${v('phone')}"></label><label class="oz-field">Ambassador ID (optional)<input name="ambassadorId" value="${v('ambassadorId')}" placeholder="e.g. AMB-003"></label></div>
      <div id="event-fields" class="oz-mgrid2"><label class="oz-field">Event name<input name="eventName" value="${v('eventName')}"></label><label class="oz-field">Event ends<input name="eventEnd" type="date" value="${v('eventEnd')}"></label></div>
      ${logoBlock(m)}
      ${pinBlock(m)}
      ${uploadField('qr', 'image/*', 'Photo of your DuitNow QR', 'A clear, straight photo. It goes on the monthly list PayNet uses to count your transactions.', { required: !(priv && priv.qrImage), current: priv && priv.qrImage ? 'Photo uploaded' : '' })}
      ${priv && safeImg(priv.qrImage) ? `<img class="qr-thumb" style="width:120px;height:120px" src="${safeImg(priv.qrImage)}" alt="Your uploaded DuitNow QR">` : ''}
      <button class="oz-btn oz-btn-primary oz-btn-md oz-btn-block">${m ? 'Send updated details to the Admin team' : 'Send to the Admin team for verification'}</button>
    </form></section></div>`;

  // Verified: the things a merchant changes or uses first, the locked details last as a plain list.
  const details = [['Business name', m.name], ['Account name on your DuitNow QR', priv?.accountName], ['Type', m.type], ['Category', m.segment],
    ['Location', m.location], ['Campus zone', m.zone], ['Contact phone', priv?.phone || m.phone], ['Ambassador ID', priv?.ambassadorId || m.ambassadorId],
    ...(m.eventName ? [['Event', `${m.eventName}${m.eventEnd ? ` · until ${m.eventEnd}` : ''}`]] : [])].filter(([, val]) => val);
  const facts = [m.type, m.zone].filter(Boolean);
  const readyNotice = app.rules.merchantReadinessUpdate?.message ? `<div class="oz-mnotice mer-readiness-notice">${ozIcon('bell')}<span><b>New readiness update</b><small data-no-i18n>${esc(app.rules.merchantReadinessUpdate.message)}</small></span></div>` : '';
  return `<div class="merchant-page mer-shop oz-mshop">
    <form id="logo-form" class="oz-mshop-head mer-shop-hero">
      <label class="oz-mlogo" title="Change logo (square works best)"><input name="logo" type="file" accept="image/png,image/jpeg,image/webp" class="visually-hidden" aria-label="Change your shop logo">
        <span class="oz-mlogo-img" id="logo-prev">${safeImg(m.logo) ? `<img src="${safeImg(m.logo)}" alt="Your logo">` : ozIcon('stall')}</span><span class="oz-mlogo-edit" aria-hidden="true">${ozIcon('edit')}</span></label>
      <input type="hidden" name="logoData" value="">
      <div class="oz-mshop-copy"><p class="oz-mkicker">My shop</p><h1 data-no-i18n>${esc(m.name)}</h1>
        <p class="oz-mshop-meta">${ozTag(statusText(m), m.status === 'verified' ? 'success' : 'warning')}${ready ? ozTag('Staff ready', 'success') : ''}${[m.location, ...facts].filter(Boolean).length ? `<span data-no-i18n>${[m.location, ...facts].filter(Boolean).map(esc).join(' · ')}</span>` : ''}</p></div>
      <div class="oz-mshop-actions">
        <button class="oz-btn oz-btn-secondary oz-btn-sm" id="logo-save" hidden><span>Save new logo</span></button>
        ${ozButton('Open poster', { href: '#/poster', kind: 'ghost', size: 'sm' })}${ozButton('Preview as a student', { href: '#/preview', size: 'sm' })}
      </div>
    </form>
    <div class="mer-shop-grid is-verified oz-mshop-grid">
      <section class="oz-mcard mer-shop-map" aria-labelledby="map-title"><div class="oz-mcard-head"><h2 id="map-title">Where students find you</h2></div>
        <form id="pin-form" class="oz-form">${pinBlock(m, true)}<button class="oz-btn oz-btn-primary oz-btn-md" id="pin-save" hidden><span>Save new location</span></button></form></section>
      <section class="oz-mcard mer-counter-kit oz-mposter" aria-labelledby="poster-title"><div class="oz-mcard-head"><h2 id="poster-title">Counter poster</h2></div>
        <div class="oz-mposter-body"><a class="mer-poster-mini" href="#/poster" aria-label="Open your poster"><img src="icons/onz-logo-dark.svg" alt="" width="680" height="214"><b>Find us on +Onz.</b><span id="poster-mini-qr" aria-hidden="true"></span><small data-no-i18n>${esc(m.name)}</small></a>
          <div class="mer-poster-copy"><p>Print it and put it next to your DuitNow QR. Students scan it to open your shop in +Onz.</p>${ozButton('Print poster', { href: '#/poster', kind: 'secondary', size: 'sm' })}</div></div></section>
      <section class="oz-mcard mer-readiness oz-mready" id="ready" tabindex="-1" aria-labelledby="ready-title">
        ${ready ? `<details class="mer-ready-done"><summary><span class="oz-mstart-ic" aria-hidden="true">${ozIcon('shield')}</span><span class="oz-mready-text"><b id="ready-title">Staff readiness</b><small>Done ${fmtDate(m.readyAt)}</small></span><span class="oz-mready-toggle"><span class="oz-mready-more">Review checklist</span><span class="oz-mready-less">Hide checklist</span>${ozIcon('s:chevron-right')}</span></summary>${readinessBody(app, m, ready)}</details>`
          : `<div class="oz-mready-head"><span class="oz-mstart-ic" aria-hidden="true">${ozIcon('shield')}</span><span class="oz-mready-text"><b id="ready-title">Staff readiness</b><small>A short checklist so everyone at the counter knows what to do.</small></span>${ozTag('To do', 'warning')}</div>
        ${readyNotice}${readinessBody(app, m, ready)}`}
      </section>
      <section class="oz-mcard mer-shop-details" id="shop-details" aria-labelledby="details-title"><div class="oz-mcard-head"><h2 id="details-title">Business details</h2>${ozTag('Locked', 'lilac')}</div>
        <dl class="mer-details">${details.map(([k, val]) => `<div><dt>${k}</dt><dd data-no-i18n>${esc(val)}</dd></div>`).join('')}
          ${priv && safeImg(priv.qrImage) ? `<div><dt>Your DuitNow QR</dt><dd><img class="qr-thumb" src="${safeImg(priv.qrImage)}" alt="Your uploaded DuitNow QR"></dd></div>` : ''}</dl>
        <p class="oz-mnote mer-details-note">Checked by the Admin team, so these are locked. <a href="#/contact">Contact the Admin team</a> to change something.</p></section>
    </div></div>`;
}
function readinessBody(app, m, ready) {
  return `<div class="oz-mready-body"><div class="oz-mchips" role="group" aria-label="Checklist language">${Object.keys(READY_TEXT).map((l) => `<button type="button" data-lang="${l}" class="${l === readyLang ? 'on' : ''}" aria-pressed="${l === readyLang}">${l}</button>`).join('')}</div>
    <div class="oz-mready-help">${READY_TEXT[readyLang].map(([t, d]) => `<div><h3>${esc(t)}</h3><p class="oz-mnote">${esc(d)}</p></div>`).join('')}</div>
    <form id="ready-form" class="oz-mready-form" data-update="${toMs(app.rules.merchantReadinessUpdate?.publishedAt) || 0}"><div class="oz-mready-checks">${READY_CHECKS.map((c) => `<label class="oz-mcheck"><input type="checkbox" required ${ready ? 'checked' : ''}><span>${esc(c)}</span></label>`).join('')}</div>
      <button class="oz-btn ${ready ? 'oz-btn-ghost' : 'oz-btn-primary'} oz-btn-md" ${m.status === 'rejected' ? 'disabled' : ''}><span>${ready ? 'Checklist complete' : 'Confirm my staff are ready'}</span></button></form></div>`;
}
function logoBlock(m) {
  return `<div class="oz-field logo-field"><span>Shop logo</span>
    <div class="oz-mlogo-row"><span class="logo-preview" id="logo-prev">${m && safeImg(m.logo) ? `<img src="${safeImg(m.logo)}" alt="Your logo">` : icon('image')}</span>
      <div class="oz-mlogo-copy"><label class="mer-upload"><input name="logo" type="file" accept="image/png,image/jpeg,image/webp" class="visually-hidden" ${m && m.logo ? '' : 'required'} aria-label="Upload your logo">
        <span class="oz-btn oz-btn-ghost oz-btn-sm"><span>${m && m.logo ? 'Choose a new logo' : 'Choose your logo'}</span></span></label>
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
  return `<div class="oz-field pin-field">${standalone ? '' : '<span>Shop location on the map</span>'}
    <div class="pin-map" id="pin-map" aria-label="Map to place your shop"></div>
    <div class="oz-mpin-bar pin-bar"><button type="button" class="oz-btn oz-btn-ghost oz-btn-sm" id="locate">${ozIcon('locate')}<span>Use my current location</span></button>
      <span class="mer-pin-status ${has ? 'is-set' : ''}" id="pin-read" ${has ? `data-lat="${m.lat}" data-lng="${m.lng}"` : ''}>${has ? 'Pin saved' : 'No pin yet. Tap the map or use your current location.'}</span></div>
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
      read.textContent = ok ? (placed ? 'Pin moved. Save to update it.' : 'Pin saved') : 'This spot is outside the UM campus. Drag the pin to your shop.';
      read.classList.toggle('bad-text', !ok); read.classList.toggle('is-set', ok); if (placed) onMove();
    }, { kit: true });
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
  if (app.merchant?.status !== 'verified') return `<div class="merchant-page">${merchantBack('#/shop', 'My shop')}<section class="oz-mcard oz-mzero-card">${merchantEmptyTile('eye')}<h1>Preview as a student</h1><p>Students can see your shop once the Admin team has verified it.</p></section></div>`;
  return `<div class="merchant-page mer-preview">${merchantBack('#/shop', 'My shop')}
    <div class="oz-mnotice">${ozIcon('eye')}<span><b>This is what students see</b><small>Your shop page in the student app, with your logo, location and live deals. Buttons are switched off in this preview.</small></span></div>
    <div class="mer-preview-device"><div class="mer-preview-bar"><span>${icon('user')} Student app</span><span>Preview</span></div>
      <div class="mer-preview-screen" tabindex="0" aria-label="Your shop page, as students see it"><div inert>${await studentShopRender(app, [app.ctx.uid])}</div></div></div>
    <p class="mer-preview-tip">Something looks wrong? Change your logo or map pin in <a href="#/shop">My shop</a>. For other details, <a href="#/contact">contact the Admin team</a>.</p></div>`;
}
function previewMount(root, app) { return studentShopMount(root, app, [app.ctx.uid]) || null; }

async function posterRender(app) {
  const m = app.merchant; if (!m) return needVerified(app);
  return `<div class="merchant-page mer-poster"><span class="no-print">${merchantBack('#/shop', 'My shop')}</span>
    <div class="poster" style="margin-top:8px"><img src="icons/onz-logo-dark.svg" alt="+Onz" width="680" height="214" style="width:190px;height:auto;max-width:100%;border-radius:0">
      <h1>Find us on +Onz.</h1><p class="muted" style="max-width:36ch">Find ${esc(m.name)} on +Onz, explore our offers, and pay cashless with DuitNow QR.</p>
      <div class="qr-frame"><div id="pqr"></div></div><p><b>${esc(m.name)}</b><br><span class="faint">Scan to open this shop in +Onz</span></p></div>
    <div class="no-print oz-mposter-actions"><button type="button" class="oz-btn oz-btn-primary oz-btn-md oz-btn-block" onclick="window.print()">${ozIcon('printer')}<span>Print poster</span></button></div></div>`;
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
  const tabs = `<div class="oz-seg oz-mseg mer-seg" role="group" aria-label="Ways to promote your shop">
    <button type="button" data-way="deal" class="oz-seg-item is-deal ${vouchers ? '' : 'on'}" aria-pressed="${!vouchers}" aria-controls="way-deal"><b>Live deals</b><small class="sr">Students earn points</small></button>
    <button type="button" data-way="voucher" class="oz-seg-item is-voucher ${vouchers ? 'on' : ''}" aria-pressed="${vouchers}" aria-controls="voucher-program"><b>Voucher program</b><small class="sr">Students spend points</small>${vapp ? '' : '<span class="oz-mnew">New</span>'}</button></div>`;
  const liveDeals = await D.dealOverview(app.ctx, deals, [m]);
  const liveNow = liveDeals.filter((d) => d.status === 'Available').length, paused = deals.filter((d) => !d.enabled).length;
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const dealActions = (d, live, published) => [
    d.status === 'pending' ? `<button class="oz-btn oz-btn-primary oz-btn-sm" data-publish-deal="${esc(d.id)}"><span>Publish deal</span></button>` : '',
    live ? `<a class="oz-btn oz-btn-primary oz-btn-sm" href="#/scan/${esc(d.id)}"><span>Show deal QR</span></a>` : '',
    published ? `<button class="oz-btn ${d.enabled ? 'oz-btn-ghost' : 'oz-btn-secondary'} oz-btn-sm" data-toggle="${esc(d.id)}" data-en="${d.enabled ? '0' : '1'}"><span>${d.enabled ? 'Pause' : 'Resume'}</span></button>` : ''].join('');
  return `<div class="merchant-page mer-promote oz-mpromote" id="promote-view">
    <div class="oz-mtitlebar">${merchantHeading('Promote your shop', 'Two ways to bring students to your counter.', 'megaphone')}${tabs}</div>
    <div class="mer-promote-grid">
      <div class="oz-mpromote-main">
        <div id="way-deal" ${vouchers ? 'hidden' : ''}>
          <section class="oz-mcard mer-deals" aria-labelledby="deals-title">
            <div class="oz-mcard-head mer-section-head"><div><h2 id="deals-title">Your live deals</h2>
              <p class="mer-deals-summary">${deals.length ? `<span class="num">${n(liveNow)}</span> <span>live now</span> · <span class="num">${n(paused)}</span> <span>paused</span>` : 'Publish instantly, with no approval needed.'}</p></div>
              <button type="button" class="oz-btn oz-btn-primary oz-btn-sm mer-way-cta" id="new-deal">${ozIcon('s:plus')}<span>${deals.length ? 'Create another deal' : 'Create a deal'}</span></button></div>
            ${deals.length ? `<p class="mer-deals-results" id="deal-results"></p>` : ''}
            <div class="mer-deal-grid">${liveDeals.map(({ deal: d, status }) => {
              const live = status === 'Available', published = ['approved', 'published'].includes(d.status);
              return `<article class="mer-deal-card oz-mdeal ${live ? 'is-live' : ''}">
                <div class="oz-mdeal-top"><h3 data-no-i18n>${esc(d.title)}</h3><span class="oz-tag oz-tag-${live ? 'success' : d.status === 'rejected' ? 'peach' : d.status === 'pending' ? 'warning' : 'lilac'}">${esc(live ? 'Live now' : status)}</span></div>
                ${d.benefit && !same(d.benefit, d.title) ? `<p class="deal-benefit" data-no-i18n>${esc(d.benefit)}</p>` : ''}
                <p class="oz-mdeal-meta"><span>${D.hhmm(d.startMin)}–${D.hhmm(d.endMin)} MYT</span> · <span>under ${d.threshold}% full</span></p>
                <div class="oz-mdeal-foot mer-deal-actions">${dealActions(d, live, published)}${d.status !== 'rejected' ? `<button class="oz-btn oz-btn-ghost oz-btn-sm" data-edit-deal="${esc(d.id)}"><span>Edit</span></button>` : ''}<button class="oz-btn oz-btn-sm oz-mdanger mer-deal-remove" data-remove-deal="${esc(d.id)}"><span>Remove</span></button></div>
              </article>`; }).join('') || merchantEmpty('badge-percent', 'No live deals yet.', 'Create a deal for your quiet hours. It goes live straight away.')}</div>
          </section>
        </div>
        <div id="way-voucher" ${vouchers ? '' : 'hidden'}>${voucherCardHTML(vapp)}</div>
      </div>
      <aside class="oz-mpromote-side">${seatsWidget(m)}<div data-way-side="deal" ${vouchers ? 'hidden' : ''}>${dealCardHTML(app, deals.length)}</div></aside>
    </div></div>`;
}

const WAY_GLYPH = { zap: 'check', 'qr-code': 'scan', store: 'stall', ticket: 'voucher', sparkles: 'coin', 'shield-check': 'shield' };
const wayFacts = (list) => `<ul class="mer-way-facts oz-mfacts">${list.map(([ic, t]) => `<li>${ozIcon(WAY_GLYPH[ic] || ic)}<span>${t}</span></li>`).join('')}</ul>`;
// The live-deal builder, for a new deal or (with a deal) for editing one.
function dealSheet(app, deal = null) {
  const v = (k, d = '') => esc(deal?.[k] ?? d);
  const time = (min, d) => (Number.isFinite(min) ? D.hhmm(Math.min(min, 1439)) : d);
  const el = sheet(`<h2 class="oz-msheet-title">${deal ? 'Edit live deal' : 'New live deal'}</h2>
    <div class="oz-mdeal-preview mer-deal-preview"><p class="oz-mkicker">Student preview</p><h3 id="deal-preview-title" data-no-i18n></h3><p class="oz-mdeal-meta"><span id="deal-preview-time"></span> · <span>under <b id="deal-preview-threshold"></b> full</span></p>${ozTag(deal ? 'Changes show to students straight away' : 'Publishes instantly, no approval needed', 'warning')}</div>
    <form id="df" class="oz-form mer-builder">
    <label class="oz-field">Name<input name="title" required minlength="3" maxlength="60" placeholder="e.g. Afternoon study break" value="${v('title')}"></label>
    <label class="oz-field">Discount details<input name="benefit" required minlength="3" maxlength="160" placeholder="e.g. 20% off any coffee" value="${v('benefit')}"></label>
    <div class="oz-mgrid2"><label class="oz-field">From<input name="start" type="time" required value="${time(deal?.startMin, '14:00')}"></label><label class="oz-field">Until<input name="end" type="time" required value="${time(deal?.endMin, '17:00')}"></label></div>
    <div class="oz-mgrid2"><label class="oz-field">Only while seats taken under (%)<input name="threshold" type="number" min="1" max="100" required value="${v('threshold', 60)}"></label></div>
    <ul class="oz-mfacts"><li>${ozIcon('community')}<span>Each student can claim each deal once a day.</span></li><li>${ozIcon('clock')}<span>A claim lasts 15 minutes. Apply the discount before then.</span></li></ul>
    <button class="oz-btn oz-btn-primary oz-btn-md oz-btn-block"><span>${deal ? 'Save changes' : 'Publish deal'}</span></button></form>`);
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
    e.preventDefault(); const f = e.target; const s = D.parseHHMM(f.start.value), en = D.parseHHMM(f.end.value);
    if (en <= s) return toast('The end time must be after the start time.', true);
    const fields = { title: f.title.value, benefit: f.benefit.value, startMin: s, endMin: en, threshold: Math.floor(+f.threshold.value) };
    busy($('button', el), async () => {
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
  return `<section class="oz-msection mer-ways"><article class="mer-way is-deal oz-mway">
    <h2 class="mer-way-title">Students earn points</h2>
    <p class="mer-way-lead">A discount you give at your counter during your quiet hours.</p>
    ${wayFacts([['zap', 'You set it up yourself. It goes live straight away.'], ['qr-code', `Students scan your deal QR${pts ? ` and earn ${pts} points` : ''}.`], ['store', 'You give the discount at your counter.']])}
  </article></section>`;
}
// Voucher program: students SPEND points on your shop's voucher.
function voucherCardHTML(a) {
  const status = a ? `<div class="mer-voucher-status is-${esc(a.status)}"><div class="oz-mcard-head"><b>Your application</b><span class="oz-tag oz-tag-${a.status === 'approved' ? 'success' : a.status === 'declined' ? 'peach' : 'warning'}">${esc(D.VOUCHER_APP_STATUS[a.status] || 'Sent')}</span></div>
      <p data-no-i18n><b>${esc(a.offer)}</b></p><p class="faint"><span>Value</span> ${rm(a.valueCents)} · <span data-no-i18n>${n(a.perMonth)}</span> <span>a month</span> · <span>Sent</span> ${fmtDate(a.submittedAt)}</p>
      ${a.reviewNote ? `<p class="mer-voucher-note"><b>Note from the Admin team:</b> <span data-no-i18n>${esc(a.reviewNote)}</span></p>` : ''}
      ${a.status === 'approved' ? '<p class="faint">The Admin team will contact you to set up your voucher.</p>' : a.status === 'pending' ? '<p class="faint">We’ll contact you within a few working days.</p>' : ''}</div>` : '';
  const button = !a ? `<button class="oz-btn oz-btn-primary oz-btn-md oz-btn-block mer-voucher-cta" id="voucher-apply"><span>Apply to join</span></button>`
    : a.status === 'pending' ? `<button class="oz-btn oz-btn-ghost oz-btn-md oz-btn-block mer-voucher-ghost" id="voucher-apply"><span>Edit application</span></button>`
    : a.status === 'declined' ? `<button class="oz-btn oz-btn-primary oz-btn-md oz-btn-block mer-voucher-cta" id="voucher-apply"><span>Apply again</span></button>` : '';
  return `<section class="oz-msection mer-ways" id="voucher-program"><article class="mer-way is-voucher mer-voucher oz-mway">
    <h2 class="mer-way-title">Students spend points</h2>
    <p class="mer-way-lead">A voucher for your shop that students swap their points for in Rewards.</p>
    ${wayFacts([['ticket', 'You apply. The Admin team agrees the details with you.'], ['sparkles', 'Students spend their points to get your voucher.'], ['shield-check', 'Applying is free and doesn’t commit you to anything.']])}
    ${status}${button ? `<div>${button}</div>` : ''}
  </article></section>`;
}
function voucherForm(app) {
  const a = app._voucherApp; const v = (k, d = '') => esc(a?.[k] ?? d);
  const el = sheet(`<p class="oz-mkicker">Voucher program</p><h2 class="oz-msheet-title">${a ? 'Edit application' : 'Apply to join'}</h2>
    <form id="vf" class="oz-form">
      <label class="oz-field">What students get<input name="offer" required minlength="3" maxlength="160" value="${v('offer')}" placeholder="e.g. RM5 off any meal"></label>
      <div class="oz-mgrid2"><label class="oz-field">Voucher value (RM)<input name="value" type="number" min="0.5" max="1000" step="0.5" required value="${a ? a.valueCents / 100 : ''}" placeholder="e.g. 5"></label>
        <label class="oz-field">Vouchers you can honour a month<input name="perMonth" type="number" min="1" max="10000" step="1" required value="${v('perMonth')}" placeholder="e.g. 50"></label></div>
      <label class="oz-field">Conditions (optional)<textarea name="conditions" rows="3" maxlength="500" placeholder="e.g. Minimum spend RM10. Weekdays only, 2–5 pm.">${v('conditions')}</textarea></label>
      <div class="oz-mgrid2"><label class="oz-field">Contact person<input name="contactName" required minlength="2" maxlength="80" value="${v('contactName', app.profile?.name || '')}"></label>
        <label class="oz-field">Contact phone<input name="contactPhone" type="tel" required minlength="8" maxlength="20" value="${v('contactPhone', app._merchantPhone || '')}" placeholder="e.g. 012-345 6789"></label></div>
      <button class="oz-btn oz-btn-primary oz-btn-md oz-btn-block"><span>${a ? 'Send updated application' : 'Send application'}</span></button></form>`);
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
    results.innerHTML = `${ozIcon('chart')}<span>${week ? `${n(week)} ${week === 1 ? 'claim' : 'claims'} in the last 7 days` : 'No claims in the last 7 days yet.'}</span>${insightsOn ? `<a class="oz-link" href="#/insights">See insights</a>` : ''}`;
  }, () => {}) : () => {};
  $$('[data-way]', root).forEach((b) => { b.onclick = () => {
    const voucher = b.dataset.way === 'voucher';
    $$('[data-way]', root).forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    $('#way-deal', root).hidden = voucher; $('#way-voucher', root).hidden = !voucher; $$('[data-way-side]', root).forEach((x) => { x.hidden = voucher; });
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
  return `<div class="merchant-page mer-insights oz-minsights"><div class="oz-mtitlebar">${merchantHeading('Insights', 'Deal claims and discounts at your counter.', 'chart-column')}
    <div class="oz-seg oz-mseg mer-period" role="group" aria-label="Period">${PERIODS.map(([k, l]) => `<button type="button" data-period="${k}" class="oz-seg-item ${k === insightsPeriod ? 'on' : ''}" aria-pressed="${k === insightsPeriod}">${l}</button>`).join('')}</div></div>
    <div id="ins" class="oz-mins"><span class="oz-skel oz-skel-lg"></span><span class="oz-skel oz-skel-md"></span><span class="oz-skel oz-skel-md"></span></div></div>`;
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
    const waiting = inPeriod.filter((c) => c.status === 'claimed' && !L.claimExpired(c, now)).length, label = PERIODS.find(([k]) => k === insightsPeriod)[1];
    $('#ins', root).innerHTML = `<section class="oz-mcard oz-mins-main" aria-label="${esc(label)}">
        <div class="oz-mkpis">
          <div class="oz-mkpi is-lead"><span>Deal claims</span><strong class="num">${n(inPeriod.length)}</strong><small>${esc(label)}</small></div>
          <div class="oz-mkpi"><span>Discounts applied</span><strong class="num">${n(applied)}</strong><small>Given at your counter</small></div>
          <div class="oz-mkpi"><span>Waiting</span><strong class="num">${n(waiting)}</strong><small>${waiting ? 'Open Deal QR to apply' : 'Nobody waiting'}</small></div>
          <div class="oz-mkpi"><span>Used at the counter</span><strong class="num">${rate}%</strong><small>Claims that became a discount</small></div>
        </div>
        <div class="oz-mchart mer-chart"><div class="oz-mcard-head"><h2>Claims in the last 7 days</h2><p class="oz-mnote mer-chart-note">${busiestDay.count ? `Busiest day: ${esc(busiestDay.label)}, ${n(busiestDay.count)} ${busiestDay.count === 1 ? 'claim' : 'claims'}.` : 'No claims in the last 7 days yet.'}</p></div>
          ${barChart(week.map((d) => d.count), week.map((d) => d.label), { highlight: 6 })}</div>
      </section>
      <div class="oz-mins-grid ${blocks.length ? '' : 'is-single'}">
        ${blocks.length ? `<section class="oz-mcard oz-mchart mer-chart"><div class="oz-mcard-head"><h2>Busiest times</h2></div>
          ${barChart(blocks.map((b) => b.count), blocks.map((b) => b.label), { highlight: blocks.indexOf(busiest) })}
          <p class="oz-mnote mer-chart-note">Most claims come in between ${hourLabel(busiest.h)} and ${hourLabel((busiest.h + 2) % 24)}. Run deals in your quieter hours to fill seats.</p></section>` : ''}
        <section class="oz-mcard mer-redemption-history"><div class="oz-mcard-head"><h2>Recent deal claims</h2><span class="oz-mcount">${n(inPeriod.length)}</span></div><div class="oz-mlist">${sorted.slice(0, 50).map((c) => `<div class="oz-mlist-item"><div class="oz-mlist-text"><h3 data-no-i18n>${esc(c.studentName)}</h3><p><span>${c.status === 'applied' ? 'Discount applied' : L.claimExpired(c, now) ? 'Expired' : 'Waiting for discount'}</span> · <span data-no-i18n>${esc(c.title)}</span></p></div><small class="oz-mlist-time">${fmtDate(c.createdAt)} ${fmtTime(c.createdAt)}</small></div>`).join('') || merchantEmpty('qr-code', 'No deal claims yet', 'Student QR scans will appear here.')}</div></section>
      </div>`;
  };
  $$('[data-period]', root).forEach((b) => { b.onclick = () => { insightsPeriod = b.dataset.period; $$('[data-period]', root).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); draw(); }; });
  return L.watchMerchantClaims(app.ctx, (list) => { claims = list; draw(); }, () => {});
}

async function surveyRender(app) {
  const existing = await D.getSurvey(app.ctx).catch(() => null);
  return `<div class="merchant-page mer-survey">${merchantBack('#/home', 'Merchant home')}${merchantHeading('Cashless readiness check', 'Your answers help the Admin team decide who needs an ambassador visit or staff training.', 'target', 'Build your confidence')}${surveyHTML('merchant', existing)}</div>`;
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
