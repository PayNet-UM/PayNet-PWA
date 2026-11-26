// +Onz icon set (Figma "Onz Icon · Solid" 743:6191 and "Onz Icon" 453:6363), drawn with CSS masks so the
// unmodified Figma SVGs take the text colour of their parent. Solid glyphs by default; stroke glyphs only for
// chevrons, close, plus and names the solid set does not have. Anything unmapped falls back to the shared set.
import { setIconRenderer } from './icons.js';

export const OZ_SOLID = ['community', 'leagues', 'home', 'rewards', 'me', 'events', 'map-pin', 'clock', 'settings', 'check',
  'streak', 'scan', 'stall', 'friend-add', 'learn', 'bell', 'search', 'lock', 'coin', 'voucher', 'heart', 'info', 'wallet',
  'hat', 'edit', 'share', 'medal'];
export const OZ_STROKE = ['chevron-right', 'chevron-left', 'close', 'plus', 'check', 'copy', 'camera', 'torch', 'history',
  'logout', 'live', 'fund', 'language', 'trash', 'deals'];

// Names used across the existing views (shared Lucide names) → +Onz glyph.
const FROM_SHARED = {
  users: 'community', trophy: 'leagues', house: 'home', gift: 'rewards', user: 'me', calendar: 'events',
  'map-pin': 'map-pin', clock: 'clock', settings: 'settings', 'circle-check': 'check', 'badge-check': 'check',
  flame: 'streak', 'qr-code': 'scan', store: 'stall', 'user-plus': 'friend-add', 'book-open': 'learn', bell: 'bell',
  search: 'search', lock: 'lock', coins: 'coin', ticket: 'voucher', heart: 'heart', info: 'info', wallet: 'wallet',
  pencil: 'edit', 'share-2': 'share', medal: 'medal',
  'chevron-right': 's:chevron-right', 'chevron-left': 's:chevron-left', x: 's:close', plus: 's:plus', check: 's:check',
  copy: 's:copy', camera: 's:camera', history: 's:history', 'log-out': 's:logout', zap: 's:live',
  'hand-heart': 's:fund', 'trash-2': 's:trash', languages: 's:language', globe: 's:language',
};

/** HTML for one +Onz glyph. `name` is a +Onz name (`home`) or `s:<name>` for the stroke set. */
export function ozIcon(name, cls = '') {
  const stroke = name.startsWith('s:');
  const n = stroke ? name.slice(2) : name;
  if (!(stroke ? OZ_STROKE : OZ_SOLID).includes(n)) return '';
  return `<span class="ic oz-ic oz-ic-${stroke ? 's-' : ''}${n}${cls ? ' ' + cls : ''}" aria-hidden="true"></span>`;
}

export function installOzIcons() {
  setIconRenderer((n, cls) => (FROM_SHARED[n] ? ozIcon(FROM_SHARED[n], cls) : null));
}
