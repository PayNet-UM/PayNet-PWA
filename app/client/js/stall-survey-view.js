// Merchant page for the +Onz Merchant Assessment, the "stall survey" (questions in ../stall-survey.js). The merchant picks English or Bahasa Melayu
// at the top; both languages are in the page and the switch only changes which one shows, so answers are kept.
import * as D from './data.js';
import { STALL_SECTIONS, STALL_QUESTIONS, STALL_TYPES, STALL_INTRO, STALL_QUESTION_COUNT, stallSetup, stallPrefillFromV1, isCurrentStallSurvey } from './stall-survey.js';
import { getLang, setLang as setAppLang } from './i18n.js';
import { $, $$, esc, icon, toast, busy, confetti } from './ui.js';
import { merchantHeading } from './merchant-ui.js';
import * as Guide from './guide.js';

let surveyLang = null; // remembered while the app is open
let editing = false;
const bi = (t) => `<span lang="en">${esc(t.en)}</span><span lang="ms">${esc(t.ms)}</span>`;
const say = (en, ms) => (surveyLang === 'ms' ? ms : en);

function questionHTML(q, saved = {}, number = '') {
  const v = saved[q.id]; const picked = new Set([].concat(v ?? []).map(String));
  const req = q.required || q.requiredIf ? ' <b class="ss-req" aria-hidden="true">*</b>' : '';
  const hint = q.hint ? `<p class="faint ss-hint">${bi(q.hint)}</p>` : '';
  const num = number ? `<span class="ss-num">${number}.</span> ` : '';
  const show = q.showIf ? ` data-show-if="${q.showIf[0]}:${q.showIf[1].join(',')}"` : '';
  if (q.type === 'consent') {
    return `${q.lead ? `<p class="ss-lead">${bi(q.lead)}</p>` : ''}<div class="card ss-q ss-consent" data-q="${q.id}"${show}><label class="check"><input type="checkbox" name="${q.id}" ${v === true ? 'checked' : ''}> <span>${bi(q)}</span></label>${hint}</div>`;
  }
  if (q.options) {
    const kind = q.type === 'multi' ? 'checkbox' : 'radio';
    const opts = [...q.options, ...(q.other ? [{ code: 'other', en: 'Other', ms: 'Lain-lain' }] : [])];
    return `<fieldset class="card ss-q" data-q="${q.id}" data-type="${q.type}"${show} ${q.max ? `data-max="${q.max}"` : ''}>
      <legend>${num}${bi(q)}${req}</legend>${hint}
      <div class="ss-options ${q.options.length > 8 ? 'is-grid' : ''}">${opts.map((x) => `<label class="check"><input type="${kind}" name="${q.id}" value="${esc(x.code)}" ${picked.has(x.code) ? 'checked' : ''}> ${bi(x)}</label>`).join('')}</div>
      ${q.other ? `<label class="field ss-other ${picked.has('other') ? '' : 'hidden'}">
        <input name="${q.id}Other" aria-label="Other / Lain-lain" maxlength="80" value="${esc(saved[q.id + 'Other'] || '')}" placeholder="${say('Please say', 'Sila nyatakan')}" data-ph-en="Please say" data-ph-ms="Sila nyatakan"></label>` : ''}
    </fieldset>`;
  }
  const attrs = q.type === 'tel' ? 'type="tel" inputmode="tel" autocomplete="tel" maxlength="20"' : `type="text" maxlength="${q.max || 80}"${q.id === 'ownerName' ? ' autocomplete="name"' : ''}`;
  return `<label class="card field ss-q" data-q="${q.id}"${show}><span>${num}${bi(q)}${req}</span>${hint}<input name="${q.id}" ${attrs} value="${esc(v ?? '')}"></label>`;
}

function resultHTML(s) {
  const t = STALL_TYPES[s.stallType] || STALL_TYPES.cash; const setup = stallSetup(s.answers);
  return `<section class="card ss-result" id="ss-result">
      <span class="ss-result-icon">${icon(t.icon)}</span>
      <p class="ss-thanks">${bi(STALL_INTRO.thanks)}</p>
      <p class="mer-eyebrow">${bi({ en: 'Your stall type', ms: 'Jenis kedai anda' })}</p>
      <h2>${bi(t)}</h2><p>${bi(t.about)}</p>
      ${setup.length ? `<h3>${bi({ en: 'How +Onz can help', ms: 'Bagaimana +Onz boleh membantu' })}</h3>
      <ul class="ss-setup">${setup.map((x) => `<li>${icon('check')}<span>${bi(x)}</span></li>`).join('')}</ul>` : ''}
      <p class="faint">${bi(s.answers?.consentContact ? { en: 'The Admin team will contact you about anything you asked for.', ms: 'Pasukan Admin akan menghubungi anda tentang apa yang anda minta.' }
    : { en: 'You chose not to be contacted, so the Admin team won’t reach out. You can change this any time.', ms: 'Anda memilih untuk tidak dihubungi, jadi pasukan Admin tidak akan menghubungi anda. Anda boleh mengubahnya bila-bila masa.' })}</p>
      <div class="row ss-result-actions"><button class="btn" type="button" id="ss-edit">${icon('pencil')} ${bi({ en: 'Edit my answers', ms: 'Ubah jawapan saya' })}</button>
        <a class="btn primary" href="#/home">${bi({ en: 'Go to home', ms: 'Ke laman utama' })}</a></div>
    </section>`;
}

