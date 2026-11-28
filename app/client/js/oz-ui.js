// +Onz redesign components (Figma page "UI Design System" 430:50) as small HTML-string helpers.
// Every helper escapes the text it is given; pass trusted HTML only through the `*Html` options.
import { esc } from './ui.js';
import { ozIcon } from './oz-icons.js';

const A = 'assets/onz/';
const attrs = (o = {}) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(String(v))}"`)).join('');

/** Button (431:75). kind: primary | secondary | ghost | destructive; size: md | sm. Renders <a> when href is given. */
export function ozButton(label, { kind = 'primary', size = 'md', href, iconName, block = false, cls = '', attr = {} } = {}) {
  const c = `oz-btn oz-btn-${kind} oz-btn-${size}${block ? ' oz-btn-block' : ''}${cls ? ' ' + cls : ''}`;
  const inner = `${iconName ? ozIcon(iconName) : ''}<span>${esc(label)}</span>`;
  return href ? `<a class="${c}" href="${esc(href)}"${attrs(attr)}>${inner}</a>` : `<button type="button" class="${c}"${attrs(attr)}>${inner}</button>`;
}

/** Tag (431:100). tone: lilac | mint | sky | peach | points | expiry */
export const ozTag = (label, tone = 'lilac', cls = '') => `<span class="oz-tag oz-tag-${tone}${cls ? ' ' + cls : ''}">${esc(label)}</span>`;

/** Points Pill (431:83). The number is bound live through data-bind="points". */
export const ozPointsPill = (points, { href = '#/me/history', bind = true } = {}) => // web header "Open points history" (1223:70968)
  `<a class="oz-pill pts-chip" href="${esc(href)}" aria-label="Your points"><span class="oz-plus" aria-hidden="true"></span><span${bind ? ' data-bind="points"' : ''}>${Number(points || 0).toLocaleString()}</span></a>`;

/** Segmented Control (464:6226). items: [{ key, label }]. Buttons carry data-seg="key". */
export function ozSegmented(items, selected, { label = '', cls = '' } = {}) {
  return `<div class="oz-seg${cls ? ' ' + cls : ''}" role="tablist"${label ? ` aria-label="${esc(label)}"` : ''}>${items.map((it) =>
    `<button type="button" role="tab" class="oz-seg-item" data-seg="${esc(it.key)}" aria-selected="${it.key === selected}">${esc(it.label)}</button>`).join('')}</div>`;
}

/** List Row (431:139). Pass href for a link row; trailing chevron unless chevron:false. */
export function ozListRow({ title, sub = '', iconName = '', leadHtml = '', href, trailHtml = '', chevron = true, cls = '', attr = {} }) {
  const lead = leadHtml || (iconName ? `<span class="oz-row-lead">${ozIcon(iconName)}</span>` : '');
  const body = `${lead}<span class="oz-row-text"><span class="oz-row-title">${esc(title)}</span>${sub ? `<span class="oz-row-sub">${esc(sub)}</span>` : ''}</span>${trailHtml}${chevron ? ozIcon('s:chevron-right', 'oz-row-chev') : ''}`;
  const c = `${cls ? cls + ' ' : ''}oz-row`;
  return href ? `<a class="${c}" href="${esc(href)}"${attrs(attr)}>${body}</a>` : `<div class="${c}"${attrs(attr)}>${body}</div>`;
}

