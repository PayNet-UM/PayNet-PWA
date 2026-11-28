import * as D from './data.js';
import * as L from './live-deals.js';
import { $, $$, esc, n, renderQR, busy, toast, errText, startScanner, confetti } from './ui.js';
import { ozButton } from './oz-ui.js';
import { ozIcon } from './oz-icons.js';

// Why a deal can't show its QR right now, in the merchant's words, and where to fix it.
function whyNotLive(deal, status) {
  if (status.startsWith('Opens ')) return [`Runs ${D.hhmm(deal.startMin)}–${D.hhmm(deal.endMin)} each day. Come back then.`, ''];
  if (status === 'Busy right now') return [`Hidden while your café is more than ${deal.threshold}% full.`, 'Update café occupancy'];
  if (status === 'Seat count not set') return ['Set your seat count first, so students know you have space.', 'Set my seats'];
  if (status === 'Paused') return ['You paused this deal.', 'Resume it'];
  if (status === 'Ready to publish') return ['Not published yet.', 'Publish it'];
  return [status, ''];
}
const counterContext = 'Show the QR to students. Give them the discount and mark it applied before the claim expires.';
const counterBack = () => ozButton('Back to Deal QR', { href: '#/scan', kind: 'ghost', cls: 'oz-claim-back' });
const counterManage = (label = 'Manage promotions', kind = 'ghost') =>
  ozButton(label, { href: '#/promote', kind, cls: 'mer-qr-manage' });
const counterUnavailable = () => `<h1 class="oz-claim-title">This deal isn’t live any more</h1>
  <p>Check Promote your shop to see why.</p>${counterManage('Promote your shop', 'primary')}`;

export async function merchantDealQRRender(app, [requested] = []) {
  const workspace = (content) => dealWorkspace(content, counterContext, 'oz-counter');
  if (app.merchant?.status !== 'verified') return workspace(`<header class="oz-claim-heading"><h1 class="oz-claim-title">Deal QR</h1>
    <p>The Admin team must verify your shop before you can show a deal QR.</p></header>
    ${ozButton('My shop', { href: '#/shop' })}`);
  const [deals, shop] = await Promise.all([D.myDeals(app.ctx), D.getMerchant(app.ctx, app.ctx.uid).catch(() => null)]);
  const rows = await D.dealOverview(app.ctx, deals, [shop || app.merchant]);
  const live = rows.filter(({ status }) => status === 'Available');
  const other = rows.filter(({ deal, status }) => status !== 'Available' && deal.status !== 'rejected');
  if (requested) {
    const selected = live.find(({ deal }) => deal.id === requested)?.deal;
    if (!selected) return workspace(`<div class="oz-counter-unavailable">${counterUnavailable()}</div>${counterBack()}`);
    return workspace(`<header class="oz-claim-heading" data-counter-deal="${esc(selected.id)}">
        <h1 class="oz-claim-title">Students scan this QR</h1>
        <p data-no-i18n>${esc(selected.title)}${selected.benefit && selected.benefit !== selected.title ? ' · ' + esc(selected.benefit) : ''}</p>
      </header>
      <div id="deal-claim-list" class="oz-counter-claims" aria-live="polite"></div>
      <div class="oz-claim-card oz-counter-code">
        <div id="live-deal-qr" hidden></div>
        <p class="oz-claim-caption">Keep this screen open at the counter.</p>
      </div>
      <div class="oz-counter-meta">
        <p id="deal-qr-clock" role="timer" aria-live="off">Loading deal QR…</p>
        <p id="deal-counter-total"><b id="deal-claim-total">0</b> <span>waiting for a discount</span></p>
        <p id="deal-counter-wake" hidden>Your screen stays on while this is open.</p>
      </div>
      <div class="oz-counter-result" aria-live="polite"></div>
      ${counterBack()}`);
  }
  const pts = n(app.rules.liveDealPoints);
  return workspace(`<header class="oz-claim-heading"><h1 class="oz-claim-title">Deal QR</h1>
    ${rows.length ? `<p>${live.length ? 'Show this at your counter. Students scan it to claim your deal.' : 'No deal is live right now.'}</p>` : ''}</header>
    ${live.length || !rows.length ? `<section class="oz-claim-card mer-qr-intro">
      <h2>What is a deal QR?</h2>
      ${live.length ? `<p>Each live deal has its own QR code. Students scan it with +Onz to claim your discount and earn ${pts} points. Then tap Apply discount.</p>${counterManage()}`
        : `<p>First, create a live deal: a discount for your quiet hours. Its QR then appears here.</p>${counterManage('Create your first deal', 'primary')}`}
    </section>` : ''}
    ${live.length ? `<section class="oz-counter-list" aria-labelledby="counter-live"><h2 id="counter-live">Live now</h2>
      ${live.map(({ deal }, index) => `<article class="oz-claim-card">
        <h3 data-no-i18n>${esc(deal.title)}</h3>
        <p data-no-i18n>${deal.benefit && deal.benefit !== deal.title ? esc(deal.benefit) + ' · ' : ''}${D.hhmm(deal.startMin)}–${D.hhmm(deal.endMin)}</p>
        ${ozButton('Show QR to students', { href: '#/scan/' + deal.id, kind: index === 0 ? 'primary' : 'secondary',
          attr: { 'data-deal-qr': deal.id } })}
      </article>`).join('')}</section>` : ''}
    ${other.length ? `<section class="oz-counter-list" aria-label="Not live right now">
      ${live.length ? '<h2>Not live right now</h2>' : ''}
      ${other.map(({ deal, status }) => { const [why, action] = whyNotLive(deal, status);
        return `<article class="oz-claim-card"><h3 data-no-i18n>${esc(deal.title)}</h3><p>${esc(why)}</p>
          ${action ? counterManage(action, 'secondary') : ''}</article>`;
      }).join('')}
    </section>` : ''}
    ${rows.length && !live.length ? counterManage() : ''}`);
}

