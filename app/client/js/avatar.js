// +Onz avatars: every student is Sir Onz (Figma "Lion v2" 22:1166), wearing a skin and a level-locked hat.
// The drawing is composed from the original Figma artwork in assets/onz (never redrawn); only the head shell,
// face plate and eyes are the plain rounded shapes Lion v2 itself defines.
// Stored as a small settings map on the student's profile (users/{uid}.avatar). Older profiles also hold the
// pre-redesign drawing options (skin tone, hair, outfit…); clean() keeps them untouched so nothing is lost.
import { CAMPUS_BACKGROUNDS, CAMPUS_COLORS } from './avatar-backgrounds.js';
export { CAMPUS_BACKGROUNDS };

// Pre-redesign options, kept so stored avatars stay valid (Firestore allows up to 16 keys in the map).
export const SKIN = ['#FFE3CC', '#F7CDA8', '#EDB98A', '#DDA06F', '#C68650', '#A86B3F', '#82502E', '#5C3720'];
export const HAIR_COLORS = ['#1E1A1D', '#3B2620', '#6B4128', '#9A5B32', '#C98B4A', '#E8C17A', '#B8B8C0', '#E37BA8', '#8E6CEF', '#3F7FD9', '#2BA38C'];
export const OUTFIT_COLORS = ['#00A547', '#258DCE', '#F4A019', '#E85A5A', '#8E6CEF', '#FFCA28', '#2E3A4F', '#F2EFE6'];
export const ACCENT_COLORS = ['#E2463B', '#F4A019', '#00A547', '#258DCE', '#8E6CEF', '#F48FB1', '#4A3B33', '#FFFFFF'];
export const BG_COLORS = CAMPUS_COLORS;
export const HAIRS = [['short', 'Short'], ['bob', 'Bob'], ['long', 'Long'], ['bun', 'Bun'], ['curly', 'Curly'], ['spiky', 'Spiky'], ['tudung', 'Tudung'], ['bawal', 'Bawal'], ['shawl', 'Shawl']];
export const isTudung = (hair) => ['tudung', 'bawal', 'shawl'].includes(hair);
export const OUTFITS = [['tee', 'T-shirt'], ['hoodie', 'Hoodie'], ['overalls', 'Overalls'], ['baju', 'Baju kurung']];
export const BAGS = [['none', 'No bag'], ['backpack', 'Backpack'], ['tote', 'Tote bag']];
export const FACES = [['smile', 'Smile'], ['grin', 'Grin'], ['wink', 'Wink']];

// Hats (Figma "Hats" 416:123, wardrobe 696:13625). Ids are unchanged from production; a third value is the level that unlocks it.
// Order follows the wardrobe grid (696:13647): free hats, the level hats, then the songkok.
export const HATS = [['none', 'No hat'], ['beanie', 'Beanie'], ['cap', 'Cap'], ['party', 'Party hat'],
  ['mushroom', 'Barista cap', 'Regular'], ['headband', 'KK headband'], ['grad', 'Explorer hat', 'Explorer'], ['crown', 'Crown', 'Campus champion'], ['songkok', 'Songkok']];

