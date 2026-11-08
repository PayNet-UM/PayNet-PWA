// HEP presentation helpers. Counts, permissions and actions stay in the data layer.
import { esc, icon } from './ui.js';

export const hepEmblem = (glyph, small = false) => `<span class="hep-emblem${small ? ' small' : ''}" aria-hidden="true">${icon(glyph)}<i>${icon('plus')}</i></span>`;

export const hepHeading = (title, description, glyph, actions = '') => `<header class="hep-page-head">
  ${hepEmblem(glyph)}<div class="hep-heading-copy"><span class="hep-eyebrow">Campus management</span><h1>${title}</h1><p>${description}</p></div>
  ${actions ? `<div class="hep-heading-actions">${actions}</div>` : ''}
</header>`;

export const hepMetric = (label, value, glyph, tone = 'violet', detail = '') => `<div class="stat hep-metric" data-tone="${tone}">
  <span class="hep-metric-icon" aria-hidden="true">${icon(glyph)}</span><div class="k">${label}</div><div class="v num">${value}</div>${detail ? `<div class="s">${detail}</div>` : ''}
</div>`;

export const hepEmpty = (title, glyph = 'circle-check') => `<div class="hep-empty">${hepEmblem(glyph, true)}<p>${title}</p></div>`;

export const hepShortcut = (route, title, description, glyph, tone) => `<a class="hep-shortcut" data-tone="${tone}" href="#/${esc(route)}">
  ${hepEmblem(glyph)}<span><strong>${title}</strong><small>${description}</small></span><span class="hep-shortcut-arrow" aria-hidden="true">${icon('arrow-right')}</span>
</a>`;
