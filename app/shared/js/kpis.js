// The 9 approved programme KPIs (team sheet "KPI Tracking", read 22 Nov 2026) and how the Dashboard scores them.
// Targets, the period and the amber line are editable by HEP (config/kpiTargets); numbers the app can't see are
// entered by HEP (config/kpiFigures). Keep this file free of imports so it can be tested on its own.

export const KPIS = [
  { id: 'mapped', component: 'Campus Digital Connect', name: 'Merchants mapped', type: 'cumulative', target: 100,
    measured: 'Merchant assessments done in the app, plus stalls surveyed outside the app (entered by HEP).',
    interpretation: 'Below pace means the 20th-of-the-month PayNet list will be thin.',
    steps: 'Add walkers to Team A/B shops; capture the QR photo and terminal ID on the spot.' },
  { id: 'listed', component: 'Campus Digital Connect', name: 'Merchants listed with PayNet', type: 'cumulative', target: 70,
    measured: 'Merchants on the app’s PayNet list (Lampiran 1), plus merchants submitted outside the app (entered by HEP).',
    interpretation: 'Only listed merchants count towards UM’s PayNet total.',
    steps: 'Clear “confirm business account” remarks first; use the next month’s list for late ones.' },
  { id: 'ready', component: 'Campus Digital Connect', name: 'Merchants ready (verified QR)', type: 'cumulative', target: 50,
    measured: 'Merchants verified by HEP in the app (clear QR image, business name).',
    interpretation: 'The gap between listed and ready shows onboarding friction.',
    steps: 'Visit with a phone and complete sign-up on the spot; fast-track personal-QR switches at bank desks.' },
  { id: 'reach', component: 'Campus Cashless Loop', name: 'Student reach', type: 'cumulative', target: 8000,
    measured: 'Registered students in the app, plus reach from HEP circulars, roadshows, KOLs and Instagram (entered by HEP).',
    interpretation: 'Reach is awareness only; it doesn’t pay out until students take part.',
    steps: 'Push through JTK reps and the leaderboard; a KOL promo push.' },
  { id: 'activation', component: 'Campus Cashless Loop', name: 'Student activation', type: 'cumulative', target: 4000,
    measured: 'Basic Active Users so far: students who did a lesson, the money check or an event submission. (The sheet’s wording is “first confirmed cashless purchase”; the app doesn’t record purchases.)',
    interpretation: 'The main driver of cost per activated student.',
    steps: 'If below pace by mid-campaign: booths at KK cafeterias at lunch; an early-bird progress banner.' },
  { id: 'repeat', component: 'Campus Cashless Loop', name: 'Repeat participation', type: 'level', target: 55, unit: '%',
    measured: 'Activated students who did a basic action on 2 or more different days ÷ activated students.',
    interpretation: 'The habit signal. Low repeat means rewards are buying one-off actions.',
    steps: 'Weekly missions, quiet-hour deals and streak badges; make missions easier if completion is under 10%.' },
  { id: 'growth', component: 'Financial eco-system partnerships', name: 'Transaction growth (month on month)', type: 'level', target: 20, unit: '%',
    measured: 'Change in PayNet-counted plus manual transactions, latest month vs the month before.',
    interpretation: 'Needs a clean baseline month from PayNet; otherwise growth is overstated.',
    steps: 'Confirm the baseline with PayNet; more “show your code” reminders at counters.' },
  { id: 'retention', component: 'Financial eco-system partnerships', name: 'Post-campaign retention', type: 'level', target: 80, unit: '%',
    measured: 'Stalls still taking QR at the end ÷ stalls listed (both entered by HEP).',
    interpretation: 'Tests sustainability: 10% of the PayNet rubric.',
    steps: 'A weekly Monday count check; merchant deals; bank or e-wallet follow-ups.' },
  { id: 'transactions', component: 'Financial eco-system partnerships', name: 'Qualifying transactions', type: 'cumulative', target: 300000,
    measured: 'PayNet-counted (Lampiran 1) plus manual counts (Lampiran 2), added up over the programme period.',
    interpretation: 'The headline impact number PayNet verifies.',
    steps: 'Add vending, printing and laundry operators via Lampiran 2; push high-frequency merchants.' },
];
export const KPI_DEFAULTS = { start: '2026-11-11', end: '2026-12-31', amberPct: 90 };
export const FIGURE_FIELDS = [
  ['mappedOutside', 'Stalls surveyed outside the app', 'mapped'], ['listedOutside', 'Merchants submitted to PayNet outside the app', 'listed'],
  ['reachExternal', 'Reach outside the app (circulars, roadshows, KOL and Instagram)', 'reach'],
  ['retentionStillQr', 'Stalls still taking QR at the end of the campaign', 'retention'], ['retentionBase', 'Stalls listed (the base for retention)', 'retention'],
];