export function merchantDealQRMount(root, app) {
  const heading = $('[data-counter-deal]', root);
  if (!heading) return null;
  const id = heading.dataset.counterDeal;
  const qr = $('#live-deal-qr', root), clock = $('#deal-qr-clock', root);
  const claimList = $('#deal-claim-list', root), result = $('.oz-counter-result', root);
  const main = $('.oz-claim-main', root), wakeNote = $('#deal-counter-wake', root);
  const applying = new Set();
  let disposed = false, session = null, refreshing = false, stoppedQR = false, lock = null, waking = false;
  let claims = [], waiting = new Set(), received = false, renderedClaims = '';
  let notice = null;
  function drawClaims() {
    const now = D.clock(app.ctx);
    const pending = claims.filter((claim) => claim.status === 'claimed' && !L.claimExpired(claim, now));
    const nextWaiting = new Set(pending.map((claim) => claim.id));
    const finished = claims.find((claim) => waiting.has(claim.id) && !nextWaiting.has(claim.id));
    if (finished) {
      notice = finished;
      result.innerHTML = finished.status === 'applied'
        ? '<section class="oz-claim-card"><h3>Discount marked as applied.</h3><p>The student can now see the confirmed discount.</p></section>'
        : `<section class="oz-claim-card"><h3>Claim expired</h3><p data-no-i18n>${esc(finished.studentName)}</p>
          <p>Discount cannot be applied to an expired claim.</p></section>`;
    }
    if (pending.some((claim) => !waiting.has(claim.id))) {
      if (received) navigator.vibrate?.([120, 60, 120]);
      if (!finished && notice) { result.innerHTML = ''; notice = null; }
    }
    waiting = nextWaiting;
    const total = $('#deal-claim-total', root);
    const count = n(pending.length);
    if (total.textContent !== count) total.textContent = count;
    const html = pending.map((claim, index) => {
      const left = Math.ceil((D.toMs(claim.createdAt) + L.CLAIM_LIFETIME_MS - now) / 60000);
      return `<article class="oz-claim-card mer-claim"><span class="oz-counter-new">New claim</span>
        <h2 data-no-i18n>${esc(claim.studentName)}</h2>
        <p>Give them the discount, then tap the button. <span>${left} <span>min left</span></span></p>
        ${ozButton('Apply discount', { kind: index === 0 ? 'primary' : 'secondary',
          attr: { 'data-apply-claim': claim.id, disabled: applying.has(claim.id) } })}
      </article>`;
    }).join('');
    if (html !== renderedClaims) {
      renderedClaims = html;
      const focus = claimList.contains(document.activeElement) ? document.activeElement.dataset.applyClaim : '';
      claimList.innerHTML = html;
      if (focus) $$('[data-apply-claim]', claimList).find((button) => button.dataset.applyClaim === focus)?.focus({ preventScroll: true });
    }
  }
  const apply = (event) => {
    const button = event.target.closest('[data-apply-claim]');
    const claimId = button?.dataset.applyClaim;
    if (!claimId || !waiting.has(claimId) || applying.has(claimId)) return;
    applying.add(claimId);
    busy(button, async () => {
      try { await L.applyDealClaim(app.ctx, claimId); }
      catch (error) { if (!disposed) toast(error.message || errText(error), true); }
      finally { applying.delete(claimId); if (!disposed) drawClaims(); }
    });
  };
  claimList.addEventListener('click', apply);

  function showQRFailure() {
    stoppedQR = true;
    qr.hidden = true;
    qr.removeAttribute('data-code');
    $('.oz-counter-code', root).hidden = true;
    $('.oz-counter-meta', root).hidden = true;
    heading.hidden = true;
    claimList.insertAdjacentHTML('beforebegin', `<div class="oz-counter-unavailable" role="status">${counterUnavailable()}</div>`);
    lock?.release().catch(() => {});
  }
  async function refresh() {
    refreshing = true;
    try {
      const next = await L.issueDealQR(app.ctx, id);
      if (disposed) return;
      renderQR(qr, next.code, 180);
      qr.dataset.code = next.code;
      qr.hidden = false;
      session = next;
      tick();
    } catch {
      if (!disposed) showQRFailure();
    } finally { refreshing = false; }
  }
  function tick() {
    if (disposed) return;
    drawClaims();
    if (stoppedQR || !session) return;
    const seconds = Math.max(0, Math.ceil((session.expiresAt - D.clock(app.ctx)) / 1000));
    if (seconds === 0) { qr.hidden = true; qr.removeAttribute('data-code'); }
    if (seconds <= 5 && !refreshing) refresh();
    const note = `New code in ${seconds}s. It changes by itself, so screenshots won’t work.`;
    if (clock.dataset.source !== note) { clock.dataset.source = note; clock.textContent = note; }
  }
  async function wake() {
    if (!navigator.wakeLock || waking || (lock && !lock.released) || disposed || stoppedQR || document.visibilityState !== 'visible') return;
    waking = true;
    try {
      const next = await navigator.wakeLock.request('screen');
      if (document.visibilityState !== 'visible' || disposed || stoppedQR) await next.release();
      else { lock = next; wakeNote.hidden = false; }
    } catch { /* Wake lock is optional. */ }
    finally { waking = false; }
  }
  const off = L.watchMerchantClaims(app.ctx, (rows) => {
    if (disposed) return;
    claims = rows.filter((claim) => claim.dealId === id);
    drawClaims();
    received = true;
  }, (error) => { if (!disposed) toast(errText(error), true); });
  document.addEventListener('visibilitychange', wake);
  const interval = setInterval(tick, 1000);
  refresh();
  wake();
  return () => {
    disposed = true; clearInterval(interval); off();
    claimList.removeEventListener('click', apply);
    document.removeEventListener('visibilitychange', wake);
    lock?.release().catch(() => {});
  };
}
const studentCounterContext = 'Ask staff to show the deal QR. Each student can claim each deal once a day. This confirms a deal claim, not a payment.';
// The page title sits above both columns, so the "At the counter" card lines up with the first card in the list
// instead of floating level with the heading.
function dealWorkspace(content, counterText, cls = '') {
  const end = content.startsWith('<header') ? content.indexOf('</header>') + 9 : 0;
  const head = content.slice(0, end), body = content.slice(end);
  return `<div class="oz-claim-workspace ${cls}">${head ? `<div class="oz-claim-head">${head}</div>` : ''}<div class="oz-claim-main">${body}</div>
    <aside class="oz-claim-counter oz-claim-card"><h2>At the counter</h2>
      <p>${esc(counterText)}</p>
    </aside></div>`;
}
const claimPage = (content) => dealWorkspace(content, studentCounterContext);
const claimBack = (kind = 'ghost') => ozButton('Back to live deals', { href: '#/explore/deals', kind, cls: 'oz-claim-back' });