// Skins in the order and with the level locks of the wardrobe colours grid (696:13715). Every lock is a level,
// which production already grants; nothing is bought. Palette = shell top, shell bottom, face top, face bottom.
// The last seven are also the KK League college colours (COLLEGE_SKIN below).
// Onzo's faces, from Figma "Hats & Expressions v2 › Expressions" (416:8732), on the Lion v2 canvas (200×280).
// Only the eyes, mouth and cheeks change between expressions; the nose and everything else stay put.
const SMILE = (x, y, w, h) => `<path transform="translate(${x} ${y}) scale(${w / 20} ${h / 10})" d="M20 0C20 1.31 19.74 2.61 19.24 3.83C18.74 5.04 18 6.14 17.07 7.07C16.14 8 15.04 8.74 13.83 9.24C12.61 9.74 11.31 10 10 10C8.69 10 7.39 9.74 6.17 9.24C4.96 8.74 3.86 8 2.93 7.07C2 6.14 1.26 5.04 0.76 3.83C0.26 2.61 0 1.31 0 0H3.8C3.8 .81 3.96 1.62 4.27 2.37C4.58 3.12 5.04 3.81 5.62 4.38C6.19 4.96 6.88 5.42 7.63 5.73C8.38 6.04 9.19 6.2 10 6.2C10.81 6.2 11.62 6.04 12.37 5.73C13.12 5.42 13.81 4.96 14.38 4.38C14.96 3.81 15.42 3.12 15.73 2.37C16.04 1.62 16.2 .81 16.2 0H20Z" fill="#1A1A1A"/>`;
const PLUS_EYE = (cx) => `<path d="M${cx} 113a3.33 3.33 0 0 1 3.33 3.33v3.34h3.34a3.33 3.33 0 0 1 0 6.66h-3.34v3.34a3.33 3.33 0 0 1-6.66 0v-3.34h-3.34a3.33 3.33 0 0 1 0-6.66h3.34v-3.34A3.33 3.33 0 0 1 ${cx} 113Z" fill="url(#onz-love-eye)"/>`;
export const EXPRESSIONS = {
  calm: '<rect x="71" y="113" width="11" height="19" rx="5.5" fill="#1A1A1A"/><rect x="118" y="113" width="11" height="19" rx="5.5" fill="#1A1A1A"/>',
  happy: '<rect x="71" y="113" width="11" height="19" rx="5.5" fill="#1A1A1A"/><rect x="118" y="113" width="11" height="19" rx="5.5" fill="#1A1A1A"/>' + SMILE(90, 150, 20, 10),
  wink: '<rect x="71" y="111" width="11" height="24" rx="5.5" fill="#1A1A1A"/><rect x="113" y="123" width="20" height="6" rx="3" fill="#1A1A1A"/>',
  love: '<linearGradient id="onz-love-eye" x1="0" y1="113" x2="0" y2="133" gradientUnits="userSpaceOnUse"><stop stop-color="#1325F5"/><stop offset="1" stop-color="#5A78FF"/></linearGradient>'
    + PLUS_EYE(76.5) + PLUS_EYE(123.5) + SMILE(90, 150, 20, 10),
  surprised: '<rect x="70" y="106" width="12" height="29" rx="6" fill="#1A1A1A"/><rect x="118" y="106" width="12" height="29" rx="6" fill="#1A1A1A"/>',
  celebrate: '<rect x="69" y="116" width="13" height="11" rx="5.5" fill="#1A1A1A"/><rect x="118" y="116" width="13" height="11" rx="5.5" fill="#1A1A1A"/>' + SMILE(87, 148, 26, 13),
  // Cheeks use the skin's lighter shell colour (blue Onzo: #8CBEFB), passed in at poke time.
  shy: (cheek = '#8CBEFB') => `<rect x="66" y="122" width="11" height="13" rx="5.5" fill="#1A1A1A"/><rect x="113" y="122" width="11" height="13" rx="5.5" fill="#1A1A1A"/><ellipse cx="60" cy="141" rx="10" ry="5" fill="${cheek}"/><ellipse cx="140" cy="141" rx="10" ry="5" fill="${cheek}"/>`,
};
/** Swap an Onzo SVG's face to an expression for `ms`, then back to Calm. Returns a cancel function. */
export function showExpression(svg, name, ms = 1400) {
  const face = svg?.querySelector('.onz-face'); if (!face || !EXPRESSIONS[name]) return () => {};
  const cheek = svg.querySelector('linearGradient stop:last-child')?.getAttribute('stop-color') || '#8CBEFB';
  face.innerHTML = typeof EXPRESSIONS[name] === 'function' ? EXPRESSIONS[name](cheek) : EXPRESSIONS[name];
  const t = setTimeout(() => { if (face.isConnected) face.innerHTML = EXPRESSIONS.calm; }, ms);
  return () => { clearTimeout(t); if (face.isConnected) face.innerHTML = EXPRESSIONS.calm; };
}
export const ONZ_SKINS = [
  ['blue', 'Blue', null, ['#4DA1F8', '#8CBEFB', '#BBD0F5', '#DDE8FA']],
  ['red', 'Red', null, ['#FF7A6B', '#FFB0A6', '#FFD3CC', '#FFE9E5']],
  ['orange', 'Orange', 'Regular', ['#FFA35C', '#FFC896', '#FFE0C7', '#FFF0E3']],
  ['yellow', 'Yellow', null, ['#FFD95C', '#FFE896', '#FFF0BF', '#FFF8E0']],
  ['green', 'Green', null, ['#5ED493', '#9BE6BB', '#CDEFDB', '#E8F8EE']],
  ['teal', 'Teal', 'Explorer', ['#5FD3DA', '#9CE6EA', '#CBEFF1', '#E6F8F9']],
  ['purple', 'Purple', 'Campus champion', ['#A57CFF', '#C9B0FF', '#E2D6FF', '#F1EBFF']],
  ['pink', 'Pink', 'Legend', ['#FF8DBB', '#FFBCD7', '#FFD9E8', '#FFEDF4']],
  ['midnight', 'Midnight', 'Legend', ['#4A507F', '#7279A8', '#C9CDE6', '#E3E6F5']],
  ['cocoa', 'Cocoa', null, ['#BF8864', '#D8AB88', '#EED3B8', '#F9EADB']],
  ['aqua', 'Aqua', null, ['#43BFDC', '#8EDBEA', '#BCEBF3', '#E0F6FA']],
  ['plum', 'Plum', null, ['#C67AA1', '#DFA6C1', '#EED0E0', '#F8E7F0']],
  ['slate', 'Slate', null, ['#8FA4BA', '#B1C2D3', '#D3DFEB', '#EDF2F8']],
];

