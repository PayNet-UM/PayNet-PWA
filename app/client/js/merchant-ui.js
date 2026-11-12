// Merchant presentation helpers. All progress and totals come from existing records.
import { esc, icon, n } from './ui.js';
import { merchantReadinessCurrent } from './data.js';
import { directoryArt } from './directory-art.js';

export const merchantHeading = (title, description, glyph, kicker = 'Merchant tools') => `<header class="mer-page-head">
  <div><span class="mer-eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div>
  <span class="mer-heading-art" aria-hidden="true">${icon(glyph)}<i>${icon('sparkles')}</i></span>
</header>`;

export const merchantMetric = (label, value, glyph, tone = 'violet') => `<div class="stat mer-metric" data-tone="${tone}">
  <span class="mer-metric-icon" aria-hidden="true">${icon(glyph)}</span><div class="k">${label}</div><div class="v num">${value}</div>
</div>`;

export const merchantEmpty = (glyph, title, description = '') => `<div class="mer-empty">
  <span class="mer-empty-art" aria-hidden="true">${icon(glyph)}<i>${icon('sparkles')}</i></span><h3>${title}</h3>${description ? `<p>${description}</p>` : ''}
</div>`;

export function merchantSetup(m, hasPin, rules) {
  const current = merchantReadinessCurrent(m, rules);
  const updated = !!m?.ready && !current;
  const milestones = [
    ['store', 'Shop profile', !!m], ['map-pin', 'Map pin', hasPin(m)],
    ['badge-check', 'Admin verified', m?.status === 'verified'], ['shield-check', 'Staff ready', current],
  ];
  const done = milestones.filter(([, , complete]) => complete).length;
  if (done === 4) return '';
  return `<section class="card mer-setup" aria-labelledby="mer-setup-title">
    <div class="mer-section-head"><h2 id="mer-setup-title">Shop readiness</h2><span class="mer-count">${n(done)} / 4</span></div>
    <div class="mer-setup-progress"><div class="mer-progress-ring" style="--progress:${done * 25}%" role="img" aria-label="${done}/4 completed"><span>${done * 25}<small>%</small></span></div>
      <div><span class="mer-eyebrow">${updated ? 'New update' : 'Get set up'}</span><h3>${updated ? 'Action needed' : 'Build your shop'}</h3></div></div>
    ${updated && rules?.merchantReadinessUpdate?.message ? `<p class="mer-readiness-update-copy" data-no-i18n>${esc(rules.merchantReadinessUpdate.message)}</p>` : ''}
    <div class="mer-milestones">${milestones.map(([glyph, label, complete]) => `<a href="${glyph === 'shield-check' ? '#/shop/ready' : '#/shop'}" class="mer-milestone ${complete ? 'is-done' : ''}"><span>${icon(glyph)}</span><strong>${label}</strong><i aria-label="${complete ? 'Complete' : 'To do'}">${icon(complete ? 'check' : 'chevron-right')}</i></a>`).join('')}</div>
    <a class="btn primary block" href="${updated ? '#/shop/ready' : '#/shop'}">${updated ? 'Review update' : 'Continue setup'} ${icon('arrow-right')}</a>
  </section>`;
}

export const merchantAction = (route, glyph, label, description, index) => `<a class="mer-action" data-tone="${['violet', 'lime', 'peach', 'sky'][index % 4]}" href="#/${esc(route)}">
  <span class="mer-action-top"><span class="onz-art-frame mer-action-art">${directoryArt({ store: 'shops', 'qr-code': 'qr', 'badge-percent': 'deals', target: 'lessons' }[glyph] || 'shops')}</span><span class="mer-action-arrow">${icon('arrow-right')}</span></span>
  <h3>${label}</h3><p>${description}</p>
</a>`;
