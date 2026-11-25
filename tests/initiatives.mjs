// Tests for Initiatives and KOL tracking (app/shared/js/initiatives.js): link capture and before/after impact.
import assert from 'node:assert/strict';
import { captureSource, getSource, toCode, initiativeImpact, SOURCE_DAYS, linkWithSource } from '../app/shared/js/initiatives.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n   ', e.message); } };
const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const DAY = 86400000, T = Date.parse('2026-11-20T12:00:00+08:00');

console.log('Initiatives');
test('a tracking link is remembered on arrival', () => {
  const s = store(); assert.equal(captureSource('?src=jtk-roundtable', s, T), 'jtk-roundtable'); assert.equal(getSource(s, T + DAY), 'jtk-roundtable');
});
test('the first link wins, so a later link doesn’t take the credit', () => {
  const s = store(); captureSource('?src=kol-aina', s, T); assert.equal(captureSource('?src=poster-kk1', s, T + DAY), 'kol-aina');
});
test('the link stops counting after 30 days, then a new one can be remembered', () => {
  const s = store(); captureSource('?src=kol-aina', s, T);
  assert.equal(getSource(s, T + SOURCE_DAYS * DAY + 1), '');
  assert.equal(captureSource('?src=poster-kk1', s, T + SOURCE_DAYS * DAY + 1), 'poster-kk1');
});
test('badly formed codes are ignored', () => {
  const s = store();
  for (const q of ['?src=Bad Code', '?src=<script>', '?src=a', '?src=' + 'x'.repeat(31), '']) assert.equal(captureSource(q, s, T), '');
});
test('blocked storage doesn’t break the app', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(captureSource('?src=kol-aina', broken, T), ''); assert.equal(getSource(broken, T), '');
});
test('names turn into tidy tracking codes', () => {
  assert.equal(toCode('JTK Roundtable 17 Nov'), 'jtk-roundtable-17-nov'); assert.equal(toCode('@kembangster'), 'kembangster');
});
// 14 days at 2 sign-ups a day, then 5 a day from 10 Nov.
const rows = [];
for (let i = 0; i < 20; i++) {
  const day = new Date(Date.parse('2026-10-27T00:00:00Z') + i * DAY).toISOString().slice(0, 10);
  rows.push({ day, students: { new: day >= '2026-11-10' ? 5 : 2 }, sources: { bySource: { jtk: 7 }, activatedBySource: { jtk: 3 } } });
}
test('before/after: daily averages, days counted and estimated extra sign-ups', () => {
  const x = initiativeImpact(rows, { code: 'jtk', start: '2026-11-10' });
  assert.equal(x.before, 2); assert.equal(x.after, 5); assert.equal(x.days, 6); assert.equal(x.extra, 18);
  assert.equal(x.viaLink, 7); assert.equal(x.activatedViaLink, 3);
});
test('an end date limits the “after” window', () => {
  const x = initiativeImpact(rows, { code: 'jtk', start: '2026-11-10', end: '2026-11-11' });
  assert.equal(x.days, 2); assert.equal(x.extra, 6);
});
test('a future initiative has no before/after yet', () => {
  const x = initiativeImpact(rows, { code: 'jtk', start: '2026-12-25' });
  assert.equal(x.before, null); assert.equal(x.extra, null); assert.equal(x.viaLink, 7);
});
test('the open-in-browser link keeps the KOL code (Instagram/TikTok → Chrome/Safari)', () => {
  assert.equal(linkWithSource('https://addonz.my/', 'kol-aina'), 'https://addonz.my/?src=kol-aina');
  assert.equal(linkWithSource('intent://addonz.my/', 'kol-aina'), 'intent://addonz.my/?src=kol-aina');
  assert.equal(linkWithSource('https://addonz.my/', ''), 'https://addonz.my/', 'no code: plain link');
  assert.equal(linkWithSource('https://addonz.my/', 'bad code&x=1'), 'https://addonz.my/', 'only valid codes go in the link');
  // The full journey: code saved in Instagram, carried in the link, saved again in Chrome.
  const insta = new Map(), chrome = new Map(); const store = (m) => ({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) });
  captureSource('?src=kol-aina', store(insta));
  const link = linkWithSource('https://addonz.my/', getSource(store(insta)));
  assert.equal(captureSource(new URL(link).search, store(chrome)), 'kol-aina');
});
test('an unknown code has no sign-ups', () => assert.equal(initiativeImpact(rows, { code: 'nobody', start: '2026-11-10' }).viaLink, 0));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
