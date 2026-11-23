// The Dashboard's Excel report for PayNet and the team: one sheet per area, counts only (no names, emails or
// matric numbers). Builds plain rows so it can be tested without a spreadsheet library. No imports besides pure modules.
import { KPIS, kpiActuals, kpiStatus, STATUS_LABEL } from './kpis.js';
import { initiativeImpact } from './initiatives.js';

const SOURCE = { app: 'From the app', hep: 'Entered by HEP' };

// rows: daily summaries (oldest first); settings/figures/months: as the Dashboard uses them; initiatives: HEP's list.
// Returns [{ name, columns: [[header, width]], rows: [[...]] }].
export function reportSheets({ rows, settings, figures = {}, months = {}, initiatives = [], now = Date.now(), labels = {} }) {
  const latest = rows[rows.length - 1] || {};
  const actuals = kpiActuals({ latest, figures, months, settings });
  const kpiRows = KPIS.map((k) => {
    const a = actuals[k.id], s = kpiStatus(k, a.value, settings, now);
    return [k.component, k.name, k.type === 'cumulative' ? 'Count' : 'Percentage', a.value ?? '', settings.targets[k.id],
      s.pctOfTarget ?? '', k.type === 'cumulative' ? s.expected ?? '' : '', STATUS_LABEL[s.status],
      a.parts.map((p) => `${p.label}: ${p.value} (${SOURCE[p.source] || p.source})`).join('; ') || a.pending || '', k.measured];
  });
  const st = latest.students || {}, act = latest.active || {}, ac = latest.activation || {};
  const m = latest.merchants || {}, c = latest.commerce || {}, com = latest.community || {};
  const tierRow = (label, key) => [label, act.d1?.[key] ?? 0, act.d7?.[key] ?? 0, act.d30?.[key] ?? 0];
  const breakdown = (obj, label = (k) => k) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [label(k), v]);
  const trend = rows.map((r) => [r.day, r.students?.total ?? 0, r.students?.new ?? 0, r.active?.d1?.opened ?? 0, r.active?.d7?.basic ?? 0,
    r.active?.d7?.engaged ?? 0, r.activation?.ever ?? 0, r.merchants?.verified ?? 0, r.commerce?.vouchersUsed ?? 0, r.commerce?.dealClaims ?? 0,
    r.active?.daysPerWeek ?? '', r.rates?.referral ?? '', r.rates?.quiz ?? '', r.time?.minutesPerStudent7 ?? '']);
  const ini = initiatives.map((it) => { const x = initiativeImpact(rows, it);
    return [it.name, labels.type?.(it.type) || it.type, it.code, it.start || '', it.end || '', x.viaLink, x.activatedViaLink, x.before ?? '', x.after ?? '', x.extra ?? ''];
  });
  return [
    { name: 'KPIs', columns: [['Component', 26], ['KPI', 30], ['Type', 12], ['Actual', 12], ['Target', 12], ['% of target', 12], ['Expected by today', 16], ['Status', 16], ['Made up of', 50], ['How it’s measured', 60]],
      rows: kpiRows },
    { name: 'Students', columns: [['Students who…', 30], ['Today', 10], ['Last 7 days', 12], ['Last 30 days', 12]],
      rows: [tierRow('Opened the app', 'opened'), tierRow('Basic Active Users', 'basic'), tierRow('Engaged Active Users', 'engaged'), [],
        ['Registered students', st.total ?? 0], ['New in the last 7 days', st.new7 ?? 0], ['Activated (ever)', ac.ever ?? 0],
        ['Repeat participation (%)', ac.repeatRate ?? 0], ['Daily vs monthly opens (%)', act.stickiness ?? 0],
        ['Days opened per week (average, last 7 days)', act.daysPerWeek ?? ''], ['Referral sign-up rate (%)', latest.rates?.referral ?? ''], ['Quiz participation rate (%)', latest.rates?.quiz ?? ''], [],
        ['By residential college'], ...breakdown(st.byCollege, (k) => (k === 'none' ? 'Not set' : k)), [], ['By faculty'], ...breakdown(st.byFaculty, (k) => (k === 'none' ? 'Not set' : k))] },
    { name: 'Merchants and commerce', columns: [['Measure', 40], ['Value', 14]],
      rows: [['Merchants onboarded', m.total ?? 0], ['Verified merchants', m.verified ?? 0], ['Waiting for review', m.pending ?? 0], ['Merchant assessments done', m.assessed ?? 0], [],
        ['Vouchers claimed', c.vouchersIssued ?? 0], ['Vouchers used', c.vouchersUsed ?? 0], ['Voucher value paid out (RM)', ((c.voucherValueUsedCents ?? 0) / 100).toFixed(2)],
        ['Live-deal QR claims', c.dealClaims ?? 0], [], ['Event submissions', com.eventSubmissions ?? 0], ['Referral sign-ups', com.referrals ?? 0], ['Friend connections', com.friendships ?? 0], [],
        ['Merchants by category'], ...breakdown(m.byType), [], ['Payment readiness'], ...breakdown(m.digitalMix, labels.stall || ((k) => k)), [],
        ['Transactions by month (PayNet + manual)'], ...Object.keys(months).sort().map((mo) => [mo, months[mo]])] },
    { name: 'Initiatives', columns: [['Initiative', 30], ['Type', 18], ['Code', 20], ['Start', 12], ['End', 12], ['Sign-ups via link', 16], ['Of them, active', 14], ['Daily sign-ups before', 18], ['Daily sign-ups after', 18], ['Estimated extra sign-ups', 20]],
      rows: ini.length ? [...ini, [], ['How students heard about +Onz'], ...breakdown(latest.sources?.byHeardFrom, labels.heard || ((k) => k))] : [['No initiatives yet']] },
    { name: 'Time in the app', columns: [['Page (last 7 days)', 26], ['Minutes', 12], ['Visits', 10], ['Reached 25% (%)', 16], ['Reached half (%)', 16], ['Reached 75% (%)', 16], ['Reached the end (%)', 18]],
      rows: [['Minutes per student per day (7-day average)', latest.time?.minutesPerStudent7 ?? ''], ['Total minutes, 7 days', latest.time?.minutes7 ?? ''], [],
        ...Object.entries(latest.time?.pages7 || {}).sort((a, b) => b[1].ms - a[1].ms).map(([k, p]) => {
          const pc = (c) => (p.views ? Math.round((c / p.views) * 100) : '');
          return [labels.page?.(k) || k, Math.round(p.ms / 60000), p.views, pc(p.r25), pc(p.r50), pc(p.r75), pc(p.r100)];
        })] },
    { name: 'Daily trend', columns: [['Day', 12], ['Registered students', 18], ['New sign-ups', 14], ['Opened the app', 14], ['Basic active (7 days)', 18], ['Engaged active (7 days)', 20], ['Activated (ever)', 16], ['Verified merchants', 16], ['Vouchers used', 14], ['Live-deal claims', 14], ['Days opened per week', 18], ['Referral sign-up rate (%)', 20], ['Quiz participation (%)', 18], ['Minutes per student per day', 22]],
      rows: trend },
  ];
}