/** Live Deal Card (754:6209). footerHtml is trusted directory navigation. */
export function ozLiveDealCard({ deal, merchant, status, points, minutesLeft, hhmm, claimHref, claimLabel = 'Claim', primary = true, footerHtml = '' }) {
  const live = status === 'Available', claimed = status === 'Claimed today', busy = status === 'Busy right now';
  const tone = claimed ? 'is-claimed' : busy ? 'is-busy' : 'is-later';
  const pill = live ? '' : `<span class="oz-deal-pill ${tone}">${esc(status)}</span>`;
  const pointsLabel = Number(points) > 0 ? `+${Number(points)} pts` : '';
  const note = live ? `Ends in ${minutesLeft} min`
    : claimed ? (pointsLabel ? `${pointsLabel} added · back tomorrow` : 'Back tomorrow')
    : busy ? 'Shop is full. Try again soon.'
    : status.startsWith('Opens ') ? `Off-peak deal · ${hhmm(deal.startMin)}–${hhmm(deal.endMin)}` : '';
  return `<article class="oz-deal${live ? ' is-live' : ''}">
    <div class="oz-deal-top"><span class="oz-deal-badge" aria-hidden="true">${ozIcon('stall')}</span>
      <div class="oz-deal-text" data-no-i18n><p class="oz-deal-shop">${esc(merchant.name)}</p><h3 class="oz-deal-title">${esc(deal.title)}</h3></div>${pill}</div>
    ${note ? `<div class="oz-deal-bottom">${ozIcon('clock', 'oz-deal-clock')}<p class="oz-deal-note">${esc(note)}</p>
      ${claimHref ? `<span class="oz-deal-points">${esc(pointsLabel)}</span>${ozButton(claimLabel, { href: claimHref, size: 'sm', kind: primary ? 'primary' : 'secondary' })}` : ''}</div>` : ''}
    ${footerHtml ? `<div class="oz-deal-links">${footerHtml}</div>` : ''}
  </article>`;
}

/** Sir Onz, front view (Lion v2 22:1166, calm). Built from the Figma layers; scales with --oz-lion-w. */
export function ozLion({ cls = '', label = '' } = {}) {
  return `<span class="oz-lion${cls ? ' ' + cls : ''}"${label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"'}>
    <img class="l-tail" src="${A}lion/tail.svg" alt=""><img class="l-body" src="${A}lion/body.svg" alt="">
    <img class="l-mane" src="${A}lion/mane.svg" alt=""><img class="l-ears" src="${A}lion/ears.svg" alt="">
    <i class="l-shell"></i><i class="l-face"></i><img class="l-nose" src="${A}lion/nose.svg" alt="">
    <i class="l-eye l-eye-l"></i><i class="l-eye l-eye-r"></i><img class="l-badge" src="${A}lion/plus-badge.svg" alt=""></span>`;
}

/** Empty State (431:198). actionHtml is an optional trusted button. */
export const ozEmpty = ({ title, body = '', actionHtml = '', mascot = true, cls = '' }) =>
  `<div class="oz-empty${cls ? ' ' + cls : ''}">${mascot ? ozLion() : ''}<h3 class="oz-empty-title">${esc(title)}</h3>${body ? `<p class="oz-empty-body">${esc(body)}</p>` : ''}${actionHtml}</div>`;

/** Section header: H2 with an optional "See all →" link. */
export const ozSectionHead = (title, { href, linkLabel, id } = {}) =>
  `<div class="oz-section-head"><h2${id ? ` id="${esc(id)}"` : ''}>${esc(title)}</h2>${href ? `<a class="oz-link" href="${esc(href)}">${esc(linkLabel)} <span aria-hidden="true">→</span></a>` : ''}</div>`;

/** Sir Onz waving with his tail (Tail Wave 422:50) inside the halo, as used by the Points Hero (433:115).
 *  skin = [id, [shellTop, shellBottom, faceTop, faceBottom]] from avatar.js ONZ_SKINS, so the hero wears the saved colour. */