export async function stallSurveyRender(app) {
  surveyLang = getLang() === 'ms' ? 'ms' : 'en';
  const back = `<a class="back" href="#/home">${icon('arrow-left')} Home</a>`;
  const head = (sub) => merchantHeading('Merchant assessment', sub, 'list-checks', 'About 5 minutes');
  if (!app.merchant) {
    return `<div class="merchant-page mer-survey">${back}${head('Send your shop details first, then tell us about your business.')}
      <a class="btn primary" href="#/shop">Send shop details</a></div>`;
  }
  const saved = await D.getStallSurvey(app.ctx).catch(() => null);
  const current = isCurrentStallSurvey(saved); const old = saved && !current;
  app.stallSurveyDone = current;
  const showResult = current && !editing;
  // Pre-fill: their current answers, or what carries over from the earlier version, plus names they've already given.
  const answers = { ...(current ? saved.answers : old ? stallPrefillFromV1(saved.answers) : {}) };
  for (const q of STALL_QUESTIONS) if (q.prefill && !answers[q.id]) answers[q.id] = q.prefill === 'merchantName' ? app.merchant?.name || '' : app.profile?.name || '';
  let lastN = 0;
  const sections = STALL_SECTIONS.map((sec) => `<section class="ss-section" data-sec="${sec.id}"><div class="mer-section-head"><h2>${bi(sec)}</h2></div>
      ${STALL_QUESTIONS.filter((q) => q.section === sec.id).map((q) => { const n = q.n !== lastN ? q.n : ''; lastN = q.n; return questionHTML(q, answers, n); }).join('')}</section>`).join('');
  // Until it's answered the assessment is a required step: no way "back", and a note saying why.
  const required = !current ? `<div class="notice ss-required" role="note">${icon('lock')}<div><b>${bi(old ? { en: 'We’ve updated the assessment', ms: 'Kami telah mengemas kini penilaian ini' } : { en: 'One last step before you start', ms: 'Satu langkah terakhir sebelum anda mula' })}</b>
      <p>${bi(old ? { en: 'Please answer the new questions to keep using +Onz for Business. We’ve filled in what you told us before.', ms: 'Sila jawab soalan baharu untuk terus menggunakan +Onz for Business. Kami telah mengisi apa yang anda beritahu sebelum ini.' }
    : { en: 'Finish this assessment to use +Onz for Business. It takes about 5 minutes, and you can change your answers later.', ms: 'Lengkapkan penilaian ini untuk menggunakan +Onz for Business. Ia mengambil masa kira-kira 5 minit, dan anda boleh ubah jawapan kemudian.' })}</p></div></div>` : '';
  return `<div class="merchant-page mer-survey stall-survey">${current ? back : ''}
    ${head(`${STALL_QUESTION_COUNT} questions about your business, in four short sections. See your stall type and how +Onz can help.`)}
    <div class="ss" data-ss="${surveyLang}" data-no-i18n>${required}
      <div class="ss-lang card"><span>${bi({ en: 'Answer in', ms: 'Jawab dalam' })}${showResult ? '' : ` <button type="button" class="league-help" id="ss-help" aria-label="How the assessment works / Cara penilaian ini berfungsi" title="How the assessment works">${icon('info')}</button>`}</span>
        <div class="chips" role="group" aria-label="Language / Bahasa"><button type="button" data-ss-lang="en" lang="en" aria-pressed="${surveyLang === 'en'}">English</button><button type="button" data-ss-lang="ms" lang="ms" aria-pressed="${surveyLang === 'ms'}">Bahasa Melayu</button></div></div>
      ${showResult ? '' : `<div class="card ss-intro"><p class="mer-eyebrow">${bi(STALL_INTRO.subtitle)}</p><h2>${bi(STALL_INTRO.title)}</h2><p>${bi(STALL_INTRO.body)}</p></div>`}
      <p class="faint ss-privacy">${icon('shield-check')} ${bi({ en: 'We never ask for IC numbers. Only you and the Admin team see your answers.', ms: 'Kami tidak meminta nombor IC. Hanya anda dan pasukan Admin melihat jawapan anda.' })}</p>
      ${showResult ? resultHTML(saved) : `<form id="stall-survey" class="stack" novalidate>${sections}
        <p class="faint">${bi({ en: '* Required', ms: '* Wajib' })}</p>
        <button class="btn primary block" type="submit">${bi(current ? { en: 'Save my answers', ms: 'Simpan jawapan saya' } : { en: 'Send my answers', ms: 'Hantar jawapan saya' })}</button></form>`}
    </div></div>`;
}

