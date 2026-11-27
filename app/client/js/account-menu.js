// Account menu (Figma "Me · Account menu" 525:10476, web 938:50726). Students open it as the page #/me/account from the
// settings gear; merchants keep it as a sheet. Both use these rows, so every entry point and id
// (#tour, #install, #terms, #signout, #to-feedback, #to-mpp, #demo-account) works the same way.
import { esc, closeSheet } from './ui.js';
import { ozIcon } from './oz-icons.js';
import { avatarSVG, defaultFor } from './avatar.js';
import { getLang } from './i18n.js';
import * as Guide from './guide.js';

const chev = () => ozIcon('s:chevron-right', 'oz-menu-chev');
export const menuRow = (label, { href, id, badge = '', value = '', close = false, cls = '' } = {}) => {
  const inner = `<span class="oz-menu-label">${label}${badge}</span>${value ? `<span class="oz-menu-value">${value}</span>` : ''}${chev()}`;
  const c = `oz-menu-row${cls ? ' ' + cls : ''}`;
  return href ? `<a class="${c}" href="${esc(href)}"${id ? ` id="${id}"` : ''}${close ? ' data-close' : ''}>${inner}</a>`
    : `<button type="button" class="${c}" id="${id}">${inner}</button>`;
};
export const menuGroup = (title, rows, { id = '' } = {}) =>
  `<section class="oz-menu-section"${id ? ` id="${id}"` : ''}><h2 class="oz-menu-title">${title}</h2><div class="oz-menu-group">${rows.join('')}</div></section>`;

export function accountMenuHTML(app, { page = false, siteUrls = {} } = {}) {
  const p = app.profile || {};
  const student = app.role === 'student';
  const close = !page;
  const feedbackBadge = app.feedbackNew ? ` <span class="oz-tag oz-tag-success">${app.feedbackNew === 1 ? '1 new reply' : `${app.feedbackNew} new replies`}</span>` : '';
  const lang = getLang();
  const groups = {
    profile: student ? menuGroup('Profile and preferences', [
      ...(page ? [menuRow('Edit profile', { href: '#/me/profile' }), menuRow('Settings', { href: '#/me/settings' })] : [menuRow('Profile and settings', { href: '#/me', close })]),
      menuRow('Customise Onzo', { href: '#/avatar', close })]) : '',
    help: menuGroup('Help and information', [
      ...(student ? [menuRow('Questions and feedback', { href: '#/feedback', id: 'to-feedback', badge: feedbackBadge, close })] : []),
      menuRow('About +Onz', { href: '#/about', close }), menuRow('Contact us', { href: '#/contact', close }), menuRow('Points guide', { href: '#/points', close })]),
    app: menuGroup('App', [menuRow('Take the tour', { id: 'tour' }), menuRow('Install +Onz', { id: 'install' }), menuRow('Terms of Use and Privacy', { id: 'terms' }),
      ...(!student && app.backend.mode === 'demo' ? [menuRow('Demo mode', { id: 'demo-account' })] : [])]),
  };
  const id = `<div class="oz-account-id">${student ? `<span class="oz-account-av">${avatarSVG(p.avatar || defaultFor(app.ctx?.uid), { variant: 'head', size: 52, title: p.name })}</span>` : ''}
    <div class="oz-account-text"><p class="oz-account-name">${esc(p.name || app.user.email)}</p><p class="oz-account-sub">${page ? 'Student' : esc(app.user.email)}</p></div></div>`;
  // As a page, language, sign-out and account deletion live in Settings (Figma 449:5184); the sheet keeps them.
  const extras = page ? '' : `<section class="oz-menu-section"><h2 class="oz-menu-title" id="oz-lang-title">Language</h2>
    <div class="oz-menu-group oz-lang" role="group" aria-labelledby="oz-lang-title" data-no-i18n>${languageRows(lang)}</div></section>
    <div class="oz-menu-group oz-menu-end">
      ${app.isMpp ? `<a class="oz-menu-row" href="${esc(siteUrls.admin)}" id="to-mpp"><span class="oz-menu-label">Open the Admin dashboard</span>${chev()}</a>` : ''}
      <button type="button" class="oz-menu-row" id="signout"><span class="oz-menu-label">${ozIcon('s:logout')}Sign out</span></button>
      <a class="oz-menu-row is-danger" href="#/delete-account" data-close><span class="oz-menu-label">${ozIcon('s:trash')}${app.role === 'merchant' ? 'Close my account' : 'Delete my account'}</span></a>
    </div>`;
  return `<div class="oz-account${page ? ' is-page' : ''}">${id}
    ${page ? `<div class="oz-account-cols">${groups.profile.replace('oz-menu-section"', 'oz-menu-section is-profile"')}${groups.help.replace('oz-menu-section"', 'oz-menu-section is-help"')}${groups.app.replace('oz-menu-section"', 'oz-menu-section is-app"')}</div>` : groups.profile + groups.help + groups.app}
    ${extras}</div>`;
}
export const languageRows = (lang = getLang()) =>
  `<button type="button" class="oz-menu-row" data-lang-set="en" aria-pressed="${lang === 'en'}"><span class="oz-menu-label">English</span>${ozIcon('s:check', 'oz-menu-check')}</button>
  <button type="button" class="oz-menu-row" data-lang-set="ms" aria-pressed="${lang === 'ms'}"><span class="oz-menu-label">Bahasa Malaysia</span>${ozIcon('s:check', 'oz-menu-check')}</button>`;

export function mountAccountMenu(el, app) {
  const signout = el.querySelector('#signout');
  if (signout) signout.onclick = async () => { closeSheet(); await app.backend.sdk.signOut(app.backend.auth); location.hash = ''; };
  el.querySelector('#install').onclick = () => app.installApp();
  el.querySelector('#tour').onclick = () => { closeSheet(); Guide.start(app); };
  const demo = el.querySelector('#demo-account');
  if (demo) demo.onclick = () => import('./demo-seed.js').then((m) => m.demoSheet(app));
  el.querySelector('#terms').onclick = () => { closeSheet(); import('./terms.js').then((m) => m.termsSheet()); };
}
