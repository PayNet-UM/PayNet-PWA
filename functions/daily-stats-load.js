// Reads the database for the HEP Dashboard's daily summary (functions/daily-stats.js) and writes dailyStats/{day}.
// Server only: it reads every student's activity, which the app itself is never allowed to do.
import { dailyStats, daysFrom, DEFAULT_ENGAGED_AREAS } from './daily-stats.js';

const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);
const parentUid = (doc) => doc.ref.parent.parent?.id || '';

export async function loadInput(db) {
  const [users, appDays, ledger, vouchers, claims, friendships, referrals, events, merchants, stall, rules, pageTime] = await Promise.all([
    db.collection('users').get(), db.collectionGroup('appDays').get(), db.collectionGroup('ledger').get(),
    db.collection('vouchers').get(), db.collection('liveDealClaims').get(), db.collection('friendships').get(),
    db.collection('referrals').get(), db.collection('eventSubmissions').get(), db.collection('merchants').get(),
    db.collection('stallSurveys').get(), db.doc('config/rules').get(), db.collection('pageTime').get()]);
  const rows = (snap, f) => snap.docs.map((d) => f(d.data(), d));
  const input = {
    users: rows(users, (u, d) => ({ id: d.id, role: u.role, createdAt: ms(u.createdAt), college: u.college || '', faculty: u.faculty || '', source: u.source || '', heardFrom: u.heardFrom || '' })),
    appDays: rows(appDays, (a, d) => ({ uid: parentUid(d), day: a.day || d.id, streakCount: a.streakCount || 0 })),
    ledger: rows(ledger, (l, d) => ({ uid: parentUid(d), type: l.type, createdAt: ms(l.createdAt) })),
    vouchers: rows(vouchers, (v) => ({ studentUid: v.studentUid, createdAt: ms(v.createdAt), usedAt: ms(v.usedAt), status: v.status, valueCents: v.valueCents || 0 })),
    dealClaims: rows(claims, (c) => ({ studentUid: c.studentUid, createdAt: ms(c.createdAt) })),
    friendships: rows(friendships, (f) => ({ from: f.from, to: f.to, status: f.status, createdAt: ms(f.createdAt) })),
    referrals: rows(referrals, (r, d) => ({ uid: d.id, inviterUid: r.inviterUid, createdAt: ms(r.createdAt) })),
    events: rows(events, (e) => ({ uid: e.uid, submittedAt: ms(e.submittedAt), status: e.status })),
    merchants: rows(merchants, (m, d) => ({ id: d.id, status: m.status, type: m.type || '', submittedAt: ms(m.submittedAt) })),
    stallSurveys: rows(stall, (s, d) => ({ id: d.id, stallType: s.stallType || '', at: ms(s.at) })),
    pageTime: rows(pageTime, (p) => ({ day: p.day, page: p.page, ms: p.ms || 0, views: p.views || 0, r25: p.r25 || 0, r50: p.r50 || 0, r75: p.r75 || 0, r100: p.r100 || 0 })),
  };
  const engagedAreas = Number.isInteger(rules.data()?.engagedAreas) ? rules.data().engagedAreas : DEFAULT_ENGAGED_AREAS;
  return { input, engagedAreas };
}

// Writes the summaries for `days` (default: every day since the first sign-up, up to lastDay).
export async function buildDays(db, days, now = Date.now()) {
  const { input, engagedAreas } = await loadInput(db);
  const list = days || [];
  for (let i = 0; i < list.length; i += 400) {
    const batch = db.batch();
    for (const day of list.slice(i, i + 400)) {
      batch.set(db.doc(`dailyStats/${day}`), { ...dailyStats(input, day, { engagedAreas }), generatedAt: new Date(now) });
    }
    await batch.commit();
  }
  return list.length;
}
export async function buildAll(db, lastDay, now = Date.now()) {
  const { input } = await loadInput(db);
  return buildDays(db, daysFrom(input, lastDay), now);
}
