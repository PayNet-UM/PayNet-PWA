// "Key metrics" on the HEP Dashboard (team request, 25 Nov 2026): HEP ticks up to 6 metrics and sees them side by
// side, one small chart each over the same dates, so one screenshot covers them all. The choice is kept in this browser
// and can be shared as a link (#/dashboard/compare/<ids>/<range>). Plain functions, tested in tests/dash-compare.mjs.
// The 9 programme KPIs can be picked too (ids kpi-<id>): the team lead asked for screenshots of chosen KPIs for slides.
import { TREND_METRICS, TREND_RANGES, series } from './trend-chart.js';
import { KPIS } from './kpis.js';

export const COMPARE_MAX = 6;
// What a first-time viewer sees: the headline numbers the team checks most.
export const COMPARE_DEFAULT = ['students', 'basic7', 'activation', 'referralRate'];
export const KPI_PREFIX = 'kpi-';
export const kpiFor = (id) => (String(id).startsWith(KPI_PREFIX) ? KPIS.find((k) => KPI_PREFIX + k.id === id) || null : null);
const IDS = new Set([...TREND_METRICS.map((m) => m.id), ...KPIS.map((k) => KPI_PREFIX + k.id)]);
const RANGES = new Set(TREND_RANGES.map(([k]) => k));

// A clean list of metric ids: known ones only, no repeats, at most COMPARE_MAX.
export function cleanSelection(list) {
  const ids = (Array.isArray(list) ? list : String(list || '').split(',')).map((x) => String(x).trim()).filter((x) => IDS.has(x));
  return [...new Set(ids)].slice(0, COMPARE_MAX);
}
export const cleanRange = (r) => (RANGES.has(String(r)) ? String(r) : 'programme');

// The share link, and reading one back (the route arguments after #/dashboard).
export const compareLink = (base, ids, range) => `${base}#/dashboard/compare/${cleanSelection(ids).join(',')}/${cleanRange(range)}`;
export function fromRouteArgs(args = []) {
  if (args[0] !== 'compare') return null;
  const ids = cleanSelection(args[1]);
  return ids.length ? { ids, range: cleanRange(args[2]) } : null;
}

// The picked metrics as an Excel sheet: one row per day, one column per metric. KPIs are already on the KPIs sheet.
export function compareSheet(rows, ids, from, to) {
  const metrics = cleanSelection(ids).map((id) => TREND_METRICS.find((m) => m.id === id)).filter(Boolean);
  if (!metrics.length) return null;
  const cols = metrics.map((m) => series(rows, m, from, to));
  const days = cols[0]?.map((p) => p.day) || [];
  return {
    name: 'Key metrics',
    columns: [['Day', 12], ...metrics.map((m) => [m.label + (m.unit === '%' ? ' (%)' : m.unit === 'min' ? ' (min)' : m.unit === 'days' ? ' (days)' : ''), 22])],
    rows: days.map((day, i) => [day, ...cols.map((c) => c[i].value ?? '')]),
  };
}
