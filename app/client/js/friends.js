import * as D from './data.js';
import { avatarSVG, defaultFor } from './avatar.js';
import { $, $$, esc, icon, busy, toast, errText, confirmSheet, initials, confetti } from './ui.js';

export function usernameTag(username) {
  return username ? `<div class="username-tag"><span data-no-i18n>@${esc(username)}</span><button type="button" class="username-copy" data-copy-username aria-label="Copy username" title="Copy username">${icon('copy')}</button></div>` : '';
}

export function mountUsernameCopy(root, app) {
  const button = $('[data-copy-username]', root);
  if (button) button.onclick = () => busy(button, async () => {
    try {
      await navigator.clipboard.writeText(app.profile.username);
      toast('Username copied');
    } catch {
      toast('Couldn’t copy. Select your username to copy it manually.', true);
    }
  });
}

export async function friendsRender(app) {
  const profile = await D.getProfile(app.ctx);
  app.profile = app.ctx.profile = profile;
  app._friendDirectory = await D.listUsernames(app.ctx);
  return `<section class="card friends-hero" aria-labelledby="friends-title">
      <div class="friends-player">${avatarSVG(profile.avatar || defaultFor(app.ctx.uid), { size: 96, title: profile.name })}<button type="button" class="friends-add-shortcut" data-friends-jump="friend-search" aria-controls="friend-search" aria-label="Add friends"><span aria-hidden="true">+</span></button></div>
      <div class="friends-hero-copy"><h1 id="friends-title">Your circle</h1>
        ${usernameTag(profile.username)}</div>
      <div class="friends-scoreboard" aria-label="Your connections">
        <button type="button" data-friends-jump="friends-section-accepted" aria-controls="friends-section-accepted" disabled><strong id="friends-total">—</strong><span>Friends</span></button>
        <button type="button" data-friends-jump="friends-section-incoming" aria-controls="friends-section-incoming" disabled><strong id="friends-incoming">—</strong><span>Requests</span></button>
        <button type="button" data-friends-jump="friends-section-sent" aria-controls="friends-section-sent" disabled><strong id="friends-outgoing">—</strong><span>Sent</span></button>
      </div>
    </section>
    <nav class="chips friends-tabs" aria-label="Campus map">${D.featureOn(app.rules, 'overview') ? `<a class="btn small" href="#/explore">${icon('map')} Overview</a>` : ''}<a class="btn small primary" href="#/friends" aria-current="page">${icon('users')} Friends</a></nav>
    ${profile.username ? ''
      : `<form id="friend-username" class="card stack friends-claim"><div class="row"><span class="tile-icon">${icon('user')}</span><div><h2>Choose your username</h2></div></div>
        <label class="field">Username<input name="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" title="3–24 letters, numbers or underscores. Permanent once saved." autocomplete="off" placeholder="e.g. aina_um"></label><button class="btn primary">Save username</button></form>`}
    <form id="friend-search" class="card stack friends-search" tabindex="-1" aria-label="Add friends"><div class="row"><span class="tile-icon">${icon('user-plus')}</span><div><h2>Add friends</h2></div></div>
      <div class="friends-search-controls"><div class="friends-autocomplete"><label class="field"><span class="sr">Find by username</span><input name="username" required maxlength="25" placeholder="@username" autocomplete="off" autocapitalize="none" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="friend-suggestions" aria-expanded="false" ${profile.username ? '' : 'disabled'}></label><ul id="friend-suggestions" class="friends-suggestions" role="listbox" aria-label="Matching users" hidden></ul></div><button class="btn primary" ${profile.username ? '' : 'disabled'}>${icon('user-plus')} Add</button></div>
      <div id="friend-result" aria-live="polite"></div><p class="faint">Using a referral code also sends its owner a friend request.</p></form>
    <div id="friend-lists" aria-live="polite" role="region" aria-label="Friend requests and your circle" tabindex="0"><p class="faint">Loading friends…</p></div>`;
}

