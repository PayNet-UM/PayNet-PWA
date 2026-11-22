// Tests for KPI scoring (app/shared/js/kpis.js): actual values, pace-based status and HEP-entered figures.
import assert from 'node:assert/strict';
import { KPIS, kpiSettings, kpiActuals, kpiStatus, monthlyTransactions } from '../app/shared/js/kpis.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n   ', e.message); } };
const kpi = (id) => KPIS.find((k) => k.id === id);
const at = (day) => Date.parse(day + 'T12:00:00+08:00');
// A 10-day period makes the pace easy to check: 1-10 Dec.
const settings = kpiSettings({ start: '2026-12-01', end: '2026-12-10', targets: { reach: 1000 } });

console.log('KPI scoring');
test('the 9 approved KPIs, with the sheet’s targets as defaults', () => {
  assert.equal(KPIS.length, 9);
  const d = kpiSettings();
  assert.equal(d.targets.reach, 8000); assert.equal(d.targets.transactions, 300000); assert.equal(d.targets.repeat, 55);
  assert.equal(d.end, '2026-12-31'); assert.equal(d.amberPct, 90);
});
test('HEP’s saved targets override the defaults', () => {
  assert.equal(settings.targets.reach, 1000); assert.equal(settings.targets.mapped, 100);
  assert.equal(kpiSettings({ targets: { reach: '' } }).targets.reach, 8000, 'an empty box keeps the default');
});
test('cumulative KPIs are judged against pace', () => {
  // At midday on 5 Dec, 4.5 of 10 days have passed, so 450 of 1,000 is expected.
  assert.deepEqual(kpiStatus(kpi('reach'), 450, settings, at('2026-12-05')), { status: 'on', pctOfTarget: 45, expected: 450 });
  assert.equal(kpiStatus(kpi('reach'), 410, settings, at('2026-12-05')).status, 'watch', '91% of the expected number');
  assert.equal(kpiStatus(kpi('reach'), 300, settings, at('2026-12-05')).status, 'behind');
  assert.equal(kpiStatus(kpi('reach'), 0, settings, at('2026-11-20')).status, 'on', 'nothing is expected before the start');
  assert.equal(kpiStatus(kpi('reach'), 999, settings, at('2026-12-20')).status, 'watch', 'after the end the full target is expected');
});
test('level KPIs (percentages) are judged against the target itself', () => {
  assert.equal(kpiStatus(kpi('repeat'), 60, settings).status, 'on');
  assert.equal(kpiStatus(kpi('repeat'), 50, settings).status, 'watch', '50 is 91% of 55');
  assert.equal(kpiStatus(kpi('repeat'), 40, settings).status, 'behind');
});
test('missing values and missing targets', () => {
  assert.equal(kpiStatus(kpi('growth'), null, settings).status, 'pending');
  assert.equal(kpiStatus(kpi('reach'), 10, kpiSettings({ targets: { reach: 0 } })).status, 'none');
});
test('monthly transactions add PayNet and manual counts', () => {
  assert.deepEqual(monthlyTransactions([{ month: '2026-11', count: 100 }, { month: '2026-11', count: 50 }, { month: '2026-12', count: 300 }],
    [{ month: '2026-11', volume: 10 }]), { '2026-11': 160, '2026-12': 300 });
});
const latest = { merchants: { assessed: 12, verified: 8 }, students: { total: 400 }, activation: { ever: 120, repeat: 30, repeatRate: 25 } };
test('app and HEP parts are shown side by side and added up', () => {
  const a = kpiActuals({ latest, figures: { mappedOutside: 40, listedOutside: 5, reachExternal: 2000 } });
  assert.equal(a.mapped.value, 52); assert.deepEqual(a.mapped.parts.map((p) => [p.value, p.source]), [[12, 'app'], [40, 'hep']]);
  assert.equal(a.listed.value, 13); assert.equal(a.ready.value, 8); assert.equal(a.reach.value, 2400);
  assert.equal(a.activation.value, 120); assert.equal(a.repeat.value, 25);
});
test('transaction growth waits for a baseline month, then compares the last two', () => {
  assert.equal(kpiActuals({ latest, months: { '2026-11': 1000 } }).growth.value, null);
  assert.ok(kpiActuals({ latest, months: { '2026-11': 1000 } }).growth.pending);
  assert.equal(kpiActuals({ latest, months: { '2026-10': 1000, '2026-11': 1250 } }).growth.value, 25);
});
test('qualifying transactions only count months in the programme period', () => {
  const a = kpiActuals({ latest, months: { '2026-10': 999, '2026-11': 1000, '2026-12': 2000 }, settings: kpiSettings() });
  assert.equal(a.transactions.value, 3000);
});
test('retention is entered by HEP and waits until both numbers are in', () => {
  assert.equal(kpiActuals({ latest, figures: { retentionStillQr: 40 } }).retention.value, null);
  assert.equal(kpiActuals({ latest, figures: { retentionStillQr: 40, retentionBase: 50 } }).retention.value, 80);
});
test('no activated students means repeat participation is not available yet', () => {
  assert.equal(kpiActuals({ latest: { activation: { ever: 0 } } }).repeat.value, null);
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
