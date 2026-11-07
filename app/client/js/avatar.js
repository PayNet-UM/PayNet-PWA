// Kampus Kita+ avatars: an original chibi character drawn as layered SVG, so it stays crisp at any size
// and is stored as a small settings map on the student's profile (users/{uid}.avatar).

export const SKIN = ['#FFE3CC', '#F7CDA8', '#EDB98A', '#DDA06F', '#C68650', '#A86B3F', '#82502E', '#5C3720'];
export const HAIR_COLORS = ['#1E1A1D', '#3B2620', '#6B4128', '#9A5B32', '#C98B4A', '#E8C17A', '#B8B8C0', '#E37BA8', '#8E6CEF', '#3F7FD9', '#2BA38C'];
export const OUTFIT_COLORS = ['#00A547', '#258DCE', '#F4A019', '#E85A5A', '#8E6CEF', '#FFCA28', '#2E3A4F', '#F2EFE6'];
export const ACCENT_COLORS = ['#E2463B', '#F4A019', '#00A547', '#258DCE', '#8E6CEF', '#F48FB1', '#4A3B33', '#FFFFFF'];
export const BG_COLORS = ['#E6F7EE', '#E3F1FB', '#FFF1D6', '#FBE4EC', '#EEE8FD', '#F1EDE4', '#DDF4F7', '#2E3A4F'];

export const HAIRS = [['short', 'Short'], ['bob', 'Bob'], ['long', 'Long'], ['bun', 'Bun'], ['curly', 'Curly'], ['spiky', 'Spiky'], ['tudung', 'Tudung'], ['bawal', 'Bawal'], ['shawl', 'Shawl']];
export const isTudung = (hair) => ['tudung', 'bawal', 'shawl'].includes(hair);
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

