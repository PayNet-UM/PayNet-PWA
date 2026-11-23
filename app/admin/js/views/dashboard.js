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
import { TREND_METRICS, TREND_RANGES, series, rangeDays, periodChange, periodValue, fmtValue, drawTrend } from '../trend-chart.js';

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
const section = (title, intro, body) => `<section class="card pad-lg dash-section"><h2>${title}</h2>${intro ? `<p class="faint">${intro}</p>` : ''}${body}</section>`;

export async function dashboardRender(app) {
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
    $('#tr-of', root).textContent = metric.agg === 'sum' ? 'in this period' : metric.agg === 'avg' ? 'a day on average' : 'now';
    $('#tr-change', root).textContent = !ch ? 'No earlier period to compare yet'
      : `${ch.diff > 0 ? '▲ +' : ch.diff < 0 ? '▼ ' : ''}${ch.kind === 'pct' ? ch.diff + '%' : ch.kind === 'pts' ? ch.diff + ' pts'
        : metric.unit === 'days' ? `${ch.diff} days` : fmtValue(ch.diff, '')} vs the previous ${ch.days} days`;
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
  const stopTrends = mountTrends(root, app);
  const x = $('#dash-xlsx', root), p = $('#dash-print', root);
  if (x) x.onclick = (e) => busy(e.currentTarget, () => downloadReport(app));
  if (p) p.onclick = () => window.print();
  const t = $('#kpi-targets', root), f = $('#kpi-figures', root);
  if (t) t.onclick = () => targetsSheet(app);
  if (f) f.onclick = () => figuresSheet(app);
  return stopTrends; // the admin site calls this when leaving the page
}

// Excel report for PayNet and the team: counts only, one sheet per area (app/shared/js/report.js).
async function downloadReport(app) {
  try {
    if (!app._dash?.rows?.length) return toast('There’s no summary to export yet.', true);
    const initiatives = await D.listInitiatives(app.ctx).catch(() => []);
    const sheets = reportSheets({ ...app._dash, initiatives, labels: {
      type: (t) => (INITIATIVE_TYPES.find(([k]) => k === t) || [t, t])[1], heard: (k) => (HEARD_FROM.find(([key]) => key === k) || [k, k])[1],
      stall: (k) => STALL_TYPES[k]?.en || k } });
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
