import {$,esc,icon,n} from './ui.js';
import {DEFAULT_POINT_RULES,POINT_LEVELS,learningPlan,earnedPoints,livePointEarningOn} from './points-policy.js';

export function pointsSummaryHTML(app={}) {
  const plan=learningPlan(app.rules),merchant=app.role==='merchant';
  return `<a class="points-summary" href="#/points"><span>${icon('sparkles')}</span><div><b>${merchant?'Student points explained':'How points work'}</b><small>${merchant?'Vouchers are fulfilled by the Admin team.':'Three lessons + Money check. Each paid once.'}</small></div><strong>${n(plan.total)} <small>pts</small></strong>${icon('chevron-right')}</a>`;
}
export function pointsGuideHTML(app={}) {
  const rules=app.rules||DEFAULT_POINT_RULES,plan=learningPlan(rules,app.ledger||[]);
  const live=livePointEarningOn(rules),current=!!app.ctx||!!app.profile,isDemo=app.backend?.mode==='demo',student=app.role==='student'&&!!app.profile;
  return `<div class="points-guide-content">
    <div class="points-policy-hero"><div><span class="points-eyebrow">Your points, clearly explained</span><h2>Learn. Earn. Make them count.</h2><p>Points are an in-app balance with no cash value. They are used for programme vouchers or donated to student welfare.</p></div><div class="points-learning-total"><span class="points-hero-star" aria-hidden="true">${icon('sparkles')}</span><strong>${n(plan.total)}</strong><span>one-time learning points</span><small>${plan.lessonCount} × ${n(plan.lessonBonus)} + ${n(plan.surveyBonus)}</small><small class="points-settings-source">${current?'Current programme settings':'Default programme settings'}</small></div></div>
    <div class="points-default-note"><b>Default guide: 200 points ≈ RM2 in voucher value.</b><span>Three lessons at 50 points plus the 50-point Money check. The Admin team can change future bonuses and each reward’s price.</span></div>
    ${student?`<div class="points-wallet-facts"><div><span>Available balance</span><b><span data-bind="points">${n(app.profile.points||0)}</span> <small>pts</small></b></div><div><span>Earned for levels & leagues</span><b><span data-policy-earned>${app.ledgerLoaded===false?'—':n(earnedPoints(app.ledger||[]))}</span> <small>pts</small></b></div><div><span>Learning points still available</span><b><span data-policy-remaining>${app.ledgerLoaded===false?'—':n(plan.remaining)}</span> <small>pts</small></b></div></div>`:''}
    <section class="points-policy-section"><h3><span class="points-section-icon" aria-hidden="true">${icon('sparkles')}</span>Five ways points reach a student</h3><div class="points-sources">
      <article><span class="points-source-icon">${icon('book-open')}</span><div><h4>Learn & Earn</h4><p>Three lessons. Earn the bonus on the first correct answer for each lesson; practice gives no extra points.</p></div><strong>3 × ${n(plan.lessonBonus)}</strong></article>
      <article><span class="points-source-icon">${icon('target')}</span><div><h4>Money check</h4><p>Complete the knowledge and confidence survey once to earn its bonus.</p></div><strong>+${n(plan.surveyBonus)}</strong></article>
      <article><span class="points-source-icon">${icon('shield-check')}</span><div><h4>Admin awards & corrections</h4><p>The Admin team can award event points or correct a balance. Every adjustment needs a written reason.</p></div><span class="points-source-label">Admin only</span></article>
      <article><span class="points-source-icon">${icon('hand-heart')}</span><div><h4>Welfare grants</h4><p>Request up to 1,000 points at a time. Approval moves existing points from the shared fund into your balance; it creates no new points and does not count for levels or leagues.</p></div><span class="points-source-label">Pool transfer</span></article>
      <article class="points-conditional"><span class="points-source-icon">${icon('qr-code')}</span><div><h4>Live deals <span class="points-live-state">${!current?'Off by default':live?(isDemo?'Enabled in this demo':'Currently enabled'):'Currently off'}</span></h4><p>When enabled, a valid merchant QR claim earns points once per student, per deal, per day.</p><small>Live deals are off by default in production. The Admin team controls this feature.</small></div><strong>+${n(plan.liveDealPoints)}</strong></article>
    </div></section>
    <section class="points-no-awards"><span>${icon('info')}</span><div><h3>These do not award points</h3><p>Daily app streaks, referrals and browsing the campus map. Campus attendance and weekly missions are retired; only the Admin team can settle archived mission claims.</p></div></section>
    <section class="points-policy-section"><h3><span class="points-section-icon" aria-hidden="true">${icon('wallet')}</span>Two ways to use your balance</h3><div class="points-use-grid"><article><span class="points-source-icon">${icon('ticket')}</span><h4>Swap for a voucher</h4><p>Points leave your balance when you swap. You receive an 8-character voucher code to show to the Admin team, who honour it and mark it used once.</p><p>Rewards must be active and in stock. Check the voucher’s expiry date. Deleting your account removes unused vouchers.</p></article><article><span class="points-source-icon">${icon('hand-heart')}</span><h4>Donate to student welfare</h4><p>Give points from your balance to the pooled fund. Students can request support privately; only the student and the Admin team see the request.</p><p>Donations and grants move existing points. They do not create new value.</p></article></div></section>
    <section class="points-value-card"><div><span class="points-eyebrow">Reference pricing, not cash</span><h3>100 points ≈ RM1 of voucher value</h3><p>Default rewards use 1 point per sen. Each reward has its own points price and RM value, so its actual rate may differ. Points cannot be sold or exchanged for cash.</p></div><div class="points-value-examples"><span><b>200</b><small>pts</small>${icon('arrow-right')}<strong>RM2</strong></span><span><b>500</b><small>pts</small>${icon('arrow-right')}<strong>RM5</strong></span></div></section>
    <section class="points-policy-section"><h3><span class="points-section-icon" aria-hidden="true">${icon('trophy')}</span>Levels, hats and your KK</h3><div class="points-levels">${POINT_LEVELS.map(([threshold,label],i)=>`<span><i class="points-level-badge" aria-hidden="true">${icon(['star','compass','medal','trophy','sparkles'][i])}</i><b>${esc(label)}</b><small>${n(threshold)} <span>earned points</span></small></span>`).join('')}</div><p>Levels and the KK and Faculty Leagues count positive points earned, excluding welfare grants. Spending or donating does not reduce these totals. Hats unlock with levels; they are not bought with points.</p><p>At default settings, self-directed learning reaches Regular at 200 points. Explorer and higher need Admin awards, or live deals if enabled. Deleting an account removes its contribution from the league totals.</p></section>
    <details class="points-records"><summary>How the balance is protected ${icon('chevron-right')}</summary><p>Each balance change and its points-history entry are saved together. The history cannot be edited or deleted. The rules prevent repeat lesson bonuses, duplicate daily deal claims and negative balances.</p><p>Changing a bonus affects future awards only. Past points remain unchanged. The Admin team can correct mistakes with a recorded reason.</p></details>
  </div>`;
}
export function pointsPageRender(app={}) {
  const admin=app.site==='admin',href=admin?'#/settings':app.role==='student'?'#/rewards':'#/home';
  return `<div class="points-policy-page"><a class="back" href="${href}">${icon('arrow-left')}<span>${admin?'Settings':app.role==='student'?'Rewards':'Back to app'}</span></a><div class="page-title"><h1>Points guide</h1><p>Earn, use and understand your +Onz points.</p></div>${pointsGuideHTML(app)}</div>`;
}

export function pointsGuideMount(root,app={}) {
  const earned=$('[data-policy-earned]',root),remaining=$('[data-policy-remaining]',root);
  if(!earned&&!remaining)return;
  const paint=()=>{
    if(app.ledgerLoaded===false)return;
    if(earned)earned.textContent=n(earnedPoints(app.ledger||[]));
    if(remaining)remaining.textContent=n(learningPlan(app.rules,app.ledger||[]).remaining);
  };
  paint();
  return app.on?.(topic=>{if(topic==='ledger')paint();});
}