export function friendsMount(root, app) {
  mountUsernameCopy(root, app);
  let disposed = false, jumpAnimation = null;
  $$('[data-friends-jump]', root).forEach((button) => {
    button.onclick = () => {
      const target = $('#' + button.dataset.friendsJump, root);
      if (!target) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      jumpAnimation?.cancel();
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start', inline: 'nearest' });
      if (!reduced) jumpAnimation = target.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(-7px)', offset: 0.4 },
        { transform: 'translateY(2px)', offset: 0.7 },
        { transform: 'translateY(0)' },
      ], { duration: 550, delay: 200, easing: 'ease-in-out' });
    };
  });
  const claim = $('#friend-username', root);
  if (claim) claim.onsubmit = (e) => {
    e.preventDefault();
    busy($('button', claim), async () => {
      try { await D.claimUsername(app.ctx, claim.username.value); app.render(); }
      catch (err) { toast(err.code === 'permission-denied' ? 'That username is unavailable. Try another.' : errText(err), true); }
    });
  };
  const search = $('#friend-search', root), result = $('#friend-result', root);
  const input = search.username, suggestions = $('#friend-suggestions', root);
  let connected = new Set(), matches = [], active = -1;
  function closeSuggestions() {
    suggestions.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function selectSuggestion(index) {
    input.value = matches[index].username;
    closeSuggestions();
    result.textContent = '';
    input.focus();
  }
  function showSuggestions() {
    const query = D.normaliseUsername(input.value);
    matches = query ? app._friendDirectory.filter((person) => person.uid !== app.ctx.uid
      && !connected.has(person.uid) && person.username.includes(query)).slice(0, 8) : [];
    active = -1;
    input.removeAttribute('aria-activedescendant');
    suggestions.innerHTML = matches.map((person, i) => `<li id="friend-option-${i}" role="option" aria-selected="false" data-suggestion="${i}"><span class="friends-suggestion-icon" aria-hidden="true">${icon('user')}</span><span data-no-i18n>@${esc(person.username)}</span></li>`).join('');
    suggestions.hidden = !matches.length;
    input.setAttribute('aria-expanded', String(matches.length > 0));
    result.textContent = query && !matches.length ? 'No matching users available.' : '';
    $$('[data-suggestion]', suggestions).forEach((option) => {
      option.onpointerdown = (event) => event.preventDefault();
      option.onclick = () => selectSuggestion(Number(option.dataset.suggestion));
    });
  }
  input.oninput = showSuggestions;
  input.onfocus = showSuggestions;
  input.onkeydown = (event) => {
    if (event.key === 'Escape') { closeSuggestions(); return; }
    if (suggestions.hidden) return;
    if (event.key === 'Enter' && active >= 0) {
      event.preventDefault(); selectSuggestion(active); return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    active = active < 0 ? (direction > 0 ? 0 : matches.length - 1) : (active + direction + matches.length) % matches.length;
    $$('[data-suggestion]', suggestions).forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
    const option = $('#friend-option-' + active, root);
    input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  };
  search.onfocusout = (event) => { if (!search.contains(event.relatedTarget)) closeSuggestions(); };
  search.onsubmit = (e) => {
    e.preventDefault();
    closeSuggestions();
    busy($('button', search), async () => {
      result.textContent = '';
      try {
        const person = await D.findUsername(app.ctx, search.username.value);
        if (disposed) return;
        if (!person || person.uid === app.ctx.uid) { result.textContent = person ? 'That’s you!' : 'No student found. Check the username.'; return; }
        await D.requestFriend(app.ctx, person);
        if (!disposed) { result.textContent = 'Request sent'; search.username.value = ''; }
      } catch (err) { if (!disposed) result.textContent = errText(err); }
    });
  };
  const stop = D.watchFriendships(app.ctx, (rows) => {
    if (disposed) return;
    connected = new Set(rows.map((f) => f.from === app.ctx.uid ? f.to : f.from));
    if (!suggestions.hidden) showSuggestions();
    const incoming = rows.filter((f) => f.status === 'pending' && f.to === app.ctx.uid);
    const accepted = rows.filter((f) => f.status === 'accepted');
    const sent = rows.filter((f) => f.status === 'pending' && f.from === app.ctx.uid);
    $('#friends-total', root).textContent = accepted.length;
    $('#friends-incoming', root).textContent = incoming.length;
    $('#friends-outgoing', root).textContent = sent.length;
    const sections = [
      ['Request inbox', incoming, 'incoming', 'user-plus', 'No requests'],
      ['Friends', accepted, 'accepted', 'users', 'No friends yet'],
      ['Request sent', sent, 'sent', 'clock', 'No sent requests'],
    ];
    $('#friend-lists', root).innerHTML = sections.map(([title, people, kind, glyph, empty]) => `<section id="friends-section-${kind}" class="section friends-section friends-section-${kind}" tabindex="-1" aria-label="${title}">
      <div class="friends-section-heading"><span class="friends-section-icon" aria-hidden="true">${icon(glyph)}</span><h2>${title}</h2><span class="friends-count">${people.length}</span></div>
      <div class="friends-grid">${people.map((f) => {
        const personUid = f.from === app.ctx.uid ? f.to : f.from;
        const username = app._friendDirectory.find((person) => person.uid === personUid)?.username
          || (f.from === app.ctx.uid ? f.toUsername : f.fromUsername);
        const label = username ? '@' + username : f.from === app.ctx.uid ? 'Referral · ' + f.referralCode : f.fromName || 'Student';
        return `<article class="card friend-row friend-${kind}">
          <span class="friends-badge" aria-hidden="true"><span class="friends-monogram">${esc(initials(label.replace(/[@_]/g, ' ')))}</span><span class="friends-badge-mark">${icon(kind === 'accepted' ? 'check' : kind === 'incoming' ? 'plus' : 'clock')}</span></span>
          <div class="friend-identity"><h3 ${username ? 'data-no-i18n' : ''}>${esc(label)}</h3><span class="friend-state">${icon(kind === 'accepted' ? 'check' : 'clock')} ${kind === 'accepted' ? 'Connected' : kind === 'incoming' ? 'Wants to connect' : 'Awaiting reply'}</span></div>
          <div class="friend-actions">
            ${kind === 'incoming' ? `<button class="btn small go" data-accept-friend="${esc(f.id)}">${icon('user-plus')} Accept</button>` : ''}
            <button class="btn small ghost" data-remove-friend="${esc(f.id)}" data-kind="${kind}">${kind === 'accepted' ? 'Remove' : kind === 'incoming' ? 'Decline' : 'Cancel'}</button>
          </div></article>`;
      }).join('') || `<div class="friends-empty"><div class="friends-empty-orbit" aria-hidden="true"><span>${icon('user')}</span><span class="friends-empty-icon">${icon(glyph)}</span><span>${icon('user')}</span></div><p>${empty}</p></div>`}</div></section>`).join('');
    $$('.friends-scoreboard button', root).forEach((button) => { button.disabled = false; });
    $$('[data-accept-friend]', root).forEach((button) => { button.onclick = () => busy(button, async () => {
      try { await D.acceptFriend(app.ctx, button.dataset.acceptFriend); confetti(); toast('Friend added'); } catch (err) { toast(errText(err), true); }
    }); });
    $$('[data-remove-friend]', root).forEach((button) => { button.onclick = async () => {
      if (button.dataset.kind === 'accepted' && !(await confirmSheet('Remove friend?', 'You will stop seeing each other on the campus map.', 'Remove'))) return;
      busy(button, async () => { try { await D.removeFriend(app.ctx, button.dataset.removeFriend); } catch (err) { toast(errText(err), true); } });
    }; });
  }, (err) => { if (!disposed) $('#friend-lists', root).textContent = errText(err); });
  return () => { disposed = true; jumpAnimation?.cancel(); stop(); };
}