export async function studentDealClaimRender(app, [id] = []) {
  const unavailable = (title) => claimPage(`<h1 class="oz-claim-title">${title}</h1>${claimBack()}`);
  if (!id) return unavailable('Scan a live deal');
  const snap = await app.backend.sdk.getDoc(app.backend.sdk.doc(app.ctx.db, 'deals', id));
  if (!snap.exists()) return unavailable('Deal unavailable');
  const deal = { id: snap.id, ...snap.data() }, merchant = await D.getMerchant(app.ctx, deal.merchantId);
  if (!merchant) return unavailable('Deal unavailable');
  const claim = await L.myDealClaim(app.ctx, id);
  app._studentDeal = { deal, claim };
  const pts = claim?.rewardPoints ?? app.rules.liveDealPoints;
  // Mobbin (Walmart One Pay, Chick-fil-A "Scan to earn", Target "Scan to apply savings"): the offer as one ticket,
  // then one focused scan area with a single action. Back lives at the top, not as a second button at the bottom.
  const benefit = deal.benefit && deal.benefit.trim() !== deal.title.trim() ? deal.benefit : '';
  return claimPage(`<header class="oz-claim-heading">
      ${claim ? '' : `<a class="oz-help-back oz-claim-backlink" href="#/explore/deals">${ozIcon('s:chevron-left')}<span>Live deals</span></a>`}
      <h1 class="oz-claim-title" id="deal-claim-title" tabindex="-1">${claim ? 'Your deal claim' : 'Claim a live deal'}</h1>
      <p id="deal-claim-subtitle"${claim ? '' : ' hidden'}>${claim ? 'At the counter' : ''}</p>
    </header>
    <section class="oz-claim-card oz-claim-ticket" aria-label="Deal">
      <div class="oz-claim-ticket-top"><span class="oz-deal-badge" aria-hidden="true">${ozIcon('stall')}</span>
        <div class="oz-claim-ticket-text"><p class="oz-claim-shop" data-no-i18n>${esc(merchant.name)}</p><h2 data-no-i18n>${esc(deal.title)}</h2></div>
        ${pts > 0 ? `<span class="oz-tag oz-tag-points oz-claim-pts">+${n(pts)} pts</span>` : ''}</div>
      ${benefit ? `<p class="oz-claim-benefit" data-no-i18n>${esc(benefit)}</p>` : ''}
    </section>
    ${claim ? '<div id="deal-confirmation" aria-live="polite"></div>' : `
      <section class="oz-claim-card oz-claim-ready" id="deal-camera-idle">
        <div class="oz-claim-frame" aria-hidden="true"><i></i><i></i><i></i><i></i>${ozIcon('scan')}<span class="oz-claim-sweep"></span></div>
        <p class="oz-claim-ready-text">Ask staff for this deal’s QR</p>
        ${ozButton('Scan to claim', { block: true, attr: { id: 'start-deal-scan' } })}
        <p class="oz-claim-caption">Once per deal, each day · points land straight away</p>
      </section>
      <section id="deal-scanner-panel" hidden class="oz-claim-card oz-claim-scanner">
        <div class="oz-claim-preview"><video id="deal-cam" muted playsinline hidden></video>
          <div id="deal-camera-placeholder">${ozIcon('scan')}<span>Camera preview</span></div>
        </div>
        <div class="oz-claim-instructions" id="deal-scan-instructions">
          <p>Point your camera at the code shown by staff.</p><p class="oz-claim-caption">No manual code entry is available.</p>
        </div>
        <div id="deal-scan-status" role="status" hidden>
          <p class="oz-claim-error-title"></p><p class="oz-claim-caption"></p>
        </div>
        ${ozButton('Try again', { attr: { id: 'retry-deal-scan', hidden: true } })}
      </section>`}`);
}

