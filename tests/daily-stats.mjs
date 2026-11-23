// Tests for the HEP Dashboard's daily summary (app/shared/js/daily-stats.js) with hand-checked answers,
// and that the server's copy (functions/daily-stats.js) is identical.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dailyStats, daysFrom, dayOf, addDays } from '../app/shared/js/daily-stats.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n   ', e.message); } };
const at = (day, hour = 12) => Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00+08:00`); // Malaysia time
const D0 = '2026-11-20';

// Four students and two merchants over a few days.
const input = {
  users: [
    { id: 'a', role: 'student', createdAt: at('2026-11-10'), college: 'KK1', faculty: 'FSKTM', source: 'jtk', heardFrom: 'friend' },
    { id: 'b', role: 'student', createdAt: at('2026-11-15'), college: 'KK1', faculty: 'FEP' },
    { id: 'c', role: 'student', createdAt: at('2026-11-19'), college: 'IHAJ', faculty: 'FSKTM', source: 'jtk' },
    { id: 'd', role: 'student', createdAt: at('2026-11-21'), college: 'KK2' }, // after D0: not counted
    { id: 'm1', role: 'merchant', createdAt: at('2026-11-10') },
  ],
  appDays: [
    { uid: 'a', day: '2026-11-14', streakCount: 7 }, { uid: 'a', day: D0, streakCount: 1 },
    { uid: 'b', day: '2026-11-18' }, { uid: 'c', day: D0 }, { uid: 'd', day: '2026-11-21' },
  ],
  ledger: [
    { uid: 'a', type: 'lesson', createdAt: at('2026-11-12') }, { uid: 'a', type: 'survey', createdAt: at(D0) },
    { uid: 'a', type: 'redeem', createdAt: at('2026-11-16') },
    { uid: 'b', type: 'lesson', createdAt: at('2026-11-18') },
    { uid: 'c', type: 'adjust', createdAt: at(D0) }, // not an action
  ],
  vouchers: [{ studentUid: 'a', createdAt: at('2026-11-16'), usedAt: at('2026-11-17'), status: 'used', valueCents: 200 },
    { studentUid: 'b', createdAt: at(D0), status: 'issued', valueCents: 300 }],
  dealClaims: [{ studentUid: 'c', createdAt: at(D0) }],
  friendships: [{ from: 'a', to: 'b', status: 'accepted', createdAt: at('2026-11-19') }, { from: 'a', to: 'c', status: 'pending', createdAt: at(D0) }],
  referrals: [{ uid: 'c', inviterUid: 'a', createdAt: at('2026-11-19') }],
  events: [{ uid: 'c', submittedAt: at(D0, 23), status: 'pending' }],
  merchants: [{ id: 'm1', status: 'verified', type: 'Food & drinks', submittedAt: at('2026-11-11') }, { id: 'm2', status: 'pending', type: 'Printing', submittedAt: at('2026-11-19') }],
  stallSurveys: [{ id: 'm1', stallType: 'businessQr', at: at('2026-11-12') }],
};
const s = dailyStats(input, D0);

console.log('Daily summary');
test('Malaysia-time days and date maths', () => {
  assert.equal(dayOf(Date.parse('2026-11-20T16:30:00Z')), '2026-11-21', '00:30 MYT is the next day');
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
});
test('students are counted up to the end of the day only', () => {
  assert.equal(s.students.total, 3); assert.equal(s.students.new, 0); assert.equal(s.students.new7, 2);
  assert.deepEqual(s.students.byCollege, { KK1: 2, IHAJ: 1 });
});
test('opened the app: today, 7 days, 30 days', () => {
  assert.deepEqual([s.active.d1.opened, s.active.d7.opened, s.active.d30.opened], [2, 3, 3]);
});
test('basic active users need a lesson, the money check or an event submission', () => {
  // today: a (survey), c (event at 23:00); 7 days (14-20 Nov): a, b, c; 30 days: same
  assert.deepEqual([s.active.d1.basic, s.active.d7.basic, s.active.d30.basic], [2, 3, 3]);
});
test('engaged active users use at least 3 of the 4 areas', () => {
  // a over 30 days: learn, rewards, community, habit = 4. b: learn (18), community (19), rewards (voucher 20) = 3.
  // c: rewards (deal claim), community (referral, event) = 2, so not engaged.
  assert.equal(s.active.d30.engaged, 2);
  // 7 days (14-20 Nov): a has all 4 (habit on 14 Nov), b still has 3.
  assert.equal(s.active.d7.engaged, 2);
  assert.equal(s.active.d1.engaged, 0, 'nobody used 3 areas on the day itself');
  assert.equal(dailyStats(input, D0, { engagedAreas: 2 }).active.d30.engaged, 3, 'the threshold is configurable');
});
test('activation and repeat participation (KPIs 5 and 6)', () => {
  // a: basic on 12 and 20 Nov (repeat); b: 18 Nov; c: 20 Nov
  assert.deepEqual(s.activation, { ever: 3, repeat: 1, repeatRate: 33.3 });
});
test('stickiness is today ÷ 30 days, as a percentage', () => assert.equal(s.active.stickiness, 66.7));
test('days opened per week, among students who opened in the last 7 days', () => {
  // 14-20 Nov: a opened on 14 and 20 (2 days), b on 18, c on 20 = 4 days over 3 students
  assert.equal(s.active.daysPerWeek, 1.3);
});
test('time in the app: minutes per student per day and each page over 7 days', () => {
  const pageTime = [
    { day: D0, page: 'about', ms: 120000, views: 2, r25: 2, r50: 1, r75: 1, r100: 0 },        // 2 min today
    { day: '2026-11-18', page: 'home', ms: 360000, views: 3, r25: 3, r50: 3, r75: 2, r100: 2 }, // 6 min earlier this week
    { day: '2026-11-10', page: 'home', ms: 999999, views: 9 },                                   // before the 7 days
    { day: '2026-11-21', page: 'home', ms: 999999, views: 9 },                                   // after the day
  ];
  const t = dailyStats({ ...input, pageTime }, D0).time;
  // today: 2 min ÷ 2 students who opened today = 1 min. 7 days: 8 min ÷ 4 student-days opened (a×2, b, c) = 2 min.
  assert.equal(t.minutesPerStudent, 1); assert.equal(t.minutesPerStudent7, 2); assert.equal(t.minutes7, 8);
  assert.deepEqual(t.pages7.about, { ms: 120000, views: 2, r25: 2, r50: 1, r75: 1, r100: 0 });
  assert.equal(t.pages7.home.ms, 360000);
  assert.deepEqual(dailyStats(input, D0).time, { minutesPerStudent: 0, minutesPerStudent7: 0, minutes7: 0, pages7: {} }, 'no page time yet');
});
test('referral sign-up rate and quiz participation rate', () => {
  // c joined with a's referral: 1 of 3. a and b did a lesson or the money check: 2 of 3.
  assert.deepEqual(s.rates, { referral: 33.3, referred: 1, quiz: 66.7, learners: 2 });
  assert.deepEqual(dailyStats({ users: [] }, D0).rates, { referral: 0, referred: 0, quiz: 0, learners: 0 }, 'no students: 0, not NaN');
});
test('merchants, assessment and payment readiness', () => {
  assert.deepEqual([s.merchants.total, s.merchants.verified, s.merchants.pending, s.merchants.assessed], [2, 1, 1, 1]);
  assert.deepEqual(s.merchants.digitalMix, { businessQr: 1 });
});
test('commerce and community counts', () => {
  assert.deepEqual([s.commerce.vouchersIssued, s.commerce.vouchersUsed, s.commerce.voucherValueUsedCents, s.commerce.dealClaims], [2, 1, 200, 1]);
  assert.deepEqual([s.community.referrals, s.community.friendships, s.community.eventSubmissions], [1, 1, 1]);
});
test('sign-up sources are counted, and no names or emails are stored', () => {
  assert.deepEqual(s.sources.bySource, { jtk: 2 }); assert.deepEqual(s.sources.byHeardFrom, { friend: 1 });
  assert.deepEqual(s.sources.activatedBySource, { jtk: 2 }, 'a and c both did a basic action');
  assert.ok(!/"(a|b|c)"/.test(JSON.stringify(s)), 'no student IDs in the summary');
});
test('days to build run from the first sign-up', () => {
  const days = daysFrom(input, '2026-11-12'); assert.equal(days[0], '2026-11-10'); assert.equal(days.at(-1), '2026-11-12');
  assert.deepEqual(daysFrom({ users: [] }, D0), []);
});
test('the server copy is identical to the shared file', () => {
  assert.equal(fs.readFileSync(new URL('../functions/daily-stats.js', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../app/shared/js/daily-stats.js', import.meta.url), 'utf8'),
    'functions/daily-stats.js differs: copy app/shared/js/daily-stats.js over it');
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
