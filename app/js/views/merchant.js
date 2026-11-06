// Merchant app: application (logo + exact location), readiness, voucher redemption, offers, quiet-hour bonuses, visitor insights, poster.
import * as D from '../data.js';
import { $, $$, esc, icon, rm, n, toast, sheet, closeSheet, busy, errText, fmtDate, fmtTime, timeAgo, confetti, renderQR,
  startScanner, compressImage, barChart, colorFor, initials, downloadCSV } from '../ui.js';
import { pinPicker, hasPin, inGeoBox } from '../map.js';
import { surveyHTML, surveyMount, merchantLogo } from './student.js';
import { avatarSVG, defaultFor } from '../avatar.js';

export const defaultRoute = 'home';
const toMs = D.toMs;
const statusBadge = (m) => !m ? '<span class="badge grey">Not applied</span>'
  : m.status === 'verified' ? `<span class="badge ok">${icon('badge-check')}Verified</span>`
  : m.status === 'rejected' ? '<span class="badge bad">Needs changes</span>'
  : m.status === 'suspended' ? '<span class="badge bad">Suspended</span>' : '<span class="badge warn">HEP is reviewing</span>';

function needVerified(app) {
  if (app.merchant && app.merchant.status === 'verified') return null;
  return `<div class="card empty" style="margin-top:16px">${icon('store')}<h3>${app.merchant ? 'Waiting for HEP to verify your shop' : 'Apply to join first'}</h3>
    <p>${app.merchant ? 'Usually reviewed within 1–2 working days.' : 'Submit your shop details for HEP verification.'}</p>
    <a class="btn primary" style="margin-top:12px" href="#/shop">${app.merchant ? 'View application' : 'Apply now'}</a></div>`;
}

// ------------------------------------------------------------- home
async function homeRender(app) {
  const m = app.merchant; const name = m ? m.name : app.profile.name;
  const step = !m ? 1 : m.status !== 'verified' ? 2 : !m.ready ? 3 : 4;
  const verified = m?.status === 'verified';
  const shortcuts = [
    ['shop', 'store', 'My shop', 'Manage your shop details'],
    ...(verified ? [
      ['scan', 'ticket', 'Redeem a voucher', 'Scan a student’s voucher'],
      ['promote', 'badge-percent', 'Promote', 'Manage live deals and offers'],
    ] : []),
    ['survey', 'target', 'Cashless readiness check', '7 questions to identify support needs.'],
  ];
  return `<section class="kk-hero merchant-home-hero">
      <div class="merchant-home-logo">${m ? merchantLogo(m) : icon('store')}</div>
      <div><h1>${esc(name)}</h1><div class="row merchant-home-status">${statusBadge(m)}${m?.ready ? `<span class="badge ok">${icon('shield-check')}Staff ready</span>` : ''}</div></div>
    </section>
    ${step < 4 ? `<div class="card pad-lg"><h2>Get set up</h2><div class="steps" style="margin-top:10px">
      ${[['Send your details, logo and location', 'Add your logo, pin your exact spot on the map and upload your DuitNow QR for PayNet’s monthly list.', 'shop'],
        ['HEP verifies your shop', 'They check the QR name matches your business. Usually 1–2 working days.', 'shop'],
        ['Train your staff', 'A 2-minute checklist on cashless payments and redeeming vouchers.', 'shop'],
        ['Welcome your first visitors', 'Students find you on the map and check in when they arrive.', 'promote']].map(([t, d, h], i) =>
        `<div class="step ${i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''}"><span class="n">${i + 1 < step ? icon('check') : i + 1}</span><div><h3>${t}</h3><p>${d}</p>
          ${i + 1 === step && i !== 1 ? `<a class="btn small primary" style="margin-top:8px" href="#/${h}">${i === 0 ? 'Apply now' : i === 2 ? 'Open checklist' : 'Promote my shop'}</a>` : ''}</div></div>`).join('')}</div></div>` : ''}
    ${m && m.status === 'verified' && !hasPin(m) ? `<div class="notice" style="margin-top:12px">${icon('map-pin')}<span>Students can’t find you on the map yet. <a href="#/shop">Add your shop location</a> so they can walk straight to you.</span></div>` : ''}
    <h2 class="kk-pillars-title">Explore</h2>
    <nav class="kk-pillars merchant-shortcuts" aria-label="Merchant shortcuts">
      ${shortcuts.map(([route, glyph, label, description]) => `<a class="kk-pillar" href="#/${route}"><span class="tile-icon">${icon(glyph)}</span><h3>${label}</h3><p>${description}</p></a>`).join('')}
    </nav>
    ${verified ? `
      <h2 class="kk-pillars-title">Shop activity</h2>
      <div class="stats" id="today"><div class="skeleton" style="height:96px"></div><div class="skeleton" style="height:96px"></div></div>
      <section class="section"><div class="head"><h2>Who’s visiting</h2><a href="#/insights">Insights</a></div><div class="card list" id="feed"><div class="skeleton" style="height:60px"></div></div></section>` : ''}`;
}
function homeMount(root, app) {
  if (!$('#feed', root)) return null;
  return D.watchMerchantVisits(app.ctx, (vs) => {
    const today = D.dayKey(); const t = vs.filter((x) => x.day === today);
    const firstSeen = {}; [...vs].reverse().forEach((x) => { if (!firstSeen[x.uid]) firstSeen[x.uid] = x.id; });
    const newToday = t.filter((x) => firstSeen[x.uid] === x.id).length;
    $('#today', root).innerHTML = `
      <div class="stat"><div class="k">Check-ins today</div><div class="v num">${t.length}</div><div class="s">${new Set(t.map((x) => x.uid)).size} students</div></div>
      <div class="stat"><div class="k">New visitors today</div><div class="v num">${newToday}</div><div class="s">${t.length - newToday} returning</div></div>`;
    $('#feed', root).innerHTML = vs.slice(0, 8).map((x) => `<div class="item"><span class="avatar has-art" style="width:36px;height:36px">${avatarSVG(x.avatar || defaultFor(x.uid), { variant: 'head', size: 36 })}</span><div class="grow"><h3>${esc(x.name)}</h3><p>${timeAgo(x.at)}${x.deal ? ' · quiet-hour bonus' : ''}</p></div><span class="badge">${esc(x.college || '')}</span></div>`).join('')
      || `<div class="empty">${icon('map-pin-check')}<p>Students who check in at your shop will appear here.</p></div>`;
  }, () => {});
}

