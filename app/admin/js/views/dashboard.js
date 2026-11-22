// HEP Dashboard: programme performance from the daily summaries (dailyStats, built by the server every 3 hours,
// or by Demo mode). Sections follow the team lead's brief; every number says where it comes from.
import * as D from '../data.js';
import { esc, icon, n, rm, fmtDateTime } from '../ui.js';
import { hepHeading, hepEmpty } from '../hep-ui.js';
import { addDays, dayOf } from '../daily-stats.js';
import { STALL_TYPES } from '../stall-survey.js';

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
  const [rows, paynet] = await Promise.all([D.listDailyStats(app.ctx, addDays(today, -63)), D.paynetCounts(app.ctx, D.monthKey()).catch(() => [])]);
  const head = hepHeading('Dashboard', 'How +Onz is doing: students, merchants, transactions, campaigns and impact. Each number says where it comes from.', 'chart-column');
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
    <p class="faint dash-updated">${icon('clock')} Updated every 3 hours. Last update: ${fmtDateTime(latest.generatedAt)}. Figures up to ${esc(latest.day)}.</p>
    ${section('1. Students and engagement', '', `<div class="stats dash-grid">
      ${tile('Registered students', n(s.total), `+${n(s.new7)} in the last 7 days`, 'app', weekly((r) => r.students.total))}
      ${tile('Basic Active Users, 30 days', n(a.d30.basic), `${n(a.d7.basic)} in the last 7 days`, 'app', weekly((r) => r.active.d7.basic))}
      ${tile('Engaged Active Users, 30 days', n(a.d30.engaged), `${n(a.d7.engaged)} in the last 7 days`, 'app', weekly((r) => r.active.d7.engaged))}
      ${tile('Daily vs monthly opens', `${a.stickiness}%`, 'Students opening today ÷ in the last 30 days', 'app', weekly((r) => r.active.stickiness))}
      ${tile('Student activation (ever)', n(act.ever), 'Basic Active Users so far (KPI target 4,000)', 'app', weekly((r) => r.activation.ever))}
      ${tile('Repeat participation', `${act.repeatRate}%`, `${n(act.repeat)} came back on another day (KPI target 55%)`, 'app', weekly((r) => r.activation.repeatRate))}
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
      ${tile('Friend connections', n(com.friendships), 'Accepted friendships', 'app', weekly((r) => r.community.friendships))}
      ${missing('Tracking links and KOLs', 'Coming in the Initiatives update')}
      </div>`)}
    ${section('5. Impact', '', `<div class="stats dash-grid">
      ${tile('Merchants accepting digital payments', n(m.verified), `${n(digital)} assessed as business QR or card ready`, 'app')}
      ${tile('Cashless transactions facilitated', n(paynetMonth), 'This month, from PayNet’s count', 'hep')}
      ${missing('Merchant sales through +Onz', 'Needs merchant reporting')}
      ${missing('Student gigs and bookings', 'Planned feature')}
      </div>`)}
    ${section('6. KPI tracking', 'Targets and on-track status for the 9 approved KPIs arrive in the next update.', '')}`;
}
