// Trends on the HEP Dashboard: one metric over time from the daily summaries (dailyStats), like Instagram insights.
// A line with a clean scale, a crosshair and tooltip (mouse, touch or arrow keys), a "vs previous period" change and a
// table view. Days an older summary didn't record yet leave a gap rather than an invented line.
// The maths (metrics, ranges, ticks, change) is plain functions, tested in tests/trends.mjs.

// group: the Dashboard section it belongs to (the "Key metrics" picker lists them by section).
// unit: '' count, '%' percentage, 'days', 'min'. agg: how a period is summed up for the comparison:
//   last = the value on the period's last day (totals and rolling figures), sum = added up (per-day counts),
//   avg = the daily average (day-to-day figures that jump around).
const STU = 'Students and engagement', TIME = 'Time in the app', MER = 'Merchants', COM = 'Commerce', CAMP = 'Campaigns';
export const TREND_METRICS = [
  { id: 'students', group: STU, label: 'Registered students', unit: '', agg: 'last', pick: (r) => r.students?.total },
  { id: 'signups', group: STU, label: 'New sign-ups per day', unit: '', agg: 'sum', pick: (r) => r.students?.new },
  { id: 'opened', group: STU, label: 'Students who opened the app that day', unit: '', agg: 'avg', pick: (r) => r.active?.d1?.opened },
  { id: 'daysPerWeek', group: STU, label: 'Days opened per week (average)', unit: 'days', agg: 'last', pick: (r) => r.active?.daysPerWeek },
  { id: 'stickiness', group: STU, label: 'Daily vs monthly opens', unit: '%', agg: 'last', pick: (r) => r.active?.stickiness },
  { id: 'basic7', group: STU, label: 'Basic Active Users, last 7 days', unit: '', agg: 'last', pick: (r) => r.active?.d7?.basic },
  { id: 'engaged7', group: STU, label: 'Engaged Active Users, last 7 days', unit: '', agg: 'last', pick: (r) => r.active?.d7?.engaged },
  { id: 'activation', group: STU, label: 'Student activation (ever)', unit: '', agg: 'last', pick: (r) => r.activation?.ever },
  { id: 'repeat', group: STU, label: 'Repeat participation', unit: '%', agg: 'last', pick: (r) => r.activation?.repeatRate },
  { id: 'quizRate', group: STU, label: 'Quiz participation rate', unit: '%', agg: 'last', pick: (r) => r.rates?.quiz },
  { id: 'minutes', group: TIME, label: 'Minutes per student per day (7-day average)', unit: 'min', agg: 'last', pick: (r) => r.time?.minutesPerStudent7 },
  { id: 'merchants', group: MER, label: 'Merchants onboarded', unit: '', agg: 'last', pick: (r) => r.merchants?.total },
  { id: 'verified', group: MER, label: 'Verified merchants', unit: '', agg: 'last', pick: (r) => r.merchants?.verified },
  { id: 'assessed', group: MER, label: 'Merchants assessed', unit: '', agg: 'last', pick: (r) => r.merchants?.assessed },
  { id: 'vouchers', group: COM, label: 'Vouchers claimed (total)', unit: '', agg: 'last', pick: (r) => r.commerce?.vouchersIssued },
  { id: 'vouchersUsed', group: COM, label: 'Vouchers used (total)', unit: '', agg: 'last', pick: (r) => r.commerce?.vouchersUsed },
  { id: 'dealClaims', group: CAMP, label: 'Live-deal QR claims (total)', unit: '', agg: 'last', pick: (r) => r.commerce?.dealClaims },
  { id: 'referrals', group: CAMP, label: 'Referral sign-ups (total)', unit: '', agg: 'last', pick: (r) => r.community?.referrals },
  { id: 'referralRate', group: CAMP, label: 'Referral sign-up rate', unit: '%', agg: 'last', pick: (r) => r.rates?.referral },
  { id: 'events', group: CAMP, label: 'Event submissions (total)', unit: '', agg: 'last', pick: (r) => r.community?.eventSubmissions },
  { id: 'friends', group: CAMP, label: 'Friend connections (total)', unit: '', agg: 'last', pick: (r) => r.community?.friendships },
];
export const TREND_GROUPS = [STU, TIME, MER, COM, CAMP];
export const TREND_RANGES = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['programme', 'Programme to date'], ['all', 'All time']];

const DAY_MS = 86400000;
const addDays = (day, k) => new Date(Date.parse(day + 'T00:00:00Z') + k * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY_MS);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Every day from `from` to `to`, with the metric's value or null where there's no summary or no value.
export function series(rows, metric, from, to) {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) { const r = byDay.get(d); out.push({ day: d, value: r ? num(metric.pick(r)) : null }); }
  return out;
}

// The days a range covers, ending on the latest summary. Programme to date starts at the programme start.
export function rangeDays(range, rows, latestDay, programmeStart) {
  const first = rows.length ? rows[0].day : latestDay;
  let from = range === 'all' ? first : range === 'programme' ? programmeStart || first : addDays(latestDay, 1 - Number(range || 30));
  if (from > latestDay) from = latestDay;
  return { from, to: latestDay };
}

