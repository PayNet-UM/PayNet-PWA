// HEP dashboard: verification, approvals, PayNet lists, reconciliation, rewards and budget, KPIs, settings.
import * as D from '../data.js';
import { safeImg, $, $$, esc, icon, rm, n, toast, sheet, closeSheet, confirmSheet, busy, errText, fmtDate, fmtDateTime, timeAgo,
  downloadCSV, downloadBlob, loadExcel, parseCSV, barChart, initials } from '../ui.js';
import { langToggleHTML, tr } from '../i18n.js';
import { shopPinMap, hasPin, googleMapsPinUrl } from '../map.js';
import { siteUrls } from '../firebase-config.js';

export const defaultRoute = 'overview';
const toMs = D.toMs;
const NAV = [
  ['overview', 'Overview', 'layout-dashboard'], ['merchants', 'Merchants', 'store'], ['approvals', 'Approvals', 'list-checks'],
  ['paynet', 'PayNet list', 'file-spreadsheet'], ['recon', 'Activity check', 'scale'], ['rewards', 'Rewards and budget', 'gift'],
  ['campaigns', 'Campaigns', 'calendar'], ['kpis', 'KPIs and surveys', 'chart-column'], ['people', 'Students', 'users'], ['settings', 'Settings', 'settings'],
];
const monthLabel = (m) => new Date(m + '-01T00:00:00+08:00').toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
const lastMonths = (k = 6) => Array.from({ length: k }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); return D.monthKey(d.getTime() + 86400000 * 2); });
let month = D.monthKey();
const monthPicker = () => `<select id="month" style="width:auto;min-height:40px">${lastMonths().map((m) => `<option value="${m}" ${m === month ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>`;
const bindMonth = (root, app) => { const s = $('#month', root); if (s) s.onchange = () => { month = s.value; app.render(); }; };

export async function renderShell(app, route) {
  if (!$('#mpp-rail')) {
    $('#root').innerHTML = `<div class="mpp"><aside class="rail" id="mpp-rail"><header class="onz-hep-header"><a class="brand" href="#/overview"><img class="onz-brand-logo" src="icons/onz-header.png" alt="+Onz" width="368" height="227"><em class="onz-role">HEP</em></a>
      <button class="btn small menu-toggle" id="menu">${icon('list-checks')} Menu</button></header>
      <nav aria-label="HEP">${NAV.map(([k, l, ic]) => `<a href="#/${k}" data-nav="${k}">${icon(ic)}<span>${l}</span><span class="count hidden" data-count="${k}"></span></a>`).join('')}</nav>
      <div class="who">${langToggleHTML('on-dark')}<b style="color:#fff;display:block;margin-top:12px">${esc(app.user.email)}</b><div class="row" style="margin-top:10px">
        ${app.profile ? `<a class="btn small" id="as-user" href="${esc(siteUrls.client)}" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.3)">Open my ${esc(app.profile.role)} app</a>` : ''}
        <button class="btn small" id="mpp-out" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.3)">${icon('log-out')} Sign out</button></div></div></aside>
      <main class="view" id="view"></main></div>`;
    $('#menu').onclick = () => $('#mpp-rail').classList.toggle('open');
    $('#mpp-out').onclick = () => app.backend.sdk.signOut(app.backend.auth);
    if (app.addDemoRibbon) app.addDemoRibbon();
  }
  $('#mpp-rail').classList.remove('open');
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === route));
  refreshCounts(app);
}
async function refreshCounts(app) {
  try {
    const [m, o, d, c, w] = await Promise.all([D.listMerchantsAll(app.ctx), D.pendingOffers(app.ctx), D.pendingDeals(app.ctx), D.pendingMissionClaims(app.ctx), D.pendingWelfareRequests(app.ctx)]);
    const set = (k, v) => { const el = $(`[data-count=${k}]`); if (el) { el.textContent = v; el.classList.toggle('hidden', !v); } };
    set('merchants', m.filter((x) => x.status === 'pending').length); set('approvals', o.length + d.length + c.length + w.length);
  } catch { /* not initialised yet */ }
}

// ------------------------------------------------------------- overview
async function overviewRender(app) {
  if (!(await D.programmeReady(app.ctx)) || !(await D.rulesUpToDate(app.ctx))) { await D.initProgramme(app.ctx); app.rules = await D.getRules(app.ctx); }
  const [users, merchants, welfare, league, deals, waitingDeals] = await Promise.all([D.listUsers(app.ctx), D.listMerchantsAll(app.ctx),
    app.backend.sdk.getDoc(app.backend.sdk.doc(app.ctx.db, 'stats', 'welfare')), app.backend.sdk.getDoc(app.backend.sdk.doc(app.ctx.db, 'stats', 'league')), D.approvedDeals(app.ctx), D.pendingDeals(app.ctx)]);
  const liveDeals = await D.dealOverview(app.ctx, deals, merchants);
  const students = users.filter((u) => u.role === 'student');
  const verified = merchants.filter((m) => m.status === 'verified');
  const pending = merchants.filter((m) => m.status === 'pending');
  const today = Number(D.dayKey().slice(-2));
  const shortcuts = [
    ['merchants', 'store', 'Merchants', `${pending.length} waiting for review`],
    ['approvals', 'list-checks', 'Approvals', 'Offers, deals and welfare'],
    ['paynet', 'file-spreadsheet', 'PayNet list', 'Export Lampiran 1'],
  ];
  return `<section class="kk-hero hep-overview-hero">
      <div><h1>Programme overview</h1><p>PayNet merchant list is due on the 20th. ${today <= 20 && month === D.monthKey() ? `${20 - today} days left this month.` : ''}</p></div>
      <label class="hep-period"><span class="sr">Reporting month</span>${monthPicker()}</label>
    </section>
    <h2 class="kk-pillars-title">Needs your attention</h2>
    <nav class="kk-pillars hep-shortcuts" aria-label="HEP shortcuts">
      ${shortcuts.map(([route, glyph, label, detail]) => `<a class="kk-pillar" href="#/${route}"><span class="tile-icon">${icon(glyph)}</span><h3>${label}</h3><p>${detail}</p></a>`).join('')}
    </nav>
    <h2 class="kk-pillars-title">Programme activity</h2>
    <div class="stats">
      <div class="stat"><div class="k">Students enrolled</div><div class="v num">${n(students.length)}</div></div>
      <div class="stat"><div class="k">Cashless-ready merchants</div><div class="v num">${n(verified.filter((m) => m.ready).length)}</div></div>
      <div class="stat"><div class="k">Verified merchants</div><div class="v num">${n(verified.length)}</div><div class="s">${pending.length} waiting for review</div></div>
      <div class="stat"><div class="k">Welfare fund</div><div class="v num">${n(welfare.exists() ? welfare.data().points : 0)}</div><div class="s">points available</div></div></div>
    <section class="section card pad-lg"><div class="row between"><h2>Live deals</h2><a class="btn small" href="#/approvals">Review deals (${waitingDeals.length})</a></div>
      <p class="faint">${liveDeals.filter((row) => row.status === 'Available').length} live now · ${deals.length} approved</p>
      <div class="list">${liveDeals.map(({ deal: d, merchant: m, used, status }) => `<article class="item deal-overview-row">
        <div class="grow"><h3>${esc(d.title)}</h3><p>${esc(m?.name || d.merchantName)} · ${D.hhmm(d.startMin)}–${D.hhmm(d.endMin)} MYT</p>
          <p>${m?.seats ? `${m.occupied}/${m.seats} seats taken` : 'Seat count not set'}</p></div>
        <span class="badge ${status === 'Available' ? 'ok' : 'grey'}">${esc(status === 'Available' ? 'Live now' : status)}</span>
      </article>`).join('') || '<p class="faint">No approved deals yet.</p>'}</div></section>
    <div style="margin-top:16px">
      <section class="card pad-lg"><h2>KK League</h2><p class="faint">Total points earned</p><table class="data" style="margin-top:8px"><tbody>${Object.entries((league.exists() && league.data().colleges) || {}).filter(([, points]) => points > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true })).slice(0, 6)
        .map(([k, v]) => `<tr><td>${esc(D.COLLEGES.find(([c]) => c === k)?.[1] || k)}</td><td class="r num">${n(v)} <small>pts</small></td></tr>`).join('') || `<tr><td class="faint">${league.exists() ? 'No points earned yet. Get your KK started.' : 'Scores are syncing.'}</td></tr>`}</tbody></table></section></div>`;
}
function setupHTML() {
  return `<div class="page-title"><h1>Set up the programme</h1><p>This creates the points rules, reward catalogue, leaderboard and welfare counters in your Firebase project. Run it once.</p></div>
    <div class="card pad-lg stack"><label class="field">Student email domains<input id="domains" value="siswa.um.edu.my, um.edu.my, gmail.com"><small>Only these domains can sign up as students. Keep gmail.com if students sign in with Google; each matric number can only register once.</small></label>
      <button class="btn primary" id="init">Set up +Onz</button></div>`;
}
function overviewMount(root, app) {
  bindMonth(root, app);
  if ($('#init', root)) $('#init', root).onclick = (e) => busy(e.currentTarget, async () => {
    try { await D.initProgramme(app.ctx, { studentDomains: $('#domains', root).value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) }); toast('Programme set up.'); app.rules = await D.getRules(app.ctx); app.render(); }
    catch (err) { toast(errText(err), true); }
  });
}

// ------------------------------------------------------------- merchants
let mFilter = 'pending';
async function merchantsRender(app) {
  const all = await D.listMerchantsAll(app.ctx); app._m = all;
  const counts = (s) => all.filter((m) => s === 'all' || m.status === s).length;
  const rows = all.filter((m) => mFilter === 'all' || m.status === mFilter).sort((a, b) => (toMs(b.submittedAt) || 0) - (toMs(a.submittedAt) || 0));
  return `<div class="page-title"><h1>Merchants</h1><p>Verify that each DuitNow QR belongs to the business before it goes on PayNet’s list. Event stalls expire after their end date.</p></div>
    <div class="chips">${[['pending', 'To review'], ['verified', 'Verified'], ['rejected', 'Needs changes'], ['suspended', 'Suspended'], ['all', 'All']].map(([k, l]) => `<button data-f="${k}" class="${k === mFilter ? 'on' : ''}">${l} (${counts(k)})</button>`).join('')}</div>
    <div class="card" style="margin-top:10px"><div class="table-wrap"><table class="data"><thead><tr><th>Business</th><th>Category</th><th>Location</th><th>Sent</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map((m) => `<tr><td><b>${esc(m.name)}</b><br><span class="faint">${esc(m.type)}</span></td><td>${esc(m.segment)}${m.eventEnd ? `<br><span class="faint">ends ${esc(m.eventEnd)}</span>` : ''}</td><td>${esc(m.location)}</td><td>${fmtDate(m.submittedAt)}</td>
        <td>${m.status === 'verified' ? '<span class="badge ok">Verified</span>' : m.status === 'pending' ? '<span class="badge warn">To review</span>' : `<span class="badge bad">${esc(m.status)}</span>`}${m.ready ? ` <span class="badge ok">Staff ready</span>` : ''}</td>
        <td class="r"><button class="btn small ${m.status === 'pending' ? 'primary' : ''}" data-review="${esc(m.id)}">${m.status === 'pending' ? 'Review' : 'Open'}</button></td></tr>`).join('') || '<tr><td colspan="6" class="faint">Nothing here.</td></tr>'}
    </tbody></table></div></div>`;
}
function merchantsMount(root, app) {
  $$('[data-f]', root).forEach((b) => { b.onclick = () => { mFilter = b.dataset.f; app.render(); }; });
  $$('[data-review]', root).forEach((b) => {
    b.onclick = async () => {
      const m = app._m.find((x) => x.id === b.dataset.review); const p = await D.getMerchantPrivate(app.ctx, m.id).catch(() => ({}));
      const el = sheet(`<div class="row" style="gap:12px">${safeImg(m.logo) ? `<img class="logo big" src="${safeImg(m.logo)}" alt="${esc(m.name)} logo">` : '<span class="badge bad">No logo</span>'}<div><h2>${esc(m.name)}</h2><p class="muted">${esc(m.type)} · ${esc(m.segment)} · ${esc(m.location)}</p></div></div>
        <div class="cols two" style="margin-top:14px"><div>${p && safeImg(p.qrImage) ? `<a href="${safeImg(p.qrImage)}" target="_blank" rel="noopener"><img class="qr-large" src="${safeImg(p.qrImage)}" alt="Uploaded DuitNow QR for ${esc(m.name)}"></a>` : '<div class="card empty">No QR image uploaded</div>'}</div>
          <table class="data"><tbody><tr><td class="faint">Account name on QR</td><td><b>${esc(p?.accountName || '—')}</b></td></tr><tr><td class="faint">Phone</td><td>${esc(p?.phone || '—')}</td></tr>
            <tr><td class="faint">Ambassador</td><td>${esc(p?.ambassadorId || '—')}</td></tr><tr><td class="faint">Zone</td><td>${esc(m.zone || '—')}</td></tr>
            ${m.eventName ? `<tr><td class="faint">Event</td><td>${esc(m.eventName)} (ends ${esc(m.eventEnd || '?')})</td></tr>` : ''}
            <tr><td class="faint">Map pin</td><td>${hasPin(m) ? `<a href="${googleMapsPinUrl(m)}" target="_blank" rel="noopener">${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}</a>` : '<span class="badge warn">No pin yet</span>'}</td></tr>
            <tr><td class="faint">Sent</td><td>${fmtDateTime(m.submittedAt)}</td></tr>${m.reviewedBy ? `<tr><td class="faint">Last review</td><td>${esc(m.reviewedBy)}, ${fmtDate(m.reviewedAt)}</td></tr>` : ''}</tbody></table></div>
        ${hasPin(m) ? `<div id="rv-map" class="mmap small" style="margin-top:14px;border-radius:14px" aria-label="Where ${esc(m.name)} placed its shop"></div>` : ''}
        <form id="rv" class="stack" style="margin-top:16px">
          ${['The account name on the QR matches the business', 'The map pin is at the shop (on campus or within 100 m of a UM gate)', 'The QR image is clear enough for PayNet'].map((c) => `<label class="check"><input type="checkbox" name="c"> ${c}</label>`).join('')}
          <label class="field">Note to the merchant<input name="note" value="${esc(m.reviewNote || '')}" placeholder="Required if you ask for changes"></label>
          <div class="row end">${m.status !== 'suspended' && m.status === 'verified' ? '<button type="button" class="btn warn" data-s="suspended">Suspend</button>' : ''}
            <button type="button" class="btn" data-s="rejected">Ask for changes</button><button type="button" class="btn go" data-s="verified">Verify merchant</button></div></form>`, { wide: true });
      if (hasPin(m)) shopPinMap($('#rv-map', el), m).catch(() => {});
      $$('[data-s]', el).forEach((x) => {
        x.onclick = () => {
          const f = $('#rv', el); const s = x.dataset.s;
          if (s === 'verified' && $$('[name=c]', f).some((c) => !c.checked)) return toast('Tick all three checks before verifying.', true);
          if (s !== 'verified' && !f.note.value.trim()) return toast('Add a note so the merchant knows what to fix.', true);
          busy(x, async () => { try { await D.reviewMerchant(app.ctx, m.id, s, f.note.value.trim()); closeSheet(); toast(s === 'verified' ? `${m.name} verified.` : 'Status updated.'); app.render(); } catch (err) { toast(errText(err), true); } });
        };
      });
    };
  });
}

// ------------------------------------------------------------- approvals
async function approvalsRender(app) {
  const [offers, deals, claims, requests, welfare] = await Promise.all([D.pendingOffers(app.ctx), D.pendingDeals(app.ctx), D.pendingMissionClaims(app.ctx), D.pendingWelfareRequests(app.ctx), D.getWelfareFund(app.ctx)]);
  app._ap = { offers, deals, claims, requests };
  const empty = (t) => `<div class="empty" style="padding:16px">${t}</div>`;
  return `<div class="page-title"><h1>Approvals</h1><p>Approve offers and off-peak deals before students can see them. Historical mission claims can be reviewed separately.</p></div>
    <div class="cols two">
      <section class="card pad-lg"><h2>Offers (${offers.length})</h2><div class="list" style="margin-top:6px">${offers.map((o) => `<div class="item"><div class="grow"><h3>${esc(o.title)}</h3><p>${esc(o.merchantName)} · ${esc(o.type)} · until ${esc(o.endDate)}</p></div>
        <button class="btn small" data-offer="${esc(o.id)}" data-s="rejected">Reject</button><button class="btn small go" data-offer="${esc(o.id)}" data-s="approved">Approve</button></div>`).join('') || empty('No offers waiting.')}</div></section>
      <section class="card pad-lg"><h2>Live deals (${deals.length})</h2><div class="list" style="margin-top:6px">${deals.map((d) => `<div class="item"><div class="grow"><h3>${esc(d.title)}</h3><p>${esc(d.merchantName)} · ${D.hhmm(d.startMin)}–${D.hhmm(d.endMin)} · under ${d.threshold}% full</p></div>
        <button class="btn small" data-deal="${esc(d.id)}" data-s="rejected">Reject</button><button class="btn small go" data-deal="${esc(d.id)}" data-s="approved">Approve</button></div>`).join('') || empty('No deals waiting.')}</div></section></div>
    <section class="card pad-lg" style="margin-top:16px"><h2>Archived mission claims (${claims.length})</h2><p class="faint">Historical claims only. New attendance missions are paused.</p><div class="list" style="margin-top:6px">${claims.map((c) => `<div class="item"><span class="avatar" style="width:32px;height:32px">${esc(initials(c.name))}</span><div class="grow"><h3>${esc(c.name)}: ${esc(c.title)}</h3><p>Week of ${esc(c.week)} · progress ${c.progress} · +${c.bonus} points</p></div>
      <button class="btn small" data-claim="${esc(c.id)}" data-ok="0">Reject</button><button class="btn small go" data-claim="${esc(c.id)}" data-ok="1">Approve</button></div>`).join('') || empty('No claims waiting.')}</div></section>
    <section class="card pad-lg hep-welfare-review" style="margin-top:16px"><div class="row between"><h2>Welfare requests <span>(${requests.length})</span></h2><span class="badge">${n(welfare?.points || 0)} <span>points available</span></span></div>
      <div class="list">${requests.map((request) => `<article class="item hep-welfare-request"><span class="tile-icon">${icon('hand-heart')}</span><div class="grow"><h3>${esc(request.name)}</h3><p>${esc(request.college)} · ${fmtDate(request.createdAt)}</p><p class="hep-welfare-reason" data-no-i18n>${esc(request.reason)}</p></div>
      <strong class="hep-welfare-amount">${n(request.amount)} <small>pts</small></strong><div class="row"><button class="btn small warn" data-welfare="${esc(request.id)}" data-ok="0">Decline</button><button class="btn small go" data-welfare="${esc(request.id)}" data-ok="1" ${(welfare?.points || 0) < request.amount ? 'disabled title="Not enough points in the fund"' : ''}>Approve</button></div></article>`).join('') || empty('No welfare requests waiting.')}</div></section>`;
}
function approvalsMount(root, app) {
  $$('[data-offer]', root).forEach((b) => { b.onclick = () => busy(b, async () => { try { await D.reviewOffer(app.ctx, app._ap.offers.find((o) => o.id === b.dataset.offer), b.dataset.s); toast(b.dataset.s === 'approved' ? 'Offer is live.' : 'Offer rejected.'); app.render(); } catch (e) { toast(errText(e), true); } }); });
  $$('[data-deal]', root).forEach((b) => { b.onclick = () => busy(b, async () => { try { await D.reviewDeal(app.ctx, b.dataset.deal, b.dataset.s); toast(b.dataset.s === 'approved' ? 'Deal approved.' : 'Deal rejected.'); app.render(); } catch (e) { toast(errText(e), true); } }); });
  $$('[data-claim]', root).forEach((b) => { b.onclick = () => busy(b, async () => { try { await D.reviewMissionClaim(app.ctx, app._ap.claims.find((c) => c.id === b.dataset.claim), b.dataset.ok === '1'); toast('Claim reviewed.'); app.render(); } catch (e) { toast(errText(e), true); } }); });
  $$('[data-welfare]', root).forEach((button) => { button.onclick = () => {
    const request = app._ap.requests.find((item) => item.id === button.dataset.welfare), approve = button.dataset.ok === '1';
    const el = sheet(`<h2>${approve ? 'Approve welfare request' : 'Decline welfare request'}</h2><p class="muted">${esc(request.name)} · ${n(request.amount)} <span>pts</span></p>
      <p class="hep-welfare-reason" data-no-i18n>${esc(request.reason)}</p>${approve ? '<p class="faint">Points move from the welfare pool to the student’s balance.</p>' : ''}
      <form id="welfare-review-form" class="stack" style="margin-top:14px"><label class="field">Response to student<textarea name="response" rows="3" maxlength="500" ${approve ? '' : 'required minlength="3"'}></textarea></label>
      <button class="btn ${approve ? 'go' : 'warn'} block" type="submit">${approve ? 'Approve and transfer points' : 'Decline request'}</button></form>`);
    $('#welfare-review-form', el).onsubmit = (event) => {
      event.preventDefault(); busy($('button[type=submit]', el), async () => {
        try { await D.reviewWelfareRequest(app.ctx, request.id, approve, event.target.response.value); closeSheet(); toast(approve ? 'Points transferred.' : 'Request declined.'); app.render(); }
        catch (error) { toast(errText(error), true); }
      });
    };
  }; });
}

// ------------------------------------------------------------- PayNet list (Lampiran 1 and 2)
async function paynetRender(app) {
  const all = await D.listMerchantsAll(app.ctx);
  const monthEnd = `${month}-31`;
  const listed = all.filter((m) => m.status === 'verified' || (m.status === 'suspended')).filter((m) => !m.eventEnd || m.eventEnd >= `${month}-01`);
  const priv = await Promise.all(listed.map((m) => D.getMerchantPrivate(app.ctx, m.id).catch(() => null)));
  app._pn = listed.map((m, i) => ({ ...m, priv: priv[i] || {} }));
  const manual = (await D.listManualVolumes(app.ctx)).filter((r) => r.month === month);
  return `<div class="page-title row between"><div><h1>PayNet merchant list</h1><p>PayNet counts DuitNow QR transactions only for merchants on this list. Send updates by the 20th of each month.</p></div>${monthPicker()}</div>
    <section class="card pad-lg"><div class="row between"><h2>Lampiran 1: DuitNow QR merchants (${app._pn.length})</h2><div class="row"><button class="btn small" id="csv1">${icon('download')} CSV</button><button class="btn small primary" id="xlsx1">${icon('file-spreadsheet')} Excel with QR images</button></div></div>
      <div class="table-wrap" style="margin-top:10px"><table class="data"><thead><tr><th>No.</th><th>Merchant name / name on QR</th><th>Account name</th><th>Location / type</th><th>Category</th><th>QR</th><th>Remark</th></tr></thead><tbody>
      ${app._pn.map((m, i) => `<tr><td>${i + 1}</td><td><b>${esc(m.name)}</b></td><td>${esc(m.priv.accountName || '')}</td><td>${esc(m.location)} / ${esc(m.type)}</td><td>${esc(m.segment)}</td>
        <td>${safeImg(m.priv.qrImage) ? `<img class="qr-thumb" src="${safeImg(m.priv.qrImage)}" alt="QR for ${esc(m.name)}">` : '<span class="badge bad">Missing</span>'}</td><td>${remarkFor(m)}</td></tr>`).join('') || '<tr><td colspan="7" class="faint">No verified merchants yet.</td></tr>'}</tbody></table></div></section>
    <section class="card pad-lg" style="margin-top:16px"><div class="row between"><h2>Lampiran 2: volumes PayNet can’t see</h2><div class="row"><button class="btn small" id="add2">${icon('plus')} Add row</button><button class="btn small" id="xlsx2">${icon('file-spreadsheet')} Excel</button></div></div>
      <p class="faint">Card terminals, self-service laundry, vending machines. Get the monthly transaction count from the operator.</p>
      <div class="table-wrap" style="margin-top:10px"><table class="data"><thead><tr><th>Merchant</th><th>Location / type</th><th>Payment method</th><th>Provider</th><th class="r">Transactions</th><th></th></tr></thead><tbody>
      ${manual.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.location)}</td><td>${esc(r.method)}</td><td>${esc(r.provider)}</td><td class="r num">${n(r.volume)}</td><td class="r"><button class="btn small ghost" data-del2="${esc(r.id)}">${icon('trash-2')}</button></td></tr>`).join('') || '<tr><td colspan="6" class="faint">No rows for this month.</td></tr>'}</tbody></table></div></section>`;
}
function remarkFor(m) {
  if (m.status === 'suspended') return 'Not in service';
  const sent = toMs(m.reviewedAt) || toMs(m.submittedAt);
  if (sent && D.monthKey(sent) === month) return 'New merchant';
  if (m.eventEnd) return `Event stall until ${m.eventEnd}`;
  return '';
}
function paynetMount(root, app) {
  bindMonth(root, app);
  const rows = () => app._pn.map((m, i) => [i + 1, m.name, m.priv.accountName || '', `${m.location} / ${m.type}`, m.segment, m.priv.qrImage ? 'See image' : 'MISSING', remarkFor(m)]);
  $('#csv1', root).onclick = () => downloadCSV(`Lampiran1-UM-${month}.csv`, [['No.', 'Merchant name / name on the QR', 'Merchant account name', 'Location / type of business', 'Category', 'DuitNow QR (QR code image)', 'Remark'], ...rows()]);
  $('#xlsx1', root).onclick = (e) => busy(e.currentTarget, async () => {
    try {
      const ExcelJS = await loadExcel(); const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Lampiran 1');
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      ws.addRow(['No.', 'MERCHANT NAME/NAME ON THE QR', 'MERCHANT ACCOUNT NAME', 'LOCATION/TYPE OF BUSINESS', 'CATEGORY', 'DuitNow QR (QR Code Image)', 'REMARK', ...months]);
      ws.getRow(1).font = { bold: true }; ws.getRow(1).alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      ws.getCell('F1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF48FB1' } };
      [6, 32, 30, 30, 26, 22, 24].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      app._pn.forEach((m, i) => {
        const r = ws.addRow(rows()[i].map((v, j) => (j === 5 ? '' : v))); r.height = 120; r.alignment = { vertical: 'middle', wrapText: true };
        if (safeImg(m.priv.qrImage)) {
          const id = wb.addImage({ base64: m.priv.qrImage, extension: m.priv.qrImage.startsWith('data:image/png') ? 'png' : 'jpeg' });
          ws.addImage(id, { tl: { col: 5.1, row: i + 1.05 }, ext: { width: 140, height: 150 } });
        }
      });
      downloadBlob(`Lampiran1-UM-${month}.xlsx`, new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      toast('Lampiran 1 downloaded.');
    } catch (err) { toast('Excel export failed: ' + err.message, true); }
  });
  $('#xlsx2', root).onclick = (e) => busy(e.currentTarget, async () => {
    const manual = (await D.listManualVolumes(app.ctx)).filter((r) => r.month === month);
    const ExcelJS = await loadExcel(); const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Lampiran 2');
    ws.addRow(['No.', 'MERCHANT NAME', 'LOCATION / TYPE OF BUSINESS', 'PAYMENT METHOD', 'PAYMENT SERVICE PROVIDER', monthLabel(month)]); ws.getRow(1).font = { bold: true };
    manual.forEach((r, i) => ws.addRow([i + 1, r.name, r.location, r.method, r.provider, r.volume]));
    [6, 30, 30, 20, 26, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    downloadBlob(`Lampiran2-UM-${month}.xlsx`, new Blob([await wb.xlsx.writeBuffer()]));
  });
  $('#add2', root).onclick = () => {
    const el = sheet(`<h2>Add a Lampiran 2 row</h2><form id="l2" class="stack" style="margin-top:12px"><label class="field">Merchant name<input name="name" required></label>
      <label class="field">Location / type of business<input name="location" required placeholder="e.g. KK3 / self-service laundry"></label>
      <div class="grid-2"><label class="field">Payment method<input name="method" required placeholder="Card, QR code"></label><label class="field">Payment service provider<input name="provider" required placeholder="e.g. Kiplepay"></label></div>
      <label class="field">Transactions in ${monthLabel(month)}<input name="volume" type="number" min="0" step="1" required></label><button class="btn primary">Save row</button></form>`);
    $('#l2', el).onsubmit = (e) => { e.preventDefault(); const f = e.target; busy($('button', el), async () => { await D.saveManualVolume(app.ctx, null, { name: f.name.value, location: f.location.value, method: f.method.value, provider: f.provider.value, volume: Math.floor(+f.volume.value), month }); closeSheet(); app.render(); }); };
  };
  $$('[data-del2]', root).forEach((b) => { b.onclick = async () => { if (await confirmSheet('Delete this row?', 'It will be removed from this month’s Lampiran 2.', 'Delete', true)) { await D.deleteManualVolume(app.ctx, b.dataset.del2); app.render(); } }; });
}

// ------------------------------------------------------------- activity check: check-ins vs PayNet counts, unusual patterns
async function reconRender(app) {
  const [counts, merchants] = await Promise.all([D.paynetCounts(app.ctx, month), D.listMerchantsAll(app.ctx)]);
  app._rc = { merchants, counts };
  return `<div class="page-title row between"><div><h1>Activity check</h1><p>Imported PayNet transaction counts.</p></div>${monthPicker()}</div>
    <section class="card pad-lg"><div class="row between"><h2>PayNet transactions</h2><div class="row"><button class="btn small" id="imp">${icon('upload')} Import PayNet CSV</button><button class="btn small" id="exp">${icon('download')} Export</button></div></div>
    <div class="table-wrap"><table class="data"><thead><tr><th>Merchant</th><th class="r">PayNet transactions</th></tr></thead><tbody>${merchants.filter((m) => m.status === 'verified').map((m) => { const row = counts.find((r) => r.merchantId === m.id); return `<tr><td>${esc(m.name)}</td><td class="r num">${row ? n(row.count) : '—'}</td></tr>`; }).join('')}</tbody></table></div></section>`;
}
function reconMount(root, app) {
  bindMonth(root, app);
  $('#exp', root).onclick = () => downloadCSV(`PayNet-UM-${month}.csv`, [['Merchant', 'Transactions'], ...app._rc.counts.map((r) => [r.merchantName, r.count])]);
  $('#imp', root).onclick = () => {
    const el = sheet(`<h2>Import PayNet counts</h2><p class="muted">For ${monthLabel(month)}. A CSV with merchant name in the first column and transaction count in the second.</p>
      <input type="file" id="f" accept=".csv,text/csv" style="margin-top:12px"><div id="pv" style="margin-top:12px"></div>`);
    $('#f', el).onchange = async (e) => {
      const rows = parseCSV(await e.target.files[0].text());
      const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
      const matched = rows.map((r) => ({ name: r[0], count: parseInt(String(r[1]).replace(/[^\d]/g, ''), 10), m: app._rc.merchants.find((m) => norm(m.name) === norm(r[0])) })).filter((r) => Number.isFinite(r.count));
      $('#pv', el).innerHTML = `<table class="data"><tbody>${matched.map((r) => `<tr><td>${esc(r.name)}</td><td class="r">${n(r.count)}</td><td>${r.m ? '<span class="badge ok">Matched</span>' : '<span class="badge bad">No match</span>'}</td></tr>`).join('')}</tbody></table>
        <button class="btn primary block" id="save" style="margin-top:12px">Save ${matched.filter((r) => r.m).length} matched rows</button>`;
      $('#save', el).onclick = (ev) => busy(ev.currentTarget, async () => { await D.savePaynetCounts(app.ctx, month, matched.filter((r) => r.m).map((r) => ({ merchantId: r.m.id, merchantName: r.m.name, count: r.count }))); closeSheet(); toast('PayNet counts saved.'); app.render(); });
    };
  };
}

// ------------------------------------------------------------- rewards and budget
async function rewardsRender(app) {
  const [rewards, vouchers, budget, merchants, camps] = await Promise.all([D.listRewards(app.ctx), D.listVouchers(app.ctx), D.getConfig(app.ctx, 'budget'), D.listMerchantsAll(app.ctx), D.listCampaigns(app.ctx)]);
  app._rw = { rewards, vouchers, merchants };
  const alloc = budget?.allocationCents || 0; const committed = vouchers.filter((v) => v.status === 'issued').reduce((s, v) => s + (v.valueCents || 0), 0);
  const spent = vouchers.filter((v) => v.status === 'used').reduce((s, v) => s + (v.valueCents || 0), 0);
  const campBudget = camps.reduce((s, c) => s + (c.budgetCents || 0), 0);
  const open = vouchers.filter((v) => v.status === 'issued' && !v.merchantId);
  const voucherCount = (status) => { const count = vouchers.filter((v) => v.status === status).length; return `${count} voucher${count === 1 ? '' : 's'}`; };
  return `<div class="page-title"><h1>Rewards and budget</h1><p>Vouchers are paid from the activation fund. Track what’s promised (issued, not yet used) and what’s paid out.</p></div>
    <div class="stats"><div class="stat"><div class="k">Activation fund</div><div class="v num">${rm(alloc)}</div><div class="s"><button class="btn small ghost" id="alloc" style="padding:0;min-height:0">${icon('pencil')} Edit</button></div></div>
      <div class="stat"><div class="k">Promised</div><div class="v num">${rm(committed)}</div><div class="s">${voucherCount('issued')} not yet used</div></div>
      <div class="stat"><div class="k">Paid out</div><div class="v num">${rm(spent)}</div><div class="s">${voucherCount('used')} used</div></div>
      <div class="stat"><div class="k">Left to commit</div><div class="v num" style="color:${alloc - committed - spent - campBudget < 0 ? 'var(--red)' : 'inherit'}">${rm(alloc - committed - spent - campBudget)}</div><div class="s">after ${rm(campBudget)} set aside for campaigns</div></div></div>
    <section class="card pad-lg" style="margin-top:16px"><div class="row between"><h2>Reward catalogue</h2><button class="btn small primary" id="new-rw">${icon('plus')} New reward</button></div>
      <div class="table-wrap" style="margin-top:10px"><table class="data"><thead><tr><th>Reward</th><th>Redeem at</th><th class="r">Points</th><th class="r">Value</th><th class="r">Issued / stock</th><th>Status</th><th></th></tr></thead><tbody>
      ${rewards.map((r) => `<tr><td><b>${esc(r.title)}</b></td><td>${esc(merchants.find((m) => m.id === r.merchantId)?.name || 'HEP counter')}</td><td class="r num">${n(r.cost)}</td><td class="r num">${rm(r.valueCents)}</td><td class="r num">${n(r.issued || 0)} / ${n(r.stock)}</td>
        <td>${r.active ? '<span class="badge ok">On</span>' : '<span class="badge grey">Off</span>'}</td><td class="r"><button class="btn small" data-rw="${esc(r.id)}">Edit</button></td></tr>`).join('')}</tbody></table></div></section>
    <section class="card pad-lg" style="margin-top:16px"><div class="row between"><h2>Vouchers to hand out at the HEP counter (${open.length})</h2><form id="vfind" class="row" style="flex-wrap:nowrap"><input name="code" placeholder="Voucher code" style="min-height:38px;width:160px"><button class="btn small">Find</button></form></div>
      <p class="faint">Cashback and credits not tied to a merchant. Mark them used when you hand over the value.</p>
      <div class="list" style="margin-top:6px">${open.map((v) => `<div class="item"><div class="grow"><h3>${esc(v.title)} · ${esc(v.code)}</h3><p>${esc(v.studentName)} · issued ${fmtDate(v.createdAt)}</p></div><button class="btn small go" data-use="${esc(v.id)}">Mark used</button></div>`).join('') || '<p class="faint" style="padding:10px 0">None waiting.</p>'}</div></section>`;
}
function rewardsMount(root, app) {
  $('#alloc', root).onclick = async () => {
    const b = await D.getConfig(app.ctx, 'budget');
    const el = sheet(`<h2>Activation fund</h2><form id="af" class="stack" style="margin-top:12px"><label class="field">Amount for rewards (RM)<input name="v" type="number" min="0" step="1" required value="${(b?.allocationCents || 0) / 100}"><small>PDC 5.0 allows up to RM20,000 per university.</small></label><button class="btn primary">Save</button></form>`);
    $('#af', el).onsubmit = (e) => { e.preventDefault(); busy($('button', el), async () => { await D.saveConfig(app.ctx, 'budget', { allocationCents: Math.round(+e.target.v.value * 100) }); closeSheet(); app.render(); }); };
  };
  const edit = (r) => {
    const ms = app._rw.merchants.filter((m) => m.status === 'verified');
    const el = sheet(`<h2>${r ? 'Edit reward' : 'New reward'}</h2><form id="rf" class="stack" style="margin-top:12px">
      <label class="field">Title<input name="title" required value="${esc(r?.title || '')}" placeholder="e.g. RM5 off at Kopi Kolej"></label>
      <label class="field">Redeem at<select name="merchantId"><option value="">HEP counter (cashback or credit)</option>${ms.map((m) => `<option value="${m.id}" ${r?.merchantId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <div class="grid-2"><label class="field">Points needed<input name="cost" type="number" min="1" step="1" required value="${r?.cost || 500}"></label><label class="field">Value (RM)<input name="value" type="number" min="0" step="0.5" required value="${(r?.valueCents || 500) / 100}"></label></div>
      <div class="grid-2"><label class="field">Stock<input name="stock" type="number" min="${r?.issued || 0}" step="1" required value="${r?.stock || 100}"></label><label class="field">Valid for (days)<input name="validDays" type="number" min="1" required value="${r?.validDays || 30}"></label></div>
      <label class="check"><input type="checkbox" name="active" ${!r || r.active ? 'checked' : ''}> Students can swap points for this</label><button class="btn primary">Save reward</button></form>`);
    $('#rf', el).onsubmit = (e) => {
      e.preventDefault(); const f = e.target;
      const id = r ? r.id : f.title.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '-' + Math.random().toString(36).slice(2, 6);
      busy($('button', el), async () => {
        try { await D.saveReward(app.ctx, id, { title: f.title.value.trim(), merchantId: f.merchantId.value, cost: Math.floor(+f.cost.value), valueCents: Math.round(+f.value.value * 100), stock: Math.floor(+f.stock.value), validDays: Math.floor(+f.validDays.value), active: f.active.checked, ...(r ? {} : { issued: 0, lastVoucher: '', icon: f.merchantId.value ? 'coffee' : 'wallet' }) }); closeSheet(); app.render(); }
        catch (err) { toast(errText(err), true); }
      });
    };
  };
  $('#new-rw', root).onclick = () => edit(null);
  $$('[data-rw]', root).forEach((b) => { b.onclick = () => edit(app._rw.rewards.find((r) => r.id === b.dataset.rw)); });
  $$('[data-use]', root).forEach((b) => { b.onclick = () => busy(b, async () => { try { await D.useVoucher(app.ctx, b.dataset.use); toast('Voucher marked used.'); app.render(); } catch (err) { toast(D.voucherExpired(app._rw?.vouchers?.find((x) => x.id === b.dataset.use) || {}) ? 'This voucher has expired.' : errText(err), true); } }); });
  $('#vfind', root).onsubmit = async (e) => {
    e.preventDefault(); const v = await D.findVoucher(app.ctx, e.target.code.value, true).catch(() => null);
    if (!v) return toast('No voucher with that code.', true);
    const el = sheet(`<h2>${esc(v.title)}</h2><p class="muted">${esc(v.studentName)} · code ${esc(v.code)} · ${v.status === 'used' ? `used ${fmtDate(v.usedAt)}` : 'not used yet'}</p>${v.status === 'issued' && D.voucherExpired(v) ? '<p class="notice warn" style="margin-top:14px">This voucher has expired.</p>' : v.status === 'issued' ? '<button class="btn go block" id="u" style="margin-top:14px">Mark used</button>' : ''}`);
    if ($('#u', el)) $('#u', el).onclick = (ev) => busy(ev.currentTarget, async () => { try { await D.useVoucher(app.ctx, v.id); closeSheet(); app.render(); } catch (err) { toast(errText(err), true); } });
  };
}

// ------------------------------------------------------------- campaigns
async function campaignsRender(app) {
  const camps = (await D.listCampaigns(app.ctx)).sort((a, b) => String(b.start).localeCompare(String(a.start))); app._cp = camps;
  return `<div class="page-title row between"><div><h1>Campaigns and events</h1><p>Shown to students on the Community page. Set aside budget for each so the fund balance stays honest.</p></div><button class="btn primary" id="new">${icon('plus')} New campaign</button></div>
    <div class="card"><div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Dates</th><th>Where</th><th class="r">Budget</th><th></th></tr></thead><tbody>
    ${camps.map((c) => `<tr><td><b>${esc(c.name)}</b><br><span class="faint">${esc(c.description || '')}</span></td><td>${esc(c.start || '')} – ${esc(c.end || '')}</td><td>${esc(c.location || '')}</td><td class="r num">${rm(c.budgetCents)}</td>
      <td class="r"><button class="btn small" data-c="${esc(c.id)}">Edit</button></td></tr>`).join('') || '<tr><td colspan="5" class="faint">No campaigns yet.</td></tr>'}</tbody></table></div></div>`;
}
function campaignsMount(root, app) {
  const edit = (c) => {
    const el = sheet(`<h2>${c ? 'Edit campaign' : 'New campaign'}</h2><form id="cf" class="stack" style="margin-top:12px"><label class="field">Name<input name="name" required value="${esc(c?.name || '')}"></label>
      <label class="field">Short description for students<input name="description" value="${esc(c?.description || '')}"></label>
      <div class="grid-2"><label class="field">Starts<input name="start" type="date" required value="${esc(c?.start || '')}"></label><label class="field">Ends<input name="end" type="date" required value="${esc(c?.end || '')}"></label></div>
      <div class="grid-2"><label class="field">Location<input name="location" value="${esc(c?.location || '')}"></label><label class="field">Budget (RM)<input name="budget" type="number" min="0" step="1" value="${(c?.budgetCents || 0) / 100}"></label></div>
      <div class="row end">${c ? '<button type="button" class="btn warn" id="del">Delete</button>' : ''}<button class="btn primary">Save</button></div></form>`);
    $('#cf', el).onsubmit = (e) => { e.preventDefault(); const f = e.target; if (f.end.value < f.start.value) return toast('End date must be after the start date.', true);
      busy($('button.primary', el), async () => { await D.saveCampaign(app.ctx, c?.id, { name: f.name.value.trim(), description: f.description.value.trim(), start: f.start.value, end: f.end.value, location: f.location.value.trim(), budgetCents: Math.round(+f.budget.value * 100) }); closeSheet(); app.render(); }); };
    if ($('#del', el)) $('#del', el).onclick = async () => { await D.deleteCampaign(app.ctx, c.id); closeSheet(); app.render(); };
  };
  $('#new', root).onclick = () => edit(null);
  $$('[data-c]', root).forEach((b) => { b.onclick = () => edit(app._cp.find((c) => c.id === b.dataset.c)); });
}

// ------------------------------------------------------------- KPIs and surveys
async function kpisRender(app) {
  const [users, merchants, surveys, refs, vouchers, counts] = await Promise.all([D.listUsers(app.ctx), D.listMerchantsAll(app.ctx), D.listSurveys(app.ctx), D.listReferrals(app.ctx), D.listVouchers(app.ctx), D.paynetCounts(app.ctx, month)]);
  app._sv = { surveys, users };
  const students = users.filter((u) => u.role === 'student');
  const verified = merchants.filter((m) => m.status === 'verified'), ready = verified.filter((m) => m.ready);
  const sStu = surveys.filter((s) => s.role === 'student'); const avgK = sStu.length ? Math.round(sStu.reduce((s, x) => s + x.knowledge, 0) / sStu.length) : 0;
  const grades = ['A', 'B', 'C', 'D'].map((g) => [g, sStu.filter((s) => s.grade === g).length, surveys.filter((s) => s.role === 'merchant' && s.grade === g).length]);
  const kpi = [
    ['Eligible merchants onboarded', n(verified.length), 'Verified merchants on the PayNet list'],
    ['Merchant readiness', verified.length ? Math.round((ready.length / verified.length) * 100) + '%' : '—', `${ready.length} of ${verified.length} finished the staff checklist`],
    ['Transaction frequency', n(counts.reduce((s, c) => s + c.count, 0)), `DuitNow QR transactions PayNet counted at listed merchants in ${monthLabel(month)} (import on Activity check)`],
    ['Students enrolled', n(students.length), 'Registered student accounts'],
    ['Financial capability', sStu.length ? avgK + '%' : '—', `Average knowledge score across ${sStu.length} student money checks`],
    ['Referral sign-ups', n(refs.length), 'Referral codes linked to student accounts'],
    ['Vouchers redeemed', n(vouchers.filter((v) => v.status === 'used').length), `${rm(vouchers.filter((v) => v.status === 'used').reduce((s, v) => s + v.valueCents, 0))} paid out`],
  ];
  return `<div class="page-title row between"><div><h1>KPIs and surveys</h1><p>The solution map’s KPIs, calculated live from app records.</p></div>${monthPicker()}</div>
    <section class="card pad-lg"><table class="data kpi-table"><thead><tr><th>KPI</th><th class="r">Value</th><th>How it’s measured</th></tr></thead><tbody>${kpi.map(([k, v, h]) => `<tr><td>${k}</td><td class="r num" style="font-size:18px;font-weight:800">${v}</td><td class="faint">${h}</td></tr>`).join('')}</tbody></table>
      <div class="row end" style="margin-top:10px"><button class="btn small" id="kcsv">${icon('download')} Export KPIs</button></div></section>
    <section class="card pad-lg" style="margin-top:16px"><div class="row between"><h2>Money check results</h2><button class="btn small" id="scsv">${icon('download')} Export responses</button></div>
      <table class="data" style="margin-top:10px"><thead><tr><th>Grade</th><th class="r">Students</th><th class="r">Merchants</th><th>Suggested support</th></tr></thead><tbody>
      ${grades.map(([g, s, m]) => `<tr><td><b>${g}</b></td><td class="r num">${s}</td><td class="r num">${m}</td><td class="faint">${{ A: 'Ready; promote missions and deals', B: 'Targeted tips', C: 'Lessons and ambassador support', D: 'Assisted onboarding' }[g]}</td></tr>`).join('')}</tbody></table></section>`;
}
function kpisMount(root, app) {
  bindMonth(root, app);
  $('#kcsv', root).onclick = () => downloadCSV(`KPIs-UM-${month}.csv`, [['KPI', 'Value', 'Measure'], ...$$('.kpi-table tbody tr', root).map((tr) => $$('td', tr).map((td) => td.textContent))]);
  $('#scsv', root).onclick = () => downloadCSV('Money-check-responses.csv', [['Role', 'Name', 'Grade', 'Score', 'Knowledge', 'Digital', 'Completed'],
    ...app._sv.surveys.map((s) => [s.role, app._sv.users.find((u) => u.id === s.id)?.name || '', s.grade, s.score, s.knowledge, s.digital, s.at ? new Date(toMs(s.at)).toISOString() : ''])]);
}

// ------------------------------------------------------------- students (people)
let peopleQ = '';
async function peopleRender(app) {
  const users = (await D.listUsers(app.ctx)).filter((u) => u.role === 'student').sort((a, b) => (b.points || 0) - (a.points || 0)); app._pp = users;
  return `<div class="page-title"><h1>Students</h1><p>${users.length} signed up. Adjust points to correct mistakes; every change is recorded with your note.</p></div>
    <input type="search" id="pq" placeholder="Search name, email or matric" value="${esc(peopleQ)}"><div class="card" style="margin-top:12px"><div class="table-wrap"><table class="data"><thead><tr><th>Student</th><th>College</th><th class="r">Points</th><th>Joined</th><th></th></tr></thead><tbody id="pt"></tbody></table></div></div>
    <section class="card pad-lg" style="margin-top:16px"><h2>Matric number claimed by the wrong person?</h2><p class="muted">Check their student ID first, then release the number so the real student can sign up. Block the other account if needed.</p><form id="rel" class="row" style="margin-top:10px;gap:8px"><input name="m" required minlength="5" placeholder="Matric number" aria-label="Matric number to release"><button class="btn small">Release</button></form></section>`;
}
function peopleMount(root, app) {
  const draw = () => {
    const q = peopleQ.toLowerCase();
    $('#pt', root).innerHTML = app._pp.filter((u) => `${u.name} ${u.email} ${u.matric}`.toLowerCase().includes(q)).slice(0, 200).map((u) => `<tr><td><b>${esc(u.name)}</b><br><span class="faint">${esc(u.email)} · ${esc(u.matric || '')}</span></td>
      <td>${esc(u.college)}</td><td class="r num">${n(u.points)}</td><td>${fmtDate(u.createdAt)}</td><td class="r"><button class="btn small" data-adj="${esc(u.id)}">Adjust</button> <button class="btn small ghost" data-block="${esc(u.id)}">${u.disabled ? 'Unblock' : 'Block'}</button>${u.disabled ? ' <span class="badge bad">Blocked</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="faint">No students match.</td></tr>';
    $$('[data-block]', root).forEach((b) => {
      b.onclick = () => {
        const u = app._pp.find((x) => x.id === b.dataset.block); const next = !u.disabled;
        if (next && !confirm(tr(`Block ${u.name}? They won't be able to earn or redeem until you unblock them.`))) return;
        busy(b, async () => { try { await D.setBlocked(app.ctx, u.id, next); toast(next ? 'Student blocked.' : 'Student unblocked.'); app.render(); } catch (err) { toast(errText(err), true); } });
      };
    });
    $$('[data-adj]', root).forEach((b) => {
      b.onclick = () => {
        const u = app._pp.find((x) => x.id === b.dataset.adj);
        const el = sheet(`<h2>Adjust points for ${esc(u.name)}</h2><p class="muted">Current balance ${n(u.points)}. Use a minus sign to remove points.</p><form id="aj" class="stack" style="margin-top:12px">
          <label class="field">Points (+ or −)<input name="d" type="number" step="1" required></label><label class="field">Reason (the student sees this)<input name="note" required minlength="3" placeholder="e.g. Bazaar prize, or duplicate purchase removed"></label><button class="btn primary">Save adjustment</button></form>`);
        $('#aj', el).onsubmit = (e) => { e.preventDefault(); const d = Math.trunc(+e.target.d.value); if (!d) return; if (u.points + d < 0) return toast('That would make the balance negative.', true);
          busy($('button', el), async () => { try { await D.adjustPoints(app.ctx, u.id, d, e.target.note.value.trim()); closeSheet(); toast('Points adjusted.'); app.render(); } catch (err) { toast(errText(err), true); } }); };
      };
    });
  };
  $('#pq', root).oninput = (e) => { peopleQ = e.target.value; draw(); }; draw();
  $('#rel', root).onsubmit = (e) => { e.preventDefault(); const m = e.target.m.value.trim(); if (!confirm(tr(`Release matric number ${m}?`))) return; busy($('button', e.target), async () => { try { await D.releaseMatric(app.ctx, m); e.target.reset(); toast('Matric number released.'); } catch (err) { toast(errText(err), true); } }); };
}

// ------------------------------------------------------------- settings
async function settingsRender(app) {
  if (!(await D.programmeReady(app.ctx)) || !(await D.rulesUpToDate(app.ctx))) await D.initProgramme(app.ctx);
  const [rules, access] = await Promise.all([D.getRules(app.ctx), D.getConfig(app.ctx, 'access')]);
  const field = (k, label, help, min = 0, max = 100000) => `<label class="field">${label}<input name="${k}" type="number" min="${min}" max="${max}" step="1" required value="${rules[k]}"><small>${help}</small></label>`;
  const list = (k) => esc((access?.[k] || []).join('\n'));
  return `<div class="page-title"><h1>Settings</h1><p>Changes apply to new activity only. Past points stay as they were.</p></div>
    <form id="features" class="card pad-lg stack" style="margin-bottom:16px"><h2>Features</h2>
      <p class="muted">Choose what students and merchants can use. Changes apply when people next open or refresh the app, and nothing is deleted.</p>
      ${D.FEATURES.map(([k, label, help]) => `<label class="check"><input type="checkbox" name="${k}" ${D.featureOn(rules, k) ? 'checked' : ''}> <span><b>${esc(label)}</b><br><span class="faint">${esc(help)}</span></span></label>`).join('')}
      <button class="btn primary">Save features</button></form>
    <div class="cols two"><form id="rules" class="card pad-lg stack"><h2>Points rules</h2>
      <div class="grid-2">${field('surveyBonus', 'Money check bonus', 'Once per student')}${field('lessonBonus', 'Bonus per lesson', 'Once per lesson')}</div>
      <button class="btn primary">Save rules</button></form>
    <form id="access" class="card pad-lg stack"><h2>Who can use the app</h2>
      <label class="field">Student email domains<textarea name="studentDomains">${list('studentDomains')}</textarea><small>One per line, e.g. siswa.um.edu.my</small></label>
      <label class="field">Testers allowed as students<textarea name="testerEmails">${list('testerEmails')}</textarea><small>Individual emails outside those domains, for the pilot team</small></label>
      <label class="field">HEP reviewers<textarea name="mppEmails">${list('mppEmails')}</textarea><small>They get full access to this dashboard after signing in with a verified email</small></label>
      <button class="btn primary">Save access</button></form></div>`;
}
function settingsMount(root, app) {
  overviewMount(root, app);
  if (!$('#rules', root)) return;
  $('#features', root).onsubmit = (e) => {
    e.preventDefault(); const f = e.target;
    busy($('button', f), async () => { try { await D.saveConfig(app.ctx, 'rules', { features: Object.fromEntries(D.FEATURES.map(([k]) => [k, f[k].checked])) }); toast('Features saved.'); app.rules = await D.getRules(app.ctx); } catch (err) { toast(errText(err), true); } });
  };
  $('#rules', root).onsubmit = (e) => {
    e.preventDefault(); const f = e.target; const v = (k) => Math.floor(+f[k].value);
    busy($('button', f), async () => { try { await D.saveConfig(app.ctx, 'rules', { surveyBonus: v('surveyBonus'), lessonBonus: v('lessonBonus') }); app.rules = await D.getRules(app.ctx); toast('Rules saved.'); } catch (err) { toast(errText(err), true); } });
  };
  $('#access', root).onsubmit = (e) => {
    e.preventDefault(); const f = e.target; const lines = (k) => f[k].value.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    busy($('button', f), async () => { try { await D.saveConfig(app.ctx, 'access', { studentDomains: lines('studentDomains'), testerEmails: lines('testerEmails'), mppEmails: lines('mppEmails') }); toast('Access saved.'); } catch (err) { toast(errText(err), true); } });
  };
}

export const routes = {
  overview: { title: 'Overview', render: overviewRender, mount: overviewMount },
  merchants: { title: 'Merchants', render: merchantsRender, mount: merchantsMount },
  approvals: { title: 'Approvals', render: approvalsRender, mount: approvalsMount },
  paynet: { title: 'PayNet list', render: paynetRender, mount: paynetMount },
  recon: { title: 'Reconciliation', render: reconRender, mount: reconMount },
  rewards: { title: 'Rewards and budget', render: rewardsRender, mount: rewardsMount },
  campaigns: { title: 'Campaigns', render: campaignsRender, mount: campaignsMount },
  kpis: { title: 'KPIs and surveys', render: kpisRender, mount: kpisMount },
  people: { title: 'Students', render: peopleRender, mount: peopleMount },
  settings: { title: 'Settings', render: settingsRender, mount: settingsMount },
};