const num = (v) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : null);
const round1 = (x) => Math.round(x * 10) / 10;
const DAY = 86400000;
const dayMs = (day) => Date.parse(day + 'T00:00:00+08:00');

// HEP's settings merged over the sheet's defaults.
export function kpiSettings(saved = {}) {
  const targets = {};
  for (const k of KPIS) targets[k.id] = num(saved.targets?.[k.id]) ?? k.target;
  return { start: saved.start || KPI_DEFAULTS.start, end: saved.end || KPI_DEFAULTS.end,
    amberPct: num(saved.amberPct) ?? KPI_DEFAULTS.amberPct, targets };
}

// Monthly transactions: { 'YYYY-MM': count } from PayNet rows ({ month, count }) and manual rows ({ month, volume }).
export function monthlyTransactions(paynetRows = [], manualRows = []) {
  const out = {};
  for (const r of paynetRows) if (r.month) out[r.month] = (out[r.month] || 0) + (num(r.count) || 0);
  for (const r of manualRows) if (r.month) out[r.month] = (out[r.month] || 0) + (num(r.volume) || 0);
  return out;
}

// Each KPI's actual value. latest = the newest daily summary; figures = HEP-entered numbers; months = monthlyTransactions().
// A value of null means it can't be worked out yet, with `pending` saying why.
export function kpiActuals({ latest, figures = {}, months = {}, settings = kpiSettings() }) {
  const f = (k) => num(figures[k]);
  const part = (label, value, source) => ({ label, value, source });
  const out = {};
  const m = latest?.merchants || {}, s = latest?.students || {}, act = latest?.activation || {};
  out.mapped = { value: (m.assessed || 0) + (f('mappedOutside') || 0), parts: [part('In the app', m.assessed || 0, 'app'), part('Outside the app', f('mappedOutside') || 0, 'hep')] };
  out.listed = { value: (m.verified || 0) + (f('listedOutside') || 0), parts: [part('On the app’s PayNet list', m.verified || 0, 'app'), part('Submitted outside the app', f('listedOutside') || 0, 'hep')] };
  out.ready = { value: m.verified || 0, parts: [part('Verified in the app', m.verified || 0, 'app')] };
  out.reach = { value: (s.total || 0) + (f('reachExternal') || 0), parts: [part('Registered in the app', s.total || 0, 'app'), part('Reach outside the app', f('reachExternal') || 0, 'hep')] };
  out.activation = { value: act.ever || 0, parts: [part('Basic Active Users so far', act.ever || 0, 'app')] };
  out.repeat = { value: act.ever ? act.repeatRate : null, pending: act.ever ? '' : 'No activated students yet', parts: [part('Came back on another day', act.repeat || 0, 'app')] };
  const inPeriod = Object.keys(months).filter((mo) => mo >= settings.start.slice(0, 7) && mo <= settings.end.slice(0, 7)).sort();
  out.transactions = { value: inPeriod.reduce((sum, mo) => sum + months[mo], 0), parts: inPeriod.map((mo) => part(mo, months[mo], 'hep')) };
  const withData = Object.keys(months).filter((mo) => months[mo] > 0).sort();
  if (withData.length >= 2) {
    const [prev, cur] = withData.slice(-2);
    out.growth = { value: round1(((months[cur] - months[prev]) / months[prev]) * 100), parts: [part(prev, months[prev], 'hep'), part(cur, months[cur], 'hep')] };
  } else out.growth = { value: null, pending: 'Waiting for a baseline month', parts: withData.map((mo) => part(mo, months[mo], 'hep')) };
  const still = f('retentionStillQr'), base = f('retentionBase');
  out.retention = still != null && base ? { value: round1((still / base) * 100), parts: [part('Still taking QR', still, 'hep'), part('Listed', base, 'hep')] }
    : { value: null, pending: 'Entered by HEP at the end of the campaign', parts: [] };
  return out;
}

// On track / watch / behind. Cumulative KPIs are judged against where they should be by now (pace);
// level KPIs (percentages) against the target itself.
export function kpiStatus(kpi, value, settings = kpiSettings(), now = Date.now()) {
  const target = settings.targets[kpi.id];
  if (value == null) return { status: 'pending', pctOfTarget: null, expected: null };
  if (!target) return { status: 'none', pctOfTarget: null, expected: null };
  let expected = target;
  if (kpi.type === 'cumulative') {
    const start = dayMs(settings.start), end = dayMs(settings.end) + DAY;
    const share = Math.min(1, Math.max(0, (now - start) / (end - start)));
    expected = Math.round(target * share);
  }
  const pctOfTarget = round1((value / target) * 100);
  const ratio = expected > 0 ? value / expected : 1;
  const status = ratio >= 1 ? 'on' : ratio * 100 >= settings.amberPct ? 'watch' : 'behind';
  return { status, pctOfTarget, expected };
}
export const STATUS_LABEL = { on: 'On track', watch: 'Watch', behind: 'Behind', pending: 'Not available yet', none: 'No target set' };
