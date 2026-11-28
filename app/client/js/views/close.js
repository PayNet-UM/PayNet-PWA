// "Delete my account": students delete their account here; businesses send the Admin team a closing request.
// Both answer why they're leaving, which the Admin team sees in the dashboard (Account closures).
import * as D from '../data.js';
import { $, $$, esc, n, toast, busy, confirmSheet } from '../ui.js';
import { ozIcon } from '../oz-icons.js';

const isMerchant = (app) => app.role === 'merchant';

export function closeRender(app) {
  const merchant = isMerchant(app);
  const reasons = D.CLOSE_REASONS.filter(([, , who]) => who === 'all' || who === app.role);
  const p = app.profile || {};
  const back = merchant ? ['#/home', 'Merchant home'] : ['#/me/settings', 'Settings'];
  // Figma "Close merchant account" 523:11859 (web 948:55220): back link, title, one line, a quiet "Before closure"
  // card, the reasons and comment, then Keep account / the destructive action. Students get the same layout.
  return `<div class="oz-mpage oz-close close-account">
      <a class="oz-mback" href="${back[0]}">${ozIcon('s:chevron-left')}<span>${back[1]}</span></a>
      <header class="oz-mhead"><h1>${merchant ? 'Close merchant account' : 'Delete my account'}</h1><p>${merchant ? 'The Admin team reviews closure requests.' : 'This deletes your +Onz account straight away. It can’t be undone.'}</p></header>
      <section class="oz-close-before"><h2>${merchant ? 'Before closure' : 'What gets deleted'}</h2>
        ${merchant
    ? `<p>The team settles outstanding vouchers and updates the PayNet list before closing the account. They’ll contact you at <span class="oz-break" data-no-i18n>${esc(app.user.email)}</span> if they need anything.</p>`
    : `<ul>
          <li>Your profile, matric number, points history, survey answers, friends and username.</li>
          <li>Your ${n(p.points || 0)} points and any unused vouchers.</li>
          <li>Vouchers you used and welfare requests stay in the Admin team’s records with your name removed.</li>
          <li>The Admin team is told that an account was deleted and why, without your name.</li>
        </ul>`}
      </section>
      <form id="close-form" class="oz-form">
        <fieldset class="oz-close-reasons close-reasons"><legend class="oz-close-legend">Why are you leaving?</legend>
          <p class="oz-mnote">Choose all that apply. It helps the team improve +Onz.</p>
          <div class="oz-close-list">${reasons.map(([k, label]) => `<label class="oz-mcheck"><input type="checkbox" name="reason" value="${k}"><span>${esc(label)}</span></label>`).join('')}</div>
        </fieldset>
        <label class="oz-field">Comment (optional)
          <textarea name="comment" rows="3" maxlength="500" placeholder="${merchant ? 'Add details for the Admin team' : 'What could we do better?'}"></textarea></label>
        ${merchant ? '' : '<label class="oz-mcheck"><input type="checkbox" name="ok" required><span>I understand my account, points and unused vouchers will be deleted.</span></label>'}
        <div class="oz-close-actions">
          <a class="oz-btn oz-btn-ghost oz-btn-md oz-btn-block" href="${back[0]}"><span>Keep account</span></a>
          <button class="oz-btn oz-btn-destructive oz-btn-md oz-btn-block" type="submit"><span>${merchant ? 'Send closing request' : 'Delete my account'}</span></button>
        </div>
        <p class="oz-mnote">Questions? Email <a class="oz-link" href="mailto:admin@addonz.my">admin@addonz.my</a>.</p>
      </form>
    </div>`;
}

export function closeMount(root, app) {
  const merchant = isMerchant(app);
  $('#close-form', root).onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    const reasons = $$('input[name=reason]:checked', f).map((x) => x.value);
    if (!reasons.length) { toast('Choose at least one reason, or “I’d rather not say”.', true); return; }
    if (app.backend.mode === 'demo') { toast('Demo mode: accounts can’t be deleted here.', true); return; }
    const btn = $('button[type=submit]', f);
    (async () => {
      if (!merchant && !(await confirmSheet('Delete your account?', 'Your account, points and unused vouchers will be deleted. This can’t be undone.', 'Delete my account', true))) return;
      await busy(btn, async () => {
        try {
          const res = await D.closeMyAccount(app.user, { reasons, comment: f.comment.value });
          if (res.kind === 'request') {
            toast(res.already ? 'You’ve already sent a closing request. The Admin team will contact you.' : 'Request sent. The Admin team will contact you to close your account.');
            location.hash = '#/home';
            return;
          }
          toast('Your account has been deleted. Goodbye from +Onz.');
          location.hash = '';
          await app.backend.sdk.signOut(app.backend.auth).catch(() => {});
          setTimeout(() => location.reload(), 1200);
        } catch (err) { toast(err.message, true); }
      });
    })();
  };
}
