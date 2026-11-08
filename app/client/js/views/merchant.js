// Merchant app: shop setup, readiness, live-deal QR claims, applied discounts and counter poster.
import * as D from '../data.js';
import * as L from '../live-deals.js';
import { merchantDealQRRender, merchantDealQRMount } from '../deal-flow.js';
import { safeImg, $, $$, esc, icon, rm, n, toast, sheet, closeSheet, busy, errText, fmtDate, fmtTime, timeAgo, confetti, renderQR,
  startScanner, compressImage, barChart, colorFor, initials, downloadCSV } from '../ui.js';
import { pinPicker, hasPin, inGeoBox } from '../map.js';
import { surveyHTML, surveyMount, merchantLogo } from './student.js';
import { avatarSVG, defaultFor } from '../avatar.js';
import { merchantHeading, merchantMetric, merchantEmpty, merchantSetup, merchantAction } from '../merchant-ui.js';

export const defaultRoute = 'home';
const toMs = D.toMs;
const statusBadge = (m) => !m ? '<span class="badge grey">Not applied</span>'
  : m.status === 'verified' ? `<span class="badge ok">${icon('badge-check')}Verified</span>`
  : m.status === 'rejected' ? '<span class="badge bad">Needs changes</span>'
  : m.status === 'suspended' ? '<span class="badge bad">Suspended</span>' : '<span class="badge warn">HEP is reviewing</span>';

function needVerified(app) {
  if (app.merchant && app.merchant.status === 'verified') return null;
  return `<div class="card empty mer-access-card" style="margin-top:16px"><span class="mer-access-icon">${icon('store')}</span><h3>${app.merchant ? 'Waiting for HEP to verify your shop' : 'Apply to join first'}</h3>
    <p>${app.merchant ? 'Usually reviewed within 1–2 working days.' : 'Submit your shop details for HEP verification.'}</p>
    <a class="btn primary" style="margin-top:12px" href="#/shop">${app.merchant ? 'View application' : 'Apply now'}</a></div>`;
}