// Wardrobe extras (Figma Wardrobe · Eyewear 783:1914, Scarves 783:1971, Backgrounds 783:2028, Faculty collection 1223:69722).
// Stored together in avatar.wear so the avatar map keeps the pre-redesign fields and stays within the rules' 16-key limit.
export const EYEWEAR = [['none', 'None'], ['round', 'Round glasses']];
export const NECKWEAR = [['none', 'None'], ['campus-scarf', 'Campus scarf']];
export const BACKDROPS = [['sky', 'Sky'], ['campus', 'Campus'], ['night', 'Night'], ['lime', 'Lime'], ['plain', 'Plain']];
// Faculty looks: [code, faculty (as stored on profiles), outfit, has a layer over the head, wardrobe items it hides].
// NUR has no faculty in the app yet, so no student owns it.
export const LOOKS = [
  ['fass', 'Faculty of Arts and Social Sciences', 'Field satchel', false, []],
  ['fbe', 'Faculty of Built Environment', 'Architect’s drawing tube', false, []],
  ['eng', 'Faculty of Engineering', 'Ribbed hard hat', true, ['hat']],
  ['sci', 'Faculty of Science', 'Lab goggles', true, ['eyewear']],
  ['med', 'Faculty of Medicine', 'Stethoscope', false, []],
  ['bus', 'Faculty of Business and Economics', 'Market-chart tie', false, []],
  ['law', 'Faculty of Law', 'Lady Justice blindfold', true, ['eyewear']],
  ['fsktm', 'Faculty of Computer Science and Information Technology', 'Bracket headset', true, ['hat']],
  ['edu', 'Faculty of Education', 'Open-book bow tie', false, []],
  ['den', 'Faculty of Dentistry', 'Dental loupes', true, ['eyewear']],
  ['pha', 'Faculty of Pharmacy', 'Capsule lapel', false, []],
  ['lan', 'Faculty of Languages and Linguistics', 'Speech-bubble scarf', true, ['neck']],
  ['cre', 'Faculty of Creative Arts', 'Artist’s beret', true, ['hat']],
  ['spt', 'Faculty of Sport and Exercise Sciences', 'Stopwatch ribbon', false, []],
  ['api', 'Academy of Islamic Studies', 'Manuscript sash', false, []],
  ['apm', 'Academy of Malay Studies', 'Folded tanjak', true, ['hat']],
  ['nur', '', 'V-neck scrubs', false, []],
];
export const DEFAULT_WEAR = { look: 'none', eyewear: 'none', neck: 'none', backdrop: 'sky' };
/** Until the Onzo shop is decided, a student's own faculty outfit is free and the others are not available yet. */
export const lookUnlocked = (code, faculty) => code === 'none' || LOOKS.some((l) => l[0] === code && l[1] && l[1] === faculty);
function cleanWear(w) {
  const o = { ...DEFAULT_WEAR, ...(w && typeof w === 'object' ? w : {}) };
  const inList = (v, list, d) => (list.some((x) => x[0] === v) ? v : d);
  return { look: inList(o.look, LOOKS, 'none'), eyewear: inList(o.eyewear, EYEWEAR, 'none'), neck: inList(o.neck, NECKWEAR, 'none'), backdrop: inList(o.backdrop, BACKDROPS, 'sky') };
}

export const DEFAULT_AVATAR = { onz: 'blue', hat: 'none', skin: 2, hair: 'short', hairColor: 1, outfit: 'tee', outfitColor: 0, bag: 'backpack', accent: 1, glasses: false, freckles: false, face: 'smile', bg: 0 };

