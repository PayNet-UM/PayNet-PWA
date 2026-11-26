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
export const ozPointsPill = (points, { href = '#/rewards', bind = true } = {}) =>
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

/** Sir Onz waving with his tail (Tail Wave 422:50) inside the halo, as used by the Points Hero (433:115). */
export function ozHeroMascot({ hat = 'none' } = {}) {
  const hatArt = HERO_HATS[hat];
  return `<span class="oz-hero-art" aria-hidden="true">
    <i class="h-ring"></i><i class="h-halo"></i>
    <span class="h-pose"><span class="h-wave">
      <img class="h-shadow" src="${A}hero/ground-shadow.svg" alt="">
      <span class="h-lion-wrap"><span class="h-lion">
        <img class="h-body" src="${A}hero/body.svg" alt=""><img class="h-mane" src="${A}hero/mane.svg" alt="">
        <img class="h-ears" src="${A}hero/ears.svg" alt=""><i class="h-shell"></i><i class="h-face"></i>
        <i class="h-eye h-eye-l"></i><i class="h-eye h-eye-r"></i><img class="h-nose" src="${A}hero/nose.svg" alt="">
        <span class="h-smile"><img src="${A}hero/smile.svg" alt=""></span><img class="h-badge" src="${A}hero/plus-badge.svg" alt="">
        ${hatArt ? `<img class="h-hat" src="${A}hats/${hatArt}" alt="">` : ''}
      </span></span>
      <span class="h-tail-stem"><img src="${A}hero/tail-stem.svg" alt=""></span><img class="h-tail-tuft" src="${A}hero/tail-tuft.svg" alt="">
    </span></span></span>`;
}
// Hat overlays drawn for the hero pose. Hats without Figma artwork yet show no hat rather than an invented one.
export const HERO_HATS = { beanie: 'beanie.svg', cap: 'cap.svg', songkok: 'songkok.svg', mushroom: 'mushroom.svg', grad: 'grad.svg', crown: 'crown.svg' };

/**
 * Points Hero (433:115). levelName/streakDays/nextLine come from points-policy and the streak model.
 * progress is 0..1. points is bound live with data-bind="points".
 */
export function ozPointsHero({ points = 0, levelName = '', streakDays = 0, nextLine = '', progress = 0, hat = 'none', label = 'Your points', cls = '',
  levelAttr = null, streakHref = '', streakLabel = '' }) {
  const pct = Math.max(0, Math.min(1, Number(progress) || 0)) * 100;
  return `<section class="oz-hero${cls ? ' ' + cls : ''}" aria-label="${esc(label)}">
    ${ozHeroMascot({ hat })}
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