// ------------------------------------------------------------- home
async function homeRender(app) {
  const m = app.merchant; const name = m ? m.name : app.profile.name;
  const verified = m?.status === 'verified'; const toolsOn = D.featureOn(app.rules, 'merchantTools');
  const readiness = merchantSetup(m, hasPin, app.rules);
  const shortcuts = [
    ['shop', 'store', 'My shop', 'Manage your shop details'],
    ...(verified && toolsOn ? [
      ['scan', 'qr-code', 'Deal QR', 'Show a QR for students to claim'],
      ['promote', 'badge-percent', 'Promote live deals', 'Manage live deals and offers'],
    ] : []),
    ...(toolsOn ? [['survey', 'target', 'Cashless readiness check', '7 questions to identify support needs.']] : []),
  ];
  return `<div class="merchant-page mer-home"><section class="kk-hero merchant-home-hero">
      <div class="merchant-home-logo">${m ? merchantLogo(m) : icon('store')}</div>
      <div class="mer-home-copy"><span class="mer-eyebrow">Your merchant hub</span><h1>${esc(name)}</h1>${m?.location ? `<p class="mer-hero-location">${icon('map-pin')} ${esc(m.location)}</p>` : ''}<div class="row merchant-home-status">${statusBadge(m)}${D.merchantReadinessCurrent(m, app.rules) ? `<span class="badge ok">${icon('shield-check')}Staff ready</span>` : ''}</div></div>
      <div class="mer-hero-art" aria-hidden="true"><span>${icon('store')}</span><i>${icon('star')}</i><b>+</b></div>
    </section>
    ${m && m.status === 'verified' && !hasPin(m) ? `<div class="notice" style="margin-top:12px">${icon('map-pin')}<span>Students can’t find you on the map yet. <a href="#/shop">Add your shop location</a> so they can walk straight to you.</span></div>` : ''}
    <div class="mer-home-grid ${readiness ? '' : 'is-ready'}"><section class="mer-quick-section"><div class="mer-section-head"><h2>Explore</h2><span class="mer-eyebrow">Let's go</span></div>
      <nav class="mer-actions" aria-label="Merchant shortcuts">${shortcuts.map((args, index) => merchantAction(...args, index)).join('')}</nav></section>
      ${readiness}</div>
    ${verified ? `
      <section class="section"><div class="mer-section-head"><h2>Live-deal activity</h2>${toolsOn ? `<a href="#/insights">Insights ${icon('arrow-right')}</a>` : ''}</div><div class="stats mer-stats" id="merchant-wallet"><div class="skeleton" style="height:130px"></div></div></section>` : ''}</div>`;
}
function homeMount(root, app) {
  const off = app.on((topic) => { if (topic === 'merchant' || topic === 'merchant-readiness') app.render(); });
  const stop = $('#merchant-wallet', root) ? L.watchMerchantClaims(app.ctx, (claims) => {
    $('#merchant-wallet', root).innerHTML = merchantMetric('Deal claims', n(claims.length), 'qr-code')
      + merchantMetric('Discounts applied', n(claims.filter((c) => c.status === 'applied').length), 'badge-percent', 'lime')
      + merchantMetric('Awaiting discount', n(claims.filter((c) => c.status === 'claimed' && !L.claimExpired(c)).length), 'clock', 'sky');
  }, () => {}) : () => {};
  return () => { off(); stop(); };
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
async function shopRender(app) {
  const m = app.merchant; const priv = m ? await D.getMerchantPrivate(app.ctx, app.ctx.uid).catch(() => null) : null;
  const editable = !m || m.status !== 'verified';
  const ready = D.merchantReadinessCurrent(m, app.rules);
  const v = (k) => esc((m && m[k]) || (priv && priv[k]) || '');
  const sel = (name, opts, cur) => `<select name="${name}">${opts.map((o) => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  return `<div class="merchant-page mer-shop">${merchantHeading('My shop', 'Your campus storefront, all in one place.', 'store', 'Make it yours')}
    <div class="mer-shop-identity"><span class="merchant-home-logo">${m ? merchantLogo(m) : icon('store')}</span><div><h2>${esc(m?.name || app.profile.name)}</h2>${m?.location ? `<p>${icon('map-pin')} ${esc(m.location)}</p>` : ''}</div>${statusBadge(m)}</div>
    ${m && m.status === 'rejected' ? `<div class="notice bad">${icon('circle-alert')}<span>HEP asked for changes: ${esc(m.reviewNote || 'see details')}. Update and send again.</span></div>` : ''}
    ${m && m.status === 'pending' ? `<div class="notice">${icon('clock')}<span>Sent ${fmtDate(m.submittedAt)}. HEP will check that your QR name matches your business.</span></div>` : ''}
    <div class="mer-shop-grid ${!editable ? 'is-verified' : ''}"><section class="section mer-business"><div class="head"><h2>${icon('store')} Business details</h2></div>
    <form id="app-form" class="card stack" ${editable ? '' : 'inert'}>
      <label class="field">Business name, as students know it<input name="name" required minlength="2" maxlength="100" value="${v('name')}"></label>
      <label class="field">Account name on your DuitNow QR<input name="accountName" required value="${v('accountName')}"><small>HEP checks this matches the QR.</small></label>
      <div class="grid-2"><label class="field">Type${sel('type', D.MERCHANT_TYPES, m?.type)}</label><label class="field">Category${sel('segment', D.SEGMENTS, m?.segment)}</label></div>
      <div class="grid-2"><label class="field">Location<input name="location" required placeholder="e.g. KK3 cafeteria" value="${v('location')}"></label><label class="field">Campus zone${sel('zone', D.ZONES, m?.zone)}</label></div>
      <div class="grid-2"><label class="field">Contact phone<input name="phone" type="tel" value="${v('phone')}"></label><label class="field">Ambassador ID (optional)<input name="ambassadorId" value="${v('ambassadorId')}" placeholder="e.g. AMB-003"></label></div>
      <div id="event-fields" class="grid-2"><label class="field">Event name<input name="eventName" value="${v('eventName')}"></label><label class="field">Event ends<input name="eventEnd" type="date" value="${v('eventEnd')}"></label></div>
      ${editable ? logoBlock(m) : ''}
      ${editable ? pinBlock(m) : ''}
      <label class="field">Photo of your DuitNow QR<input name="qr" type="file" accept="image/*" ${priv && priv.qrImage ? '' : 'required'}><small>A clear, straight photo. It goes on the monthly list PayNet uses to count your transactions.</small></label>
      ${priv && safeImg(priv.qrImage) ? `<img class="qr-thumb" style="width:120px;height:120px" src="${safeImg(priv.qrImage)}" alt="Your uploaded DuitNow QR">` : ''}
      ${editable ? `<button class="btn primary">${m ? 'Send updated details to HEP' : 'Send to HEP for verification'}</button>` : '<p class="faint">Verified details are locked. Ask HEP if something needs to change.</p>'}
    </form></section>
    ${!editable ? `<section class="section"><div class="head"><h2>Logo</h2></div><form id="logo-form" class="card stack">${logoBlock(m, true)}
      <button class="btn primary" id="logo-save">${icon('image')} Save logo</button></form></section>
      <section class="section"><div class="head"><h2>Shop location on the map</h2></div><form id="pin-form" class="card stack">${pinBlock(m, true)}
      <button class="btn primary" id="pin-save">${icon('map-pin')} Save location</button></form></section>` : ''}
    ${m ? `<section class="section mer-readiness" id="ready" tabindex="-1"><div class="head"><h2>${icon('shield-check')} Staff readiness</h2>${ready ? `<span class="badge ok">${icon('check')}Done ${fmtDate(m.readyAt)}</span>` : ''}</div>
      ${!ready && app.rules.merchantReadinessUpdate?.message ? `<div class="notice mer-readiness-notice">${icon('bell')}<div><strong>New readiness update</strong><p data-no-i18n>${esc(app.rules.merchantReadinessUpdate.message)}</p></div></div>` : ''}
      <div class="card stack mer-readiness-content"><div class="chips">${Object.keys(READY_TEXT).map((l) => `<button data-lang="${l}" class="${l === readyLang ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${READY_TEXT[readyLang].map(([t, d]) => `<div><h3>${esc(t)}</h3><p class="muted" style="font-size:14px;margin-top:4px">${esc(d)}</p></div>`).join('')}
        <form id="ready-form" data-update="${toMs(app.rules.merchantReadinessUpdate?.publishedAt) || 0}">${READY_CHECKS.map((c) => `<label class="check"><input type="checkbox" required ${ready ? 'checked' : ''}> ${esc(c)}</label>`).join('')}
          <button class="btn ${ready ? '' : 'primary'}" ${m.status === 'rejected' ? 'disabled' : ''}>${ready ? 'Checklist complete' : 'Confirm my staff are ready'}</button></form></div></section>` : ''}
    ${m && m.status === 'verified' ? `<section class="section mer-counter-kit"><div class="head"><h2>Poster for your counter</h2></div><div class="card row"><span class="tile-icon">${icon('printer')}</span><div style="flex:1"><p class="muted" style="font-size:14px">Print it and place it next to your DuitNow QR. Students scan it to open your shop in the app.</p></div><a class="btn small" href="#/poster">Open poster ${icon('arrow-right')}</a></div></section>` : ''}</div></div>`;
}
function logoBlock(m, standalone = false) {
  return `<div class="field logo-field">${standalone ? '' : '<span>Shop logo</span>'}
    <div class="row" style="gap:14px;flex-wrap:nowrap"><span class="logo-preview" id="logo-prev">${m && safeImg(m.logo) ? `<img src="${safeImg(m.logo)}" alt="Your logo">` : icon('image')}</span>
      <div style="flex:1"><input name="logo" type="file" accept="image/png,image/jpeg,image/webp" ${m && m.logo ? '' : 'required'} aria-label="Upload your logo">
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
    try { const data = await prepareLogo(f); form.logoData.value = data; $('#logo-prev', root).innerHTML = `<img src="${data}" alt="Your logo">`; }
    catch (err) { toast(err.message, true); form.logo.value = ''; }
  };
}
function pinBlock(m, standalone = false) {
  const has = hasPin(m);
  return `<div class="field pin-field">${standalone ? '' : '<span>Shop location on the map</span>'}
    <div class="pin-map" id="pin-map" aria-label="Map to place your shop"></div>
    <div class="row between pin-bar"><button type="button" class="btn small" id="locate">${icon('locate-fixed')} Use my current location</button>
      <span class="faint num" id="pin-read">${has ? `${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}` : 'No pin yet'}</span></div>
    <small>Stand at your counter and tap “Use my current location”, or tap the map and drag the pin to your exact spot. Students use this pin for directions to your shop.</small>
    <input type="hidden" name="lat" value="${has ? m.lat : ''}"><input type="hidden" name="lng" value="${has ? m.lng : ''}"></div>`;
}
async function mountPin(root, form) {
  const el = $('#pin-map', root); if (!el || !form) return null;
  const read = $('#pin-read', root);
  try {
    const picker = await pinPicker(el, { lat: parseFloat(form.lat.value), lng: parseFloat(form.lng.value) }, ({ lat, lng }) => {
      form.lat.value = lat; form.lng.value = lng; read.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      read.classList.toggle('bad-text', !inGeoBox(lat, lng));
    });
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
  const syncEvent = () => { $('#event-fields', root).classList.toggle('hidden', f.segment.value !== 'Temporary student entrepreneur'); };
  f.segment.onchange = syncEvent; syncEvent();
  const pf = $('#pin-form', root); const lf = $('#logo-form', root);
  mountPin(root, pf || f);
  mountLogo(root, lf || f);
  if (lf) lf.onsubmit = (e) => {
    e.preventDefault();
    busy($('#logo-save', lf), async () => {
      if (!lf.logoData.value) return toast('Choose a logo image first.', true);
      try { await D.setMerchantLogo(app.ctx, lf.logoData.value); toast('Logo saved.'); } catch (err) { toast(errText(err), true); }
    });
  };
  if (pf) pf.onsubmit = (e) => {
    e.preventDefault();
    busy($('#pin-save', pf), async () => {
      try { const { lat, lng } = pinValues(pf, true); await D.setMerchantPin(app.ctx, lat, lng); toast('Location saved. Students can now find you on the map.'); }
      catch (err) { toast(err.code ? errText(err) : err.message, true); }
    });
  };
  f.onsubmit = (e) => {
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
        toast('Sent to HEP. You’ll see the status here.'); setTimeout(() => app.render(), 300);
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

// ------------------------------------------------------------- promote: offers, quiet-hour deals, seats
async function promoteRender(app) {
  const block = needVerified(app); if (block) return block;
  const [deals, shop] = await Promise.all([D.myDeals(app.ctx), D.getMerchant(app.ctx, app.ctx.uid)]);
  const m = shop || app.merchant;
  const liveDeals = await D.dealOverview(app.ctx, deals, [m]);
  const seats = Math.max(0, Number(m.seats) || 0), occupied = Math.max(0, Number(m.occupied) || 0);
  const occupancy = seats ? Math.min(100, Math.round(occupied / seats * 100)) : 0;
  return `<div class="merchant-page mer-promote">${merchantHeading('Promote live deals', 'Give students a reason to stop by.', 'megaphone', 'Your next campus favourite')}
    <div class="stats mer-stats mer-promo-stats">${merchantMetric('Live now', n(liveDeals.filter((d) => d.status === 'Available').length), 'zap', 'lime')}${merchantMetric('Paused', n(deals.filter((d) => !d.enabled).length), 'moon')}${merchantMetric('Live deals', n(deals.length), 'badge-percent', 'peach')}</div>
    <div class="mer-promo-top"><section class="card mer-occupancy"><div class="mer-section-head"><h2>${icon('coffee')} Café occupancy</h2>${seats ? `<span class="mer-count">${n(Math.max(0, seats - occupied))} seats free</span>` : ''}</div>
      <div class="mer-occupancy-summary"><div class="mer-progress-ring" style="--progress:${occupancy}%" role="img" aria-label="Café occupancy"><span>${seats ? occupancy : '—'}${seats ? '<small>%</small>' : ''}</span></div><div><h3>${seats ? `${n(occupied)} / ${n(seats)}` : 'Set your seats'}</h3><p>${seats ? 'seats taken' : 'Keep your availability up to date.'}</p></div></div>
      <form id="seats" class="grid-2" style="margin-top:12px;align-items:end"><label class="field">Total seats<input name="seats" type="number" min="1" max="2000" required value="${m.seats || ''}"></label>
        <label class="field">Seats taken now<input name="occupied" type="number" min="0" max="2000" required value="${m.occupied ?? ''}"></label>
        <button class="btn primary" style="grid-column:1/-1">${icon('refresh-cw')} Update seats</button></form>
      ${m.occupancyAt ? `<p class="faint mer-updated">Last updated ${timeAgo(m.occupancyAt)}</p>` : ''}</section>
    <section class="mer-launch-card"><span class="mer-launch-art" aria-hidden="true">${icon('megaphone')}<i>${icon('zap')}</i></span><span class="mer-eyebrow">Make some noise</span><h2>Fill the quiet hours.</h2><p>Set the discount, hours and availability. Publish instantly.</p><button class="btn primary" id="new-deal">${icon('plus')} New deal ${icon('arrow-right')}</button><span class="mer-launch-note">${icon('shield-check')} Publish instantly — no approval needed</span></section></div>
    <section class="section"><div class="mer-section-head"><h2>Live deals</h2><span class="mer-count">${n(deals.length)}</span></div>
      <div class="mer-deal-grid">${liveDeals.map(({ deal: d, status }) => `<article class="card mer-deal-card ${status === 'Available' ? 'is-live' : ''}">
        <div class="mer-deal-top"><span class="mer-panel-emblem">${icon('badge-percent')}</span><span class="badge ${status === 'Available' ? 'ok' : d.status === 'rejected' ? 'bad' : d.status === 'pending' ? 'warn' : 'grey'}">${status === 'Available' ? '<span class="mer-live-dot" aria-hidden="true"></span>' : ''}${esc(status === 'Available' ? 'Live now' : status)}</span></div>
        <h3>${esc(d.title)}</h3>${d.benefit ? `<p class="deal-benefit" data-no-i18n>${esc(d.benefit)}</p>` : ''}<div class="mer-deal-meta"><span>${icon('clock')} ${D.hhmm(d.startMin)}–${D.hhmm(d.endMin)} MYT</span><span>${icon('users')} under ${d.threshold}% full</span></div>
        <div class="mer-deal-bottom"><span>${icon('shield-check')} ${['approved', 'published'].includes(d.status) ? 'Published by merchant' : d.status === 'rejected' ? 'Archived' : 'Ready to publish'}</span>
          ${d.status === 'pending' ? `<button class="btn small primary" data-publish-deal="${esc(d.id)}">${icon('megaphone')} Publish deal</button>` : ''}${status === 'Available' ? `<a class="btn small primary" href="#/scan/${esc(d.id)}">${icon('qr-code')} Show deal QR</a>` : ''}${['approved', 'published'].includes(d.status) ? `<button class="btn small ${d.enabled ? '' : 'primary'}" data-toggle="${esc(d.id)}" data-en="${d.enabled ? '0' : '1'}">${icon(d.enabled ? 'moon' : 'zap')} ${d.enabled ? 'Pause' : 'Resume'}</button>` : ''}</div>
      </article>`).join('') || merchantEmpty('badge-percent', 'No live deals yet.', 'Your next deal starts with the New deal button.')}</div></section>
    </div>`;
}
function promoteMount(root, app) {
  if (!$('#seats', root)) return null;
  $('#seats', root).onsubmit = (e) => {
    e.preventDefault(); const s = Math.floor(+e.target.seats.value), o = Math.floor(+e.target.occupied.value);
    if (o > s) return toast('Seats taken can’t be more than total seats.', true);
    busy($('button', e.target), async () => { try { await D.setOccupancy(app.ctx, s, o); toast('Seats updated.'); app.render(); } catch (err) { toast(errText(err), true); } });
  };
  $('#new-deal', root).onclick = () => {
    const el = sheet(`<div class="mer-sheet-head"><span class="mer-panel-emblem">${icon('megaphone')}</span><div><span class="mer-eyebrow">Make some noise</span><h2>New live deal</h2></div></div>
      <div class="mer-deal-preview"><span class="mer-eyebrow">Student preview</span><h3 id="deal-preview-title" data-no-i18n></h3><div class="mer-deal-meta"><span>${icon('clock')}<span id="deal-preview-time"></span></span><span>${icon('users')}<span>Occupancy threshold</span><b id="deal-preview-threshold"></b></span></div><span class="badge warn">Publish instantly — no approval needed</span></div>
      <form id="df" class="stack mer-builder" style="margin-top:18px">
      <label class="field">Name<input name="title" required minlength="3" maxlength="60" placeholder="e.g. Afternoon study break"></label>
      <label class="field">Discount details<input name="benefit" required minlength="3" maxlength="160" placeholder="e.g. 20% off any coffee"></label>
      <div class="grid-2"><label class="field">From<input name="start" type="time" required value="14:00"></label><label class="field">Until<input name="end" type="time" required value="17:00"></label></div>
      <div class="grid-2"><label class="field">Only while seats taken under (%)<input name="threshold" type="number" min="1" max="100" required value="60"></label></div>
      <button class="btn primary">${icon('megaphone')} Publish deal</button></form>`);
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
      busy($('button', el), async () => {
        try { await D.createDeal(app.ctx, { title: f.title.value, benefit: f.benefit.value, startMin: s, endMin: en, threshold: Math.floor(+f.threshold.value), bonus: 0, limit: 1 }); closeSheet(); toast('Live deal published.'); app.render(); }
        catch (err) { toast(errText(err), true); }
      });
    };
  };
  $$('[data-publish-deal]', root).forEach((button) => { button.onclick = () => busy(button, async () => { try { await D.publishDeal(app.ctx, button.dataset.publishDeal); toast('Live deal published.'); app.render(); } catch (error) { toast(errText(error), true); } }); });
  $$('[data-toggle]', root).forEach((b) => { b.onclick = () => busy(b, async () => { await D.toggleDeal(app.ctx, b.dataset.toggle, b.dataset.en === '1'); app.render(); }); });

  const off = app.on((t) => { if (t === 'merchant' && !root.contains(document.activeElement) && !document.querySelector('#sheet[open]')) app.render(); });
  return off;
}

// ------------------------------------------------------------- insights: live-deal scans and applied discounts
async function insightsRender(app) {
  const block = needVerified(app); if (block) return block;
  return `<div class="merchant-page mer-insights">${merchantHeading('Insights', 'Live-deal scans and discounts at your shop.', 'chart-column', 'See your impact')}<div id="ins"><div class="skeleton" style="height:140px"></div></div></div>`;
}
function insightsMount(root, app) {
  if (!$('#ins', root)) return null;
  return L.watchMerchantClaims(app.ctx, (claims) => {
    const applied = claims.filter((c) => c.status === 'applied');
    const sorted = [...claims].sort((a,b) => toMs(b.createdAt) - toMs(a.createdAt));
    $('#ins', root).innerHTML = `<div class="stats mer-stats">${merchantMetric('Deal claims', n(claims.length), 'qr-code')}${merchantMetric('Discounts applied', n(applied.length), 'badge-percent', 'lime')}${merchantMetric('Awaiting discount', n(claims.filter((c) => c.status === 'claimed' && !L.claimExpired(c)).length), 'clock', 'sky')}</div>
      <section class="section card mer-redemption-history"><div class="mer-section-head"><h2>Recent deal claims</h2><span class="mer-count">${n(claims.length)}</span></div><div class="list">${sorted.slice(0,50).map((c) => `<div class="item"><span class="mer-redemption-stamp">${icon('qr-code')}</span><div class="grow"><h3 data-no-i18n>${esc(c.title)}</h3><p>${esc(c.studentName)} · ${fmtDate(c.createdAt)}</p></div><span class="badge ${c.status === 'applied' ? 'ok' : 'grey'}">${c.status === 'applied' ? 'Discount applied' : L.claimExpired(c) ? 'Expired' : 'Claim confirmed'}</span></div>`).join('') || merchantEmpty('qr-code','No deal claims yet.','Student QR scans will appear here.')}</div></section>`;
  }, () => {});
}

async function surveyRender(app) {
  const existing = await D.getSurvey(app.ctx).catch(() => null);
  return `<div class="merchant-page mer-survey"><a class="back" href="#/home">${icon('arrow-left')} Home</a>${merchantHeading('Cashless readiness check', 'Your answers help HEP decide who needs an ambassador visit or staff training.', 'target', 'Build your confidence')}${surveyHTML('merchant', existing)}</div>`;
}

export const routes = {
  home: { title: 'Home', render: homeRender, mount: homeMount, wide: true },
  scan: { title: 'Deal QR', render: merchantDealQRRender, mount: merchantDealQRMount, feature: ['merchantTools', 'dealsAndPay', 'overview'], wide: true },
  shop: { title: 'My shop', render: shopRender, mount: shopMount, wide: true },
  poster: { title: 'Poster', render: posterRender, mount: posterMount, tab: 'shop' },
  promote: { title: 'Promote live deals', render: promoteRender, mount: promoteMount, feature: 'merchantTools', wide: true },
  insights: { title: 'Insights', render: insightsRender, mount: insightsMount, feature: 'merchantTools', wide: true },
  survey: { title: 'Readiness check', render: surveyRender, mount: (r, a) => surveyMount(r, a, 'merchant', 'home'), tab: 'home', feature: 'merchantTools', wide: true },
};
