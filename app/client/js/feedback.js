// Questions and feedback: students ask anything or comment on the app, and see the team's replies here.
// Opened from the account menu. Rules: up to 3 messages a day, readable only by the student and the Admin team.
import * as D from './data.js';
import { ozTag } from './oz-ui.js';
import { ozIcon } from './oz-icons.js';
import { $, esc, icon, toast, busy, errText, fmtDate } from './ui.js';

const STATUS = { new: 'Sent', replied: 'Replied', done: 'Read by the team' };

// Which replies this student has already seen, kept in this browser, so the account menu can say "1 new reply".
const SEEN_KEY = (uid) => `onz-feedback-seen:${uid}`;
const seenIds = (uid) => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY(uid)) || '[]')); } catch { return new Set(); } };
export function unseenReplies(uid, items) { const seen = seenIds(uid); return items.filter((f) => f.status === 'replied' && !seen.has(f.id + ':' + (D.toMs(f.repliedAt) || 0))).length; }
function markSeen(uid, items) {
  try { localStorage.setItem(SEEN_KEY(uid), JSON.stringify(items.filter((f) => f.status === 'replied').map((f) => f.id + ':' + (D.toMs(f.repliedAt) || 0)))); } catch { /* private mode */ }
}

/** The "What's on your mind?" composer (OpenTable / DoorDash on Mobbin): topic chips, one message box, one Send.
 *  Shared by this page and Contact us, so there is one way to write to the team. The chips are real radios. */
export function feedbackFormHTML({ title = 'What’s on your mind?' } = {}) {
  return `<form id="fb-form" class="oz-help-panel fb-form oz-composer" novalidate>
      <h2 class="oz-composer-title">${esc(title)}</h2>
      <fieldset class="oz-chips"><legend class="oz-sr">Topic</legend>
        ${D.FEEDBACK_TOPICS.map(([k, label], i) => `<label class="oz-chip"><input type="radio" name="topic" value="${k}" ${i === 0 ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}
      </fieldset>
      <label class="oz-composer-box"><span class="oz-sr">Your message</span><textarea name="message" rows="4" minlength="5" maxlength="1000" required placeholder="Ask a question or share an idea"></textarea>
        <small class="fb-count" aria-live="polite"><span id="fb-count" data-no-i18n>0</span>/1,000</small></label>
      <button class="oz-btn oz-btn-primary oz-btn-md oz-btn-block" type="submit">${ozIcon('send')}<span>Send</span></button>
      <p class="oz-composer-fine">Only you and the +Onz team see this · up to ${D.FEEDBACK_PER_DAY} a day</p>
    </form>`;
}
export async function feedbackRender() {
  return `<div class="oz-help oz-feedback"><a class="oz-help-back" href="#/me">${icon('chevron-left')} Me</a>
    <div class="oz-help-heading"><h1>Questions and feedback</h1></div>
    ${feedbackFormHTML()}
    <section class="oz-help-messages"><h2>My messages</h2><div id="fb-list"><div class="oz-skel-list" aria-hidden="true"><span class="oz-skel oz-skel-row"></span><span class="oz-skel oz-skel-row"></span></div></div></section></div>`;
}
/** Sends the composer through the in-app feedback flow (same limits and storage as before). */
export function mountFeedbackForm(root, app) {
  const f = $('#fb-form', root); if (!f) return;
  const box = f.message;
  box.oninput = () => { $('#fb-count', root).textContent = box.value.length.toLocaleString('en-MY'); };
  f.onsubmit = (e) => {
    e.preventDefault();
    if (box.value.trim().length < 5) { toast('Write a little more so we can help.', true); box.focus(); return; }
    busy($('button[type=submit]', f), async () => {
      try {
        await D.sendFeedback(app.ctx, f.topic.value, box.value);
        f.reset(); $('#fb-count', root).textContent = '0';
        toast('Thanks! Your message has been sent to the +Onz team.');
      } catch (err) { toast(errText(err), true); }
    });
  };
}

const item = (f) => `<article class="oz-help-panel fb-item">
  <div class="fb-meta">${ozTag(D.feedbackTopic(f.topic), 'sky')}<span class="faint">${fmtDate(f.createdAt)}</span>
    <span class="fb-status ${esc(f.status)}">${esc(STATUS[f.status] || 'Sent')}</span></div>
  <p class="fb-msg" data-no-i18n>${esc(f.message)}</p>
  ${f.reply ? `<div class="fb-reply"><b>${icon('mail')} +Onz team</b><p data-no-i18n>${esc(f.reply)}</p><span class="faint">${fmtDate(f.repliedAt)}</span></div>` : ''}
</article>`;

export function feedbackMount(root, app) {
  mountFeedbackForm(root, app);
  const stop = D.watchMyFeedback(app.ctx, (items) => {
    const el = $('#fb-list', root); if (!el) return;
    el.innerHTML = items.map(item).join('') || `<div class="oz-help-panel"><p>No messages yet. Your questions and our replies will show here.</p></div>`;
    markSeen(app.ctx.uid, items); app.feedbackNew = 0; app.paintFeedbackDot?.();
  }, () => { const el = $('#fb-list', root); if (el) el.innerHTML = '<p class="faint">Couldn’t load your messages.</p>'; });
  return stop;
}
