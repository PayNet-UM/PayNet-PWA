import * as D from './data.js';
import * as L from './live-deals.js';
import { $, $$, esc, icon, n, sheet, closeSheet, onSheetClose, renderQR, busy, toast, errText, startScanner, confetti } from './ui.js';
import { merchantHeading, merchantEmpty } from './merchant-ui.js';

// Why a deal can't show its QR right now, in the merchant's words, and where to fix it.
function whyNotLive(deal, status) {
  if (/^Opens /.test(status)) return [`Runs ${D.hhmm(deal.startMin)}–${D.hhmm(deal.endMin)} each day. Come back then.`, ''];
  if (status === 'Busy right now') return [`Hidden while your café is more than ${deal.threshold}% full.`, ['promote', 'Update café occupancy']];
  if (status === 'Seat count not set') return ['Set your seat count first, so students know you have space.', ['promote', 'Set my seats']];
  if (status === 'Paused') return ['You paused this deal.', ['promote', 'Resume it']];
  if (status === 'Ready to publish') return ['Not published yet.', ['promote', 'Publish it']];
  return [status, ''];
}
export async function merchantDealQRRender(app) {
  if (app.merchant?.status !== 'verified') return `<div class="card empty"><h1>Deal QR</h1><p>The Admin team must verify your shop before you can show a deal QR.</p><a class="btn primary" href="#/shop">My shop</a></div>`;
  const [deals, shop] = await Promise.all([D.myDeals(app.ctx), D.getMerchant(app.ctx, app.ctx.uid).catch(() => null)]);
  const rows = await D.dealOverview(app.ctx, deals, [shop || app.merchant]);
  app._dealQRRows = rows;
  const live = rows.filter((r) => r.status === 'Available'), other = rows.filter((r) => r.status !== 'Available' && r.deal.status !== 'rejected');
  const pts = n(app.rules.liveDealPoints ?? 10);
  // Merchants often open Deal QR before Promote your shop, so say what it is and where deals are made.
  // Big when they have no deals yet, a box when none is live, one expandable line while a deal is live.
  const what = `Each live deal has its own QR code. Show it at your counter. Students scan it with +Onz to claim your discount and earn ${pts} points. Then you tap Apply discount.`;
  const manage = `<a class="mer-qr-manage" href="#/promote">${icon('badge-percent')} Create, pause or change your deals in Promote your shop ${icon('arrow-right')}</a>`;
  const intro = !rows.length ? `<section class="mer-qr-intro is-full"><h2>What is a deal QR?</h2><p>${what}</p><p>First, create a live deal: a discount for your quiet hours. Its QR then appears here.</p>
        <a class="btn mer-way-cta" href="#/promote">${icon('plus')} Create your first deal ${icon('arrow-right')}</a></section>`
    : !live.length ? `<section class="mer-qr-intro"><h2>What is a deal QR?</h2><p>${what}</p>${manage}</section>`
    : `<details class="mer-qr-intro is-mini"><summary>${icon('info')}<span>What is a deal QR?</span>${icon('chevron-right')}</summary><p>${what}</p></details><p class="mer-qr-manage-line">${manage}</p>`;
  return `<div class="merchant-page mer-redeem">${merchantHeading('Deal QR', 'Show this at your counter. Students scan it to claim your deal.', 'qr-code')}
    ${intro}
    ${live.length ? `<p class="mer-qr-tip">${icon('sparkles')}<span>Tell customers: “Scan this to get ${pts} points and the discount.”</span></p>` : ''}
    ${live.length ? `<section class="section"><h2 class="mer-qr-h">Live now</h2><div class="mer-qr-live">${live.map(({ deal }) => `<article class="mer-qr-deal">
        <div><h3 data-no-i18n>${esc(deal.title)}</h3>${deal.benefit ? `<p class="deal-benefit" data-no-i18n>${esc(deal.benefit)}</p>` : ''}<p class="mer-qr-hours">${icon('clock')} ${D.hhmm(deal.startMin)}–${D.hhmm(deal.endMin)}</p></div>
        <button class="btn mer-qr-show" data-deal-qr="${esc(deal.id)}">${icon('qr-code')} Show QR to students</button></article>`).join('')}</div></section>`
      : rows.length ? `<div class="mer-qr-none">${icon('clock')}<div><b>No deal is live right now.</b><p>A deal shows here during its hours, while your café has space.</p></div></div>` : ''}
    ${other.length ? `<section class="section"><h2 class="mer-qr-h">Not live right now</h2><div class="mer-qr-other">${other.map(({ deal, status }) => { const [why, act] = whyNotLive(deal, status);
      return `<article class="card mer-qr-off"><div><h3 data-no-i18n>${esc(deal.title)}</h3><p>${why}</p></div>${act ? `<a class="btn small" href="#/${act[0]}">${act[1]} ${icon('arrow-right')}</a>` : ''}</article>`; }).join('')}</div></section>` : ''}
    </div>`;
}
export function merchantDealQRMount(root, app, [requested] = []) {
  let alive = true, stopSheet = () => {};
  async function show(id) {
    try {
      let session = await L.issueDealQR(app.ctx, id);
      if (!alive) return;
      const deal = app._dealQRRows.find((row) => row.deal.id === id)?.deal;
      const canWake = 'wakeLock' in navigator;
      const el = sheet(`<div class="mer-qr-sheet"><div class="mer-sheet-head"><span class="mer-panel-emblem">${icon('qr-code')}</span><div><span class="mer-eyebrow">Students scan this QR</span><h2 data-no-i18n>${esc(deal?.title || '')}</h2>${deal?.benefit ? `<p class="deal-benefit" data-no-i18n>${esc(deal.benefit)}</p>` : ''}</div></div>
        <div id="deal-claim-list" class="mer-claims" aria-live="polite"></div>
        <div class="deal-qr-stage"><div id="live-deal-qr" data-code="${esc(session.code)}"></div>
          <div class="mer-qr-timer" aria-hidden="true"><i id="deal-qr-bar"></i></div>
          <p role="status" id="deal-qr-clock" class="mer-qr-auto"></p></div>
        <div class="mer-qr-foot"><span><b id="deal-claim-total" class="num">0</b> <span>waiting for a discount</span></span>${canWake ? `<span>${icon('sun')} Your screen stays on while this is open.</span>` : ''}</div></div>`);
      let disposed = false, currentClaims = [], renderedClaims = '', seen = new Set(), refreshing = false, lock = null;
      const total = L.QR_LIFETIME_MS / 1000;
      const drawClaims = () => {
        if (disposed) return;
        const now = D.clock(app.ctx);
        const claims = currentClaims.filter((c) => c.dealId === id && !L.claimExpired(c, now) && c.status === 'claimed');
        $('#deal-claim-total', el).textContent = n(claims.length);
        // A new claim: buzz the phone so staff notice, even while serving.
        const fresh = claims.filter((c) => !seen.has(c.id)); claims.forEach((c) => seen.add(c.id));
        if (fresh.length && renderedClaims !== '' && navigator.vibrate) navigator.vibrate([120, 60, 120]);
        const html = claims.map((c) => { const left = Math.max(0, Math.ceil((D.toMs(c.createdAt) + L.CLAIM_LIFETIME_MS - now) / 60000));
          return `<div class="deal-counter-claim mer-claim"><div><span class="mer-claim-tag">${icon('bell')} New claim</span><strong data-no-i18n>${esc(c.studentName)}</strong><p>Give them the discount, then tap the button. <span class="num">${left}</span> <span>min left</span></p></div><button class="btn go" data-apply-claim="${esc(c.id)}">${icon('check')} Apply discount</button></div>`; }).join('');
        if (html === renderedClaims && renderedClaims !== '') return;
        renderedClaims = html || ' '; $('#deal-claim-list', el).innerHTML = html;
        $$('[data-apply-claim]', el).forEach((button) => { button.onclick = () => busy(button, async () => {
          try { await L.applyDealClaim(app.ctx, button.dataset.applyClaim); toast('Discount marked as applied.'); }
          catch (error) { toast(error.message || errText(error), true); }
        }); });
      };
      // The QR changes by itself a few seconds before it expires, so staff never need to refresh it.
      const refresh = async () => {
        refreshing = true;
        try { session = await L.issueDealQR(app.ctx, id); if (disposed) return; const box = $('#live-deal-qr', el); box.innerHTML = ''; box.dataset.code = session.code; await renderQR(box, session.code, 256); }
        catch (error) { if (!disposed) { $('#live-deal-qr', el).hidden = true; $('#deal-qr-clock', el).textContent = 'This deal isn’t live any more. Close this and check Promote your shop.'; } }
        finally { refreshing = false; }
      };
      const tick = () => {
        if (disposed) return;
        const seconds = Math.max(0, Math.ceil((session.expiresAt - D.clock(app.ctx)) / 1000));
        if (seconds <= 5 && !refreshing) refresh();
        $('#deal-qr-bar', el).style.width = `${Math.round(seconds / total * 100)}%`;
        if (!$('#live-deal-qr', el).hidden) $('#deal-qr-clock', el).textContent = `New code in ${seconds}s. It changes by itself, so screenshots won’t work.`;
        drawClaims();
      };
      const wake = async () => { try { if (canWake && !disposed) lock = await navigator.wakeLock.request('screen'); } catch { /* not allowed (e.g. battery saver) */ } };
      const onVisible = () => { if (document.visibilityState === 'visible') wake(); };
      document.addEventListener('visibilitychange', onVisible); wake();
      const off = L.watchMerchantClaims(app.ctx, (claims) => { currentClaims = claims; drawClaims(); }, (e) => toast(errText(e), true));
      const interval = setInterval(tick, 1000);
      const stop = () => { if (disposed) return; disposed = true; clearInterval(interval); off(); document.removeEventListener('visibilitychange', onVisible); lock?.release?.().catch(() => {}); };
      stopSheet(); stopSheet = stop; onSheetClose(stop);
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
      $('#deal-confirmation', root).innerHTML = `<section class="card deal-confirmation ${expired ? 'is-expired' : ''}"><span class="deal-confirmation-stamp">${icon(c.status === 'applied' ? 'badge-check' : expired ? 'clock' : 'circle-check')}</span><h2>${c.status === 'applied' ? 'Discount applied' : expired ? 'Claim expired' : 'Claim confirmed'}</h2><p>${c.status === 'applied' ? 'The merchant has marked your discount as applied.' : expired ? 'The 15-minute claim window has ended.' : 'Show this confirmation to staff. They will apply your discount.'}</p><span class="badge">${c.status === 'applied' ? 'Completed' : expired ? 'Expired' : 'Valid for 15 minutes after scanning'}</span>${c.rewardPoints ? `<span class="deal-points-earned">${icon('sparkles')} +${n(c.rewardPoints)} <span>points earned</span></span>` : ''}<p class="faint">This confirms a deal claim, not a payment.</p><a class="btn primary" href="#/explore/deals">Back to live deals ${icon('arrow-right')}</a></section>`;
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
