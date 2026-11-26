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
export const HATS = [['none', 'No hat'], ['beanie', 'Beanie'], ['cap', 'Cap'], ['songkok', 'Songkok'],
  ['mushroom', 'Barista cap', 'Regular'], ['grad', 'Explorer hat', 'Explorer'], ['crown', 'Crown', 'Campus champion']];

// Skins (Figma "08 · Skins" 437:4297, wardrobe colours 696:13693). Skins that Figma unlocks through purchases,
// FESKUM or league wins are not offered: production has no way to grant them.
export const ONZ_SKINS = [
  ['blue', 'Blue', null, ['#4DA1F8', '#8CBEFB', '#BBD0F5', '#DDE8FA']],
  ['red', 'Red', null, ['#FF7A6B', '#FFB0A6', '#FFD3CC', '#FFE9E5']],
  ['orange', 'Orange', 'Regular', ['#FFA35C', '#FFC896', '#FFE0C7', '#FFF0E3']],
  ['yellow', 'Yellow', null, ['#FFD95C', '#FFE896', '#FFF0BF', '#FFF8E0']],
  ['green', 'Green', null, ['#5ED493', '#9BE6BB', '#CDEFDB', '#E8F8EE']],
  ['teal', 'Teal', 'Explorer', ['#5FD3DA', '#9CE6EA', '#CBEFF1', '#E6F8F9']],
];

export const DEFAULT_AVATAR = { onz: 'blue', hat: 'none', skin: 2, hair: 'short', hairColor: 1, outfit: 'tee', outfitColor: 0, bag: 'backpack', accent: 1, glasses: false, freckles: false, face: 'smile', bg: 0 };

const hash = (s) => [...String(s || 'kk')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
// A friendly default for people who haven't customised yet: Sir Onz in an unlocked skin, stable per account.
export function defaultFor(seed) {
  const h = hash(seed); const free = ONZ_SKINS.filter((s) => !s[2]);
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
    face: inList(o.face, FACES, 'smile'), bg: idx(o.bg, BG_COLORS, 0) };
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
  const [shellTop, shellBottom, faceTop, faceBottom] = skin[3];
  const p = `${A}skins/${skin[0]}/`;
  const head = variant === 'head';
  const vb = head ? '10 8 180 180' : '0 0 200 280';
  const h = head ? size : Math.round(size * 1.4);
  const id = `onz${++uid}`;
  const hat = a.hat !== 'none' ? `<image href="${A}hats/${a.hat}.svg" x="0" y="0" width="200" height="280" preserveAspectRatio="none"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${h}" role="img" aria-label="${attr(title || 'Sir Onz avatar')}" class="kk-avatar onz-avatar">
    <defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shellTop}"/><stop offset="1" stop-color="${shellBottom}"/></linearGradient>
      <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${faceTop}"/><stop offset="1" stop-color="${faceBottom}"/></linearGradient></defs>
    ${bg ? (head ? `<rect x="10" y="8" width="180" height="180" fill="var(--oz-blue-100, #DDE8FA)"/>` : `<rect width="200" height="280" rx="24" fill="var(--oz-blue-100, #DDE8FA)"/>`) : ''}
    <image href="${p}tail.svg" x="140.5" y="184.5" width="52.5" height="45.5" preserveAspectRatio="none"/>
    <image href="${p}body.svg" x="45" y="169" width="110" height="90" preserveAspectRatio="none"/>
    <image href="${p}mane.svg" x="19" y="41.5" width="162" height="162" preserveAspectRatio="none"/>
    <image href="${p}ears.svg" x="43" y="53" width="114" height="33" preserveAspectRatio="none"/>
    <path d="M91.3 75H108.7A58.8 58.8 0 0 1 167.5 133.8V133.8A41.2 41.2 0 0 1 126.3 175H73.7A41.2 41.2 0 0 1 32.5 133.8V133.8A58.8 58.8 0 0 1 91.3 75Z" fill="url(#${id}s)"/>
    <rect x="42.5" y="97.5" width="115" height="71" rx="35.5" fill="url(#${id}f)"/>
    <rect x="71" y="113" width="11" height="19" rx="5.5" fill="#1A1A1A"/><rect x="118" y="113" width="11" height="19" rx="5.5" fill="#1A1A1A"/>
    <image href="${A}lion/nose.svg" x="93" y="135.5" width="14" height="9" preserveAspectRatio="none"/>
    <image href="${A}hero/smile.svg" x="90" y="150" width="20" height="10" preserveAspectRatio="none"/>
    <image href="${p}badge.svg" x="85" y="163" width="30" height="30" preserveAspectRatio="none"/>
    ${hat}
  </svg>`;
}

export function hatUnlocked(hatId, levelName, levelNames) {
  const h = HATS.find((x) => x[0] === hatId); if (!h || !h[2]) return true;
  return levelNames.indexOf(levelName) >= levelNames.indexOf(h[2]);
}
export function skinUnlocked(skinId, levelName, levelNames) {
  const s = ONZ_SKINS.find((x) => x[0] === skinId); if (!s || !s[2]) return true;
  return levelNames.indexOf(levelName) >= levelNames.indexOf(s[2]);
}
