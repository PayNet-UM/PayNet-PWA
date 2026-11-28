// +Onz icon set (Figma "Onz Icon · Solid" 743:6191 and "Onz Icon" 453:6363), drawn with CSS masks so the
// unmodified Figma SVGs take the text colour of their parent. Solid glyphs by default; stroke glyphs only for
// chevrons, close, plus and names the solid set does not have. Anything unmapped falls back to the shared set.
import { setIconRenderer } from './icons.js';

export const OZ_SOLID = ['community', 'leagues', 'home', 'rewards', 'me', 'events', 'map-pin', 'clock', 'settings', 'check',
  'streak', 'scan', 'stall', 'friend-add', 'learn', 'bell', 'search', 'lock', 'coin', 'voucher', 'heart', 'info', 'wallet',
  'hat', 'edit', 'share', 'medal',
  // Drawn to match the solid set for names it lacks, so every content icon is filled (stroke is only for controls).
  'arrow-left', 'arrow-right', 'shield', 'shield-alert', 'alert', 'sparkles', 'target', 'mail', 'map', 'megaphone', 'image', 'eye', 'star', 'send', 'lightbulb', 'coffee', 'printer', 'chart', 'navigation', 'locate', 'refresh', 'smartphone', 'dashboard', 'copy', 'trash', 'logout', 'live', 'camera', 'language', 'history', 'fund', 'torch'];
export const OZ_STROKE = ['chevron-right', 'chevron-left', 'close', 'plus', 'minus', 'menu', 'download', 'upload', 'check', 'copy', 'camera', 'torch', 'history',
  'logout', 'live', 'fund', 'language', 'trash', 'deals'];

// Names used across the existing views (shared Lucide names) → +Onz glyph.
const FROM_SHARED = {
  users: 'community', trophy: 'leagues', house: 'home', gift: 'rewards', user: 'me', calendar: 'events',
  'map-pin': 'map-pin', clock: 'clock', settings: 'settings', 'circle-check': 'check', 'badge-check': 'check',
  flame: 'streak', 'qr-code': 'scan', store: 'stall', 'user-plus': 'friend-add', 'book-open': 'learn', bell: 'bell',
  search: 'search', lock: 'lock', coins: 'coin', ticket: 'voucher', heart: 'heart', info: 'info', wallet: 'wallet',
  pencil: 'edit', 'share-2': 'share', medal: 'medal',
  'chevron-right': 's:chevron-right', 'chevron-left': 's:chevron-left', x: 's:close', plus: 's:plus', check: 'check',
  copy: 'copy', camera: 'camera', history: 'history', 'log-out': 'logout', zap: 'live',
  'hand-heart': 'fund', 'trash-2': 'trash', languages: 'language', globe: 'language',
  'arrow-left': 'arrow-left', 'arrow-right': 'arrow-right', 'shield-check': 'shield', 'shield-alert': 'shield-alert', 'circle-alert': 'alert',
  sparkles: 'sparkles', target: 'target', mail: 'mail', map: 'map', megaphone: 'megaphone', image: 'image', eye: 'eye', star: 'star', send: 'send',
  lightbulb: 'lightbulb', coffee: 'coffee', printer: 'printer', 'chart-column': 'chart', navigation: 'navigation', 'locate-fixed': 'locate',
  'refresh-cw': 'refresh', smartphone: 'smartphone', 'layout-dashboard': 'dashboard', 'badge-percent': 'voucher', 'graduation-cap': 'learn',
  download: 's:download', upload: 's:upload', 'file-spreadsheet': 'chart', 'list-checks': 'check',
  handshake: 'community', 'scan-line': 'scan', 'piggy-bank': 'wallet', palette: 'hat', compass: 'map-pin', 'calendar-days': 'events',
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
