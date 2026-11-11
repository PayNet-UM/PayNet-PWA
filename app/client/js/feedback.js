// Questions and feedback: students ask anything or comment on the app, and see the team's replies here.
// Opened from the account menu. Rules: up to 3 messages a day, readable only by the student and HEP.
import * as D from './data.js';
import { $, esc, icon, toast, busy, errText, fmtDate } from './ui.js';

const TOPIC_ICONS = { question: 'info', idea: 'lightbulb', problem: 'circle-alert', other: 'mail' };
const STATUS = { new: 'Sent', replied: 'Replied', done: 'Read by the team' };

// Which replies this student has already seen, kept in this browser, so the account menu can say "1 new reply".
const SEEN_KEY = (uid) => `onz-feedback-seen:${uid}`;
const seenIds = (uid) => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY(uid)) || '[]')); } catch { return new Set(); } };
export function unseenReplies(uid, items) { const seen = seenIds(uid); return items.filter((f) => f.status === 'replied' && !seen.has(f.id + ':' + (D.toMs(f.repliedAt) || 0))).length; }
function markSeen(uid, items) {
  try { localStorage.setItem(SEEN_KEY(uid), JSON.stringify(items.filter((f) => f.status === 'replied').map((f) => f.id + ':' + (D.toMs(f.repliedAt) || 0)))); } catch { /* private mode */ }
}

export async function feedbackRender() {
  return `<a class="back" href="#/me">${icon('arrow-left')} Me</a>
    <div class="page-title"><h1>Questions and feedback</h1><p>Ask us anything, or tell us what you think of +Onz. The +Onz team reads every message.</p></div>
    <form id="fb-form" class="card stack fb-form" novalidate>
      <fieldset class="fb-topics"><legend>What’s it about?</legend>
        ${D.FEEDBACK_TOPICS.map(([k, label], i) => `<label class="fb-topic"><input type="radio" name="topic" value="${k}" ${i === 0 ? 'checked' : ''}><span>${icon(TOPIC_ICONS[k])}<span>${esc(label)}</span></span></label>`).join('')}
      </fieldset>
      <label class="field">Your message<textarea name="message" rows="5" minlength="5" maxlength="1000" required placeholder="Type your question or comment"></textarea>
        <small class="fb-count" aria-live="polite"><span id="fb-count" data-no-i18n>0</span>/1,000</small></label>
      <p class="faint">Only you and the +Onz team can see your messages. You can send up to ${D.FEEDBACK_PER_DAY} a day.</p>
      <button class="btn primary block" type="submit">Send ${icon('arrow-right')}</button>
    </form>
    <section class="section"><div class="head"><h2>My messages</h2></div><div id="fb-list" class="stack"><div class="skeleton" style="height:90px"></div></div></section>`;
}

const item = (f) => `<article class="card fb-item">
  <div class="fb-meta"><span class="badge">${icon(TOPIC_ICONS[f.topic] || 'mail')}${esc(D.feedbackTopic(f.topic))}</span><span class="faint">${fmtDate(f.createdAt)}</span>
    <span class="fb-status ${esc(f.status)}">${esc(STATUS[f.status] || 'Sent')}</span></div>
  <p class="fb-msg" data-no-i18n>${esc(f.message)}</p>
  ${f.reply ? `<div class="fb-reply"><b>${icon('mail')} +Onz team</b><p data-no-i18n>${esc(f.reply)}</p><span class="faint">${fmtDate(f.repliedAt)}</span></div>` : ''}
</article>`;

export function feedbackMount(root, app) {
  const f = $('#fb-form', root); const box = f.message;
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
  const stop = D.watchMyFeedback(app.ctx, (items) => {
    const el = $('#fb-list', root); if (!el) return;
    el.innerHTML = items.map(item).join('') || `<div class="card empty">${icon('mail')}<p>No messages yet. Your questions and our replies will show here.</p></div>`;
    markSeen(app.ctx.uid, items); app.feedbackNew = 0; app.paintFeedbackDot?.();
  }, () => { const el = $('#fb-list', root); if (el) el.innerHTML = '<p class="faint">Couldn’t load your messages.</p>'; });
  return stop;
}
