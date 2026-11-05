// Kampus Kita+ avatars: an original chibi character drawn as layered SVG, so it stays crisp at any size
// and is stored as a small settings map on the student's profile (users/{uid}.avatar).

export const SKIN = ['#FFE3CC', '#F7CDA8', '#EDB98A', '#DDA06F', '#C68650', '#A86B3F', '#82502E', '#5C3720'];
export const HAIR_COLORS = ['#1E1A1D', '#3B2620', '#6B4128', '#9A5B32', '#C98B4A', '#E8C17A', '#B8B8C0', '#E37BA8', '#8E6CEF', '#3F7FD9', '#2BA38C'];
export const OUTFIT_COLORS = ['#00A547', '#258DCE', '#F4A019', '#E85A5A', '#8E6CEF', '#FFCA28', '#2E3A4F', '#F2EFE6'];
export const ACCENT_COLORS = ['#E2463B', '#F4A019', '#00A547', '#258DCE', '#8E6CEF', '#F48FB1', '#4A3B33', '#FFFFFF'];
export const BG_COLORS = ['#E6F7EE', '#E3F1FB', '#FFF1D6', '#FBE4EC', '#EEE8FD', '#F1EDE4', '#DDF4F7', '#2E3A4F'];

export const HAIRS = [['short', 'Short'], ['bob', 'Bob'], ['long', 'Long'], ['bun', 'Bun'], ['curly', 'Curly'], ['spiky', 'Spiky'], ['tudung', 'Tudung']];
export const OUTFITS = [['tee', 'T-shirt'], ['hoodie', 'Hoodie'], ['overalls', 'Overalls'], ['baju', 'Baju kurung']];
// Hats marked with a level are unlocked by earning points.
export const HATS = [['none', 'No hat'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['songkok', 'Songkok'],
  ['mushroom', 'Mushroom hat', 'Regular'], ['grad', 'Graduation cap', 'Explorer'], ['crown', 'Crown', 'Campus champion']];
export const BAGS = [['none', 'No bag'], ['backpack', 'Backpack'], ['tote', 'Tote bag']];
export const FACES = [['smile', 'Smile'], ['grin', 'Grin'], ['wink', 'Wink']];

export const DEFAULT_AVATAR = { skin: 2, hair: 'short', hairColor: 1, outfit: 'tee', outfitColor: 0, hat: 'none', bag: 'backpack', accent: 1, glasses: false, freckles: false, face: 'smile', bg: 0 };

const hash = (s) => [...String(s || 'kk')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
// A friendly default for people who haven't customised yet, stable per account.
export function defaultFor(seed) {
  const h = hash(seed); const pick = (arr, k) => arr[(h >>> k) % arr.length];
  return { ...DEFAULT_AVATAR, skin: (h >>> 1) % SKIN.length, hair: pick(HAIRS.slice(0, 6), 3)[0], hairColor: (h >>> 5) % 6,
    outfit: pick(OUTFITS.slice(0, 3), 7)[0], outfitColor: (h >>> 9) % OUTFIT_COLORS.length, bg: (h >>> 11) % 7, face: pick(FACES, 13)[0] };
}
export function randomAvatar() { return defaultFor(Math.random().toString(36)); }

// Keep only known keys and values, so a profile can't store anything else in "avatar".
export function clean(a) {
  const o = { ...DEFAULT_AVATAR, ...(a || {}) };
  const inList = (v, list, d) => (list.some((x) => x[0] === v) ? v : d);
  const idx = (v, list, d) => (Number.isInteger(v) && v >= 0 && v < list.length ? v : d);
  return { skin: idx(o.skin, SKIN, 2), hair: inList(o.hair, HAIRS, 'short'), hairColor: idx(o.hairColor, HAIR_COLORS, 1),
    outfit: inList(o.outfit, OUTFITS, 'tee'), outfitColor: idx(o.outfitColor, OUTFIT_COLORS, 0), hat: inList(o.hat, HATS, 'none'),
    bag: inList(o.bag, BAGS, 'none'), accent: idx(o.accent, ACCENT_COLORS, 1), glasses: !!o.glasses, freckles: !!o.freckles,
    face: inList(o.face, FACES, 'smile'), bg: idx(o.bg, BG_COLORS, 0) };
}

// colour helpers
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); const f = (x) => Math.max(0, Math.min(255, Math.round(x + amt * 255)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
const light = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) > 200; };

// ------------------------------------------------------------------ drawing
// viewBox 0 0 200 260. Head centre (100, 84), radius 46.
function hairBack(a, c) {
  const d = shade(c, -0.08);
  switch (a.hair) {
    case 'bob': return `<path d="M50 84 C50 36 150 36 150 84 L152 128 C140 138 128 132 126 118 L74 118 C72 132 60 138 48 128 Z" fill="${d}"/>`;
    case 'long': return `<path d="M50 84 C50 34 150 34 150 84 L156 176 C140 186 124 178 122 160 L78 160 C76 178 60 186 44 176 Z" fill="${d}"/>`;
    case 'curly': return [[58, 62], [72, 46], [92, 38], [112, 38], [130, 46], [144, 62], [150, 82], [148, 102], [52, 102], [50, 82]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="17" fill="${d}"/>`).join('');
    case 'tudung': return `<path d="M100 30 C150 30 160 70 158 104 C157 130 150 150 156 176 C130 186 70 186 44 176 C50 150 43 130 42 104 C40 70 50 30 100 30 Z" fill="${d}"/>`;
    default: return '';
  }
}
function hairFront(a, c) {
  const hl = shade(c, 0.12);
  switch (a.hair) {
    case 'short': return `<path d="M53 88 C48 40 152 40 147 88 C142 70 130 58 112 58 C116 66 108 70 96 64 C84 70 66 72 53 88 Z" fill="${c}"/>
      <path d="M78 52 C90 46 108 46 120 50" stroke="${hl}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".6"/>`;
    case 'bob': return `<path d="M52 92 C46 38 154 38 148 92 C146 76 138 66 126 62 L74 62 C62 66 54 76 52 92 Z" fill="${c}"/>
      <path d="M62 66 L138 66 L140 74 C120 70 80 70 60 74 Z" fill="${c}"/>`;
    case 'long': return `<path d="M52 96 C44 38 156 38 148 96 C144 72 128 60 108 58 C102 70 80 76 64 76 C58 82 54 88 52 96 Z" fill="${c}"/>`;
    case 'bun': return `<circle cx="100" cy="34" r="17" fill="${c}"/><path d="M53 88 C48 40 152 40 147 88 C140 66 122 58 100 58 C78 58 60 66 53 88 Z" fill="${c}"/>
      <path d="M86 26 C94 20 106 20 114 26" stroke="${hl}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`;
    case 'curly': return [[66, 60], [82, 52], [100, 50], [118, 52], [134, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="${c}"/>`).join('');
    case 'spiky': return `<path d="M52 88 L56 52 L70 62 L74 36 L88 54 L98 30 L108 52 L122 34 L128 58 L144 48 L148 88 C136 70 120 62 100 62 C80 62 64 70 52 88 Z" fill="${c}"/>`;
    case 'tudung': return `<path fill-rule="evenodd" fill="${c}" d="M100 32 C148 32 156 72 154 104 C152 132 128 146 100 146 C72 146 48 132 46 104 C44 72 52 32 100 32 Z
        M100 52 C126 52 136 72 134 96 C132 118 118 128 100 128 C82 128 68 118 66 96 C64 72 74 52 100 52 Z"/>
      <path d="M58 132 C70 150 130 150 142 132 L150 168 C120 182 80 182 50 168 Z" fill="${c}"/>
      <path d="M76 56 C92 48 110 48 124 56" stroke="${hl}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`;
    default: return '';
  }
}
function hat(a) {
  const ac = ACCENT_COLORS[a.accent]; const acd = shade(ac, -0.15);
  switch (a.hat) {
    case 'cap': return `<path d="M52 72 C54 30 146 30 148 72 Z" fill="${ac}"/><path d="M96 70 C120 64 150 66 168 74 C150 80 120 80 96 76 Z" fill="${acd}"/><circle cx="100" cy="34" r="4" fill="${acd}"/>`;
    case 'beanie': return `<path d="M50 74 C50 22 150 22 150 74 Z" fill="${ac}"/><rect x="46" y="64" width="108" height="16" rx="8" fill="${acd}"/>
      <circle cx="100" cy="22" r="10" fill="${shade(ac, 0.2)}"/>${[64, 80, 96, 112, 128].map((x) => `<line x1="${x}" y1="66" x2="${x}" y2="78" stroke="${shade(ac, -0.28)}" stroke-width="2"/>`).join('')}`;
    case 'songkok': return `<path d="M58 70 L62 36 C80 30 120 30 138 36 L142 70 C120 64 80 64 58 70 Z" fill="#1F1A1C"/><path d="M62 36 C80 30 120 30 138 36 C120 40 80 40 62 36 Z" fill="#3A3236"/>`;
    case 'mushroom': return `<path d="M36 78 C36 10 164 10 164 78 C140 70 60 70 36 78 Z" fill="#E2463B"/>
      <ellipse cx="78" cy="40" rx="11" ry="8" fill="#FFF4E8"/><ellipse cx="118" cy="32" rx="9" ry="7" fill="#FFF4E8"/><ellipse cx="140" cy="58" rx="8" ry="6" fill="#FFF4E8"/><ellipse cx="58" cy="62" rx="7" ry="5" fill="#FFF4E8"/><ellipse cx="100" cy="58" rx="6" ry="4.5" fill="#FFF4E8"/>
      <path d="M44 76 C70 70 130 70 156 76" stroke="#FFF4E8" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    case 'grad': return `<path d="M50 50 L100 30 L150 50 L100 70 Z" fill="#1F2430"/><path d="M68 58 L68 72 C80 80 120 80 132 72 L132 58 L100 70 Z" fill="#2C3242"/>
      <path d="M100 50 L140 58 L140 82" stroke="#F4C531" stroke-width="2.5" fill="none"/><circle cx="140" cy="84" r="4" fill="#F4C531"/>`;
    case 'crown': return `<path d="M62 64 L66 30 L84 48 L100 22 L116 48 L134 30 L138 64 Z" fill="#F4C531" stroke="#D9A514" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="100" cy="46" r="5" fill="#E2463B"/><circle cx="76" cy="54" r="3.5" fill="#258DCE"/><circle cx="124" cy="54" r="3.5" fill="#00A547"/>`;
    default: return '';
  }
}
function face(a) {
  const eye = '#2A1D18';
  const eyes = a.face === 'wink'
    ? `<path d="M76 92 Q82 86 88 92" stroke="${eye}" stroke-width="3.5" fill="none" stroke-linecap="round"/><ellipse cx="118" cy="91" rx="5.2" ry="6.6" fill="${eye}"/><circle cx="120" cy="88.5" r="1.8" fill="#fff"/>`
    : `<ellipse cx="82" cy="91" rx="5.2" ry="6.6" fill="${eye}"/><ellipse cx="118" cy="91" rx="5.2" ry="6.6" fill="${eye}"/><circle cx="84" cy="88.5" r="1.8" fill="#fff"/><circle cx="120" cy="88.5" r="1.8" fill="#fff"/>`;
  const mouth = a.face === 'grin'
    ? '<path d="M90 106 Q100 120 110 106 Z" fill="#7A2E2A"/><path d="M93 108 Q100 112 107 108" stroke="#fff" stroke-width="2" fill="none"/>'
    : '<path d="M92 107 Q100 114 108 107" stroke="#7A2E2A" stroke-width="3" fill="none" stroke-linecap="round"/>';
  const freckles = a.freckles ? [[72, 101], [77, 104], [80, 99], [120, 99], [123, 104], [128, 101]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="${shade(SKIN[a.skin], -0.3)}"/>`).join('') : '';
  const glasses = a.glasses ? '<g fill="none" stroke="#2A2A33" stroke-width="2.6"><circle cx="82" cy="92" r="11"/><circle cx="118" cy="92" r="11"/><path d="M93 92 Q100 88 107 92"/></g>' : '';
  return `${eyes}<ellipse cx="72" cy="104" rx="7" ry="4.5" fill="#F28C8C" opacity=".45"/><ellipse cx="128" cy="104" rx="7" ry="4.5" fill="#F28C8C" opacity=".45"/>${freckles}${mouth}${glasses}`;
}
function body(a) {
  const c = OUTFIT_COLORS[a.outfit === 'overalls' ? 7 : a.outfitColor]; const cd = shade(c, -0.12);
  const skin = SKIN[a.skin];
  const pants = a.outfit === 'overalls' ? OUTFIT_COLORS[a.outfitColor] : a.outfit === 'baju' ? shade(OUTFIT_COLORS[a.outfitColor], -0.25) : '#3D5A80';
  const longSleeve = a.outfit === 'hoodie' || a.outfit === 'baju';
  const sleeve = longSleeve ? c : cd;
  const torsoBottom = a.outfit === 'baju' ? 214 : 200;
  let out = '';
  // legs and shoes
  out += `<rect x="80" y="196" width="17" height="42" rx="7" fill="${pants}"/><rect x="103" y="196" width="17" height="42" rx="7" fill="${pants}"/>
    <ellipse cx="88" cy="241" rx="13" ry="7" fill="#2B2B33"/><ellipse cx="112" cy="241" rx="13" ry="7" fill="#2B2B33"/>
    <rect x="76" y="241" width="24" height="4" rx="2" fill="#F4F4F4"/><rect x="100" y="241" width="24" height="4" rx="2" fill="#F4F4F4"/>`;
  // arms (behind torso edges)
  out += `<rect x="48" y="138" width="16" height="${longSleeve ? 58 : 30}" rx="8" fill="${sleeve}"/><rect x="136" y="138" width="16" height="${longSleeve ? 58 : 30}" rx="8" fill="${sleeve}"/>`;
  if (!longSleeve) out += `<rect x="49" y="162" width="14" height="32" rx="7" fill="${skin}"/><rect x="137" y="162" width="14" height="32" rx="7" fill="${skin}"/>`;
  out += `<circle cx="56" cy="198" r="8" fill="${skin}"/><circle cx="144" cy="198" r="8" fill="${skin}"/>`;
  // torso
  out += `<path d="M62 146 C62 134 74 128 100 128 C126 128 138 134 138 146 L138 ${torsoBottom - 10} C138 ${torsoBottom - 4} 132 ${torsoBottom} 126 ${torsoBottom} L74 ${torsoBottom} C68 ${torsoBottom} 62 ${torsoBottom - 4} 62 ${torsoBottom - 10} Z" fill="${c}"/>`;
  if (a.outfit === 'tee') out += `<path d="M88 130 Q100 140 112 130" stroke="${cd}" stroke-width="3" fill="none"/><circle cx="100" cy="168" r="9" fill="${shade(c, 0.18)}"/><path d="M96 168 L100 172 L106 164" stroke="${cd}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  if (a.outfit === 'hoodie') out += `<path d="M78 130 C80 146 120 146 122 130 C116 124 84 124 78 130 Z" fill="${cd}"/><line x1="94" y1="140" x2="93" y2="158" stroke="#fff" stroke-width="2"/><line x1="106" y1="140" x2="107" y2="158" stroke="#fff" stroke-width="2"/>
    <path d="M78 176 L122 176 L118 194 L82 194 Z" fill="${cd}"/>`;
  if (a.outfit === 'overalls') {
    const o = OUTFIT_COLORS[a.outfitColor]; const od = shade(o, -0.12);
    out += `<path d="M72 160 L128 160 L130 200 L70 200 Z" fill="${o}"/><rect x="80" y="150" width="40" height="22" rx="4" fill="${o}"/>
      <rect x="74" y="130" width="7" height="34" rx="3" fill="${od}"/><rect x="119" y="130" width="7" height="34" rx="3" fill="${od}"/>
      <circle cx="84" cy="158" r="3" fill="#F4C531"/><circle cx="116" cy="158" r="3" fill="#F4C531"/><path d="M92 160 Q100 168 108 160" stroke="${od}" stroke-width="2" fill="none"/>`;
  }
  if (a.outfit === 'baju') out += `<path d="M90 130 L100 146 L110 130" stroke="${cd}" stroke-width="3" fill="none"/><circle cx="100" cy="156" r="2.4" fill="${cd}"/><circle cx="100" cy="166" r="2.4" fill="${cd}"/>
    <path d="M64 200 L136 200" stroke="${cd}" stroke-width="3"/>${[76, 92, 108, 124].map((x) => `<circle cx="${x}" cy="188" r="3" fill="${shade(c, 0.2)}"/>`).join('')}`;
  return out;
}
function bagBack(a) {
  if (a.bag !== 'backpack') return '';
  const ac = ACCENT_COLORS[a.accent];
  return `<rect x="54" y="132" width="92" height="66" rx="18" fill="${shade(ac, -0.1)}"/>`;
}
function bagFront(a) {
  const ac = ACCENT_COLORS[a.accent]; const acd = shade(ac, -0.18);
  if (a.bag === 'backpack') return `<path d="M72 132 L76 190" stroke="${acd}" stroke-width="7" stroke-linecap="round"/><path d="M128 132 L124 190" stroke="${acd}" stroke-width="7" stroke-linecap="round"/>
    <rect x="71" y="160" width="10" height="6" rx="2" fill="${light(ac) ? '#999' : '#fff'}" opacity=".7"/><rect x="119" y="160" width="10" height="6" rx="2" fill="${light(ac) ? '#999' : '#fff'}" opacity=".7"/>`;
  if (a.bag === 'tote') return `<path d="M128 132 L150 178" stroke="${acd}" stroke-width="4"/><path d="M140 176 L170 176 L166 214 L144 214 Z" fill="${ac}" stroke="${acd}" stroke-width="2"/>
    <path d="M150 190 Q155 196 160 190" stroke="${acd}" stroke-width="2.5" fill="none"/>`;
  return '';
}

// Returns an SVG string. variant 'full' shows the whole character; 'head' crops to the face (for small circles).
export function avatarSVG(raw, { variant = 'full', size = 160, bg = true, title = '' } = {}) {
  const a = clean(raw);
  const skin = SKIN[a.skin]; const skinD = shade(skin, -0.08);
  const hc = HAIR_COLORS[a.hairColor];
  const vb = variant === 'head' ? '38 14 124 124' : '0 0 200 260';
  const h = variant === 'head' ? size : Math.round(size * 1.3);
  const tud = a.hair === 'tudung';
  const hatSvg = tud && !['crown', 'grad'].includes(a.hat) ? '' : hat(a);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${h}" role="img" aria-label="${title || 'Avatar'}" class="kk-avatar">
    ${bg ? `<rect x="-20" y="-20" width="240" height="300" fill="${BG_COLORS[a.bg]}"/>` : ''}
    ${bagBack(a)}${hairBack(a, hc)}
    ${body(a)}
    <rect x="90" y="120" width="20" height="16" rx="6" fill="${skinD}"/>
    ${tud ? '' : `<circle cx="54" cy="92" r="9" fill="${skinD}"/><circle cx="146" cy="92" r="9" fill="${skinD}"/>`}
    <circle cx="100" cy="88" r="44" fill="${skin}"/>
    ${face(a)}
    ${hairFront(a, hc)}${hatSvg}${bagFront(a)}
  </svg>`;
}

export function hatUnlocked(hatId, levelName, levelNames) {
  const h = HATS.find((x) => x[0] === hatId); if (!h || !h[2]) return true;
  return levelNames.indexOf(levelName) >= levelNames.indexOf(h[2]);
}
