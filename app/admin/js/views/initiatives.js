// Initiatives and KOL tracking: HEP creates a tracking link (and QR) per KOL, event or campaign, then sees sign-ups
// through it and the before/after change in daily sign-ups. Data comes from the daily summaries (counts only).
import * as D from '../data.js';
import { $, $$, esc, icon, n, sheet, closeSheet, busy, toast, errText, confirmSheet, renderQR } from '../ui.js';
import { hepHeading, hepEmpty } from '../hep-ui.js';
import { addDays, dayOf } from '../daily-stats.js';
import { INITIATIVE_TYPES, HEARD_FROM, SOURCE_RE, toCode, initiativeImpact } from '../initiatives.js';
import { siteUrls } from '../firebase-config.js';

const typeLabel = (t) => (INITIATIVE_TYPES.find(([k]) => k === t) || [t, 'Other'])[1];
// Always a full address, so the QR code opens on a phone (in Demo mode the student app's address is relative).
const linkFor = (code) => { const u = new URL(siteUrls.client || '/', location.origin); u.search = '?src=' + encodeURIComponent(code); return u.href; };
const signed = (x) => (x == null ? '—' : (x > 0 ? '+' : '') + n(x));

export async function initiativesRender(app) {
  const today = dayOf(Date.now());
  const [items, rows] = await Promise.all([D.listInitiatives(app.ctx), D.listDailyStats(app.ctx, addDays(today, -180))]);
  app._ini = items;
  const head = hepHeading('Initiatives', 'Tracking links for KOLs, events and campaigns, and what changed after each one.', 'target',
    `<button class="btn primary" id="ini-new">${icon('plus')} New initiative</button>`);
  const latest = rows[rows.length - 1];
  const scored = items.map((it) => ({ it, x: initiativeImpact(rows, it) }));
  const table = scored.length ? `<div class="table-wrap"><table class="data ini-table"><thead><tr><th>Initiative</th><th class="r">Sign-ups via link</th><th class="r">Of them, active</th>
      <th class="r">Daily sign-ups before → after</th><th class="r">Estimated extra sign-ups</th><th></th></tr></thead><tbody>
      ${scored.map(({ it, x }) => `<tr><td><b>${esc(it.name)}</b><br><span class="faint">${esc(typeLabel(it.type))} · ${esc(it.start || '')}${it.end ? ' to ' + esc(it.end) : ''} · <code>${esc(it.code)}</code></span></td>
        <td class="r num">${n(x.viaLink)}</td><td class="r num">${n(x.activatedViaLink)}</td>
        <td class="r num">${x.before == null ? '—' : `${x.before} → ${x.after}`}${x.days ? `<br><span class="faint">${n(x.days)} days after</span>` : ''}</td>
        <td class="r num">${signed(x.extra)}</td>
        <td class="r"><div class="row end" style="gap:6px;flex-wrap:wrap"><button class="btn small" data-ini-link="${esc(it.code)}">${icon('qr-code')} Link</button>
          <button class="btn small ghost" data-ini-edit="${esc(it.code)}">Edit</button></div></td></tr>`).join('')}</tbody></table></div>`
    : hepEmpty('No initiatives yet. Create one for each KOL, event or campaign you want to measure.', 'target');
  const kols = scored.filter(({ it }) => it.type === 'kol').sort((a, b) => b.x.viaLink - a.x.viaLink || b.x.activatedViaLink - a.x.activatedViaLink);
  const heard = latest?.sources?.byHeardFrom || {};
  const heardTotal = Object.values(heard).reduce((a, b) => a + b, 0);
  return `${head}
    <section class="card pad-lg dash-section"><h2>All initiatives</h2>
      <p class="faint">“Estimated extra sign-ups” compares daily sign-ups after the start with the 14 days before it. Other things happening at the same time also move this number, so read it together with sign-ups through the link.</p>${table}</section>
    <section class="card pad-lg dash-section"><h2>KOL ranking</h2>${kols.length ? `<table class="data dash-break"><thead><tr><th>KOL</th><th class="r">Sign-ups via link</th><th class="r">Of them, active</th></tr></thead><tbody>
      ${kols.map(({ it, x }, i) => `<tr><td>${i + 1}. <b>${esc(it.name)}</b></td><td class="r num">${n(x.viaLink)}</td><td class="r num">${n(x.activatedViaLink)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="faint">Add initiatives with the type “KOL or influencer” to rank them.</p>'}</section>
    <section class="card pad-lg dash-section"><h2>How students heard about +Onz</h2><p class="faint">From the optional question at sign-up (${n(heardTotal)} answers).</p>
      ${heardTotal ? `<table class="data dash-break"><tbody>${HEARD_FROM.filter(([k]) => heard[k]).sort((a, b) => heard[b[0]] - heard[a[0]]).map(([k, label]) => `<tr><td>${esc(label)}</td><td class="r num">${n(heard[k])}</td><td class="r num">${Math.round((heard[k] / heardTotal) * 100)}%</td></tr>`).join('')}</tbody></table>` : '<p class="faint">No answers yet.</p>'}</section>`;
}

function editSheet(app, it = null) {
  const el = sheet(`<h2>${it ? 'Edit initiative' : 'New initiative'}</h2><p class="muted">Changes are recorded in the Activity log.</p>
    <form id="ini-form" class="stack" style="margin-top:12px">
      <label class="field">Name<input name="name" required minlength="2" maxlength="80" value="${esc(it?.name || '')}" placeholder="e.g. JTK roundtable, or @kolname"></label>
      <label class="field">Type<select name="type">${INITIATIVE_TYPES.map(([k, v]) => `<option value="${k}" ${k === (it?.type || 'kol') ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label class="field">Tracking code<input name="code" required pattern="[a-z0-9\\-]{2,30}" maxlength="30" value="${esc(it?.code || '')}" ${it ? 'readonly' : ''}><small>Used in the link. Lower-case letters, numbers and dashes${it ? '; it can’t be changed once created' : ''}.</small></label>
      <div class="grid-2"><label class="field">Start date<input name="start" type="date" required value="${esc(it?.start || '')}"></label>
        <label class="field">End date <span class="faint">(optional)</span><input name="end" type="date" value="${esc(it?.end || '')}"></label></div>
      <button class="btn primary block">Save</button>
      ${it ? '<button type="button" class="btn warn block" id="ini-del">Delete initiative</button>' : ''}</form>`);
  const f = $('#ini-form', el);
  if (!it) f.name.oninput = () => { if (!f.code.dataset.touched) f.code.value = toCode(f.name.value); };
  f.code.oninput = () => { f.code.dataset.touched = '1'; };
  f.onsubmit = (e) => { e.preventDefault();
    const code = f.code.value.trim();
    if (!SOURCE_RE.test(code)) return toast('Use 2–30 lower-case letters, numbers or dashes for the code.', true);
    if (!it && app._ini.some((x) => x.code === code)) return toast('That code is already used by another initiative.', true);
    if (f.end.value && f.end.value < f.start.value) return toast('The end date must be after the start date.', true);
    busy($('button.primary', f), async () => { try {
      await D.saveInitiative(app.ctx, code, { name: f.name.value.trim(), type: f.type.value, start: f.start.value, end: f.end.value || '' });
      closeSheet(); toast('Initiative saved.'); app.render(); } catch (err) { toast(errText(err), true); } }); };
  if ($('#ini-del', el)) $('#ini-del', el).onclick = async () => {
    if (!(await confirmSheet('Delete initiative?', 'Its tracking link keeps working for students, but it won’t be listed here.', 'Delete', true))) return editSheet(app, it);
    try { await D.deleteInitiative(app.ctx, it.code, it.name); toast('Initiative deleted.'); app.render(); } catch (err) { toast(errText(err), true); }
  };
}
function linkSheet(it) {
  const url = linkFor(it.code);
  const el = sheet(`<h2>${esc(it.name)}</h2><p class="muted">Share this link or QR code. Students who sign up within 30 days of opening it are counted.</p>
    <div class="ini-qr" id="ini-qr" style="margin:14px auto;width:220px"></div>
    <label class="field">Link<input id="ini-url" readonly value="${esc(url)}"></label>
    <button class="btn primary block" id="ini-copy">${icon('copy')} Copy link</button>`);
  try { renderQR($('#ini-qr', el), url, 220); } catch { $('#ini-qr', el).textContent = 'The QR code couldn’t load. Copy the link instead.'; }
  $('#ini-copy', el).onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link copied.'); } catch { $('#ini-url', el).select(); toast('Select the link and copy it.'); } };
}
export function initiativesMount(root, app) {
  $('#ini-new', root).onclick = () => editSheet(app);
  $$('[data-ini-edit]', root).forEach((b) => { b.onclick = () => editSheet(app, app._ini.find((x) => x.code === b.dataset.iniEdit)); });
  $$('[data-ini-link]', root).forEach((b) => { b.onclick = () => linkSheet(app._ini.find((x) => x.code === b.dataset.iniLink)); });
}