// ------------------------------------------------------------------ drawing
// viewBox 0 0 200 260. Head centre (100, 84), radius 46.
function hairBack(a, c) {
  const shadow = shade(c, -0.1);
  switch (a.hair) {
    case 'bob': return `<path d="M49 85C45 54 66 35 99 35c32 0 54 20 52 50l4 42q-14 17-35 9l-20-10-20 10q-21 8-35-9Z" fill="${shadow}"/>`;
    case 'long': return `<path d="M48 89C46 52 67 34 101 34c36 0 54 24 52 54-2 28 4 53 11 80q-9 15-27 15l-14-5-23-36-24 37q-24 11-40-9c8-24 13-50 12-81Z" fill="${shadow}"/>`;
    case 'bun': return `<path d="M82 42c-9-10-5-26 7-30 11-6 27 0 29 10 4 11-3 20-11 24Z" fill="${shadow}"/>`;
    default: return '';
  }
}
function hairFront(a, c) {
  const highlight = shade(c, 0.17);
  const shadow = shade(c, -0.12);
  const detail = (path, color = highlight) => `<path d="${path}" stroke="${color}" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".65"/>`;
  switch (a.hair) {
    case 'short': return `<path d="M51 94C45 83 47 66 54 55c8-13 22-20 38-21 21-2 39 4 50 17 10 12 13 28 7 43l-7-15q-7-5-12-20c-17 12-38 18-65 16q-5 11-14 19Z" fill="${c}"/>`
      + detail('M65 57q19-17 48-15M70 66q26 0 47-14');
    case 'bob': return `<path d="M50 110C42 86 46 59 60 46c16-16 43-19 63-11 22 8 32 30 29 56l-1 21-9 13-2-34q-2-13-8-22l-16 4-2-8-10 8-20 1-4-7-12 7-7 2-1 48Z" fill="${c}"/>`
      + detail('M63 58q14-17 40-17M136 53q10 12 10 32');
    case 'long': return `<path d="M49 100C39 73 53 44 77 35c12-5 25-4 33 0 21-3 41 13 44 39 3 22-8 46-4 71q-8-1-13-10c-7-14 3-42 0-58-16-3-27-15-32-28-6 15-21 26-42 32-3 17 5 32-2 51q-7 11-15 12c6-20 8-29 3-44Z" fill="${c}"/>`
      + detail('M58 68q25-7 36-26M117 44q9 17 23 22');
    case 'bun': return `<path d="M52 93C47 76 50 56 64 45q16-15 37-12c27-1 46 16 48 43q1 11-3 18c-7-14-11-25-17-35-13 15-40 20-67 18q-4 10-10 16Z" fill="${c}"/>`
      + detail('M86 22q12-10 24 0M65 62q28 2 49-17');
    case 'curly': return `<path d="M52 97q-11-3-9-15-8-9 1-18-4-12 8-17 0-12 13-13 5-12 19-10 10-9 22-4 12-5 22 5 13-1 18 11 13 2 13 15 10 7 5 18 6 10-2 19 1 12-12 13l-8-18q-13 1-18-10-14 9-24-2-12 10-23 0-7 10-17 8Z" fill="${c}"/>`
      + detail('M57 58q-1-7 7-9 6-1 7 4M81 43q4-10 13-6m10 12q3-10 13-6 6 3 2 8m12 6q7-6 13 1');
    case 'spiky': return `<path d="M52 94q-9-20 0-37l-4-13 17 5 1-17 16 8 9-16 12 13 17-11 4 17 19-4-3 15 14 3q7 18-5 37l-8-17-11-11-13 7 1-11-21 10 1-10-22 14-3-8q-12 9-21 26Z" fill="${c}"/>`
      + detail('m65 56 14-10m10 9 14-10m9 9 15-5');
    case 'bawal':
      return `<path fill="${c}" fill-rule="evenodd" d="M100 29Q108 34 122 38C146 47 152 65 149 95c-2 20 2 34 15 51l-64 36-64-36c13-17 17-31 15-51-3-30 3-48 27-57Q92 34 100 29Z
        M100 49c-22 0-35 14-36 36-2 19 8 34 24 41l12 4 12-4c16-7 26-22 24-41-1-22-14-36-36-36Z"/>
        <path fill="${shadow}" opacity=".6" d="M48 145q30 4 52-12 22 16 52 12l-52 32Z"/>`
        + detail('M59 142q22 10 41 27 19-17 41-27M70 56q12-13 30-15');
    case 'shawl':
      return `<path fill="${c}" fill-rule="evenodd" d="M100 34c30-4 49 16 49 44 0 18-3 34 6 53l12 27-30 42-29-17 4-26c-24 7-46 6-68-5 12-20 14-37 10-58-5-33 10-58 46-60Z
        M100 49c-22 0-35 14-36 36-2 19 8 34 24 41l12 4 12-4c16-7 26-22 24-41-1-22-14-36-36-36Z"/>
        <path fill="${shadow}" d="M58 145q36 12 81-19l10 10q-15 15-37 21-34 10-58-4Z"/>`
        + detail('M68 55q25-21 55-9M61 145q35 10 77-19M138 149q-2 20-15 35');
    case 'tudung':
      return `<path fill-rule="evenodd" fill="${c}" d="M100 32c31-1 49 19 49 50 0 23-4 37 12 54l11 12c-13 10-28 11-41 10-15 11-36 18-57 18-5-12-19-18-38-24 15-14 23-30 21-54-3-37 8-65 43-66Z
          M100 49c-22 0-35 14-36 36-2 19 8 34 24 41l12 4 12-4c16-7 26-22 24-41-1-22-14-36-36-36Z"/>
        <path d="M62 117q10 20 38 23c-10 9-26 13-42 11m72-37q-10 24-32 34c17 2 35 0 50-9" fill="none" stroke="${shadow}" stroke-width="3" stroke-linecap="round"/>`
        + detail('M73 53q12-13 30-13m30 18q9 10 9 25M70 157q20 10 45 2');
    default: return '';
  }
}
function hat(a) {
  const ac = ACCENT_COLORS[a.accent]; const acd = shade(ac, -0.15);
  switch (a.hat) {
    case 'cap': return `<path d="M51 70c0-24 18-39 47-40 30 0 49 15 51 37l-6 11q-49-7-92-2Z" fill="${ac}" stroke="${acd}" stroke-width="2"/>
      <path d="M98 32q-23 10-26 39m27-39q25 8 32 35M55 69q47-10 89-4" fill="none" stroke="${acd}" stroke-width="1.6"/>
      <path d="M95 71q32-11 53-7l22 9q4 4-3 7-30 9-72-3Z" fill="${acd}"/>
      <path d="M111 73q25-6 45 0" fill="none" stroke="${shade(ac, 0.16)}" stroke-width="1.6"/>
      <rect x="88" y="48" width="17" height="9" rx="2" fill="${shade(ac, 0.24)}"/>`;
    case 'beanie': return `<path d="M50 70C50 43 68 22 100 22s50 21 50 48Z" fill="${ac}" stroke="${acd}" stroke-width="2"/>
      <path d="M67 65q1-23 17-34m4 34q0-25 9-36m11 36q0-25-6-36m28 36q-2-23-17-34" fill="none" stroke="${acd}" stroke-width="2" opacity=".6"/>
      <path d="M50 63q50-8 100 0l-1 15q-49-5-98 0Z" fill="${acd}"/>
      ${[61, 74, 87, 100, 113, 126, 139].map((x) => `<path d="M${x} 65v9" stroke="${ac}" stroke-width="2" stroke-linecap="round"/>`).join('')}`;
    case 'songkok': return `<path d="M57 71l5-34q38-12 76 0l5 34q-43-7-86 0Z" fill="#211d24"/>
      <path d="M62 37q38-12 76 0-38 9-76 0Z" fill="#48404a"/>
      <path d="M70 42l-3 22m63-22 3 22M61 66q39-7 78 0" fill="none" stroke="#625764" stroke-width="1.4" opacity=".65"/>`;
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
  if (a.outfit === 'baju') {
    out += `<path d="M73 192h54l7 42q-34 6-68 0Z" fill="${pants}"/>
      <path d="M103 210l-7 26m-22-6q26 5 52 0" fill="none" stroke="${shade(pants, 0.13)}" stroke-width="1.5"/>`;
  }
  // arms (behind torso edges)
  out += `<rect x="48" y="138" width="16" height="${longSleeve ? 58 : 30}" rx="8" fill="${sleeve}"/><rect x="136" y="138" width="16" height="${longSleeve ? 58 : 30}" rx="8" fill="${sleeve}"/>`;
  if (!longSleeve) out += `<rect x="49" y="162" width="14" height="32" rx="7" fill="${skin}"/><rect x="137" y="162" width="14" height="32" rx="7" fill="${skin}"/>`;
  out += `<circle cx="56" cy="198" r="8" fill="${skin}"/><circle cx="144" cy="198" r="8" fill="${skin}"/>`;
  // torso
  out += `<path d="M62 146 C62 134 74 128 100 128 C126 128 138 134 138 146 L138 ${torsoBottom - 10} C138 ${torsoBottom - 4} 132 ${torsoBottom} 126 ${torsoBottom} L74 ${torsoBottom} C68 ${torsoBottom} 62 ${torsoBottom - 4} 62 ${torsoBottom - 10} Z" fill="${c}"/>`;
  if (a.outfit === 'tee') out += `<path d="M85 130Q100 146 115 130M51 164h12m74 0h12M69 193q31 4 62 0" stroke="${cd}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M111 151h13v10q-6 5-13 0Z" fill="${shade(c, -0.05)}" stroke="${cd}" stroke-width="1.5"/>`;
  if (a.outfit === 'hoodie') out += `<path d="M76 131q24 30 48 0-7-7-24-6-17-1-24 6Z" fill="${cd}"/>
    <path d="M85 171h30l8 15q-23 6-46 0Z" fill="${shade(c, -0.06)}" stroke="${cd}" stroke-width="1.5"/>
    <path d="M51 189h11m76 0h11m-82 3q33 5 66 0" stroke="${cd}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  if (a.outfit === 'overalls') {
    const denim = OUTFIT_COLORS[a.outfitColor];
    const seam = shade(denim, -0.16);
    out += `<path d="M74 133l9-3 8 21h18l8-21 9 3-7 21 4 15 9 19-9 13H77l-9-13 9-19 4-15Z" fill="${denim}" stroke="${seam}" stroke-width="1.5"/>
      <circle cx="84" cy="154" r="2.7" fill="#e8b960"/><circle cx="116" cy="154" r="2.7" fill="#e8b960"/>
      <path d="M91 164h18v8q-9 6-18 0Zm-16 18 11-4m39 4-11-4" fill="none" stroke="${seam}" stroke-width="1.5"/>`;
  }
  if (a.outfit === 'baju') out += `<path d="M88 129q12 13 24 0m-12 9v15m-34 53q34 4 68 0M50 189h12m76 0h12" stroke="${cd}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="100" cy="147" r="2.4" fill="${cd}"/>`;
  return out;
}
function bagBack(a) {
  if (a.bag !== 'backpack') return '';
  const ac = ACCENT_COLORS[a.accent];
  const seam = shade(ac, -0.22);
  return `<path d="M128 140q0-12 9-12 8 0 8 12" fill="none" stroke="${seam}" stroke-width="4"/>
    <path d="M127 141q14-8 25 0 11 9 12 28l2 21q-1 10-13 13l-28-1Z" fill="${ac}" stroke="${seam}" stroke-width="2"/>
    <path d="M143 143q13 6 14 28m-10 3q8-3 15 0l2 14q-1 7-14 8Z" fill="${shade(ac, -0.07)}" stroke="${seam}" stroke-width="1.6"/>
    <path d="M151 175l9-1m-2 0v5" stroke="${shade(ac, 0.24)}" stroke-width="1.8" stroke-linecap="round"/>`;
}
function bagFront(a) {
  if (a.bag !== 'tote') return '';
  const ac = ACCENT_COLORS[a.accent];
  const seam = shade(ac, -0.18);
  return `<path d="M133 135q11 16 18 44m-13-44q15 15 23 44" fill="none" stroke="${seam}" stroke-width="3" stroke-linecap="round"/>
    <path d="M141 174q15 3 31 0l-3 35q-1 6-6 7h-15q-5-1-6-6Z" fill="${ac}" stroke="${seam}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M143 181q14 3 27 0m-23 4 1 23q0 3 4 4h11" fill="none" stroke="${seam}" stroke-width="1.4" stroke-dasharray="2 2"/>
    <rect x="151" y="189" width="11" height="7" rx="2" fill="${shade(ac, 0.24)}"/>`;
}

const attr = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Returns an SVG string. variant 'full' shows the whole character; 'head' crops to the face (for small circles).
export function avatarSVG(raw, { variant = 'full', size = 160, bg = true, title = '' } = {}) {
  const a = clean(raw);
  const skin = SKIN[a.skin]; const skinD = shade(skin, -0.08);
  const hc = HAIR_COLORS[a.hairColor];
  const vb = variant === 'head' ? '38 14 124 124' : variant === 'bust' ? '4 18 192 192' : variant === 'bag' ? '40 117 140 140' : '0 0 200 260';
  const h = variant === 'full' ? Math.round(size * 1.3) : size;
  const tud = isTudung(a.hair);
  const hatSvg = tud && !['crown', 'grad'].includes(a.hat) ? '' : hat(a);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${h}" role="img" aria-label="${attr(title || 'Avatar')}" class="kk-avatar">
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
