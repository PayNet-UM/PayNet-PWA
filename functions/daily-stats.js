// Daily programme summary for the HEP Dashboard: counts only, no names or emails.
// The same file runs on the server (functions/daily-stats.js is an exact copy, checked by tests/daily-stats.mjs)
// and in Demo mode, so both produce identical numbers. Keep it free of imports.
//
// Active-user tiers (agreed with the team lead, 22 Nov 2026):
//  - Opened the app: has an appDays record.
//  - Basic Active User: did a basic action (a lesson, the money check, or an event submission).
//  - Engaged Active User: used at least `engagedAreas` (default 3) of the 4 areas:
//      learn (lesson or money check), rewards (voucher or live-deal claim),
//      community (friend added, referral, event submission), habit (reached a 7-day app streak).
// Student activation (KPI) counts Basic Active Users ever; repeat participation = basic actions on 2+ different days.
// Rates (team request, 24 Nov 2026): referral sign-up rate = students who joined with a referral ÷ all students;
// quiz participation = students who did a lesson or the money check ÷ all students; days opened per week = the
// average number of days in the last 7 that a student opened the app, among students who opened it at least once.

export const DAY_MS = 86400000;
const MYT_MS = 8 * 3600000;
export const dayOf = (ms) => new Date(ms + MYT_MS).toISOString().slice(0, 10);
export const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
export const AREAS = ['learn', 'rewards', 'community', 'habit'];
export const DEFAULT_ENGAGED_AREAS = 3;

const bump = (map, key, by = 1) => { if (key) map[key] = (map[key] || 0) + by; };
const ms = (v) => (typeof v === 'number' ? v : 0);