function mountClaimStatus(root, app, claim) {
  const confirmation = $('#deal-confirmation', root);
  let current = claim, previous = '', timerLabel = null, disposed = false;
  const draw = () => {
    if (disposed) return;
    const now = D.clock(app.ctx);
    const applied = current.status === 'applied';
    const expired = !applied && L.claimExpired(current, now);
    const state = applied ? 'applied' : expired ? 'expired' : 'confirmed';
    if (state !== previous) {
      previous = state;
      const title = applied ? 'Discount applied' : expired ? 'Claim expired' : 'Claim confirmed';
      const detail = applied ? 'The merchant has marked your discount as applied.' : expired ? 'The 15-minute claim window has ended.' : 'Show this confirmation to staff. They will apply your discount.';
      confirmation.innerHTML = `<section class="oz-claim-card oz-claim-confirmation${expired ? ' is-expired' : ''}">
        ${ozIcon(expired ? 'info' : 'check')}<h2>${title}</h2><p>${detail}</p>
        ${state === 'confirmed' ? `<div class="oz-claim-countdown">
          <span>Time left</span><strong role="timer" aria-live="off" data-no-i18n></strong>
          <p class="oz-claim-caption">Valid for 15 minutes after scanning</p>
        </div>` : ''}
        ${current.rewardPoints ? `<p class="deal-points-earned">+${n(current.rewardPoints)} <span>points earned</span></p>` : ''}
        <p class="oz-claim-caption">This confirms a deal claim, not a payment.</p>${claimBack('primary')}
      </section>`;
      timerLabel = $('[role="timer"]', confirmation);
    }
    if (timerLabel) {
      const seconds = Math.max(0, Math.ceil((D.toMs(current.createdAt) + L.CLAIM_LIFETIME_MS - now) / 1000));
      const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      if (timerLabel.textContent !== time) timerLabel.textContent = time;
    }
  };
  draw();
  const off = L.watchMyClaim(app.ctx, claim.id, (snapshot) => {
    if (snapshot && !disposed) { current = snapshot; draw(); }
  }, (error) => { if (!disposed) toast(errText(error), true); });
  const timer = setInterval(draw, 1000);
  return () => { disposed = true; off(); clearInterval(timer); };
}