// ------------------------------------------------------------- redeem: scan student vouchers
async function scanRender(app) {
  const block = needVerified(app); if (block) return block;
  return `<div class="page-title"><h1>Redeem a voucher</h1><p>Students swap their points for vouchers. Scan the voucher QR on their phone, give the discount, and mark it used.</p></div>
    <div class="scanner" id="scanner"><video id="cam" muted playsinline></video><div class="idle" id="idle"><div>${icon('camera')}<p>Camera is off</p>
      <button class="btn primary" id="start" style="margin-top:12px">Start camera</button></div></div></div>
    <p class="faint" id="scanstatus" style="text-align:center;margin-top:10px" role="status"></p>
    <form id="manual" class="card stack" style="margin-top:16px"><label class="field">No camera? Type the code<input name="code" autocomplete="off" placeholder="8-letter voucher code"></label><button class="btn">Look up code</button></form>`;
}
function scanMount(root, app) {
  if (!$('#cam', root)) return null;
  let stop = null, handling = false;
  const status = (t) => { const el = $('#scanstatus', root); if (el) el.textContent = t; };
  const start = async () => {
    sessionStorage.setItem('umc-cam', 'on');
    $('#idle', root).classList.add('hidden');
    root.querySelector('.scanner').insertAdjacentHTML('beforeend', '<div class="frame"></div>');
    stop = await startScanner($('#cam', root), (code) => handle(code), status);
  };
  $('#start', root).onclick = start;
  $('#manual', root).onsubmit = (e) => { e.preventDefault(); const v = e.target.code.value.trim(); if (v) handle(v); };
  async function handle(raw) {
    if (handling) return; handling = true;
    try {
      raw = raw.trim();
      if (raw.startsWith('UMV1:') || /^[A-Z0-9]{8}$/i.test(raw)) await voucherFlow(app, raw);
      else toast('That isn’t a +Onz voucher. Ask the student to open the voucher in Rewards.', true);
    } finally { handling = false; }
  }
  if (sessionStorage.getItem('umc-cam') === 'on') start();
  return () => { stop && stop(); };
}
async function voucherFlow(app, raw) {
  let v;
  try { v = await D.findVoucher(app.ctx, raw); } catch (e) { return toast(e.code === 'permission-denied' ? 'This voucher belongs to another merchant.' : errText(e), true); }
  if (!v) return toast('Voucher not found for your shop.', true);
  if (v.status === 'used') return toast(`Voucher already used on ${fmtDate(v.usedAt)}.`, true);
  const el = sheet(`<h2>Redeem voucher</h2><div class="ticket" style="margin-top:12px"><span class="stub">${icon('ticket')}</span><span class="body"><h3>${esc(v.title)}</h3><p class="faint">${esc(v.studentName)} · worth ${rm(v.valueCents)}</p></span></div>
    <p class="muted" style="margin-top:12px">Give the student ${rm(v.valueCents)} off, then mark the voucher used.</p>
    <button class="btn go block" id="use" style="margin-top:12px">Mark as used</button>`);
  $('#use', el).onclick = (e) => busy(e.currentTarget, async () => { try { await D.useVoucher(app.ctx, v.id); closeSheet(); toast('Voucher marked as used.'); } catch (err) { toast(errText(err), true); } });
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
const READY_CHECKS = ['Staff confirm every payment in our own banking app or terminal', 'Staff know how to redeem a student’s +Onz voucher',
  'The name on our DuitNow QR matches our registered business name', 'Our +Onz poster is displayed next to our DuitNow QR'];
let readyLang = 'English';
async function shopRender(app) {
  const m = app.merchant; const priv = m ? await D.getMerchantPrivate(app.ctx, app.ctx.uid).catch(() => null) : null;
  const editable = !m || m.status !== 'verified';
  const v = (k) => esc((m && m[k]) || (priv && priv[k]) || '');
  const sel = (name, opts, cur) => `<select name="${name}">${opts.map((o) => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  return `<div class="page-title"><h1>My shop</h1><p class="row" style="gap:8px">${statusBadge(m)}</p></div>
    ${m && m.status === 'rejected' ? `<div class="notice bad">${icon('circle-alert')}<span>HEP asked for changes: ${esc(m.reviewNote || 'see details')}. Update and send again.</span></div>` : ''}
    ${m && m.status === 'pending' ? `<div class="notice">${icon('clock')}<span>Sent ${fmtDate(m.submittedAt)}. HEP will check that your QR name matches your business.</span></div>` : ''}
    <section class="section"><div class="head"><h2>Business details</h2></div>
    <form id="app-form" class="card stack" ${editable ? '' : 'inert'}>
      <label class="field">Business name, as students know it<input name="name" required minlength="2" value="${v('name')}"></label>
      <label class="field">Account name on your DuitNow QR<input name="accountName" required value="${v('accountName')}"><small>HEP checks this matches the QR.</small></label>
      <div class="grid-2"><label class="field">Type${sel('type', D.MERCHANT_TYPES, m?.type)}</label><label class="field">Category${sel('segment', D.SEGMENTS, m?.segment)}</label></div>
      <div class="grid-2"><label class="field">Location<input name="location" required placeholder="e.g. KK3 cafeteria" value="${v('location')}"></label><label class="field">Campus zone${sel('zone', D.ZONES, m?.zone)}</label></div>
      <div class="grid-2"><label class="field">Contact phone<input name="phone" type="tel" value="${v('phone')}"></label><label class="field">Ambassador ID (optional)<input name="ambassadorId" value="${v('ambassadorId')}" placeholder="e.g. AMB-003"></label></div>
      <div id="event-fields" class="grid-2"><label class="field">Event name<input name="eventName" value="${v('eventName')}"></label><label class="field">Event ends<input name="eventEnd" type="date" value="${v('eventEnd')}"></label></div>
      ${editable ? logoBlock(m) : ''}
      ${editable ? pinBlock(m) : ''}
      <label class="field">Photo of your DuitNow QR<input name="qr" type="file" accept="image/*" ${priv && priv.qrImage ? '' : 'required'}><small>A clear, straight photo. It goes on the monthly list PayNet uses to count your transactions.</small></label>
      ${priv && priv.qrImage ? `<img class="qr-thumb" style="width:120px;height:120px" src="${priv.qrImage}" alt="Your uploaded DuitNow QR">` : ''}
      ${editable ? `<button class="btn primary">${m ? 'Send updated details to HEP' : 'Send to HEP for verification'}</button>` : '<p class="faint">Verified details are locked. Ask HEP if something needs to change.</p>'}
    </form></section>
    ${!editable ? `<section class="section"><div class="head"><h2>Logo</h2></div><form id="logo-form" class="card stack">${logoBlock(m, true)}
      <button class="btn primary" id="logo-save">${icon('image')} Save logo</button></form></section>
      <section class="section"><div class="head"><h2>Shop location on the map</h2></div><form id="pin-form" class="card stack">${pinBlock(m, true)}
      <button class="btn primary" id="pin-save">${icon('map-pin')} Save location</button></form></section>` : ''}
    ${m ? `<section class="section" id="ready"><div class="head"><h2>Staff readiness</h2>${m.ready ? `<span class="badge ok">${icon('check')}Done ${fmtDate(m.readyAt)}</span>` : ''}</div>
      <div class="card stack"><div class="chips">${Object.keys(READY_TEXT).map((l) => `<button data-lang="${l}" class="${l === readyLang ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${READY_TEXT[readyLang].map(([t, d]) => `<div><h3>${esc(t)}</h3><p class="muted" style="font-size:14px;margin-top:4px">${esc(d)}</p></div>`).join('')}
        <form id="ready-form">${READY_CHECKS.map((c) => `<label class="check"><input type="checkbox" required ${m.ready ? 'checked' : ''}> ${esc(c)}</label>`).join('')}
          <button class="btn ${m.ready ? '' : 'primary'}" ${m.status === 'rejected' ? 'disabled' : ''}>${m.ready ? 'Checklist complete' : 'Confirm my staff are ready'}</button></form></div></section>` : ''}
    ${m && m.status === 'verified' ? `<section class="section"><div class="head"><h2>Poster for your counter</h2></div><div class="card row"><span class="tile-icon">${icon('printer')}</span><div style="flex:1"><p class="muted" style="font-size:14px">Print it and place it next to your DuitNow QR. Students scan it to open your shop in the app.</p></div><a class="btn small" href="#/poster">Open poster</a></div></section>` : ''}`;
}
function logoBlock(m, standalone = false) {
  return `<div class="field logo-field">${standalone ? '' : '<span>Shop logo</span>'}
    <div class="row" style="gap:14px;flex-wrap:nowrap"><span class="logo-preview" id="logo-prev">${m && m.logo ? `<img src="${m.logo}" alt="Your logo">` : icon('image')}</span>
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
    <small>Stand at your counter and tap “Use my current location”, or tap the map and drag the pin to your exact spot. Students navigate here and must be this close to check in.</small>
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
function shopMount(root, app) {
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
  if (rf) rf.onsubmit = (e) => { e.preventDefault(); if (app.merchant.ready) return; busy($('button', rf), async () => { try { await D.setReadiness(app.ctx); toast('Readiness recorded.'); } catch (err) { toast(errText(err), true); } }); };
  const off = app.on((t) => { if (t === 'merchant' && !root.contains(document.activeElement)) app.render(); });
  return off;
}

async function posterRender(app) {
  const m = app.merchant; if (!m) return needVerified(app);
  return `<a class="back no-print" href="#/shop">${icon('arrow-left')} My shop</a>
    <div class="poster" style="margin-top:8px"><img src="icons/icon-192.png" alt="" style="width:56px;height:56px;border-radius:16px">
      <h1>Check in here, collect points.</h1><p class="muted" style="max-width:36ch">Find ${esc(m.name)} on +Onz, check in when you arrive, and pay cashless with DuitNow QR.</p>
      <div class="qr-frame"><div id="pqr"></div></div><p><b>${esc(m.name)}</b><br><span class="faint">Scan to open this shop in +Onz</span></p></div>
    <div class="row no-print" style="justify-content:center;margin-top:16px"><button class="btn primary" onclick="window.print()">${icon('printer')} Print poster</button></div>`;
}
function posterMount(root, app) {
  const url = `${location.origin}${location.pathname}#/merchant/${app.ctx.uid}`;
  renderQR($('#pqr', root), url, 300);
}

// ------------------------------------------------------------- promote: offers, quiet-hour deals, seats
async function promoteRender(app) {
  const block = needVerified(app); if (block) return block;
  const [offers, deals, shop] = await Promise.all([D.myOffers(app.ctx), D.myDeals(app.ctx), D.getMerchant(app.ctx, app.ctx.uid)]);
  const m = shop || app.merchant;
  const liveDeals = await D.dealOverview(app.ctx, deals, [m]);
  const badge = (s) => `<span class="badge ${s === 'approved' ? 'ok' : s === 'rejected' ? 'bad' : s === 'withdrawn' ? 'grey' : 'warn'}">${{ approved: 'Live', rejected: 'Not approved', withdrawn: 'Withdrawn', pending: 'HEP reviewing' }[s] || s}</span>`;
  return `<div class="page-title"><h1>Promote</h1><p>Send deals and offers to HEP for approval.</p></div>
    <section class="card pad-lg"><h2>Café occupancy</h2><p class="muted" style="margin-top:4px">Keep seat counts current so off-peak deals switch on when you have space.</p>
      <form id="seats" class="grid-2" style="margin-top:12px;align-items:end"><label class="field">Total seats<input name="seats" type="number" min="1" max="2000" required value="${m.seats || ''}"></label>
        <label class="field">Seats taken now<input name="occupied" type="number" min="0" max="2000" required value="${m.occupied ?? ''}"></label>
        <button class="btn primary" style="grid-column:1/-1">Update seats</button></form>
      ${m.occupancyAt ? `<p class="faint" style="margin-top:8px">Last updated ${timeAgo(m.occupancyAt)}</p>` : ''}</section>
    <section class="section"><div class="head"><h2>Live deals</h2><button class="btn small primary" id="new-deal">${icon('plus')} New deal</button></div>
      <div class="stack">${liveDeals.map(({ deal: d, used, status }) => `<article class="card deal-overview-row">
        <div><h3>${esc(d.title)}</h3><p class="faint">${D.hhmm(d.startMin)}–${D.hhmm(d.endMin)} MYT · under ${d.threshold}% full · +${d.bonus} pts</p>
          ${d.status === 'approved' ? `<p class="faint">${used == null ? 'Claim count unavailable' : `${used}/${d.limit} claimed today`}</p>` : ''}</div>
        <div class="row"><span class="badge ${status === 'Available' ? 'ok' : 'grey'}">${esc(status === 'Available' ? 'Live now' : status)}</span>
          ${d.status === 'approved' ? `<button class="btn small" data-toggle="${esc(d.id)}" data-en="${d.enabled ? '0' : '1'}">${d.enabled ? 'Pause' : 'Resume'}</button>` : ''}</div>
      </article>`).join('') || `<div class="card empty">${icon('clock')}<p>No live deals yet.</p></div>`}</div></section>
    <section class="section"><div class="head"><h2>Offers</h2><button class="btn small primary" id="new-offer">${icon('plus')} New offer</button></div>
      <div class="stack">${offers.map((o) => `<div class="card row between"><div><h3>${esc(o.title)}</h3><p class="faint">${esc(o.type)} · until ${esc(o.endDate)}</p></div><div class="row">${badge(o.status)}
        ${o.status === 'approved' || o.status === 'pending' ? `<button class="btn small ghost" data-withdraw="${esc(o.id)}">Withdraw</button>` : ''}</div></div>`).join('') || `<div class="card empty">${icon('megaphone')}<p>No offers yet. A first-visit bonus is a good start.</p></div>`}</div></section>`;
}
function promoteMount(root, app) {
  if (!$('#seats', root)) return null;
  $('#seats', root).onsubmit = (e) => {
    e.preventDefault(); const s = Math.floor(+e.target.seats.value), o = Math.floor(+e.target.occupied.value);
    if (o > s) return toast('Seats taken can’t be more than total seats.', true);
    busy($('button', e.target), async () => { try { await D.setOccupancy(app.ctx, s, o); toast('Seats updated.'); app.render(); } catch (err) { toast(errText(err), true); } });
  };
  $('#new-offer', root).onclick = () => {
    const el = sheet(`<h2>New offer</h2><form id="of" class="stack" style="margin-top:12px"><label class="field">What students get<input name="title" required minlength="3" maxlength="60" placeholder="e.g. Free iced tea with any rice set"></label>
      <label class="field">Type<select name="type"><option>First-visit bonus</option><option>Discount</option><option>Free item</option><option>Extra points day</option></select></label>
      <label class="field">Runs until<input name="endDate" type="date" required min="${D.dayKey()}"></label><button class="btn primary">Send to HEP</button></form>`);
    $('#of', el).onsubmit = (e) => { e.preventDefault(); const f = e.target; busy($('button', el), async () => { try { await D.createOffer(app.ctx, { title: f.title.value, type: f.type.value, endDate: f.endDate.value }); closeSheet(); toast('Offer sent to HEP.'); app.render(); } catch (err) { toast(errText(err), true); } }); };
  };
  $('#new-deal', root).onclick = () => {
    const el = sheet(`<h2>New live deal</h2><p class="muted">Award extra points when students check out during off-peak hours.</p><form id="df" class="stack" style="margin-top:12px">
      <label class="field">Name<input name="title" required minlength="3" maxlength="60" placeholder="e.g. Afternoon study break"></label>
      <div class="grid-2"><label class="field">From<input name="start" type="time" required value="14:00"></label><label class="field">Until<input name="end" type="time" required value="17:00"></label></div>
      <div class="grid-2"><label class="field">Only while seats taken under (%)<input name="threshold" type="number" min="1" max="100" required value="60"></label><label class="field">Bonus points<input name="bonus" type="number" min="1" max="500" required value="40"></label></div>
      <label class="field">Bonuses per day<input name="limit" type="number" min="1" max="200" required value="12"></label>
      <button class="btn primary">Send to HEP</button></form>`);
    $('#df', el).onsubmit = (e) => {
      e.preventDefault(); const f = e.target; const s = D.parseHHMM(f.start.value), en = D.parseHHMM(f.end.value);
      if (en <= s) return toast('The end time must be after the start time.', true);
      busy($('button', el), async () => {
        try { await D.createDeal(app.ctx, { title: f.title.value, startMin: s, endMin: en, threshold: Math.floor(+f.threshold.value), bonus: Math.floor(+f.bonus.value), limit: Math.floor(+f.limit.value) }); closeSheet(); toast('Deal sent to HEP.'); app.render(); }
        catch (err) { toast(errText(err), true); }
      });
    };
  };
  $$('[data-toggle]', root).forEach((b) => { b.onclick = () => busy(b, async () => { await D.toggleDeal(app.ctx, b.dataset.toggle, b.dataset.en === '1'); app.render(); }); });
  $$('[data-withdraw]', root).forEach((b) => { b.onclick = () => busy(b, async () => { await app.backend.sdk.updateDoc(app.backend.sdk.doc(app.ctx.db, 'offers', b.dataset.withdraw), { status: 'withdrawn' }); app.render(); }); });
  const off = app.on((t) => { if (t === 'merchant' && !root.contains(document.activeElement) && !document.querySelector('#sheet[open]')) app.render(); });
  return off;
}

// ------------------------------------------------------------- insights (from check-ins)
async function insightsRender(app) {
  const block = needVerified(app); if (block) return block;
  return `<div class="page-title"><h1>Insights</h1><p>From students who checked in at your shop on +Onz.</p></div><div id="ins"><div class="skeleton" style="height:240px"></div></div>`;
}
function insightsMount(root, app) {
  if (!$('#ins', root)) return null;
  return D.watchMerchantVisits(app.ctx, (vs) => {
    const days = Array.from({ length: 7 }, (_, i) => D.dayKey(Date.now() - (6 - i) * 86400000));
    const per = days.map((d) => vs.filter((v) => v.day === d).length);
    const students = new Map(); vs.forEach((v) => students.set(v.uid, (students.get(v.uid) || 0) + 1));
    const returning = [...students.values()].filter((c) => c > 1).length;
    const hours = Array.from({ length: 24 }, () => 0); vs.forEach((v) => { hours[new Date((toMs(v.at) || 0) + 8 * 3600000).getUTCHours()]++; });
    const busiest = hours.indexOf(Math.max(...hours)); const quiet = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].sort((a, b) => hours[a] - hours[b])[0];
    const month = vs.filter((v) => v.month === D.monthKey());
    const colleges = {}; vs.forEach((v) => { colleges[v.college] = (colleges[v.college] || 0) + 1; });
    const topCollege = Object.entries(colleges).sort((a, b) => b[1] - a[1])[0];
    $('#ins', root).innerHTML = `<div class="stats">
        <div class="stat"><div class="k">This month</div><div class="v num">${month.length}</div><div class="s">check-ins</div></div>
        <div class="stat"><div class="k">Students</div><div class="v num">${students.size}</div><div class="s">${returning} came back</div></div>
        <div class="stat"><div class="k">Top college</div><div class="v num">${topCollege ? esc(topCollege[0]) : '—'}</div><div class="s">${topCollege ? `${topCollege[1]} check-ins` : 'no data yet'}</div></div>
        <div class="stat"><div class="k">Busiest hour</div><div class="v num">${vs.length ? `${busiest}:00` : '—'}</div><div class="s">${vs.length ? `quietest ${quiet}:00` : 'no data yet'}</div></div></div>
      <section class="section card pad-lg"><h2>Check-ins, last 7 days</h2><div style="margin-top:12px">${barChart(per, days.map((d) => new Date(d + 'T00:00:00+08:00').toLocaleDateString('en-MY', { weekday: 'short' })), { highlight: 6 })}</div></section>
      ${vs.length && hours[quiet] < hours[busiest] / 3 ? `<div class="notice" style="margin-top:16px">${icon('info')}<span>${quiet}:00 is your quietest hour. A quiet-hour bonus could bring students in then.</span></div>` : ''}
      <section class="section"><div class="head"><h2>Recent check-ins</h2><button class="btn small" id="csv">${icon('download')} CSV</button></div><div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>When</th><th>Student</th><th>College</th><th>Bonus</th></tr></thead>
        <tbody>${vs.slice(0, 50).map((v) => `<tr><td>${fmtDate(v.at)} ${fmtTime(v.at)}</td><td>${esc(v.name)}</td><td>${esc(v.college || '')}</td><td>${v.deal ? 'Quiet hour' : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="faint">No check-ins yet.</td></tr>'}</tbody></table></div></div></section>`;
    const csv = $('#csv', root);
    if (csv) csv.onclick = () => (downloadCSV(`${app.merchant.name}-check-ins.csv`, [['Date', 'Time', 'Student', 'College', 'Quiet-hour bonus'], ...vs.map((v) => [v.day, fmtTime(v.at), v.name, v.college, v.deal ? 'yes' : ''])]));
  }, () => {});
}

async function surveyRender(app) {
  const existing = await D.getSurvey(app.ctx).catch(() => null);
  return `<a class="back" href="#/home">${icon('arrow-left')} Home</a><div class="page-title"><h1>Cashless readiness check</h1><p>Your answers help HEP decide who needs an ambassador visit or staff training.</p></div>${surveyHTML('merchant', existing)}`;
}

export const routes = {
  home: { title: 'Home', render: homeRender, mount: homeMount },
  scan: { title: 'Scan', render: scanRender, mount: scanMount },
  shop: { title: 'My shop', render: shopRender, mount: shopMount },
  poster: { title: 'Poster', render: posterRender, mount: posterMount, tab: 'shop' },
  promote: { title: 'Promote', render: promoteRender, mount: promoteMount },
  insights: { title: 'Insights', render: insightsRender, mount: insightsMount },
  survey: { title: 'Readiness check', render: surveyRender, mount: (r, a) => surveyMount(r, a, 'merchant', 'home'), tab: 'home' },
};
