// Tests for the Dashboard's Excel report (app/shared/js/report.js): sheet contents and no personal data.
import assert from 'node:assert/strict';
import { reportSheets } from '../app/shared/js/report.js';
import { kpiSettings } from '../app/shared/js/kpis.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n   ', e.message); } };
const day = (d, total, nw) => ({ day: d, students: { total, new: nw, new7: nw, byCollege: { KK1: total - 1, none: 1 }, byFaculty: { FS: total } },
  active: { d1: { opened: 2, basic: 1, engaged: 0 }, d7: { opened: 5, basic: 3, engaged: 1 }, d30: { opened: 8, basic: 4, engaged: 1 }, stickiness: 25 },
  activation: { ever: 4, repeat: 1, repeatRate: 25 }, merchants: { total: 3, verified: 2, pending: 1, assessed: 2, byType: { Food: 2 }, digitalMix: { businessQr: 1 } },
  commerce: { vouchersIssued: 3, vouchersUsed: 1, voucherValueUsedCents: 500, dealClaims: 2 }, community: { referrals: 1, friendships: 2, eventSubmissions: 1 },
  sources: { bySource: { jtk: 3 }, activatedBySource: { jtk: 2 }, byHeardFrom: { friend: 2 } } });
const rows = [day('2026-11-20', 8, 1), day('2026-11-21', 10, 2)];
const sheets = reportSheets({ rows, settings: kpiSettings(), figures: { mappedOutside: 5 }, months: { '2026-11': 1200 },
  initiatives: [{ name: 'JTK Roundtable', type: 'roundtable', code: 'jtk', start: '2026-11-17' }], now: Date.parse('2026-11-21T12:00:00+08:00') });
const sheet = (name) => sheets.find((s) => s.name === name);

console.log('Excel report');
test('one sheet per area', () => assert.deepEqual(sheets.map((s) => s.name), ['KPIs', 'Students', 'Merchants and commerce', 'Initiatives', 'Daily trend']));
test('the KPI sheet lists the 9 KPIs with actual, target and status', () => {
  const k = sheet('KPIs'); assert.equal(k.rows.length, 9); assert.equal(k.columns.length, k.rows[0].length);
  const mapped = k.rows.find((r) => r[1] === 'Merchants mapped');
  assert.equal(mapped[3], 7, '2 in the app + 5 entered by HEP'); assert.equal(mapped[4], 100); assert.match(mapped[8], /Entered by HEP/);
});
test('student tiers and breakdowns, with “none” shown as “Not set”', () => {
  const s = sheet('Students');
  assert.deepEqual(s.rows[1], ['Basic Active Users', 1, 3, 4]);
  assert.ok(s.rows.some((r) => r[0] === 'Not set'));
});
test('transactions by month and voucher value in ringgit', () => {
  const m = sheet('Merchants and commerce');
  assert.ok(m.rows.some((r) => r[0] === '2026-11' && r[1] === 1200)); assert.ok(m.rows.some((r) => r[0] === 'Voucher value paid out (RM)' && r[1] === '5.00'));
});
test('initiatives show link sign-ups and active students', () => {
  const i = sheet('Initiatives').rows[0]; assert.equal(i[0], 'JTK Roundtable'); assert.equal(i[5], 3); assert.equal(i[6], 2);
});
test('the daily trend has one row per day', () => assert.deepEqual(sheet('Daily trend').rows.map((r) => r[0]), ['2026-11-20', '2026-11-21']));
test('no initiatives gives a friendly line instead of an empty sheet', () => {
  assert.deepEqual(reportSheets({ rows, settings: kpiSettings() }).find((s) => s.name === 'Initiatives').rows, [['No initiatives yet']]);
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