// wear = { eyewear, neck, look, lookOver, hides } (from avatar.js). The hero's .h-lion box is the Lion v2 canvas
// (200×280) at 0.8416, so the wardrobe's full-canvas layers sit on it exactly like the hat does. Without this the
// hero ignored glasses, scarves and faculty looks, so a saved change looked like it hadn't saved.
export function ozHeroMascot({ hat = 'none', skin = null, wear = null } = {}) {
  const hides = wear?.hides || [];
  const hatArt = !hides.includes('hat') && Object.prototype.hasOwnProperty.call(HERO_HATS, hat) ? HERO_HATS[hat] : null;
  const ok = (v) => typeof v === 'string' && /^[a-z0-9-]+$/.test(v) && v !== 'none';
  const layer = (src, cls) => `<img class="h-wear ${cls}" src="${A}${src}" alt="">`;
  const lookUnder = wear && ok(wear.look) ? layer(`looks/${wear.look}-under.svg`, 'h-look') : '';
  const over = [wear && ok(wear.neck) && !hides.includes('neck') ? layer(`neck/${wear.neck}.svg`, 'h-neck') : '',
    wear && ok(wear.look) && wear.lookOver ? layer(`looks/${wear.look}-over.svg`, 'h-look') : '',
    wear && ok(wear.eyewear) && !hides.includes('eyewear') ? layer(`eyewear/${wear.eyewear}.svg`, 'h-eyewear') : ''].join('');
  const id = skin && /^[a-z]+$/.test(skin[0]) ? skin[0] : 'blue';
  const P = id === 'blue' ? `${A}hero/` : `${A}hero/skins/${id}/`;
  const c = skin?.[1]; const vars = id !== 'blue' && c ? ` style="--oz-mascot-shell-top:${esc(c[0])};--oz-mascot-shell-bottom:${esc(c[1])};--oz-mascot-face-top:${esc(c[2])};--oz-mascot-face-bottom:${esc(c[3])}"` : '';
  return `<span class="oz-hero-art" aria-hidden="true"${vars}>
    <i class="h-ring"></i><i class="h-halo"></i>
    <span class="h-pose"><span class="h-wave">
      <img class="h-shadow" src="${A}hero/ground-shadow.svg" alt="">
      <span class="h-lion-wrap"><span class="h-lion">
        <img class="h-body" src="${P}body.svg" alt="">${lookUnder}<img class="h-mane" src="${P}mane.svg" alt="">
        <img class="h-ears" src="${P}ears.svg" alt=""><i class="h-shell"></i><i class="h-face"></i>
        <i class="h-eye h-eye-l"></i><i class="h-eye h-eye-r"></i><img class="h-nose" src="${A}hero/nose.svg" alt="">
        <span class="h-smile"><img src="${A}hero/smile.svg" alt=""></span>${lookUnder ? '' : `<img class="h-badge" src="${A}hero/plus-badge.svg" alt="">`}
        ${over}${hatArt ? `<img class="h-hat" src="${A}hats/${esc(hatArt)}" alt="">` : ''}
      </span></span>
      <span class="h-tail-stem"><img src="${P}tail-stem.svg" alt=""></span><img class="h-tail-tuft" src="${P}tail-tuft.svg" alt="">
    </span></span></span>`;
}
// Hat overlays drawn for the hero pose. Hats without Figma artwork yet show no hat rather than an invented one.
export const HERO_HATS = { beanie: 'beanie.svg', cap: 'cap.svg', songkok: 'songkok.svg', mushroom: 'mushroom.svg', grad: 'grad.svg', crown: 'crown.svg' };

/**
 * Points Hero (433:115). levelName/streakDays/nextLine come from points-policy and the streak model.
 * progress is 0..1. points is bound live with data-bind="points".
 */
