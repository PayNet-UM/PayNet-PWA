// Merchant page for the stall survey (questions in ../stall-survey.js). The merchant picks English or Bahasa Melayu
// at the top; both languages are in the page and the switch only changes which one shows, so answers are kept.
import * as D from './data.js';
import { STALL_SECTIONS, STALL_QUESTIONS, STALL_TYPES, STALL_QUIZ_COUNT, stallSetup } from './stall-survey.js';
import { getLang, setLang as setAppLang } from './i18n.js';
import { $, $$, esc, icon, toast, busy, confetti } from './ui.js';
import { merchantHeading } from './merchant-ui.js';
import * as Guide from './guide.js';

let surveyLang = null; // remembered while the app is open
let editing = false;
const bi = (t) => `<span lang="en">${esc(t.en)}</span><span lang="ms">${esc(t.ms)}</span>`;
const say = (en, ms) => (surveyLang === 'ms' ? ms : en);

function questionHTML(q, saved = {}) {
  const v = saved[q.id]; const picked = new Set([].concat(v ?? []).map(String));
  const req = q.required ? ' <b class="ss-req" aria-hidden="true">*</b>' : '';
  const hint = q.hint ? `<p class="faint ss-hint">${bi(q.hint)}</p>` : '';
  if (q.options) {
    const kind = q.type === 'multi' ? 'checkbox' : 'radio';
    const opts = [...q.options, ...(q.other ? [{ code: 'other', en: 'Other', ms: 'Lain-lain' }] : [])];
    return `<fieldset class="card ss-q" data-q="${q.id}" data-type="${q.type}" ${q.max ? `data-max="${q.max}"` : ''} ${q.none ? `data-none="${q.none}"` : ''}>
      <legend>${bi(q)}${req}</legend>${hint}
      <div class="ss-options ${q.options.length > 8 ? 'is-grid' : ''}">${opts.map((x) => `<label class="check"><input type="${kind}" name="${q.id}" value="${esc(x.code)}" ${picked.has(x.code) ? 'checked' : ''}${kind === 'radio' && q.required ? ' required' : ''}> ${bi(x)}</label>`).join('')}</div>
      ${q.other ? `<label class="field ss-other ${picked.has('other') ? '' : 'hidden'}">
        <input name="${q.id}Other" aria-label="Other / Lain-lain" maxlength="80" value="${esc(saved[q.id + 'Other'] || '')}" placeholder="${say('Please say', 'Sila nyatakan')}" data-ph-en="Please say" data-ph-ms="Sila nyatakan"></label>` : ''}
    </fieldset>`;
  }
  const attrs = q.type === 'number' ? 'type="number" inputmode="numeric" min="0" max="999" step="1"'
    : q.type === 'tel' ? 'type="tel" inputmode="tel" autocomplete="tel" maxlength="20"' : `type="text" maxlength="${q.max || 80}"`;
  return `<label class="card field ss-q" data-q="${q.id}">${bi(q)}${req}${hint}<input name="${q.id}" ${attrs} value="${esc(v ?? '')}"></label>`;
}

function resultHTML(s) {
  const t = STALL_TYPES[s.stallType] || STALL_TYPES.cash; const setup = stallSetup(s.answers);
  return `<section class="card ss-result" id="ss-result">
      <span class="ss-result-icon">${icon(t.icon)}</span>
      <p class="mer-eyebrow">${bi({ en: 'Your stall type', ms: 'Jenis kedai anda' })}</p>
      <h2>${bi(t)}</h2><p>${bi(t.about)}</p>
      ${setup.length ? `<h3>${bi({ en: 'What we can set up for you, free', ms: 'Apa yang kami boleh bantu, percuma' })}</h3>
      <ul class="ss-setup">${setup.map((x) => `<li>${icon('check')}<span>${bi(x)}</span></li>`).join('')}</ul>` : ''}
      <p class="faint">${bi({ en: 'The Admin team will contact you about anything you asked for.', ms: 'Pasukan Admin akan menghubungi anda tentang apa yang anda minta.' })}</p>
      <div class="row ss-result-actions"><button class="btn" type="button" id="ss-edit">${icon('pencil')} ${bi({ en: 'Edit my answers', ms: 'Ubah jawapan saya' })}</button>
        <a class="btn primary" href="#/home">${bi({ en: 'Go to home', ms: 'Ke laman utama' })}</a></div>
    </section>`;
}

