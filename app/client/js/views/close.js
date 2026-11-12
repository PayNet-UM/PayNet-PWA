// "Delete my account": students delete their account here; businesses send the Admin team a closing request.
// Both answer why they're leaving, which the Admin team sees in the dashboard (Account closures).
import * as D from '../data.js';
import { $, $$, esc, icon, n, toast, busy, confirmSheet } from '../ui.js';

const isMerchant = (app) => app.role === 'merchant';

export function closeRender(app) {
  const merchant = isMerchant(app);
  const reasons = D.CLOSE_REASONS.filter(([, , who]) => who === 'all' || who === app.role);
  const p = app.profile || {};
  return `<section class="section close-account">
      <a class="btn small ghost" href="#/${merchant ? 'home' : 'me'}">${icon('arrow-left')} Back</a>
      <h1 style="margin-top:12px">${merchant ? 'Close my business account' : 'Delete my account'}</h1>
      <div class="card stack">
        ${merchant
    ? `<p>The Admin team will close your account after settling any vouchers students still hold and updating the PayNet list. They’ll contact you at ${esc(app.user.email)} if they need anything.</p>`
    : `<p>This deletes your +Onz account straight away. It can’t be undone.</p>
        <ul class="close-list">
          <li>Your profile, matric number, points history, survey answers, friends and username are deleted.</li>
          <li>You lose your ${n(p.points || 0)} points and any unused vouchers.</li>
          <li>Vouchers you used and welfare requests stay in the Admin team’s records with your name removed.</li>
          <li>The Admin team is told that an account was deleted and why, without your name.</li>
        </ul>`}
      </div>
      <form id="close-form" class="stack" style="margin-top:16px">
        <fieldset class="card stack close-reasons"><legend><h2>Why are you leaving?</h2></legend>
          <p class="faint">Choose all that apply. It helps the team improve +Onz.</p>
          ${reasons.map(([k, label]) => `<label class="check"><input type="checkbox" name="reason" value="${k}"> ${esc(label)}</label>`).join('')}
          <label class="field">Anything else you’d like to tell us? (optional)
            <textarea name="comment" rows="3" maxlength="500" placeholder="What could we do better?"></textarea></label>
        </fieldset>
        ${merchant ? '' : '<label class="check"><input type="checkbox" name="ok" required> I understand my account, points and unused vouchers will be deleted.</label>'}
        <button class="btn warn block" type="submit">${icon(merchant ? 'mail' : 'trash-2')} ${merchant ? 'Send closing request' : 'Delete my account'}</button>
        <p class="faint">Questions? Email <a href="mailto:admin@addonz.my">admin@addonz.my</a>.</p>
      </form>
    </section>`;
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
