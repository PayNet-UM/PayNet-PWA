import * as D from './data.js';
import * as L from './live-deals.js';
import { $, $$, esc, icon, n, sheet, closeSheet, onSheetClose, renderQR, busy, toast, errText, startScanner, confetti } from './ui.js';
import { merchantHeading, merchantEmpty } from './merchant-ui.js';

export async function merchantDealQRRender(app) {
  if (app.merchant?.status !== 'verified') return `<div class="card empty"><h1>Deal QR</h1><p>HEP must verify your shop before you can show a deal QR.</p><a class="btn primary" href="#/shop">My shop</a></div>`;
  const deals = await D.myDeals(app.ctx);
  const rows = await D.dealOverview(app.ctx, deals, [app.merchant]);
  app._dealQRRows = rows;
  return `<div class="merchant-page mer-redeem">${merchantHeading('Deal QR', 'Show your QR. Students scan. Apply the discount.', 'qr-code', 'At the counter')}
    <div class="mer-redeem-steps"><span><b>1</b>Show deal QR</span><span><b>2</b>Student scans</span><span><b>3</b>Apply discount</span></div>
    <div class="notice"><span>${icon('onz-coin')}</span><p>+${n(app.rules.liveDealPoints ?? 10)} <span>points for each student’s first successful deal scan of the day.</span></p></div>
    <section class="section"><div class="mer-section-head"><h2>Choose a live deal</h2><a href="#/promote">Promote live deals ${icon('arrow-right')}</a></div><div class="mer-deal-grid">${rows.map(({ deal, status }) => `<article class="card mer-deal-card"><div class="mer-deal-top"><span class="mer-panel-emblem">${icon('qr-code')}</span><span class="badge ${status === 'Available' ? 'ok' : 'grey'}">${esc(status === 'Available' ? 'Live now' : status)}</span></div><h3>${esc(deal.title)}</h3><p class="faint">${D.hhmm(deal.startMin)}–${D.hhmm(deal.endMin)} MYT</p><button class="btn primary block" style="margin-top:18px" data-deal-qr="${esc(deal.id)}" ${status === 'Available' ? '' : 'disabled'}>${icon('qr-code')} Show deal QR</button></article>`).join('') || merchantEmpty('qr-code', 'No live deals yet.', 'Publish a live deal to start showing its QR.')}</div></section></div>`;
}
export function merchantDealQRMount(root, app, [requested] = []) {
  let alive = true, stopSheet = () => {};
  async function show(id) {
    try {
      const session = await L.issueDealQR(app.ctx, id);
      if (!alive) return;
      const deal = app._dealQRRows.find((row) => row.deal.id === id)?.deal;
      const el = sheet(`<div class="mer-sheet-head"><span class="mer-panel-emblem">${icon('qr-code')}</span><div><span class="mer-eyebrow">Students scan this QR</span><h2 data-no-i18n>${esc(deal?.title || '')}</h2>${deal?.benefit ? `<p class="deal-benefit" data-no-i18n>${esc(deal.benefit)}</p>` : ''}</div></div>
        <div class="deal-qr-stage"><div id="live-deal-qr" data-code="${esc(session.code)}"></div><p role="status" id="deal-qr-clock"></p><p class="faint">QR codes expire automatically. Show a fresh QR when needed.</p></div>
        <button class="btn block" id="refresh-deal-qr">${icon('refresh-cw')} Refresh QR</button>
        <section class="section"><div class="mer-section-head"><h3>Student claims</h3><span id="deal-claim-total" class="mer-count">0</span></div><div id="deal-claim-list" class="stack" aria-live="polite"></div></section>`);
      let disposed = false, currentClaims = [], renderedClaims = '';
      const drawClaims = () => {
        if (disposed) return;
        const claims = currentClaims.filter((c) => c.dealId === id && !L.claimExpired(c, D.clock(app.ctx)) && c.status === 'claimed');
        $('#deal-claim-total', el).textContent = n(claims.length);
        const html = claims.map((c) => `<div class="deal-counter-claim"><div><strong data-no-i18n>${esc(c.studentName)}</strong><p class="faint">Claim confirmed</p></div><button class="btn small go" data-apply-claim="${esc(c.id)}">${icon('check')} Apply discount</button></div>`).join('') || '<p class="faint">Waiting for students to scan…</p>';
        if (html === renderedClaims) return;
        renderedClaims = html; $('#deal-claim-list', el).innerHTML = html;
        $$('[data-apply-claim]', el).forEach((button) => { button.onclick = () => busy(button, async () => {
          try { await L.applyDealClaim(app.ctx, button.dataset.applyClaim); toast('Discount marked as applied.'); }
          catch (error) { toast(error.message || errText(error), true); }
        }); });
      };
      const tick = () => {
        if (disposed) return;
        const seconds = Math.max(0, Math.ceil((session.expiresAt - D.clock(app.ctx)) / 1000));
        $('#live-deal-qr', el).hidden = seconds === 0;
        $('#deal-qr-clock', el).textContent = seconds ? `QR expires in ${seconds}s` : 'QR expired. Show a fresh QR.';
        drawClaims();
      };
      const off = L.watchMerchantClaims(app.ctx, (claims) => { currentClaims = claims; drawClaims(); }, (e) => toast(errText(e), true));
      const interval = setInterval(tick, 1000);
      const stop = () => { if (disposed) return; disposed = true; clearInterval(interval); off(); };
      stopSheet(); stopSheet = stop; onSheetClose(stop);
      $('#refresh-deal-qr', el).onclick = () => busy($('#refresh-deal-qr', el), () => show(id));
      await renderQR($('#live-deal-qr', el), session.code, 256); tick();
    } catch (error) { if (alive) toast(error.message || errText(error), true); }
  }
  $$('[data-deal-qr]', root).forEach((button) => { button.onclick = () => busy(button, () => show(button.dataset.dealQr)); });
  if (requested && app._dealQRRows?.some(({ deal, status }) => deal.id === requested && status === 'Available')) show(requested);
  return () => { alive = false; stopSheet(); };
}

