// HEP Dashboard: programme performance from the daily summaries (dailyStats, built by the server every 3 hours,
// or by Demo mode). Sections follow the team lead's brief; every number says where it comes from.
import * as D from '../data.js';
import { $, $$, esc, icon, n, rm, fmtDateTime, sheet, closeSheet, busy, toast, errText, loadExcel, downloadBlob } from '../ui.js';
import { reportSheets } from '../report.js';
import { INITIATIVE_TYPES, HEARD_FROM } from '../initiatives.js';
import { hepHeading, hepEmpty } from '../hep-ui.js';
import { addDays, dayOf } from '../daily-stats.js';
import { STALL_TYPES } from '../stall-survey.js';
import { KPIS, FIGURE_FIELDS, kpiSettings, kpiActuals, kpiStatus, monthlyTransactions, STATUS_LABEL } from '../kpis.js';
import { PAGE_NAMES } from '../page-time.js';
import { TREND_METRICS, TREND_RANGES, TREND_GROUPS, series, rangeDays, periodChange, periodValue, fmtValue, drawTrend } from '../trend-chart.js';
import { COMPARE_MAX, COMPARE_DEFAULT, KPI_PREFIX, kpiFor, cleanSelection, cleanRange, compareLink, fromRouteArgs, compareSheet } from '../dash-compare.js';

const SOURCES = { app: ['From the app', 'ok'], hep: ['Entered by HEP', ''], none: ['Not tracked yet', 'warn'] };
const badge = (kind) => `<span class="badge ${SOURCES[kind][1]} dash-source">${SOURCES[kind][0]}</span>`;