export async function stallSurveyRender(app) {
  surveyLang = getLang() === 'ms' ? 'ms' : 'en';
  const back = `<a class="back" href="#/home">${icon('arrow-left')} Home</a>`;
  if (!app.merchant) {
    return `<div class="merchant-page mer-survey">${back}${merchantHeading('Stall survey', 'Send your shop details first, then tell us about your stall.', 'list-checks', 'About 3 minutes')}
      <a class="btn primary" href="#/shop">Send shop details</a></div>`;
  }
  const saved = await D.getStallSurvey(app.ctx).catch(() => null);
  app.stallSurveyDone = !!saved;
  const showResult = saved && !editing;
  const sections = STALL_SECTIONS.map((sec) => `<section class="ss-section" data-sec="${sec.id}"><div class="mer-section-head"><h2>${bi(sec)}</h2></div>
      <p class="faint">${bi(sec.note)}</p>${STALL_QUESTIONS.filter((q) => q.section === sec.id).map((q) => questionHTML(q, saved?.answers)).join('')}</section>`).join('');
  // Until it's answered the survey is a required step: no way "back", and a note saying why.
  const required = !saved ? `<div class="notice ss-required" role="note">${icon('lock')}<div><b>${bi({ en: 'One last step before you start', ms: 'Satu langkah terakhir sebelum anda mula' })}</b>
      <p>${bi({ en: 'Finish this survey to use +Onz for Business. It takes about 3 minutes, and you can change your answers later.', ms: 'Lengkapkan tinjauan ini untuk menggunakan +Onz for Business. Ia mengambil masa kira-kira 3 minit, dan anda boleh ubah jawapan kemudian.' })}</p></div></div>` : '';
  return `<div class="merchant-page mer-survey stall-survey">${saved ? back : ''}
    ${merchantHeading('Stall survey', `${STALL_QUIZ_COUNT} quick questions about your stall. Find out your stall type and what the team can set up for you, free.`, 'list-checks', 'About 3 minutes')}
    <div class="ss" data-ss="${surveyLang}" data-no-i18n>${required}
      <div class="ss-lang card"><span>${bi({ en: 'Answer in', ms: 'Jawab dalam' })}${showResult ? '' : ` <button type="button" class="league-help" id="ss-help" aria-label="How the stall survey works / Cara tinjauan ini berfungsi" title="How the stall survey works">${icon('info')}</button>`}</span>
        <div class="chips" role="group" aria-label="Survey language / Bahasa tinjauan"><button type="button" data-ss-lang="en" lang="en" aria-pressed="${surveyLang === 'en'}">English</button><button type="button" data-ss-lang="ms" lang="ms" aria-pressed="${surveyLang === 'ms'}">Bahasa Melayu</button></div></div>
      <p class="faint ss-privacy">${icon('shield-check')} ${bi({ en: 'We never ask for IC numbers. Only you and the Admin team see your answers.', ms: 'Kami tidak meminta nombor IC. Hanya anda dan pasukan Admin melihat jawapan anda.' })}</p>
      ${showResult ? resultHTML(saved) : `<form id="stall-survey" class="stack" novalidate>${sections}
        <p class="faint">${bi({ en: '* Required', ms: '* Wajib' })}</p>
        <button class="btn primary block" type="submit">${bi(saved ? { en: 'Save my answers', ms: 'Simpan jawapan saya' } : { en: 'See my stall type', ms: 'Lihat jenis kedai saya' })}</button></form>`}
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

  // "Other" boxes, "Nothing, I'm fine" on its own, and at most 2 picks where asked.
  $$('fieldset.ss-q', f).forEach((fs) => {
    const sync = (changed) => {
      const inputs = $$('input[type=checkbox], input[type=radio]', fs);
      if (fs.dataset.none && changed?.checked) {
        if (changed.value === fs.dataset.none) inputs.forEach((i) => { if (i !== changed) i.checked = false; });
        else inputs.forEach((i) => { if (i.value === fs.dataset.none) i.checked = false; });
      }
      if (fs.dataset.max) {
        const full = inputs.filter((i) => i.checked).length >= Number(fs.dataset.max);
        inputs.forEach((i) => { i.disabled = full && !i.checked; });
      }
      const other = $('.ss-other', fs);
      if (other) { const on = inputs.some((i) => i.value === 'other' && i.checked); other.classList.toggle('hidden', !on); if (on && changed?.value === 'other') $('input', other).focus(); }
      fs.classList.remove('is-missing');
    };
    fs.onchange = (e) => sync(e.target); sync();
  });
  f.oninput = (e) => e.target.closest('.ss-q')?.classList.remove('is-missing');

  f.onsubmit = (e) => {
    e.preventDefault();
    const raw = {};
    for (const q of STALL_QUESTIONS) {
      raw[q.id] = q.type === 'multi' ? $$(`input[name="${q.id}"]:checked`, f).map((i) => i.value) : (q.options ? ($(`input[name="${q.id}"]:checked`, f)?.value || '') : f[q.id].value);
      if (q.other) raw[q.id + 'Other'] = f[q.id + 'Other'].value;
    }
    busy($('button[type=submit]', f), async () => {
      try {
        const res = await D.submitStallSurvey(app.ctx, raw, surveyLang);
        const firstTime = !app.stallSurveyDone;
        editing = false; app.stallSurveyDone = true; confetti();
        toast(firstTime ? say('All done! Here’s your stall type, and the rest of +Onz for Business is now open.', 'Selesai! Ini jenis kedai anda, dan bahagian lain +Onz for Business kini dibuka.')
          : say('Thanks! Here’s your stall type.', 'Terima kasih! Ini jenis kedai anda.'));
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