export async function studentDealClaimRender(app, [id] = []) {
  if (!id) return `<div class="card empty"><h1>Scan a live deal</h1><a class="btn primary" href="#/explore/deals">Live deals</a></div>`;
  const snap = await app.backend.sdk.getDoc(app.backend.sdk.doc(app.ctx.db, 'deals', id));
  if (!snap.exists()) return `<div class="card empty"><h1>Deal unavailable</h1><a href="#/explore/deals">Live deals</a></div>`;
  const deal = { id: snap.id, ...snap.data() }, merchant = await D.getMerchant(app.ctx, deal.merchantId);
  const existing = await L.myDealClaim(app.ctx, id);
  app._studentDeal = { deal, merchant, claim: existing };
  return `<div class="merchant-page student-deal-claim"><a class="back" href="#/explore/deals">${icon('arrow-left')} Live deals</a>${merchantHeading('Claim a live deal', 'Scan the QR shown by the merchant.', 'qr-code', 'At the counter')}
    <div class="card deal-student-summary"><span class="mer-panel-emblem">${icon('badge-percent')}</span><div><h2 data-no-i18n>${esc(deal.title)}</h2><p data-no-i18n>${esc(merchant.name)}</p><span class="badge ok">+${n(app.rules.liveDealPoints ?? 10)} <span>points on a successful scan</span></span>${deal.benefit ? `<strong class="deal-benefit" data-no-i18n>${esc(deal.benefit)}</strong>` : ''}</div></div>
    ${existing ? '<div id="deal-confirmation" aria-live="polite"></div>' : `<section class="section"><div class="scanner deal-student-scanner"><video id="deal-cam" muted playsinline></video><div class="idle" id="deal-camera-idle"><div>${icon('qr-code')}<h2>Ready to claim?</h2><p>Ask staff to show this deal’s QR.</p><button class="btn go" id="start-deal-scan">${icon('camera')} Scan to claim</button></div></div></div><p id="deal-scan-status" class="faint" role="status"></p><p class="faint deal-claim-note">Scan once per deal each day to earn points immediately.</p></section>`}</div>`;
}
export function studentDealClaimMount(root, app) {
  let stopCamera = null, stopWatch = null, interval = null, disposed = false, handling = false;
  const { deal, claim } = app._studentDeal || {};
  if (!deal) return null;
  if (claim) {
    const draw = (c) => {
      if (!c || disposed) return;
      const expired = c.status !== 'applied' && L.claimExpired(c, D.clock(app.ctx));
      $('#deal-confirmation', root).innerHTML = `<section class="card deal-confirmation ${expired ? 'is-expired' : ''}"><span class="deal-confirmation-stamp">${icon(c.status === 'applied' ? 'badge-check' : expired ? 'clock' : 'circle-check')}</span><h2>${c.status === 'applied' ? 'Discount applied' : expired ? 'Claim expired' : 'Claim confirmed'}</h2><p>${c.status === 'applied' ? 'The merchant has marked your discount as applied.' : expired ? 'The 15-minute claim window has ended.' : 'Show this confirmation to staff. They will apply your discount.'}</p><span class="badge">${c.status === 'applied' ? 'Completed' : expired ? 'Expired' : 'Valid for 15 minutes after scanning'}</span>${c.rewardPoints ? `<span class="deal-points-earned">${icon('onz-coin')} +${n(c.rewardPoints)} <span>points earned</span></span>` : ''}<p class="faint">This confirms a deal claim, not a payment.</p><a class="btn primary" href="#/explore/deals">Back to live deals ${icon('arrow-right')}</a></section>`;
    };
    stopWatch = L.watchMyClaim(app.ctx, claim.id, (c) => { app._studentDeal.claim = c; draw(c); }, (e) => toast(errText(e), true));
    draw(claim); interval = setInterval(() => draw(app._studentDeal.claim), 1000);
  } else {
    $('#start-deal-scan', root).onclick = (event) => busy(event.currentTarget, async () => {
      try {
        stopCamera = await startScanner($('#deal-cam', root), async (raw) => {
          if (handling || disposed) return; handling = true;
          try { await L.claimDealQR(app.ctx, raw, deal.id); if (!disposed) { stopCamera?.(); confetti(); app.render(); } }
          catch (error) { if (!disposed) toast(error.message || errText(error), true); }
          finally { handling = false; }
        }, (message) => { if (!disposed) $('#deal-scan-status', root).textContent = message; }, { manualFallback: false });
        if (disposed) { stopCamera?.(); return; }
        if ($('#deal-cam', root).srcObject) $('#deal-camera-idle', root).hidden = true;
      } catch (error) { if (!disposed) toast(error.message || errText(error), true); }
    });
  }
  return () => { disposed = true; stopCamera?.(); stopWatch?.(); clearInterval(interval); };
}
