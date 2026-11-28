// Admin presentation helpers on the +Onz design system (Figma "Admin · …" 1440 / "Mobile admin · …" 390, e.g.
// Programme overview 1136:64484 / 1137:65876). Counts, permissions and actions stay in the data layer.
import { esc } from './ui.js';
import { ozIcon } from './oz-icons.js';

// Old icon names used by admin views → the solid +Onz glyphs.
const GLYPH = { store: 'stall', users: 'community', 'shield-check': 'shield', 'hand-heart': 'heart', 'file-spreadsheet': 'chart', 'badge-percent': 'voucher',
  'list-checks': 'check', 'circle-check': 'check', trophy: 'leagues', 'chart-column': 'chart', 'layout-dashboard': 'dashboard', ticket: 'voucher', gift: 'rewards',
  calendar: 'events', 'piggy-bank': 'wallet', 'trash-2': 'trash', settings: 'settings', target: 'target', mail: 'mail', scale: 'chart' };
export const hepGlyph = (g) => ozIcon(GLYPH[g] || g) || ozIcon('info');

/** Kept for old callers: a small icon tile. */
export const hepEmblem = (glyph, small = false) => `<span class="oz-aicon${small ? ' is-small' : ''}" aria-hidden="true">${hepGlyph(glyph)}</span>`;

/** Page head: title (UI/H1), one line, then the page's actions as a right-aligned pill row (Figma). */
export const hepHeading = (title, description, _glyph, actions = '') => `<header class="oz-ahead hep-page-head">
  <div class="oz-ahead-copy"><h1>${title}</h1>${description ? `<p>${description}</p>` : ''}</div>
  ${actions ? `<div class="oz-ahead-actions hep-heading-actions">${actions}</div>` : ''}
</header>`;

/** Stat card: label, big number, optional detail (Figma overview stat cards). */
export const hepMetric = (label, value, _glyph, _tone, detail = '') => `<div class="oz-astat stat hep-metric">
  <span class="oz-astat-label k">${label}</span><strong class="oz-astat-value v num">${value}</strong>${detail ? `<small class="oz-astat-detail s">${detail}</small>` : ''}
</div>`;

export const hepEmpty = (title, glyph = 'circle-check') => `<div class="oz-aempty hep-empty">${hepEmblem(glyph, true)}<p>${title}</p></div>`;

/** A row that opens another admin page. */
export const hepShortcut = (route, title, description, glyph) => `<a class="oz-arow hep-shortcut" href="#/${esc(route)}">
  ${hepEmblem(glyph)}<span class="oz-arow-text"><strong>${title}</strong><small>${description}</small></span>${ozIcon('s:chevron-right')}
</a>`;
