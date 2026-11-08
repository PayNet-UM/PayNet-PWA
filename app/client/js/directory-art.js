// Shared Explore artwork for the student and merchant homepages.
import { icon } from './ui.js';

export function directoryArt(key) {
  const illustrated = { deals: ['badge-percent', 'zap'], community: ['users', 'hand-heart'], qr: ['qr-code', 'check'] }[key];
  if (illustrated) return `<span class="onz-deals-art" aria-hidden="true">${icon(illustrated[0])}<i>${icon(illustrated[1])}</i></span>`;
  return `<span class="onz-directory-art onz-art-${key}" aria-hidden="true"></span>`;
}