const summarise = (pts, agg) => {
  const v = pts.map((p) => p.value).filter((x) => x != null);
  if (!v.length) return null;
  if (agg === 'sum') return v.reduce((a, b) => a + b, 0);
  if (agg === 'avg') return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  return v[v.length - 1];
};
// The headline for a period: the total (sum), the daily average (avg) or the latest value (last).
export const periodValue = (rows, metric, from, to) => summarise(series(rows, metric, from, to), metric.agg);
// This period against the one just before it, of the same length. Percentages change in points, the rest in %.
export function periodChange(rows, metric, from, to) {
  const len = daysBetween(from, to) + 1;
  const now = summarise(series(rows, metric, from, to), metric.agg);
  const before = summarise(series(rows, metric, addDays(from, -len), addDays(from, -1)), metric.agg);
  if (now == null || before == null) return null;
  if (metric.unit === '%' || metric.unit === 'days' || metric.unit === 'min') return { now, before, diff: Math.round((now - before) * 10) / 10, kind: metric.unit === '%' ? 'pts' : 'abs', days: len };
  if (before === 0) return { now, before, diff: now, kind: 'abs', days: len };
  return { now, before, diff: Math.round(((now - before) / before) * 1000) / 10, kind: 'pct', days: len };
}

// Clean y-axis steps (1, 2 or 5 × a power of ten) from 0 up past the largest value.
export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count, pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  const ticks = []; for (let t = 0; t < max + step * 0.999; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return ticks;
}

export const fmtValue = (v, unit) => {
  if (v == null) return '—';
  if (unit === '%') return `${v}%`;
  if (unit === 'days') return `${v} ${v === 1 ? 'day' : 'days'}`;
  if (unit === 'min') return `${v} min`;
  return Math.round(v).toLocaleString('en-MY');
};
const fmtTick = (v, unit) => (unit === '%' ? `${v}%` : v >= 10000 ? `${Math.round(v / 1000)}K` : v.toLocaleString('en-MY'));
const shortDate = (day) => new Date(day + 'T00:00:00Z').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// Draws the chart into `host` (an element), sized to its width. Returns nothing; call again to redraw.
export function drawTrend(host, pts, metric, { compact = false } = {}) {
  const W = Math.max(compact ? 200 : 280, host.clientWidth || 640), H = compact ? 120 : W < 480 ? 200 : 240;
  const pad = { l: metric.unit === '%' ? 44 : 48, r: 16, t: 14, b: 28 };
  const vals = pts.map((p) => p.value).filter((v) => v != null);
  const ticks = niceTicks(Math.max(...vals, metric.unit === '%' ? 10 : 1), compact ? 2 : 4);
  const top = ticks[ticks.length - 1] || 1;
  const x = (i) => pad.l + (pts.length < 2 ? (W - pad.l - pad.r) / 2 : (i / (pts.length - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  // Connected runs of days that have a value; a single day draws as a dot.
  const runs = []; let cur = [];
  pts.forEach((p, i) => { if (p.value == null) { if (cur.length) runs.push(cur); cur = []; } else cur.push([x(i), y(p.value)]); });
  if (cur.length) runs.push(cur);
  const xTickIdx = pts.length <= 1 ? [0] : compact ? [0, pts.length - 1] : [...new Set([0, Math.round((pts.length - 1) / 3), Math.round((2 * (pts.length - 1)) / 3), pts.length - 1])];
  const lastIdx = pts.map((p) => p.value != null).lastIndexOf(true);
  const svg = `<svg class="trend-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${metric.label} over time">
    ${ticks.map((t) => `<line class="trend-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="trend-axis" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${fmtTick(t, metric.unit)}</text>`).join('')}
    ${xTickIdx.map((i) => `<text class="trend-axis" x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">${shortDate(pts[i].day)}</text>`).join('')}
    ${runs.map((r) => (r.length === 1 ? `<circle class="trend-dot" cx="${r[0][0]}" cy="${r[0][1]}" r="3"/>` : `<polyline class="trend-line" points="${r.map((p) => p.map((c) => c.toFixed(1)).join(',')).join(' ')}"/>`)).join('')}
    ${lastIdx >= 0 ? `<circle class="trend-end" cx="${x(lastIdx)}" cy="${y(pts[lastIdx].value)}" r="4"/>` : ''}
    <line class="trend-cross" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
    <circle class="trend-hover" r="5" visibility="hidden"/>
  </svg>`;
  host.innerHTML = svg + '<div class="trend-tip" role="status" hidden></div>';
  const el = host.firstElementChild, tip = host.lastElementChild, cross = el.querySelector('.trend-cross'), dot = el.querySelector('.trend-hover');
  let at = -1;
  const show = (i) => {
    at = Math.max(0, Math.min(pts.length - 1, i));
    const p = pts[at], cx = x(at);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    if (p.value != null) { dot.setAttribute('cx', cx); dot.setAttribute('cy', y(p.value)); dot.setAttribute('visibility', 'visible'); } else dot.setAttribute('visibility', 'hidden');
    tip.hidden = false; tip.textContent = '';
    const strong = document.createElement('strong'); strong.textContent = p.value == null ? 'No data' : fmtValue(p.value, metric.unit);
    const small = document.createElement('span'); small.textContent = shortDate(p.day);
    tip.append(strong, small);
    const left = Math.min(Math.max(cx - tip.offsetWidth / 2, 0), W - tip.offsetWidth);
    tip.style.left = `${left}px`; tip.style.top = `${Math.max(0, (p.value != null ? y(p.value) : pad.t) - tip.offsetHeight - 10)}px`;
  };
  const hide = () => { at = -1; tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); };
  const indexAt = (clientX) => { const b = el.getBoundingClientRect(); const px = ((clientX - b.left) / b.width) * W;
    return pts.length < 2 ? 0 : Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (pts.length - 1)); };
  el.addEventListener('pointermove', (e) => show(indexAt(e.clientX)));
  el.addEventListener('pointerdown', (e) => show(indexAt(e.clientX)));
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  host.tabIndex = 0;
  host.onkeydown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show((at < 0 ? lastIdx : at) + (e.key === 'ArrowRight' ? 1 : -1)); }
    else if (e.key === 'Escape') hide();
  };
  host.onblur = hide;
}
