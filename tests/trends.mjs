// Tests for the Dashboard trends maths (app/shared/js/trend-chart.js): no browser needed.
import assert from 'node:assert/strict';
import { TREND_METRICS, TREND_RANGES, series, rangeDays, periodChange, niceTicks, fmtValue } from '../app/shared/js/trend-chart.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n   ', e.message); } };
const metric = (id) => TREND_METRICS.find((m) => m.id === id);

// Ten days of summaries, 1-10 Nov; 4 Nov is missing, and the rates only start on 6 Nov (older summaries lack them).
const rows = [];
for (let d = 1; d <= 10; d++) {
  if (d === 4) continue;
  const day = `2026-11-${String(d).padStart(2, '0')}`;
  rows.push({ day, students: { total: d * 10, new: d === 1 ? 10 : 10 - (d === 5 ? 10 : 0) }, active: { d1: { opened: d % 2 ? 4 : 6 }, daysPerWeek: 1 + d / 10 },
    ...(d >= 6 ? { rates: { referral: 10 + d, quiz: 50 } } : {}) });
}

console.log('Dashboard trends');
test('every metric has a label, unit, comparison and picker', () => {
  for (const m of TREND_METRICS) { assert.ok(m.id && m.label && typeof m.pick === 'function', m.id); assert.ok(['last', 'sum', 'avg'].includes(m.agg), m.id); }
  assert.ok(metric('referralRate') && metric('quizRate') && metric('daysPerWeek'), 'the new rates can be charted');
  assert.deepEqual(TREND_RANGES.map(([k]) => k), ['30', '90', 'programme', 'all']);
});
test('a series has one point per day, with gaps where there is no summary or value', () => {
  const pts = series(rows, metric('students'), '2026-11-03', '2026-11-05');
  assert.deepEqual(pts, [{ day: '2026-11-03', value: 30 }, { day: '2026-11-04', value: null }, { day: '2026-11-05', value: 50 }]);
  assert.equal(series(rows, metric('referralRate'), '2026-11-05', '2026-11-06')[0].value, null, 'older summaries without rates leave a gap');
});
test('ranges end on the latest summary', () => {
  assert.deepEqual(rangeDays('30', rows, '2026-11-10', '2026-11-11'), { from: '2026-10-12', to: '2026-11-10' });
  assert.deepEqual(rangeDays('all', rows, '2026-11-10'), { from: '2026-11-01', to: '2026-11-10' });
  assert.deepEqual(rangeDays('programme', rows, '2026-11-10', '2026-11-03'), { from: '2026-11-03', to: '2026-11-10' });
  assert.deepEqual(rangeDays('programme', rows, '2026-11-10', '2026-12-01'), { from: '2026-11-10', to: '2026-11-10' }, 'a programme that starts later shows today');
});
test('totals compare the last day with the last day of the previous period', () => {
  // 6-10 Nov ends at 100 students; 1-5 Nov ended at 50: +100%.
  assert.deepEqual(periodChange(rows, metric('students'), '2026-11-06', '2026-11-10'), { now: 100, before: 50, diff: 100, kind: 'pct', days: 5 });
});
test('per-day counts are added up, and day-to-day figures averaged', () => {
  // New sign-ups 6-10 Nov: 10 each = 50. 1-5 Nov: 10 + 10 + 10 + (no 4 Nov) + 0 = 30. +66.7%.
  assert.deepEqual(periodChange(rows, metric('signups'), '2026-11-06', '2026-11-10'), { now: 50, before: 30, diff: 66.7, kind: 'pct', days: 5 });
  // Opened: 6-10 Nov = 6,4,6,4,6 → 5.2; 1-5 Nov = 4,6,4,(gap),4 → 4.5.
  const ch = periodChange(rows, metric('opened'), '2026-11-06', '2026-11-10');
  assert.equal(ch.now, 5.2); assert.equal(ch.before, 4.5);
});
test('percentages change in points, and no earlier data means no comparison', () => {
  assert.equal(periodChange(rows, metric('referralRate'), '2026-11-06', '2026-11-10'), null, 'rates only start on 6 Nov');
  const ch = periodChange(rows, metric('referralRate'), '2026-11-09', '2026-11-10');
  assert.deepEqual([ch.now, ch.before, ch.kind], [20, 18, 'pts']); assert.equal(ch.diff, 2);
});
test('clean y-axis steps', () => {
  assert.deepEqual(niceTicks(100), [0, 50, 100]);
  assert.deepEqual(niceTicks(7), [0, 2, 4, 6, 8]);
  assert.deepEqual(niceTicks(4200), [0, 2000, 4000, 6000]);
  assert.deepEqual(niceTicks(0), [0, 1]);
  for (const max of [3, 55, 999, 12345]) { const t = niceTicks(max); assert.ok(t[t.length - 1] >= max && t[0] === 0, String(max)); }
});
test('values are written for people', () => {
  assert.equal(fmtValue(1234, ''), '1,234'); assert.equal(fmtValue(33.3, '%'), '33.3%');
  assert.equal(fmtValue(1, 'days'), '1 day'); assert.equal(fmtValue(1.4, 'days'), '1.4 days'); assert.equal(fmtValue(null, ''), '—');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
