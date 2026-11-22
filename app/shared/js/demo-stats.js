// Demo mode's version of the server's daily summary job: builds dailyStats/{day} from the demo database with the
// same calculation (daily-stats.js), so the HEP Dashboard shows real numbers for the demo data.
import { dailyStats, daysFrom, dayOf } from './daily-stats.js';

const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);
export function demoInput(docs) {
  const input = { users: [], appDays: [], ledger: [], vouchers: [], dealClaims: [], friendships: [], referrals: [], events: [], merchants: [], stallSurveys: [] };
  for (const [path, d] of docs) {
    const p = path.split('/');
    if (p[0] === 'users' && p.length === 2) input.users.push({ id: p[1], role: d.role, createdAt: ms(d.createdAt), college: d.college || '', faculty: d.faculty || '', source: d.source || '', heardFrom: d.heardFrom || '' });
    else if (p[0] === 'users' && p[2] === 'appDays' && p.length === 4) input.appDays.push({ uid: p[1], day: d.day || p[3], streakCount: d.streakCount || 0 });
    else if (p[0] === 'users' && p[2] === 'ledger' && p.length === 4) input.ledger.push({ uid: p[1], type: d.type, createdAt: ms(d.createdAt) });
    else if (p.length === 2) {
      if (p[0] === 'vouchers') input.vouchers.push({ studentUid: d.studentUid, createdAt: ms(d.createdAt), usedAt: ms(d.usedAt), status: d.status, valueCents: d.valueCents || 0 });
      else if (p[0] === 'liveDealClaims') input.dealClaims.push({ studentUid: d.studentUid, createdAt: ms(d.createdAt) });
      else if (p[0] === 'friendships') input.friendships.push({ from: d.from, to: d.to, status: d.status, createdAt: ms(d.createdAt) });
      else if (p[0] === 'referrals') input.referrals.push({ uid: p[1], inviterUid: d.inviterUid, createdAt: ms(d.createdAt) });
      else if (p[0] === 'eventSubmissions') input.events.push({ uid: d.uid, submittedAt: ms(d.submittedAt), status: d.status });
      else if (p[0] === 'merchants') input.merchants.push({ id: p[1], status: d.status, type: d.type || '', submittedAt: ms(d.submittedAt) });
      else if (p[0] === 'stallSurveys') input.stallSurveys.push({ id: p[1], stallType: d.stallType || '', at: ms(d.at) });
    }
  }
  return input;
}
export function seedDemoDailyStats(sdk, now = Date.now()) {
  if (!sdk._rawUpdate) return;
  sdk._rawUpdate((docs) => {
    const input = demoInput(docs);
    const engagedAreas = Number.isInteger(docs.get('config/rules')?.engagedAreas) ? docs.get('config/rules').engagedAreas : undefined;
    for (const day of daysFrom(input, dayOf(now)).slice(-60)) docs.set('dailyStats/' + day, { ...dailyStats(input, day, { engagedAreas }), generatedAt: now });
  });
}
