// Tests for anonymous page time (app/shared/js/page-time.js): the counting, without a browser.
import assert from 'node:assert/strict';
import { createPageTimer, pageKey, PAGE_KEYS, IDLE_MS, MAX_VIEW_MS } from '../app/shared/js/page-time.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n   ', e.message); } };
const S = 1000, MIN = 60 * S;
// Moves time forward in 5-second ticks, like the app's timer.
const run = (t, from, to) => { for (let x = from + 5 * S; x <= to; x += 5 * S) t.tick(x); };

console.log('Page time');
test('pages are named by the first part of the address; unknown ones are "other"', () => {
  assert.equal(pageKey('#/about'), 'about'); assert.equal(pageKey('#/merchant/abc123'), 'merchant');
  assert.equal(pageKey(''), 'home'); assert.equal(pageKey('#/'), 'home'); assert.equal(pageKey('#/nope'), 'other');
  assert.ok(PAGE_KEYS.includes('other') && PAGE_KEYS.includes('learn'));
});
test('time on screen is counted, and the visit is counted when the student moves on', () => {
  const t = createPageTimer(0);
  t.open('about', 0); run(t, 0, 20 * S); t.active(20 * S); run(t, 20 * S, 40 * S);
  t.open('learn', 40 * S);
  const out = t.take(40 * S);
  assert.equal(out.about.ms, 40 * S); assert.equal(out.about.views, 1);
  assert.equal(out.learn, undefined, 'the new visit has no time yet');
});
test('a page left open without activity stops counting after 2 minutes', () => {
  const t = createPageTimer(0);
  t.open('home', 0); run(t, 0, 10 * MIN);
  assert.equal(t.take(10 * MIN).home.ms, IDLE_MS);
});
test('time while the app is in the background is not counted', () => {
  const t = createPageTimer(0);
  t.open('rewards', 0); run(t, 0, 30 * S); t.hidden(30 * S);
  run(t, 30 * S, 5 * MIN); t.shown(5 * MIN); run(t, 5 * MIN, 5 * MIN + 10 * S);
  assert.equal(t.take(5 * MIN + 10 * S).rewards.ms, 40 * S);
});
test('a long gap between ticks (a sleeping phone) adds at most 15 seconds', () => {
  const t = createPageTimer(0);
  t.open('me', 0); t.tick(10 * MIN);
  assert.ok(t.take(10 * MIN).me.ms <= 15 * S);
});
test('one visit never counts for more than 30 minutes', () => {
  const t = createPageTimer(0);
  t.open('learn', 0);
  for (let x = 5 * S; x <= 2 * 60 * MIN; x += 5 * S) { t.active(x); }
  t.end(2 * 60 * MIN);
  assert.equal(t.take(2 * 60 * MIN).learn.ms, MAX_VIEW_MS);
});
test('how far a visit scrolled is counted in steps; the bottom is 95% or more', () => {
  const t = createPageTimer(0);
  t.open('about', 0); t.scrolled(60, 5 * S); run(t, 5 * S, 20 * S); t.end(20 * S);
  t.open('about', 20 * S); t.scrolled(30, 25 * S); t.scrolled(97, 30 * S); run(t, 30 * S, 40 * S); t.end(40 * S);
  const a = t.take(40 * S).about;
  assert.deepEqual([a.views, a.r25, a.r50, a.r75, a.r100], [2, 2, 2, 1, 1]);
});
test('a short page seen in full counts as read to the end without scrolling', () => {
  const t = createPageTimer(0);
  t.open('contact', 0); t.seen(100); run(t, 0, 10 * S); t.end(10 * S);
  assert.equal(t.take(10 * S).contact.r100, 1);
});
test('a redirect shorter than a second is not a visit', () => {
  const t = createPageTimer(0);
  t.open('home', 0); t.open('learn', 500); run(t, 500, 10 * S + 500); t.end(10 * S + 500);
  const out = t.take(10 * S + 500);
  assert.equal(out.home?.views ?? 0, 0, 'its half second is time on screen, but not a visit'); assert.equal(out.learn.views, 1);
});
test('totals are handed over once, and the visit in progress keeps counting', () => {
  const t = createPageTimer(0);
  t.open('home', 0); run(t, 0, 30 * S);
  assert.equal(t.take(30 * S).home.ms, 30 * S);
  assert.deepEqual(t.take(30 * S), {}, 'nothing new');
  run(t, 30 * S, 45 * S); t.end(45 * S);
  assert.deepEqual(t.take(45 * S).home, { ms: 15 * S, views: 1, r25: 0, r50: 0, r75: 0, r100: 0 });
});
test('nothing in the totals names a student', () => {
  const t = createPageTimer(0); t.open('home', 0); run(t, 0, 10 * S); t.end(10 * S);
  assert.deepEqual(Object.keys(t.take(10 * S).home).sort(), ['ms', 'r100', 'r25', 'r50', 'r75', 'views']);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