// input (all timestamps in milliseconds; rows without a time are ignored for dated counts):
//   users:        [{ id, role, createdAt, college, faculty, source, heardFrom }]
//   appDays:      [{ uid, day, streakCount }]
//   ledger:       [{ uid, type, createdAt }]        lesson / survey / redeem / liveDeal / ...
//   vouchers:     [{ studentUid, createdAt, usedAt, status, valueCents }]
//   dealClaims:   [{ studentUid, createdAt }]
//   friendships:  [{ from, to, status, createdAt }]
//   referrals:    [{ uid, inviterUid, createdAt }]  uid = the friend who joined
//   events:       [{ uid, submittedAt, status }]
//   merchants:    [{ id, status, type, submittedAt }]
//   stallSurveys: [{ id, stallType, at }]
//   pageTime:     [{ day, page, ms, views, r25, r50, r75, r100 }]   anonymous totals per page per day (page-time.js)
// Everything is counted up to the end of `day` (Malaysia time).
export function dailyStats(input, day, { engagedAreas = DEFAULT_ENGAGED_AREAS } = {}) {
  const end = Date.parse(day + 'T00:00:00Z') - MYT_MS + DAY_MS; // midnight after `day`, MYT
  const upTo = (t) => ms(t) > 0 && ms(t) < end;
  const students = (input.users || []).filter((u) => u.role === 'student' && upTo(u.createdAt));
  const studentIds = new Set(students.map((u) => u.id));

  // Per-student actions: day -> { basic, areas }
  const acts = new Map();
  const act = (uid, t, area, basic = false) => {
    if (!studentIds.has(uid) || !upTo(t)) return;
    const d = dayOf(ms(t));
    if (!acts.has(uid)) acts.set(uid, []);
    acts.get(uid).push({ day: d, area, basic });
  };
  for (const l of input.ledger || []) {
    if (l.type === 'lesson' || l.type === 'survey') act(l.uid, l.createdAt, 'learn', true);
    else if (l.type === 'redeem' || l.type === 'liveDeal') act(l.uid, l.createdAt, 'rewards');
  }
  for (const v of input.vouchers || []) act(v.studentUid, v.createdAt, 'rewards');
  for (const c of input.dealClaims || []) act(c.studentUid, c.createdAt, 'rewards');
  for (const f of input.friendships || []) if (f.status === 'accepted') { act(f.from, f.createdAt, 'community'); act(f.to, f.createdAt, 'community'); }
  for (const r of input.referrals || []) { act(r.uid, r.createdAt, 'community'); act(r.inviterUid, r.createdAt, 'community'); }
  for (const e of input.events || []) act(e.uid, e.submittedAt, 'community', true);
  const opens = new Map(); // uid -> Set(day)
  for (const a of input.appDays || []) {
    if (!studentIds.has(a.uid) || !a.day || a.day > day) continue;
    if (!opens.has(a.uid)) opens.set(a.uid, new Set());
    opens.get(a.uid).add(a.day);
    if ((a.streakCount || 0) >= 7) { if (!acts.has(a.uid)) acts.set(a.uid, []); acts.get(a.uid).push({ day: a.day, area: 'habit', basic: false }); }
  }

  const windowStart = (n) => addDays(day, 1 - n);
  const tiers = (n) => {
    const from = windowStart(n);
    let opened = 0, basic = 0, engaged = 0;
    for (const uid of studentIds) {
      if ([...(opens.get(uid) || [])].some((d) => d >= from && d <= day)) opened++;
      const recent = (acts.get(uid) || []).filter((a) => a.day >= from && a.day <= day);
      if (recent.some((a) => a.basic)) basic++;
      if (new Set(recent.map((a) => a.area)).size >= engagedAreas) engaged++;
    }
    return { opened, basic, engaged };
  };
  const d1 = tiers(1), d7 = tiers(7), d30 = tiers(30);
  const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
  let openDays7 = 0;
  for (const uid of studentIds) openDays7 += [...(opens.get(uid) || [])].filter((d) => d >= windowStart(7) && d <= day).length;
  const referred = new Set((input.referrals || []).filter((r) => upTo(r.createdAt) && studentIds.has(r.uid)).map((r) => r.uid)).size;
  const learners = [...studentIds].filter((uid) => (acts.get(uid) || []).some((a) => a.area === 'learn')).length;
  // Time in the app: minutes per student per day (time ÷ students who opened the app), and each page over 7 days.
  const pages7 = {}, timedDays = new Set(); let msToday = 0, ms7 = 0;
  for (const p of input.pageTime || []) {
    if (!p.day || p.day > day || p.day < windowStart(7) || !p.page) continue;
    const t = (pages7[p.page] ||= { ms: 0, views: 0, r25: 0, r50: 0, r75: 0, r100: 0 });
    for (const k of Object.keys(t)) t[k] += Number(p[k]) || 0;
    ms7 += Number(p.ms) || 0; if (p.day === day) msToday += Number(p.ms) || 0;
    timedDays.add(p.day);
  }
  // Only days that recorded page time count in the average, so days before tracking started don't pull it down.
  let timedOpenDays = 0;
  for (const uid of studentIds) for (const d of opens.get(uid) || []) if (timedDays.has(d)) timedOpenDays++;
  const minutes = (msTotal, people) => (people ? Math.round((msTotal / 60000 / people) * 10) / 10 : 0);

  let activatedEver = 0, repeat = 0;
  const sourceOf = new Map(students.map((u) => [u.id, u.source])), activatedBySource = {};
  for (const uid of studentIds) {
    const basicDays = new Set((acts.get(uid) || []).filter((a) => a.basic).map((a) => a.day));
    if (basicDays.size >= 1) { activatedEver++; bump(activatedBySource, sourceOf.get(uid)); }
    if (basicDays.size >= 2) repeat++;
  }

  const byCollege = {}, byFaculty = {}, bySource = {}, byHeardFrom = {};
  for (const u of students) { bump(byCollege, u.college || 'none'); bump(byFaculty, u.faculty || 'none'); bump(bySource, u.source); bump(byHeardFrom, u.heardFrom); }

  const merchants = (input.merchants || []).filter((m) => upTo(m.submittedAt) || m.status === 'verified');
  const byType = {}; for (const m of merchants) bump(byType, m.type || 'other');
  const surveys = (input.stallSurveys || []).filter((s) => upTo(s.at));
  const digitalMix = {}; for (const s of surveys) bump(digitalMix, s.stallType || 'unknown');

  const vouchers = (input.vouchers || []).filter((v) => upTo(v.createdAt));
  const used = vouchers.filter((v) => v.status === 'used' && upTo(v.usedAt || v.createdAt));
  const claims = (input.dealClaims || []).filter((c) => upTo(c.createdAt));
  const onDay = (t) => upTo(t) && dayOf(ms(t)) === day;

  return {
    day,
    students: { total: students.length, new: students.filter((u) => dayOf(ms(u.createdAt)) === day).length,
      new7: students.filter((u) => dayOf(ms(u.createdAt)) >= windowStart(7)).length, byCollege, byFaculty },
    active: { d1, d7, d30, stickiness: d30.opened ? Math.round((d1.opened / d30.opened) * 1000) / 10 : 0,
      daysPerWeek: d7.opened ? Math.round((openDays7 / d7.opened) * 10) / 10 : 0 },
    rates: { referral: pct(referred, studentIds.size), referred, quiz: pct(learners, studentIds.size), learners },
    time: { minutesPerStudent: minutes(msToday, d1.opened), minutesPerStudent7: minutes(ms7, timedOpenDays), minutes7: Math.round(ms7 / 60000), pages7 },
    activation: { ever: activatedEver, repeat, repeatRate: activatedEver ? Math.round((repeat / activatedEver) * 1000) / 10 : 0 },
    merchants: { total: merchants.length, verified: merchants.filter((m) => m.status === 'verified').length,
      pending: merchants.filter((m) => m.status === 'pending').length, byType, assessed: surveys.length, digitalMix },
    commerce: { vouchersIssued: vouchers.length, vouchersUsed: used.length, voucherValueUsedCents: used.reduce((s, v) => s + (v.valueCents || 0), 0),
      dealClaims: claims.length, vouchersIssuedToday: vouchers.filter((v) => onDay(v.createdAt)).length, dealClaimsToday: claims.filter((c) => onDay(c.createdAt)).length },
    community: { referrals: (input.referrals || []).filter((r) => upTo(r.createdAt)).length,
      friendships: (input.friendships || []).filter((f) => f.status === 'accepted' && upTo(f.createdAt)).length,
      eventSubmissions: (input.events || []).filter((e) => upTo(e.submittedAt)).length },
    sources: { bySource, byHeardFrom, activatedBySource },
    settings: { engagedAreas },
  };
}

// The days to build, from the first student sign-up up to `lastDay` (used by the backfill and Demo mode).
export function daysFrom(input, lastDay) {
  const first = Math.min(...(input.users || []).map((u) => ms(u.createdAt)).filter((t) => t > 0));
  if (!Number.isFinite(first)) return [];
  const out = []; for (let d = dayOf(first); d <= lastDay; d = addDays(d, 1)) out.push(d);
  return out;
}