export function ozPointsHero({ points = 0, levelName = '', streakDays = 0, nextLine = '', progress = 0, hat = 'none', skin = null, label = 'Your points', cls = '',
  levelAttr = null, streakHref = '', streakLabel = '', mascotHref = '', mascotLabel = '', wear = null }) {
  const pct = Math.max(0, Math.min(1, Number(progress) || 0)) * 100;
  return `<section class="oz-hero${cls ? ' ' + cls : ''}" aria-label="${esc(label)}">
    ${ozHeroMascot({ hat, skin, wear })}
    ${mascotHref ? `<a class="oz-hero-hit" href="${esc(mascotHref)}" aria-label="${esc(mascotLabel || 'Customise Onzo')}"></a>` : ''}
    <div class="oz-hero-text">
      <p class="oz-hero-label">${esc(label)}</p>
      <p class="oz-hero-points"><span data-bind="points">${Number(points || 0).toLocaleString()}</span></p>
      <div class="oz-hero-chips">
        ${levelName ? (levelAttr ? `<button type="button" class="oz-hero-chip oz-hero-chip-btn"${attrs(levelAttr)}>` : '<span class="oz-hero-chip">')
          + `<img src="${A}hero/medal.svg" alt="" width="16" height="16">${esc(levelName)}` + (levelAttr ? '</button>' : '</span>') : ''}
        ${streakHref ? `<a class="oz-hero-chip oz-hero-chip-btn" href="${esc(streakHref)}"${streakLabel ? ` aria-label="${esc(streakLabel)}"` : ''}><img src="${A}hero/flame.svg" alt="" width="16" height="16">${esc(streakDays > 0 ? (streakDays === 1 ? '1 day' : `${streakDays} days`) : 'Start a streak')}</a>`
          : streakDays > 0 ? `<span class="oz-hero-chip"><img src="${A}hero/flame.svg" alt="" width="16" height="16">${esc(streakDays === 1 ? '1 day' : `${streakDays} days`)}</span>` : ''}
      </div>
      ${nextLine ? `<p class="oz-hero-next">${esc(nextLine)}</p>` : ''}
      ${nextLine ? `<div class="oz-hero-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="${esc(nextLine)}"><i style="width:${pct.toFixed(1)}%"></i></div>` : ''}
    </div></section>`;
}

/**
 * Route loading state (Figma Loading frames: Rewards 951:54838, Leagues 951:54935, Events 918:32414).
 * Grey blocks in the page's real shape instead of a spinner (as in Thumbtack / Trainline on Mobbin). Client-only:
 * Admin keeps the shared routeLoadingHTML. Keeps `.route-loading` + a status label for screen readers and tests.
 */
export function ozRouteSkeleton(path = '') {
  const route = String(path).split('/')[0];
  const label = route === 'events' ? 'Events loading…' : route === 'rewards' ? 'Your campus rewards are on the way…' : 'A little more campus life, coming up…';
  const b = (cls) => `<span class="oz-skel ${cls}"></span>`;
  const main = route === 'leagues' ? b('oz-skel-bar') + b('oz-skel-xl') + b('oz-skel-row').repeat(4)
    : route === 'events' ? b('oz-skel-bar') + `<span class="oz-skel-grid">${b('oz-skel-card').repeat(3)}</span>` + b('oz-skel-lg').repeat(2)
    : b('oz-skel-md') + b('oz-skel-bar') + b('oz-skel-lg').repeat(3);
  const side = route === 'events' ? '' : `<span class="oz-skel-side">${b('oz-skel-md')}${b('oz-skel-lg')}${b('oz-skel-lg')}</span>`;
  return `<div class="route-loading oz-skel-page" role="status"><span class="visually-hidden">${esc(label)}</span>
    ${b('oz-skel-title')}<span class="oz-skel-cols${side ? '' : ' is-single'}" aria-hidden="true"><span class="oz-skel-main">${main}</span>${side}</span></div>`;
}

/** Streak flame (assets/onz/streak/flame.svg, inlined) so its two layers can burn: the outer flame sways slowly,
 *  the inner one flickers faster and out of phase, both pinned at the base. Still under reduced motion. */
// The flame warms up as a streak grows: 1–6 days orange, 7–13 red-orange, 14–29 magenta, 30+ blue (colours in oz-tokens.css).
export const flameTier = (days = 0) => (days >= 30 ? 4 : days >= 14 ? 3 : days >= 7 ? 2 : 1);
export const ozFlame = (size = 120, cls = '', days = 0) => `<svg class="oz-flame${cls ? ' ' + cls : ''}" data-tier="${flameTier(days)}" width="${size}" height="${size}" viewBox="0 0 120 120" fill="none" aria-hidden="true" focusable="false">
  <ellipse class="oz-flame-glow" cx="60" cy="96" rx="44" ry="20" fill="#FF8A1F" opacity=".18"/>
  <path class="oz-flame-outer" d="M71.25 3.75C78.75 26.25 103.125 41.25 103.125 75C103.125 101.25 86.25 116.25 60 116.25C35.625 116.25 16.875 99.375 16.875 75C16.875 58.125 26.25 46.875 33.75 31.875C37.5 45 41.25 50.625 48.75 54.375C46.875 33.75 54.375 15 71.25 3.75Z" fill="#FF8A1F"/>
  <path class="oz-flame-inner" d="M61.875 63.75C67.5 76.875 82.5 82.5 82.5 95.625C82.5 106.875 73.125 112.5 61.875 112.5C48.75 112.5 39.375 105 39.375 93.75C39.375 80.625 54.375 75 61.875 63.75Z" fill="#FFD23F"/>
</svg>`;
