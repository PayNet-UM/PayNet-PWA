// Tests for "Key metrics" (app/shared/js/dash-compare.js): picking, the share link and the Excel sheet.
import assert from 'node:assert/strict';
import { COMPARE_MAX, COMPARE_DEFAULT, KPI_PREFIX, kpiFor, cleanSelection, cleanRange, compareLink, fromRouteArgs, compareSheet } from '../app/shared/js/dash-compare.js';
import { TREND_METRICS, TREND_GROUPS } from '../app/shared/js/trend-chart.js';
import { KPIS } from '../app/shared/js/kpis.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n   ', e.message); } };

console.log('Key metrics');
test('every metric belongs to a Dashboard section, and the defaults exist', () => {
  for (const m of TREND_METRICS) assert.ok(TREND_GROUPS.includes(m.group), m.id + ' has no section');
  assert.deepEqual(cleanSelection(COMPARE_DEFAULT), COMPARE_DEFAULT);
});
test('the 9 KPIs can be picked too', () => {
  assert.equal(KPIS.length, 9);
  for (const k of KPIS) assert.equal(kpiFor(KPI_PREFIX + k.id), k);
  assert.equal(kpiFor('students'), null);
  assert.deepEqual(cleanSelection(['kpi-reach', 'students']), ['kpi-reach', 'students']);
});
test('a selection keeps known metrics only, without repeats, up to 6, in the order picked', () => {
  assert.deepEqual(cleanSelection('quizRate,students,nope,quizRate,kpi-nope'), ['quizRate', 'students']);
  const many = TREND_METRICS.map((m) => m.id);
  assert.equal(cleanSelection(many).length, COMPARE_MAX);
  assert.deepEqual(cleanSelection(many), many.slice(0, COMPARE_MAX));
  assert.deepEqual(cleanSelection(null), []);
});
test('the period falls back to programme to date', () => {
  assert.equal(cleanRange('30'), '30'); assert.equal(cleanRange('all'), 'all'); assert.equal(cleanRange('7'), 'programme'); assert.equal(cleanRange(undefined), 'programme');
});
test('a share link opens the same view, and a tampered link is cleaned', () => {
  const link = compareLink('https://umconnect-e455a-admin.web.app/', ['students', 'kpi-reach'], '30');
  assert.equal(link, 'https://umconnect-e455a-admin.web.app/#/dashboard/compare/students,kpi-reach/30');
  const args = link.split('#/dashboard/')[1].split('/');
  assert.deepEqual(fromRouteArgs(args), { ids: ['students', 'kpi-reach'], range: '30' });
  assert.deepEqual(fromRouteArgs(['compare', '<script>,students', 'x']), { ids: ['students'], range: 'programme' });
  assert.equal(fromRouteArgs(['compare', 'nothing-valid']), null);
  assert.equal(fromRouteArgs([]), null, 'the plain Dashboard address is not a shared view');
});
test('the Excel sheet has one row per day and one column per daily metric (KPIs are on their own sheet)', () => {
  const rows = [{ day: '2026-11-20', students: { total: 10 }, rates: { quiz: 20 } }, { day: '2026-11-22', students: { total: 12 } }];
  const sh = compareSheet(rows, ['students', 'kpi-reach', 'quizRate'], '2026-11-20', '2026-11-22');
  assert.equal(sh.name, 'Key metrics');
  assert.deepEqual(sh.columns.map(([h]) => h), ['Day', 'Registered students', 'Quiz participation rate (%)']);
  assert.deepEqual(sh.rows, [['2026-11-20', 10, 20], ['2026-11-21', '', ''], ['2026-11-22', 12, '']]);
  assert.equal(compareSheet(rows, ['kpi-reach'], '2026-11-20', '2026-11-22'), null, 'only KPIs picked: no extra sheet');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