export function studentDealClaimMount(root, app) {
  if (!$('#deal-claim-title', root)) return null;
  const { deal, claim } = app._studentDeal;
  if (claim) return mountClaimStatus(root, app, claim);
  const video = $('#deal-cam', root), ready = $('#deal-camera-idle', root), scanner = $('#deal-scanner-panel', root);
  const title = $('#deal-claim-title', root), retry = $('#retry-deal-scan', root);
  const status = $('#deal-scan-status', root), instructions = $('#deal-scan-instructions', root);
  let stopCamera, disposed = false, handling = false;
  const report = (label, detail, canRetry) => {
    status.hidden = !detail; instructions.hidden = !!detail;
    status.firstElementChild.textContent = label;
    status.lastElementChild.textContent = detail;
    retry.hidden = !canRetry;
  };
  const begin = (event) => busy(event.currentTarget, async () => {
    ready.hidden = true; scanner.hidden = false;
    title.textContent = 'Scan the deal QR';
    title.focus({ preventScroll: true });
    report('', '', false);
    try {
      stopCamera = await startScanner(video, async (raw) => {
        if (handling || disposed) return;
        handling = true;
        try {
          await L.claimDealQR(app.ctx, raw, deal.id);
          if (!disposed) { stopCamera?.(); confetti(); app.render(); }
        } catch (error) {
          if (!disposed) report('Scan unsuccessful', error.message || errText(error), false);
        } finally { handling = false; }
      }, (message, state) => {
        if (disposed) return;
        if (state === 'ready') {
          video.hidden = false;
          $('#deal-camera-placeholder', root).hidden = true;
        } else report(state === 'denied' ? 'Camera permission denied' : 'Camera unavailable', message, true);
      }, { manualFallback: false });
      if (disposed) stopCamera();
    } catch (error) {
      if (!disposed) report('Camera unavailable', error.message || errText(error), true);
    }
  });
  $('#start-deal-scan', root).onclick = begin;
  retry.onclick = begin;
  return () => { disposed = true; stopCamera?.(); };
}