export function stallSurveyMount(root, app) {
  const box = $('.ss', root); if (!box) return null;
  // Picking a language here switches the whole app too, so the page around the survey matches.
  const setLang = (l) => {
    surveyLang = l; box.dataset.ss = l; if (getLang() !== l) setAppLang(l);
    $$('[data-ss-lang]', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ssLang === l)));
    $$('[data-ph-en]', box).forEach((i) => { i.placeholder = i.dataset[l === 'ms' ? 'phMs' : 'phEn']; });
  };
  $$('[data-ss-lang]', box).forEach((b) => { b.onclick = () => setLang(b.dataset.ssLang); });
  const edit = $('#ss-edit', box); if (edit) edit.onclick = () => { editing = true; app.render(); };
  const f = $('#stall-survey', box); if (!f) return null;
  // First visit: a short screen guide, like the Leagues page. The (i) button shows it again.
  $('#ss-help', box).onclick = () => Guide.startPageTour(app, 'stall-survey', { replay: true });
  const tour = setTimeout(() => { if (root.isConnected) Guide.startPageTour(app, 'stall-survey'); }, 350);

  // Follow-up questions (financing purpose and amount) only show when they apply.
  const syncShown = () => $$('[data-show-if]', f).forEach((el) => {
    const [id, codes] = el.dataset.showIf.split(':');
    el.classList.toggle('hidden', !codes.split(',').includes($(`input[name="${id}"]:checked`, f)?.value || ''));
  });
  // "Other" boxes, and the most picks where a question says "up to".
  $$('fieldset.ss-q', f).forEach((fs) => {
    const sync = (changed) => {
      const inputs = $$('input[type=checkbox], input[type=radio]', fs);
      if (fs.dataset.max) {
        const full = inputs.filter((i) => i.checked).length >= Number(fs.dataset.max);
        inputs.forEach((i) => { i.disabled = full && !i.checked; });
      }
      const other = $('.ss-other', fs);
      if (other) { const on = inputs.some((i) => i.value === 'other' && i.checked); other.classList.toggle('hidden', !on); if (on && changed?.value === 'other') $('input', other).focus(); }
      fs.classList.remove('is-missing');
    };
    fs.onchange = (e) => { sync(e.target); syncShown(); }; sync();
  });
  syncShown();
  f.oninput = (e) => e.target.closest('.ss-q')?.classList.remove('is-missing');

  f.onsubmit = (e) => {
    e.preventDefault();
    const raw = {};
    for (const q of STALL_QUESTIONS) {
      raw[q.id] = q.type === 'consent' ? f[q.id].checked : q.type === 'multi' ? $$(`input[name="${q.id}"]:checked`, f).map((i) => i.value) : (q.options ? ($(`input[name="${q.id}"]:checked`, f)?.value || '') : f[q.id].value);
      if (q.other) raw[q.id + 'Other'] = f[q.id + 'Other'].value;
    }
    busy($('button[type=submit]', f), async () => {
      try {
        const res = await D.submitStallSurvey(app.ctx, raw, surveyLang);
        const firstTime = !app.stallSurveyDone;
        editing = false; app.stallSurveyDone = true; confetti();
        toast(firstTime ? say('Thank you! The rest of +Onz for Business is now open.', 'Terima kasih! Bahagian lain +Onz for Business kini dibuka.')
          : say('Thanks! Your answers are saved.', 'Terima kasih! Jawapan anda telah disimpan.'));
        await app.render(); root.querySelector('#ss-result')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return res;
      } catch (err) {
        if (err.fields) {
          const ids = new Set(err.fields.map((x) => x.replace(/Other$/, '')));
          $$('.ss-q', f).forEach((el) => el.classList.toggle('is-missing', ids.has(el.dataset.q)));
          const first = $('.ss-q.is-missing', f); first?.scrollIntoView({ block: 'center', behavior: 'smooth' }); $('input:not([disabled])', first)?.focus({ preventScroll: true });
          toast(say('Answer every question marked *. If you picked “Other”, say what it is.', 'Jawab semua soalan bertanda *. Jika anda pilih “Lain-lain”, nyatakannya.'), true);
        } else toast(err.message, true);
      }
    });
  };
  return () => clearTimeout(tour);
}