const hash = (s) => [...String(s || 'kk')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
// A friendly default for people who haven't customised yet: Sir Onz in an unlocked skin, stable per account.
export function defaultFor(seed) {
  // The original four free skins only, so students who never customised keep the same Sir Onz as before.
  const h = hash(seed); const free = ONZ_SKINS.filter((s) => ['blue', 'red', 'yellow', 'green'].includes(s[0]));
  return { ...DEFAULT_AVATAR, onz: free[(h >>> 3) % free.length][0] };
}
export function randomAvatar() { return defaultFor(Math.random().toString(36)); }

// Keep only known keys and values, so a profile can't store anything else in "avatar".
export function clean(a) {
  const o = { ...DEFAULT_AVATAR, ...(a || {}) };
  const inList = (v, list, d) => (list.some((x) => x[0] === v) ? v : d);
  const idx = (v, list, d) => (Number.isInteger(v) && v >= 0 && v < list.length ? v : d);
  return { onz: inList(o.onz, ONZ_SKINS, 'blue'), hat: inList(o.hat, HATS, 'none'),
    skin: idx(o.skin, SKIN, 2), hair: inList(o.hair, HAIRS, 'short'), hairColor: idx(o.hairColor, HAIR_COLORS, 1),
    outfit: inList(o.outfit, OUTFITS, 'tee'), outfitColor: idx(o.outfitColor, OUTFIT_COLORS, 0),
    bag: inList(o.bag, BAGS, 'none'), accent: idx(o.accent, ACCENT_COLORS, 1), glasses: !!o.glasses, freckles: !!o.freckles,
    face: inList(o.face, FACES, 'smile'), bg: idx(o.bg, BG_COLORS, 0), wear: cleanWear(o.wear) };
}

const attr = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const A = 'assets/onz/';
let uid = 0;

/**
 * Sir Onz as an SVG string. Same signature as before.
 * variant 'full' (and the older 'bust'/'bag') shows the whole lion; 'head' crops to the head for small circles.
 * The Lion v2 canvas here is 200 × 280 (half the Figma 400 × 560 canvas); hats are full-canvas overlays.
 */
export function avatarSVG(raw, { variant = 'full', size = 160, bg = true, title = '' } = {}) {
  const a = clean(raw);
  const skin = ONZ_SKINS.find((s) => s[0] === a.onz) || ONZ_SKINS[0];
  return lionSVG(skin[0], skin[3], { variant, size, bg, hat: a.hat, wear: a.wear, label: title || 'Onzo avatar' });
}

// Lion v2 in any skin: the shared body of avatarSVG and the league college lions. label '' = decorative.
function lionSVG(skinId, [shellTop, shellBottom, faceTop, faceBottom], { variant = 'full', size = 160, bg = false, hat = 'none', wear = DEFAULT_WEAR, label = '', cls = '' } = {}) {
  const p = `${A}skins/${skinId}/`;
  // Layer order: tail, body, faculty outfit (under the head), head, badge (an outfit has its own embroidered plus),
  // scarf, the outfit's head piece, eyewear, hat. All overlays share the Lion v2 canvas.
  const look = LOOKS.find((l) => l[0] === wear.look); const hides = look ? look[4] : [];
  // cls tags a worn layer (onz-hat / onz-eyewear / onz-neck) so the wardrobe can animate just that piece going on.
  const full = (src, cls = '') => `<image href="${A}${src}"${cls ? ` class="${cls}"` : ''} x="0" y="0" width="200" height="280" preserveAspectRatio="none"/>`;
  const eyeArt = wear.eyewear !== 'none' && !hides.includes('eyewear') ? full(`eyewear/${wear.eyewear}.svg`, 'onz-eyewear') : '';
  const neckArt = wear.neck !== 'none' && !hides.includes('neck') ? full(`neck/${wear.neck}.svg`, 'onz-neck') : '';
  const head = variant === 'head';
  const vb = head ? '10 8 180 180' : '0 0 200 280';
  const h = head ? size : Math.round(size * 1.4);
  const id = `onz${++uid}`;
  const hatArt = hat && hat !== 'none' && !hides.includes('hat') ? full(`hats/${hat}.svg`, 'onz-hat') : '';
  const a11y = label ? `role="img" aria-label="${attr(label)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${h}" ${a11y} class="kk-avatar onz-avatar${cls ? ' ' + cls : ''}">
    <defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shellTop}"/><stop offset="1" stop-color="${shellBottom}"/></linearGradient>
      <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${faceTop}"/><stop offset="1" stop-color="${faceBottom}"/></linearGradient></defs>
    ${bg ? (head // the round picture can't show the tall stage scene without cropping and zooming it, so it shows
      // that Background's sky as a plain gradient (Figma Me 441:2458); the full lion keeps the whole scene (783:2028)
      ? `<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${(BACKDROP_SKY[wear.backdrop] || BACKDROP_SKY.sky)[0]}"/><stop offset="1" stop-color="${(BACKDROP_SKY[wear.backdrop] || BACKDROP_SKY.sky)[1]}"/></linearGradient><rect x="10" y="8" width="180" height="180" fill="url(#${id}b)"/>`
      : `<clipPath id="${id}c"><rect width="200" height="280" rx="24"/></clipPath><image href="${A}backgrounds/${attr(wear.backdrop)}.svg" width="200" height="280" preserveAspectRatio="xMidYMax slice" clip-path="url(#${id}c)"/>`) : ''}
    <image href="${p}tail.svg" x="140.5" y="184.5" width="52.5" height="45.5" preserveAspectRatio="none"/>
    <image href="${p}body.svg" x="45" y="169" width="110" height="90" preserveAspectRatio="none"/>
    ${look ? full(`looks/${look[0]}-under.svg`) : ''}
    <image href="${p}mane.svg" x="19" y="41.5" width="162" height="162" preserveAspectRatio="none"/>
    <image href="${p}ears.svg" x="43" y="53" width="114" height="33" preserveAspectRatio="xMidYMax meet"/>
    <path d="M91.3 75H108.7A58.8 58.8 0 0 1 167.5 133.8V133.8A41.2 41.2 0 0 1 126.3 175H73.7A41.2 41.2 0 0 1 32.5 133.8V133.8A58.8 58.8 0 0 1 91.3 75Z" fill="url(#${id}s)"/>
    <rect x="42.5" y="97.5" width="115" height="71" rx="35.5" fill="url(#${id}f)"/>
    <g class="onz-face">${EXPRESSIONS.calm}</g>
    <image href="${A}lion/nose.svg" x="93" y="135.5" width="14" height="9" preserveAspectRatio="none"/>
    <image href="${A}hero/smile.svg" x="90" y="150" width="20" height="10" preserveAspectRatio="none"/>
    ${look ? '' : `<image href="${p}badge.svg" x="85" y="163" width="30" height="30" preserveAspectRatio="none"/>`}
    ${neckArt}${look && look[3] ? full(`looks/${look[0]}-over.svg`) : ''}${eyeArt}${hatArt}
  </svg>`;
}

/** What the Home hero should wear, with the same rules as lionSVG (a faculty look can hide hat/eyewear/neck). */
export function heroWear(raw) {
  const a = clean(raw); const w = a.wear; const look = LOOKS.find((l) => l[0] === w.look);
  return { eyewear: w.eyewear, neck: w.neck, look: look ? look[0] : 'none', lookOver: !!(look && look[3]), hides: look ? look[4] : [] };
}

// Top and bottom stops of each Background's sky (from assets/onz/backgrounds/*.svg), for the round picture.
const BACKDROP_SKY = { sky: ['#8CC8FF', '#D8EEFF'], campus: ['#FFD27A', '#FFF1CF'], night: ['#1B1F4A', '#3B3F86'], lime: ['#E0FF3A', '#F4FFB8'], plain: ['#DDE8FA', '#F6F8FF'] };

// Each residential college's colour in the KK League (Figma "Onzo · <colour>" in 08 · Leagues · Production 696:13575).
export const COLLEGE_SKIN = { KK1: 'blue', KK2: 'red', KK3: 'orange', KK4: 'yellow', KK5: 'green', KK6: 'teal', KK7: 'purple',
  KK8: 'pink', KK9: 'midnight', KK10: 'cocoa', KK11: 'aqua', KK12: 'plum', KK13: 'slate', IHAJ: 'lime' };
// League-only colours: IHAJ shared KK1's blue, so it gets its own lime lion (recoloured from green; not a Wardrobe colour).
const LEAGUE_SKINS = [['lime', 'Lime', null, ['#A8D62E', '#CDEB7C', '#E6F4BC', '#F4FBDD']]];
/** A college's Sir Onz for the KK League. Off campus (no college) uses the standard blue lion. */
export function collegeLionSVG(code, { size = 38 } = {}) {
  const skin = [...ONZ_SKINS, ...LEAGUE_SKINS].find((s) => s[0] === COLLEGE_SKIN[code]) || ONZ_SKINS[0];
  return lionSVG(skin[0], skin[3], { size, cls: 'oz-lg-lion' });
}

export function hatUnlocked(hatId, levelName, levelNames) {
  const h = HATS.find((x) => x[0] === hatId); if (!h || !h[2]) return true;
  return levelNames.indexOf(levelName) >= levelNames.indexOf(h[2]);
}
export function skinUnlocked(skinId, levelName, levelNames) {
  const s = ONZ_SKINS.find((x) => x[0] === skinId); if (!s || !s[2]) return true;
  return levelNames.indexOf(levelName) >= levelNames.indexOf(s[2]);
}
