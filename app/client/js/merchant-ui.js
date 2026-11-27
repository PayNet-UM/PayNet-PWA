// Merchant presentation helpers on the +Onz design system (Figma Merchant frames, e.g. Insights 523:11598,
// Close merchant account 523:11859, Promote 1116:58618). All progress and totals come from existing records.
import { esc, n } from './ui.js';
import { merchantReadinessCurrent } from './data.js';
import { ozIcon } from './oz-icons.js';

/** Back link above a page title ("‹ Merchant home"), the Figma sub-page pattern. */
export const merchantBack = (href, label) => `<a class="oz-mback" href="${esc(href)}">${ozIcon('s:chevron-left')}<span>${esc(label)}</span></a>`;

/** Page title (UI/H1) and one line of help. `glyph` is kept for old callers and no longer drawn. */
export const merchantHeading = (title, description, _glyph, _kicker, back = null) => `${back ? merchantBack(back[0], back[1]) : ''}<header class="oz-mhead mer-page-head">
  <h1>${title}</h1>${description ? `<p>${description}</p>` : ''}
</header>`;

/** Stat card (label, big number, optional hint). */
export const merchantMetric = (label, value, _glyph, _tone, hint = '') => `<div class="oz-mstat stat mer-metric"><span class="oz-mstat-label">${label}</span><strong class="num">${value}</strong>${hint ? `<small>${hint}</small>` : ''}</div>`;

/** Empty state: lime icon tile, title, one line (Figma "No deal claims yet" 1374:82524). */
export const merchantEmpty = (glyph, title, description = '') => `<div class="oz-mzero mer-empty">
  <span class="oz-mzero-ic" aria-hidden="true">${ozIcon({ 'badge-percent': 'voucher', 'qr-code': 'scan' }[glyph] || glyph)}</span><h3>${title}</h3>${description ? `<p>${description}</p>` : ''}
</div>`;

/** Shop readiness card (Figma "Shop readiness · setup" 840:29261 / "Action needed · update" 840:29318). */
export function merchantSetup(m, hasPin, rules) {
  const current = merchantReadinessCurrent(m, rules);
  const updated = !!m?.ready && !current;
  const milestones = [
    ['stall', 'Shop profile', !!m, '#/shop'], ['map-pin', 'Map pin', hasPin(m), '#/shop'],
    ['shield', 'Admin verified', m?.status === 'verified', '#/shop'], ['check', 'Staff ready', current, '#/shop/ready'],
  ];
  const done = milestones.filter(([, , complete]) => complete).length;
  if (done === 4) return '';
  return `<section class="oz-mcard oz-msetup mer-setup" aria-labelledby="mer-setup-title">
    <p class="oz-mkicker">${updated ? 'New update' : 'Get set up'}</p>
    <h2 id="mer-setup-title">${updated ? 'Action needed' : 'Shop readiness'}</h2>
    <p class="oz-mstart-count">${n(done)} of 4 done</p>
    <span class="oz-mstart-bar" aria-hidden="true"><i style="width:${done * 25}%"></i></span>
    ${updated && rules?.merchantReadinessUpdate?.message ? `<p class="oz-msetup-note" data-no-i18n>${esc(rules.merchantReadinessUpdate.message)}</p>` : ''}
    <ul class="oz-mchecks">${milestones.map(([glyph, label, complete, href]) => `<li class="${complete ? 'is-done' : ''}"><a href="${href}">
      <span class="oz-mstart-ic" aria-hidden="true">${ozIcon(complete ? 'check' : glyph)}</span><span class="oz-mstart-text"><b>${label}</b><small class="oz-mstart-state">${complete ? 'Completed' : 'To do'}</small></span></a></li>`).join('')}</ul>
    <a class="oz-btn oz-btn-primary oz-btn-md oz-btn-block btn" href="${updated ? '#/shop/ready' : '#/shop'}"><span>${updated ? 'Review update' : 'Continue setup'}</span></a>
  </section>`;
}

/** Kept for old imports: a plain list row to a merchant page. */
export const merchantAction = (route, glyph, label, description) => `<a class="oz-row" href="#/${esc(route)}"><span class="oz-row-lead">${ozIcon(glyph)}</span><span class="oz-row-text"><span class="oz-row-title">${label}</span><span class="oz-row-sub">${description}</span></span></a>`;