// A small trend line for the last few weeks (one point per week).
function spark(values) {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return '';
  const max = Math.max(...v, 1), w = 96, h = 26, step = w / (v.length - 1);
  const pts = v.map((x, i) => `${(i * step).toFixed(1)},${(h - 2 - (x / max) * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="dash-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}
const tile = (label, value, detail, source, trend = []) => `<div class="stat dash-tile">
  <div class="k">${label}</div><div class="v num">${value}</div>${spark(trend)}
  <div class="s">${detail ? `<span>${detail}</span>` : ''}${badge(source)}</div></div>`;
const missing = (label, why) => tile(label, '—', why, 'none');
const top = (obj, label = (k) => (k === 'none' ? 'Not set' : k), max = 6) => {
  const rows = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, max);
  return rows.length ? `<table class="data dash-break"><tbody>${rows.map(([k, c]) => `<tr><td data-no-i18n>${esc(label(k))}</td><td class="r num">${n(c)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="faint">No data yet.</p>';
};
const sectionId = (title) => 'dash-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const section = (title, intro, body) => `<section class="card pad-lg dash-section" id="${sectionId(title)}"><h2 tabindex="-1">${title}</h2>${intro ? `<p class="faint">${intro}</p>` : ''}${body}</section>`;
// The Dashboard's sections, in page order, for the jump bar (team request: get to section 6 without scrolling).
const SECTIONS = ['Key metrics', 'Trends', '1. Students and engagement', 'Time in the app', '2. Merchants', '3. Commerce and transactions', '4. Campaigns', '5. Impact', '6. KPI tracking'];
function jumpHTML() {
  return `<nav class="dash-jump no-print" aria-label="Dashboard sections">
    <div class="dash-jump-chips">${SECTIONS.map((t) => `<button type="button" class="dash-jump-chip" data-jump="${sectionId(t)}">${esc(t)}</button>`).join('')}</div>
    <label class="dash-jump-select"><span class="sr">Jump to section</span><select id="dash-jump">${SECTIONS.map((t) => `<option value="${sectionId(t)}">${esc(t)}</option>`).join('')}</select></label>
  </nav>`;
}

export async function dashboardRender(app, args = []) {
  const shared = fromRouteArgs(args);
  if (shared) saveCompare(shared);
  const today = dayOf(Date.now());
  const [rows, paynet, allPaynet, manualRows, savedTargets, savedFigures] = await Promise.all([D.listDailyStats(app.ctx),
    D.paynetCounts(app.ctx, D.monthKey()).catch(() => []), D.allPaynetCounts(app.ctx).catch(() => []), D.listManualVolumes(app.ctx).catch(() => []),
    D.getConfig(app.ctx, 'kpiTargets').catch(() => null), D.getConfig(app.ctx, 'kpiFigures').catch(() => null)]);
  const settings = kpiSettings(savedTargets || {}), figures = savedFigures || {}, months = monthlyTransactions(allPaynet, manualRows);
  app._kpi = { settings, figures };
  app._dash = { rows, settings, figures, months };
  const head = hepHeading('Dashboard', 'How +Onz is doing: students, merchants, transactions, campaigns and impact. Each number says where it comes from.', 'chart-column',
    `<div class="row no-print" style="gap:8px;flex-wrap:wrap"><button class="btn small" id="dash-xlsx">${icon('download')} Excel report</button><button class="btn small" id="dash-print">${icon('printer')} Print or save as PDF</button></div>`)
    + `<p class="print-only faint">+Onz programme report · printed ${esc(fmtDateTime(Date.now()))}</p>`;
  if (!rows.length) return head + hepEmpty('No summary yet. It appears within 3 hours of the server update, or straight away after the backfill in docs/DEPLOY.md.', 'chart-column');
  const latest = rows[rows.length - 1], byDay = new Map(rows.map((r) => [r.day, r]));
  const weekly = (pick) => [8, 7, 6, 5, 4, 3, 2, 1, 0].map((i) => byDay.get(addDays(latest.day, -7 * i))).filter(Boolean).map(pick);
  const s = latest.students, a = latest.active, act = latest.activation, m = latest.merchants, c = latest.commerce, com = latest.community;
  const paynetMonth = paynet.reduce((sum, r) => sum + (r.count || 0), 0);
  const stallLabel = (k) => STALL_TYPES[k]?.en || k;
  const digital = (m.digitalMix?.businessQr || 0) + (m.digitalMix?.card || 0);

  const tiers = `<div class="table-wrap"><table class="data dash-tiers"><thead><tr><th>Students who…</th><th class="r">Today</th><th class="r">Last 7 days</th><th class="r">Last 30 days</th></tr></thead><tbody>
    <tr><td><b>Opened the app</b><br><span class="faint">Opened +Onz at least once</span></td><td class="r num">${n(a.d1.opened)}</td><td class="r num">${n(a.d7.opened)}</td><td class="r num">${n(a.d30.opened)}</td></tr>
    <tr><td><b>Basic Active Users</b><br><span class="faint">Did a lesson, the money check or an event submission</span></td><td class="r num">${n(a.d1.basic)}</td><td class="r num">${n(a.d7.basic)}</td><td class="r num">${n(a.d30.basic)}</td></tr>
    <tr><td><b>Engaged Active Users</b><br><span class="faint">Used ${n(latest.settings?.engagedAreas || 3)} or more of 4 areas: Learn, Rewards, Community and Habit (7-day streak)</span></td><td class="r num">${n(a.d1.engaged)}</td><td class="r num">${n(a.d7.engaged)}</td><td class="r num">${n(a.d30.engaged)}</td></tr>
    </tbody></table></div>`;

  return `${head}
    ${kpiFlags(latest, settings, figures, months)}
    <p class="faint dash-updated">${icon('clock')} Updated every 3 hours. Last update: ${fmtDateTime(latest.generatedAt)}. Figures up to ${esc(latest.day)}.</p>
    ${jumpHTML()}
    ${section('Key metrics', `Your picks, side by side over the same dates (up to ${COMPARE_MAX}). Saved on this computer; Copy link shares this view.`, compareHTML())}
    ${section('Trends', 'Pick a number to see how it changed day by day. Hover over the line, or use the arrow keys, to read each day.', trendsHTML())}
    ${section('1. Students and engagement', '', `<div class="stats dash-grid">
      ${tile('Registered students', n(s.total), `+${n(s.new7)} in the last 7 days`, 'app', weekly((r) => r.students.total))}
      ${tile('Basic Active Users, 30 days', n(a.d30.basic), `${n(a.d7.basic)} in the last 7 days`, 'app', weekly((r) => r.active.d7.basic))}
      ${tile('Engaged Active Users, 30 days', n(a.d30.engaged), `${n(a.d7.engaged)} in the last 7 days`, 'app', weekly((r) => r.active.d7.engaged))}
      ${tile('Daily vs monthly opens', `${a.stickiness}%`, 'Students opening today ÷ in the last 30 days', 'app', weekly((r) => r.active.stickiness))}
      ${tile('Student activation (ever)', n(act.ever), 'Basic Active Users so far (KPI target 4,000)', 'app', weekly((r) => r.activation.ever))}
      ${tile('Repeat participation', `${act.repeatRate}%`, `${n(act.repeat)} came back on another day (KPI target 55%)`, 'app', weekly((r) => r.activation.repeatRate))}
      ${tile('Days opened per week', a.daysPerWeek == null ? '—' : fmtValue(a.daysPerWeek, 'days'), 'Average over the last 7 days, among students who opened the app', 'app', weekly((r) => r.active.daysPerWeek))}
      ${tile('Quiz participation rate', latest.rates ? `${latest.rates.quiz}%` : '—', latest.rates ? `${n(latest.rates.learners)} students did a lesson quiz or the money check` : 'Shown after the next update', 'app', weekly((r) => r.rates?.quiz))}
      </div>${tiers}
      <div class="grid-2" style="margin-top:14px"><div><h3>By residential college</h3>${top(s.byCollege)}</div><div><h3>By faculty</h3>${top(s.byFaculty)}</div></div>`)}
    ${section('Time in the app', 'Anonymous totals: only time while a page is on screen and the student was active in the last 2 minutes. No names or accounts.', timeHTML(latest, weekly))}
    ${section('2. Merchants', '', `<div class="stats dash-grid">
      ${tile('Merchants onboarded', n(m.total), `${n(m.pending)} waiting for review`, 'app', weekly((r) => r.merchants.total))}
      ${tile('Verified merchants', n(m.verified), 'QR checked by HEP (KPI: merchants ready, target 50)', 'app', weekly((r) => r.merchants.verified))}
      ${tile('Merchants assessed', n(m.assessed), 'Merchant assessments done in the app', 'app', weekly((r) => r.merchants.assessed))}
      ${missing('Shop page views', 'The app doesn’t record views yet')}
      </div><div class="grid-2" style="margin-top:14px"><div><h3>By category</h3>${top(m.byType)}</div><div><h3>Payment readiness</h3>${top(m.digitalMix, stallLabel)}</div></div>`)}
    ${section('3. Commerce and transactions', 'The app never handles payments, so purchase amounts come from PayNet or merchants.', `<div class="stats dash-grid">
      ${tile('DuitNow QR transactions this month', n(paynetMonth), 'PayNet’s count for listed merchants, imported on Activity check', 'hep')}
      ${tile('Vouchers claimed', n(c.vouchersIssued), `${n(c.vouchersIssuedToday)} today`, 'app', weekly((r) => r.commerce.vouchersIssued))}
      ${tile('Vouchers used', n(c.vouchersUsed), `${rm(c.voucherValueUsedCents)} paid out`, 'app', weekly((r) => r.commerce.vouchersUsed))}
      ${missing('Gross transaction value', 'Needs PayNet or merchant reporting')}
      ${missing('Bookings and conversion', 'Bookings aren’t in +Onz yet')}
      </div>`)}
    ${section('4. Campaigns', '', `<div class="stats dash-grid">
      ${tile('Live-deal QR claims', n(c.dealClaims), `${n(c.dealClaimsToday)} today`, 'app', weekly((r) => r.commerce.dealClaims))}
      ${tile('Event submissions', n(com.eventSubmissions), 'Student events sent to HEP', 'app', weekly((r) => r.community.eventSubmissions))}
      ${tile('Referral sign-ups', n(com.referrals), 'Friends who joined with a referral code', 'app', weekly((r) => r.community.referrals))}
      ${tile('Referral sign-up rate', latest.rates ? `${latest.rates.referral}%` : '—', 'Share of all students who joined with a referral code', 'app', weekly((r) => r.rates?.referral))}
      ${tile('Friend connections', n(com.friendships), 'Accepted friendships', 'app', weekly((r) => r.community.friendships))}
      ${tile('Sign-ups through tracking links', n(Object.values(latest.sources?.bySource || {}).reduce((a, b) => a + b, 0)), '<a href="#/initiatives">See each KOL and event</a>', 'app')}
      </div>`)}
    ${section('5. Impact', '', `<div class="stats dash-grid">
      ${tile('Merchants accepting digital payments', n(m.verified), `${n(digital)} assessed as business QR or card ready`, 'app')}
      ${tile('Cashless transactions facilitated', n(paynetMonth), 'This month, from PayNet’s count', 'hep')}
      ${missing('Merchant sales through +Onz', 'Needs merchant reporting')}
      ${missing('Student gigs and bookings', 'Planned feature')}
      </div>`)}
    ${section('6. KPI tracking', `Programme period ${esc(settings.start)} to ${esc(settings.end)}. Counts are judged against where they should be by today; percentages against the target. Amber below ${n(settings.amberPct)}% of that.`,
      kpiTable(latest, settings, figures, months) + `<div class="row" style="margin-top:12px;gap:8px"><button class="btn small" id="kpi-targets">${icon('pencil')} Edit targets</button><button class="btn small" id="kpi-figures">${icon('pencil')} Enter figures</button></div>`)}`;
}

// ------------------------------------------------------------- Time in the app (app/shared/js/page-time.js)
const fmtDuration = (ms) => { const m = Math.round((ms || 0) / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : m >= 1 ? `${m} min` : `${Math.round((ms || 0) / 1000)} s`; };
const share = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
function timeHTML(latest, weekly) {
  const t = latest.time;
  if (!t) return '<p class="faint">Shown after the next update.</p>';
  const pages = Object.entries(t.pages7 || {}).filter(([, p]) => p.ms > 0 || p.views > 0).sort((a, b) => b[1].ms - a[1].ms);
  const reach = (p) => [['25%', p.r25], ['Half', p.r50], ['75%', p.r75], ['End', p.r100]].map(([label, c]) => {
    const v = share(c, p.views);
    return `<span class="reach-step" title="${label}: ${v}% of visits"><i style="height:${Math.max(2, v * 0.24)}px"></i><small>${label} ${v}%</small></span>`;
  }).join('');
  return `<div class="stats dash-grid">
      ${tile('Minutes per student per day', `${t.minutesPerStudent7} min`, 'Average over the last 7 days, among students who opened the app', 'app', weekly((r) => r.time?.minutesPerStudent7))}
      ${tile('Minutes per student today', `${t.minutesPerStudent} min`, 'Today so far', 'app')}
      ${tile('Total time in the app, 7 days', fmtDuration(t.minutes7 * 60000), 'All students together', 'app', weekly((r) => r.time?.minutes7))}
    </div>
    ${pages.length ? `<div class="table-wrap" style="margin-top:14px"><table class="data dash-pages"><thead><tr><th>Page, last 7 days</th><th class="r">Time</th><th class="r">Visits</th><th class="r">Per visit</th><th>How far visits scrolled</th></tr></thead><tbody>
      ${pages.map(([k, p]) => `<tr><td><b>${esc(PAGE_NAMES[k] || k)}</b></td><td class="r num">${fmtDuration(p.ms)}</td><td class="r num">${n(p.views)}</td>
        <td class="r num">${p.views ? fmtDuration(p.ms / p.views) : '—'}</td><td><div class="reach">${p.views ? reach(p) : '<span class="faint">—</span>'}</div></td></tr>`).join('')}
      </tbody></table></div><p class="faint" style="margin-top:6px">“End” is the share of visits that scrolled to the bottom. A big drop between steps shows where people stop reading.</p>`
    : '<p class="faint" style="margin-top:12px">No page time recorded yet.</p>'}`;
}

// How a number compares with the previous period, and what the headline number means.
const changeText = (ch, metric) => (!ch ? 'No earlier period to compare yet'
  : `${ch.diff > 0 ? '▲ +' : ch.diff < 0 ? '▼ ' : ''}${ch.kind === 'pct' ? ch.diff + '%' : ch.kind === 'pts' ? ch.diff + ' pts'
    : metric.unit === 'days' || metric.unit === 'min' ? `${ch.diff} ${metric.unit}` : fmtValue(ch.diff, '')} vs the previous ${ch.days} days`);
const ofText = (metric) => (metric.agg === 'sum' ? 'in this period' : metric.agg === 'avg' ? 'a day on average' : 'now');

// ------------------------------------------------------------- Key metrics (app/shared/js/dash-compare.js)
const COMPARE_KEY = 'onz-dash-compare';
function compareState() {
  try { const s = JSON.parse(localStorage.getItem(COMPARE_KEY) || 'null'); if (s) return { ids: cleanSelection(s.ids), range: cleanRange(s.range) }; } catch { /* not saved */ }
  return { ids: [...COMPARE_DEFAULT], range: 'programme' };
}
function saveCompare(state) { try { localStorage.setItem(COMPARE_KEY, JSON.stringify({ ids: cleanSelection(state.ids), range: cleanRange(state.range) })); } catch { /* not saved: still works */ } }
function compareHTML() {
  const st = compareState();
  return `<div class="cmp-bar no-print"><div class="trend-ranges" role="group" aria-label="Period for my key metrics">${TREND_RANGES.map(([k, label]) => `<button type="button" class="btn small ${k === st.range ? 'primary' : 'ghost'}" data-cmp-range="${k}" aria-pressed="${k === st.range}">${esc(label)}</button>`).join('')}</div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn small" id="cmp-pick">${icon('list-checks')} Pick metrics</button><button type="button" class="btn small ghost" id="cmp-link">${icon('copy')} Copy link</button></div></div>
    <p class="cmp-caption" id="cmp-caption"></p><div class="cmp-grid" id="cmp-grid"></div>`;
}
// A KPI card: actual against target, how far along, and the status (KPIs aren't day by day, so no chart).
function kpiCard({ k, a, s }, settings) {
  const target = settings.targets[k.id];
  const bar = s.pctOfTarget == null ? 0 : Math.min(100, s.pctOfTarget);
  return `<article class="cmp-card cmp-kpi"><h3 class="cmp-name">${esc(k.name)}</h3>
    <div class="cmp-head"><b class="num cmp-value">${fmtKpi(k, a.value)}</b><span class="trend-of">of ${fmtKpi(k, target)} target</span></div>
    <p class="cmp-status"><span class="badge ${STATUS_CLASS[s.status]}">${STATUS_LABEL[s.status]}</span>${s.pctOfTarget == null ? '' : ` <span class="faint">${s.pctOfTarget}% of target</span>`}</p>
    <div class="cmp-bar-track" role="img" aria-label="${s.pctOfTarget ?? 0}% of target"><i style="width:${bar}%"></i>${k.type === 'cumulative' && s.expected != null && target ? `<b class="cmp-pace" style="left:${Math.min(100, (s.expected / target) * 100)}%" title="Where it should be by today"></b>` : ''}</div>
    <p class="faint cmp-note">${a.pending ? esc(a.pending) : k.type === 'cumulative' && s.expected != null ? `${n(s.expected)} expected by today (the line)` : esc(k.component)}</p></article>`;
}
function mountCompare(root, app) {
  const grid = $('#cmp-grid', root); if (!grid) return () => {};
  const { rows, settings } = app._dash; const latest = rows[rows.length - 1];
  const draw = () => {
    const st = compareState();
    const { from, to } = rangeDays(st.range, rows, latest.day, settings.start);
    // A caption that travels with a screenshot into a slide: what, which dates, and how fresh.
    const nice = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    $('#cmp-caption', root).textContent = `+Onz · Key metrics · ${nice(from)} – ${nice(to)} · updated ${fmtDateTime(latest.generatedAt)}. Each chart has its own scale.`;
    const kpiScores = new Map(scored(latest, app._dash.settings, app._dash.figures, app._dash.months).map((x) => [KPI_PREFIX + x.k.id, x]));
    if (!st.ids.length) { grid.innerHTML = '<p class="faint">No metrics picked. Use Pick metrics to choose up to 6.</p>'; return; }
    grid.innerHTML = st.ids.map((id) => kpiFor(id) ? kpiCard(kpiScores.get(id), app._dash.settings) : `<article class="cmp-card" data-cmp="${id}"><h3 class="cmp-name"></h3><div class="cmp-head"><b class="num cmp-value"></b><span class="trend-of cmp-of"></span></div><p class="faint cmp-change"></p><div class="trend-chart cmp-chart"></div></article>`).join('');
    for (const card of $$('[data-cmp]', grid)) { // the daily-number cards (KPI cards are complete already)
      const metric = TREND_METRICS.find((m) => m.id === card.dataset.cmp);
      $('.cmp-name', card).textContent = metric.label;
      $('.cmp-value', card).textContent = fmtValue(periodValue(rows, metric, from, to), metric.unit);
      $('.cmp-of', card).textContent = ofText(metric);
      $('.cmp-change', card).textContent = changeText(periodChange(rows, metric, from, to), metric);
      drawTrend($('.cmp-chart', card), series(rows, metric, from, to), metric, { compact: true });
    }
  };
  $$('[data-cmp-range]', root).forEach((b) => { b.onclick = () => {
    saveCompare({ ...compareState(), range: b.dataset.cmpRange });
    $$('[data-cmp-range]', root).forEach((x) => { const on = x === b; x.classList.toggle('primary', on); x.classList.toggle('ghost', !on); x.setAttribute('aria-pressed', String(on)); });
    draw();
  }; });
  $('#cmp-pick', root).onclick = () => pickSheet(draw);
  $('#cmp-link', root).onclick = async () => {
    const st = compareState(); const url = compareLink(location.origin + location.pathname, st.ids, st.range);
    try { await navigator.clipboard.writeText(url); toast('Link copied. It opens the Dashboard with these metrics.'); } catch { prompt('Copy this link', url); }
  };
  draw();
  let w = grid.clientWidth;
  if (typeof ResizeObserver !== 'function') return () => {};
  const ro = new ResizeObserver(() => { if (Math.abs(grid.clientWidth - w) > 8) { w = grid.clientWidth; draw(); } }); ro.observe(grid);
  return () => ro.disconnect();
}
// The picker: metrics listed by Dashboard section, up to COMPARE_MAX ticked.
function pickSheet(onSaved) {
  const chosen = new Set(compareState().ids);
  const el = sheet(`<h2>Pick your key metrics</h2><p class="muted">Tick up to ${COMPARE_MAX}. They show side by side at the top of the Dashboard.</p>
    <form id="cmp-form" class="stack" style="margin-top:12px">
      <fieldset class="cmp-group"><legend>KPI targets</legend>${KPIS.map((k) => `<label class="check"><input type="checkbox" name="m" value="${KPI_PREFIX + k.id}" ${chosen.has(KPI_PREFIX + k.id) ? 'checked' : ''}> ${esc(k.name)}</label>`).join('')}</fieldset>
      ${TREND_GROUPS.map((g) => `<fieldset class="cmp-group"><legend>${esc(g)}</legend>${TREND_METRICS.filter((m) => m.group === g).map((m) => `<label class="check"><input type="checkbox" name="m" value="${m.id}" ${chosen.has(m.id) ? 'checked' : ''}> ${esc(m.label)}</label>`).join('')}</fieldset>`).join('')}
      <p class="faint" id="cmp-count" role="status"></p>
      <div class="row" style="gap:8px"><button class="btn primary">Show these</button><button type="button" class="btn ghost" id="cmp-reset">Back to the usual four</button></div>
    </form>`);
  const boxes = $$('input[name=m]', el);
  // Order of ticking is kept, so the cards appear in the order picked.
  const order = [...chosen];
  const sync = () => {
    const n = boxes.filter((b) => b.checked).length;
    $('#cmp-count', el).textContent = `${n} of ${COMPARE_MAX} picked${n >= COMPARE_MAX ? '. Untick one to pick another.' : ''}`;
    boxes.forEach((b) => { b.disabled = !b.checked && n >= COMPARE_MAX; });
  };
  boxes.forEach((b) => { b.onchange = () => { if (b.checked) order.push(b.value); else order.splice(order.indexOf(b.value), 1); sync(); }; });
  sync();
  $('#cmp-reset', el).onclick = () => { boxes.forEach((b) => { b.checked = COMPARE_DEFAULT.includes(b.value); }); order.splice(0, order.length, ...COMPARE_DEFAULT); sync(); };
  $('#cmp-form', el).onsubmit = (e) => { e.preventDefault(); saveCompare({ ...compareState(), ids: order }); closeSheet(); onSaved(); };
}

// ------------------------------------------------------------- Jump to section (sticky, highlights where you are)
function mountJump(root) {
  const nav = $('.dash-jump', root); if (!nav) return () => {};
  const select = $('#dash-jump', nav), chips = $$('[data-jump]', nav), row = $('.dash-jump-chips', nav);
  let lock = '', lockUntil = 0; // while a jump scrolls the page, keep the chosen section highlighted
  const targets = SECTIONS.map((t) => $('#' + sectionId(t), root)).filter(Boolean);
  // On phones the admin menu bar sticks to the top, so the jump bar sits under it.
  const topBar = () => { const rail = document.querySelector('.mpp .rail'); return rail && rail.getBoundingClientRect().width > window.innerWidth * 0.9 ? rail.offsetHeight : 0; };
  const offset = () => topBar() + nav.offsetHeight + 8;
  const place = () => { nav.style.top = topBar() + 'px'; };
  const go = (id) => {
    const el = $('#' + id, root); if (!el) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    lock = id; lockUntil = Date.now() + 1500;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset(), behavior: smooth ? 'smooth' : 'auto' });
    $('h2', el)?.focus({ preventScroll: true });
    mark(id);
  };
  const mark = (id) => {
    chips.forEach((c) => { const on = c.dataset.jump === id; c.classList.toggle('on', on); if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current'); });
    if (select.value !== id) select.value = id;
    // Bring the highlighted button into view in its own row (scrollIntoView would also move, and so stop, the page).
    const chip = chips.find((c) => c.dataset.jump === id);
    if (chip && row.clientWidth && (chip.offsetLeft < row.scrollLeft || chip.offsetLeft + chip.offsetWidth > row.scrollLeft + row.clientWidth)) row.scrollLeft = chip.offsetLeft - 16;
  };
  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (Date.now() < lockUntil) return mark(lock);
      const line = offset() + 4;
      let current = targets[0];
      for (const t of targets) if (t.getBoundingClientRect().top <= line) current = t;
      // At the very bottom the last sections can't reach the top, so the last one on screen counts.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        for (const t of targets) if (t.getBoundingClientRect().top < window.innerHeight * 0.6) current = t;
      }
      if (current) mark(current.id);
    });
  };
  chips.forEach((c) => { c.onclick = () => go(c.dataset.jump); });
  select.onchange = () => go(select.value);
  place(); onScroll();
  const onResize = () => { place(); onScroll(); };
  window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onResize);
  return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
}

// ------------------------------------------------------------- Trends (app/shared/js/trend-chart.js)
const TREND_KEY = 'onz-dash-trend';
const trendState = () => { try { return { metric: 'students', range: 'programme', ...JSON.parse(localStorage.getItem(TREND_KEY) || '{}') }; } catch { return { metric: 'students', range: 'programme' }; } };
function trendsHTML() {
  const st = trendState();
  return `<div class="trend-controls no-print"><label class="field">Number<select id="tr-metric">${TREND_METRICS.map((m) => `<option value="${m.id}" ${m.id === st.metric ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></label>
    <div class="trend-ranges" role="group" aria-label="Period">${TREND_RANGES.map(([k, label]) => `<button type="button" class="btn small ${k === st.range ? 'primary' : 'ghost'}" data-range="${k}" aria-pressed="${k === st.range}">${esc(label)}</button>`).join('')}</div></div>
    <div class="trend-head"><span class="trend-name" id="tr-name"></span><b class="num" id="tr-value"></b><span class="trend-of" id="tr-of"></span><span class="faint" id="tr-change"></span></div>
    <div class="trend-chart" id="tr-chart"></div>
    <details class="trend-table no-print"><summary>Show as table</summary><div class="table-wrap" id="tr-table"></div></details>`;
}
function mountTrends(root, app) {
  const host = $('#tr-chart', root); if (!host) return;
  const { rows, settings } = app._dash; const latest = rows[rows.length - 1];
  const draw = () => {
    const st = trendState(); const metric = TREND_METRICS.find((m) => m.id === st.metric) || TREND_METRICS[0];
    const { from, to } = rangeDays(st.range, rows, latest.day, settings.start);
    const pts = series(rows, metric, from, to);
    const ch = periodChange(rows, metric, from, to);
    $('#tr-name', root).textContent = metric.label;
    // Per-day counts show the period's total, day-to-day figures their daily average, the rest today's value.
    $('#tr-value', root).textContent = fmtValue(periodValue(rows, metric, from, to), metric.unit);
    $('#tr-of', root).textContent = ofText(metric);
    $('#tr-change', root).textContent = changeText(ch, metric);
    drawTrend(host, pts, metric);
    $('#tr-table', root).innerHTML = `<table class="data"><thead><tr><th>Day</th><th class="r">${esc(metric.label)}</th></tr></thead><tbody>${pts.slice().reverse()
      .map((p) => `<tr><td>${esc(p.day)}</td><td class="r num">${esc(fmtValue(p.value, metric.unit))}</td></tr>`).join('')}</tbody></table>`;
  };
  const save = (patch) => { try { localStorage.setItem(TREND_KEY, JSON.stringify({ ...trendState(), ...patch })); } catch { /* not saved: still works */ } };
  $('#tr-metric', root).onchange = (e) => { save({ metric: e.target.value }); draw(); };
  $$('[data-range]', root).forEach((b) => { b.onclick = () => {
    save({ range: b.dataset.range });
    $$('[data-range]', root).forEach((x) => { const on = x === b; x.classList.toggle('primary', on); x.classList.toggle('ghost', !on); x.setAttribute('aria-pressed', String(on)); });
    draw();
  }; });
  draw();
  // Redraw at the new width when the window or sidebar changes size.
  let w = host.clientWidth;
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => { if (Math.abs(host.clientWidth - w) > 8) { w = host.clientWidth; draw(); } }); ro.observe(host); return () => ro.disconnect(); }
}

// ------------------------------------------------------------- KPI tracking (section 6)
const STATUS_CLASS = { on: 'ok', watch: '', behind: 'warn', pending: '', none: '' };
const fmtKpi = (k, v) => (v == null ? '—' : k.unit === '%' ? `${v}%` : n(v));
function scored(latest, settings, figures, months) {
  const actuals = kpiActuals({ latest, figures, months, settings });
  return KPIS.map((k) => ({ k, a: actuals[k.id], s: kpiStatus(k, actuals[k.id].value, settings) }));
}
function kpiFlags(latest, settings, figures, months) {
  const behind = scored(latest, settings, figures, months).filter((x) => x.s.status === 'behind');
  return behind.length ? `<div class="notice warn dash-flags">${icon('circle-alert')} <b>Behind target:</b> ${behind.map((x) => esc(x.k.name)).join(', ')}. See section 6 for what to try.</div>` : '';
}
function kpiTable(latest, settings, figures, months) {
  const rows = scored(latest, settings, figures, months).map(({ k, a, s }) => `<tr>
    <td><b>${esc(k.name)}</b><br><span class="faint">${esc(k.component)}</span></td>
    <td class="r num"><b>${fmtKpi(k, a.value)}</b>${a.parts.length > 1 ? `<br><span class="faint">${a.parts.map((p) => `${esc(p.label)}: ${n(p.value)}`).join(' · ')}</span>` : ''}${a.pending ? `<br><span class="faint">${esc(a.pending)}</span>` : ''}</td>
    <td class="r num">${fmtKpi(k, settings.targets[k.id])}</td>
    <td class="r num">${s.pctOfTarget == null ? '—' : s.pctOfTarget + '%'}${k.type === 'cumulative' && s.expected != null ? `<br><span class="faint">${n(s.expected)} expected by today</span>` : ''}</td>
    <td><span class="badge ${STATUS_CLASS[s.status]}">${STATUS_LABEL[s.status]}</span></td>
    <td class="faint">${s.status === 'behind' || s.status === 'watch' ? `<b>Try:</b> ${esc(k.steps)}` : esc(k.measured)}</td></tr>`).join('');
  return `<div class="table-wrap"><table class="data dash-kpis"><thead><tr><th>KPI</th><th class="r">Actual</th><th class="r">Target</th><th class="r">% of target</th><th>Status</th><th>How it’s measured, or what to try</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function targetsSheet(app) {
  const s = app._kpi.settings;
  const el = sheet(`<h2>Edit KPI targets</h2><p class="muted">From the approved KPI sheet. Changes are recorded in the Activity log.</p>
    <form id="kt" class="stack" style="margin-top:12px"><div class="grid-2"><label class="field">Programme start<input name="start" type="date" required value="${esc(s.start)}"></label>
      <label class="field">Programme end<input name="end" type="date" required value="${esc(s.end)}"></label></div>
      <label class="field">Amber below (% of where it should be)<input name="amberPct" type="number" min="1" max="100" required value="${s.amberPct}"></label>
      ${KPIS.map((k) => `<label class="field">${esc(k.name)}${k.unit ? ' (%)' : ''}<input name="t_${k.id}" type="number" min="0" step="any" required value="${s.targets[k.id]}"></label>`).join('')}
      <button class="btn primary block">Save targets</button></form>`);
  $('#kt', el).onsubmit = (e) => { e.preventDefault(); const f = e.target;
    if (f.end.value < f.start.value) return toast('The end date must be after the start date.', true);
    busy($('button', f), async () => { try {
      await D.saveConfig(app.ctx, 'kpiTargets', { start: f.start.value, end: f.end.value, amberPct: Number(f.amberPct.value),
        targets: Object.fromEntries(KPIS.map((k) => [k.id, Number(f['t_' + k.id].value)])) });
      closeSheet(); toast('KPI targets saved.'); app.render(); } catch (err) { toast(errText(err), true); } }); };
}
function figuresSheet(app) {
  const fig = app._kpi.figures;
  const el = sheet(`<h2>Enter figures</h2><p class="muted">Numbers the app can’t see. They’re labelled “Entered by HEP” and recorded in the Activity log.</p>
    <form id="kf" class="stack" style="margin-top:12px">${FIGURE_FIELDS.map(([key, label]) => `<label class="field">${esc(label)}<input name="${key}" type="number" min="0" step="1" value="${fig[key] ?? ''}"></label>`).join('')}
      <button class="btn primary block">Save figures</button></form>`);
  $('#kf', el).onsubmit = (e) => { e.preventDefault(); const f = e.target;
    busy($('button', f), async () => { try {
      await D.saveConfig(app.ctx, 'kpiFigures', Object.fromEntries(FIGURE_FIELDS.map(([key]) => [key, f[key].value === '' ? null : Math.floor(Number(f[key].value))])));
      closeSheet(); toast('Figures saved.'); app.render(); } catch (err) { toast(errText(err), true); } }); };
}
export function dashboardMount(root, app) {
  const stops = [mountTrends(root, app), mountCompare(root, app), mountJump(root)];
  const x = $('#dash-xlsx', root), p = $('#dash-print', root);
  if (x) x.onclick = (e) => busy(e.currentTarget, () => downloadReport(app));
  if (p) p.onclick = () => window.print();
  const t = $('#kpi-targets', root), f = $('#kpi-figures', root);
  if (t) t.onclick = () => targetsSheet(app);
  if (f) f.onclick = () => figuresSheet(app);
  return () => stops.forEach((stop) => stop?.()); // the admin site calls this when leaving the page
}

// Excel report for PayNet and the team: counts only, one sheet per area (app/shared/js/report.js).
async function downloadReport(app) {
  try {
    if (!app._dash?.rows?.length) return toast('There’s no summary to export yet.', true);
    const initiatives = await D.listInitiatives(app.ctx).catch(() => []);
    const sheets = reportSheets({ ...app._dash, initiatives, labels: {
      type: (t) => (INITIATIVE_TYPES.find(([k]) => k === t) || [t, t])[1], heard: (k) => (HEARD_FROM.find(([key]) => key === k) || [k, k])[1],
      stall: (k) => STALL_TYPES[k]?.en || k, page: (k) => PAGE_NAMES[k] || k } });
    const cmp = compareState();
    if (cmp.ids.length) {
      const last = app._dash.rows[app._dash.rows.length - 1].day;
      const { from, to } = rangeDays(cmp.range, app._dash.rows, last, app._dash.settings.start);
      const sheet = compareSheet(app._dash.rows, cmp.ids, from, to);
      if (sheet) sheets.splice(1, 0, sheet);
    }
    const ExcelJS = await loadExcel(); const wb = new ExcelJS.Workbook();
    for (const sh of sheets) {
      const ws = wb.addWorksheet(sh.name);
      ws.addRow(sh.columns.map(([h]) => h)); ws.getRow(1).font = { bold: true };
      sh.columns.forEach(([, w], i) => { ws.getColumn(i + 1).width = w; });
      sh.rows.forEach((r) => ws.addRow(r));
    }
    const day = app._dash.rows[app._dash.rows.length - 1].day;
    downloadBlob(`Onz-report-${day}.xlsx`, new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    toast('Report downloaded.');
  } catch (err) { toast('Excel export failed: ' + errText(err), true); }
}
