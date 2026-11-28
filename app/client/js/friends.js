import * as D from './data.js';
import { avatarSVG, defaultFor } from './avatar.js';
import { $, $$, esc, icon, busy, toast, errText, confirmSheet, initials, sheet, closeSheet } from './ui.js';
import { ozIcon } from './oz-icons.js';
import { collapse, copyWithFeedback, slideOpen, slideClose } from './oz-motion.js';

export function usernameTag(username) {
  return username ? `<div class="username-tag"><span data-no-i18n>@${esc(username)}</span><button type="button" class="username-copy" data-copy-username aria-label="Copy username" title="Copy username">${icon('copy')}</button></div>` : '';
}

export function mountUsernameCopy(root, app) {
  const button = $('[data-copy-username]', root);
  // Same copy interaction as everywhere else: the icon turns into a check for a moment (oz-motion copyWithFeedback).
  if (button) button.onclick = () => copyWithFeedback(button, app.profile.username, 'Couldn’t copy. Select your username to copy it manually.');
}

export async function friendsRender(app) {
  const profile = await D.getProfile(app.ctx);
  app.profile = app.ctx.profile = profile;
  app._friendDirectory = await D.listUsernames(app.ctx);
  return `<section class="card friends-hero" aria-labelledby="friends-title">
      <div class="friends-player">${avatarSVG(profile.avatar || defaultFor(app.ctx.uid), { size: 96, title: profile.name })}<button type="button" class="friends-add-shortcut" data-friends-jump="friend-search" aria-controls="friend-search" aria-label="Add friends"><span aria-hidden="true">+</span></button></div>
      <div class="friends-hero-copy"><span class="friends-kicker">Your circle</span><h1 id="friends-title">Community</h1>
        ${usernameTag(profile.username)}</div>
      <p class="friends-purpose">Keep your UM friends in one place.</p>
      <div class="friends-scoreboard" aria-label="Your connections">
        <button type="button" data-friends-jump="friends-section-accepted" aria-controls="friends-section-accepted" disabled><strong id="friends-total">—</strong><span>Friends</span></button>
        <button type="button" data-friends-jump="friends-section-incoming" aria-controls="friends-section-incoming" disabled><strong id="friends-incoming">—</strong><span>Requests</span></button>
        <button type="button" data-friends-jump="friends-section-sent" aria-controls="friends-section-sent" disabled><strong id="friends-outgoing">—</strong><span>Sent</span></button>
      </div>
    </section>
    <nav class="community-shortcuts" aria-label="Community sections">
      <button type="button" data-friends-jump="friend-search" aria-controls="friend-search">${icon('user-plus')} Add friends</button>
    </nav>
    ${profile.username ? ''
      : `<form id="friend-username" class="card stack friends-claim"><div class="row"><span class="tile-icon">${icon('user')}</span><div><h2>Choose your username</h2></div></div>
        <label class="field">Username<input name="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" title="3–24 letters, numbers or underscores. Permanent once saved." autocomplete="off" placeholder="e.g. aina_um"></label><button class="btn primary">Save username</button></form>`}
    <form id="friend-search" class="card stack friends-search" tabindex="-1" aria-label="Add friends">
      <div class="friends-search-controls"><div class="friends-autocomplete"><label class="field"><span class="sr">Find by username</span><input name="username" required maxlength="25" placeholder="@username" autocomplete="off" autocapitalize="none" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="friend-suggestions" aria-expanded="false" ${profile.username ? '' : 'disabled'}></label><ul id="friend-suggestions" class="friends-suggestions" role="listbox" aria-label="Matching users" hidden></ul></div><button class="btn primary" ${profile.username ? '' : 'disabled'}>${icon('user-plus')} Add</button></div>
      <div id="friend-result" aria-live="polite"></div></form>
    <div id="friend-lists" aria-live="polite" role="region" aria-label="Friend requests and your circle" tabindex="0"><div class="oz-skel-list" role="status"><span class="visually-hidden">Loading friends…</span><span class="oz-skel oz-skel-row"></span><span class="oz-skel oz-skel-row"></span><span class="oz-skel oz-skel-row"></span></div></div>`;
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
  const accepting = new Set();
  let latest = null;
  // Friends list toolbar (Insight Timer "Search N friends", LinkedIn Connections "Sort by" on Mobbin): the search filters
  // rows in place (no repaint, so typing keeps focus); the sort order is remembered for the session.
  let query = '';
  let sortKey = (() => { try { return sessionStorage.getItem('oz-friend-sort') || 'recent'; } catch { return 'recent'; } })();
  const SORTS = [['recent', 'Recently added'], ['oldest', 'Oldest first'], ['az', 'A–Z']];
  const when = (f) => f.createdAt?.toMillis?.() ?? (f.createdAt?.seconds ? f.createdAt.seconds * 1000 : Number(new Date(f.createdAt || 0)) || 0);
  const nameOf = (f) => (f.from === app.ctx.uid ? f.toUsername : f.fromUsername) || f.fromName || '';
  const sorted = (list) => [...list].sort(sortKey === 'az' ? (a, b) => nameOf(a).localeCompare(nameOf(b))
    : sortKey === 'oldest' ? (a, b) => when(a) - when(b) : (a, b) => when(b) - when(a));
  const filterRows = () => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    let shown = 0;
    $$('#friends-section-accepted .friend-row', root).forEach((row) => {
      const hit = !q || row.dataset.friendLabel.toLowerCase().includes(q); row.hidden = !hit; if (hit) shown++;
    });
    const none = $('#friend-filter-none', root);
    if (none) { none.hidden = !q || shown > 0; none.textContent = `No friends match “${query.trim()}”`; }
    const clear = $('#friend-filter-clear', root); if (clear) clear.hidden = !q;
  };
  const tools = (count) => `<div class="oz-friend-tools">
      <label class="oz-friend-search">${ozIcon('search')}<span class="visually-hidden">Search your friends</span><input type="search" id="friend-filter" autocomplete="off" enterkeyhint="search" placeholder="Search ${count} ${count === 1 ? 'friend' : 'friends'}" value="${esc(query)}">
        <button type="button" class="oz-friend-clear" id="friend-filter-clear" aria-label="Clear search" hidden>${ozIcon('s:close')}</button></label>
      <button type="button" class="oz-friend-sort" id="friend-sort" aria-haspopup="dialog"><span>${SORTS.find(([k]) => k === sortKey)[1]}</span>${ozIcon('s:chevron-right', 'oz-friend-sort-chev')}</button></div>
    <p class="oz-friend-none" id="friend-filter-none" role="status" hidden></p>`;
  // "Show" switch on the Friends heading (Lex "Show on profile", BeReal "Show my friends" on Mobbin): hides the list on
  // this device, e.g. when showing your screen to someone. Your friends list is never visible to other students anyway.
  const HIDE_KEY = 'oz-friends-hidden:' + app.ctx.uid;
  const listHidden = () => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } };
  const mountShow = () => {
    const sw = $('#friends-visible', root), body = $('#friends-body', root);
    if (!sw || !body) return;
    sw.onchange = async () => {
      try { localStorage.setItem(HIDE_KEY, sw.checked ? '0' : '1'); } catch { /* private mode: session only */ }
      if (sw.checked) { body.hidden = false; await slideOpen(body); }
      else { await slideClose(body); body.hidden = true; }
    };
  };
  const mountTools = () => {
    mountShow();
    const filter = $('#friend-filter', root);
    if (!filter) return;
    filter.oninput = () => { query = filter.value; filterRows(); };
    $('#friend-filter-clear', root).onclick = () => { query = ''; filter.value = ''; filterRows(); filter.focus(); };
    $('#friend-sort', root).onclick = () => {
      const el = sheet(`<div class="oz-sort-sheet"><h2>Sort friends</h2><div class="oz-sort-opts" role="radiogroup" aria-label="Sort friends">${SORTS.map(([k, label]) =>
        `<button type="button" role="radio" class="oz-sort-opt" data-sort="${k}" aria-checked="${k === sortKey}"><span>${label}</span>${ozIcon('s:check', 'oz-sort-tick')}</button>`).join('')}</div></div>`);
      $$('[data-sort]', el).forEach((b) => { b.onclick = () => {
        sortKey = b.dataset.sort; try { sessionStorage.setItem('oz-friend-sort', sortKey); } catch { /* private mode */ }
        closeSheet(); if (latest) paint(latest);
      }; });
    };
    filterRows();
  };
  const paint = (rows) => {
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
      ['Request inbox', incoming, 'incoming', 'user-plus', 'No requests right now'],
      ['Friends', sorted(accepted), 'accepted', 'users', 'No friends yet'],
      ['Request sent', sent, 'sent', 'clock', 'No sent requests'],
    ];
    $('#friend-lists', root).innerHTML = sections.map(([title, people, kind, glyph, empty]) => `<section id="friends-section-${kind}" class="section friends-section friends-section-${kind}" tabindex="-1" aria-label="${title}">
      <div class="friends-section-heading"><span class="friends-section-icon" aria-hidden="true">${icon(glyph)}</span><h2>${title}</h2>
        ${kind === 'accepted' && people.length ? `<label class="oz-friends-show"><span>Show</span><span class="oz-toggle"><input type="checkbox" role="switch" id="friends-visible" aria-label="Show friends list" ${listHidden() ? '' : 'checked'}><i aria-hidden="true"></i></span></label>` : ''}</div>
      ${kind === 'accepted' ? `<div class="oz-friends-body" id="friends-body"${people.length && listHidden() ? ' hidden' : ''}>` : ''}
      ${kind === 'accepted' && people.length ? tools(people.length) : ''}
      <div class="friends-grid">${people.map((f) => {
        const personUid = f.from === app.ctx.uid ? f.to : f.from;
        const username = app._friendDirectory.find((person) => person.uid === personUid)?.username
          || (f.from === app.ctx.uid ? f.toUsername : f.fromUsername);
        const label = username ? '@' + username : f.from === app.ctx.uid ? 'Referral · ' + f.referralCode : f.fromName || 'Student';
        return `<article class="oz-friend-row friend-row friend-${kind}" data-friend-label="${esc(label)}">
          <span class="friends-badge" aria-hidden="true"><span class="friends-monogram">${esc(initials(label.replace(/[@_]/g, ' ')))}</span></span>
          <div class="friend-identity"><h3 ${username ? 'data-no-i18n' : ''}>${esc(label)}</h3>${kind === 'accepted' ? '' : `<span class="friend-state">${kind === 'incoming' ? 'Wants to connect' : 'Awaiting reply'}</span>`}</div>
          <div class="friend-actions">
            ${kind === 'incoming' ? `<button type="button" class="oz-btn oz-btn-primary oz-btn-sm" data-accept-friend="${esc(f.id)}"><span>Accept</span></button>` : ''}
            ${kind === 'accepted'
              // A friend's options live in a sheet (who they are, then actions); removing is a deliberate, confirmed step there.
              ? `<button type="button" class="oz-friend-more" data-friend-sheet="${esc(f.id)}" aria-label="Options for ${esc(label)}" aria-haspopup="dialog"><span class="oz-friend-dots" aria-hidden="true"><i></i><i></i><i></i></span></button>`
              // Incoming: Accept + a compact ✕ (Instagram / Facebook request rows), so the name never breaks mid-word.
              : kind === 'incoming'
                ? `<button type="button" class="oz-friend-x" data-remove-friend="${esc(f.id)}" data-kind="${kind}" aria-label="Decline ${esc(label)}" title="Decline">${ozIcon('s:close')}</button>`
                : `<button type="button" class="oz-btn oz-btn-ghost oz-btn-sm" data-remove-friend="${esc(f.id)}" data-kind="${kind}"><span>Cancel</span></button>`}
          </div></article>`;
      }).join('') || `<div class="friends-empty oz-friends-empty"><span class="oz-friends-empty-ic" aria-hidden="true">${icon(glyph)}</span><p>${empty}</p></div>`}</div>${kind === 'accepted' ? '</div>' : ''}</section>`).join('');
    mountTools();
    $$('.friends-scoreboard button', root).forEach((button) => { button.disabled = false; });
    $$('[data-accept-friend]', root).forEach((button) => { button.onclick = () => busy(button, async () => {
      const id = button.dataset.acceptFriend;
      accepting.add(id);
      try {
        await D.acceptFriend(app.ctx, id);
        toast('Friend added');
        const row = button.closest('.friend-row');
        if (disposed || !row?.isConnected || !row.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        button.innerHTML = ozIcon('s:check');
        button.style.minWidth = 'var(--oz-touch)';
        row.style.overflow = 'hidden';
        const height = row.getBoundingClientRect().height;
        await row.animate([
          { opacity: 1, height: height + 'px', minHeight: 0, offset: 0 },
          { opacity: 1, height: height + 'px', minHeight: 0, offset: .35 },
          { opacity: 0, height: '0px', minHeight: 0, paddingBlock: 0, borderWidth: 0 },
        ], { duration: 280, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {});
      } catch (err) { toast(errText(err), true); }
      finally {
        accepting.delete(id);
        if (!accepting.size && latest) paint(latest);
      }
    }); });
    $$('[data-friend-sheet]', root).forEach((button) => { button.onclick = () => {
      const label = button.closest('[data-friend-label]').dataset.friendLabel; const id = button.dataset.friendSheet;
      const el = sheet(`<div class="oz-friend-sheet"><span class="oz-friend-sheet-av" aria-hidden="true">${esc(initials(label.replace(/[@_]/g, ' ')))}</span>
        <h2 data-no-i18n>${esc(label)}</h2><p class="oz-friend-sheet-state">${ozIcon('check')} Connected</p>
        <div class="oz-friend-sheet-actions">${label.startsWith('@') ? `<button type="button" class="oz-row oz-friend-sheet-row" data-copy-handle>${ozIcon('copy')}<span>Copy username</span></button>` : ''}
          <button type="button" class="oz-row oz-friend-sheet-row is-danger" data-unfriend>${ozIcon('trash')}<span>Remove friend</span></button></div></div>`);
      const copyBtn = el.querySelector('[data-copy-handle]');
      if (copyBtn) copyBtn.onclick = () => copyWithFeedback(copyBtn.querySelector('span') || copyBtn, label, 'Copy is unavailable here.');
      el.querySelector('[data-unfriend]').onclick = async () => { closeSheet(); if (!(await confirmSheet('Remove friend?', 'This removes the connection for both of you.', 'Remove'))) return;
        const row = $(`[data-friend-sheet="${CSS.escape(id)}"]`, root)?.closest('.friend-row');
        if (row) await collapse(row, { remove: false }); // the row folds away instead of the list jumping
        try { await D.removeFriend(app.ctx, id); toast('Friend removed.'); } catch (err) { row?.getAnimations().forEach((a) => a.cancel()); toast(errText(err), true); } };
    }; });
    $$('[data-remove-friend]', root).forEach((button) => { button.onclick = async () => {
      if (button.dataset.kind === 'accepted' && !(await confirmSheet('Remove friend?', 'This removes the connection for both of you.', 'Remove'))) return;
      const row = button.closest('.friend-row');
      busy(button, async () => { if (row) await collapse(row, { remove: false });
        try { await D.removeFriend(app.ctx, button.dataset.removeFriend); } catch (err) { row?.getAnimations().forEach((a) => a.cancel()); toast(errText(err), true); } });
    }; });
  };
  const stop = D.watchFriendships(app.ctx, (rows) => {
    latest = rows;
    if (!accepting.size) paint(rows);
  }, (err) => { if (!disposed) $('#friend-lists', root).textContent = errText(err); });
  return () => { disposed = true; jumpAnimation?.cancel(); stop(); };
}
