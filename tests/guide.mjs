// First-time guide: which steps show for each role, the "make it your own" checklist, and that every
// phrase in it has a Malay translation. No browser: the client site is assembled into a temp folder.
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
import { copySite } from '../scripts/lib/sites.mjs';

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.MutationObserver = class { observe() {} takeRecords() { return []; } };
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) } });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'en-MY' } });
globalThis.document = { documentElement: { lang: 'en' }, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, head: {}, body: { contains: () => false } };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onz-guide-'));
copySite('client', dir);
const load = (f) => import(pathToFileURL(path.join(dir, 'js', f)).href);
const G = await load('guide.js');
const { _test } = await load('i18n.js');
const D = await load('data.js');

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); } };
const all = () => true;
const only = (...keys) => (sel) => !keys.some((k) => sel.includes(`"${k}"`));
const student = { role: 'student', ctx: { uid: 's1' }, profile: { name: 'Aina Nadhirah' }, rules: D.DEFAULT_RULES, ledger: [] };
const merchant = (m = null) => ({ role: 'merchant', ctx: { uid: 'm1' }, profile: { name: 'Kopi Kolej' }, rules: D.DEFAULT_RULES, merchant: m });
const texts = (steps) => steps.flatMap((s) => [s.title, s.body, ...(s.chips || []).map(([, t]) => t),
  ...(s.tasks ? [s.tasks.heading, s.tasks.cta, s.tasks.note, ...s.tasks.items.map((x) => x.label)] : [])]).filter(Boolean);

console.log('First-time guide');
test('a new account is flagged once, then not again', () => {
  assert.equal(G.isPending('new'), false);
  G.markNewAccount('new');
  assert.equal(G.isPending('new'), true);
  localStorage.setItem('onz-guide-v1:new', 'done');
  assert.equal(G.isPending('new'), false);
});
test('a student starts with a personal welcome and ends with the checklist', () => {
  const steps = G.stepsFor(student, { has: all });
  assert.equal(steps[0].kind, 'welcome');
  assert.equal(steps[0].title, 'Welcome to +Onz, Aina!');
  assert.equal(steps.at(-1).kind, 'finish');
  assert.deepEqual(steps.filter((s) => s.target).map((s) => s.title),
    ['Home', 'Your points', 'Community', 'Campus Events', 'Rewards', 'Me', 'English or Bahasa Malaysia', 'Your account menu']);
});
test('replaying the tour skips the first-time welcome wording', () => {
  assert.equal(G.stepsFor(student, { first: false, has: all })[0].title, 'A quick tour of +Onz');
  assert.equal(G.stepsFor(student, { first: false, has: all }).at(-1).title, 'That’s the tour');
});
test('tabs HEP has switched off are left out of the tour', () => {
  const titles = G.stepsFor(merchant(), { has: only('scan', 'promote', 'insights') }).map((s) => s.title);
  assert.ok(titles.includes('My shop'));
  for (const off of ['Deal QR', 'Promote live deals', 'Insights']) assert.ok(!titles.includes(off), off);
});
test('every highlighted element is named once', () => {
  const targets = G.stepsFor(student, { has: all }).filter((s) => s.target).map((s) => s.target);
  assert.equal(new Set(targets).size, targets.length);
});
test('the student checklist shows the real Money check bonus and ticks it once done', () => {
  const before = G.tasksFor(student).items.find((x) => x.route === 'survey');
  assert.equal(before.label, `Earn ${D.DEFAULT_RULES.surveyBonus} points with the Money check`);
  assert.equal(before.done, false);
  assert.equal(G.tasksFor({ ...student, ledger: [{ id: 'survey' }] }).items.find((x) => x.route === 'survey').done, true);
  assert.equal(G.tasksFor({ ...student, profile: { avatar: { hair: 1 } } }).items.find((x) => x.route === 'avatar').done, true);
});
test('the merchant checklist follows the shop set-up', () => {
  const done = (m) => G.tasksFor(merchant(m)).items.map((x) => x.done);
  assert.deepEqual(done(null), [false, false, false, false]);
  assert.deepEqual(done({ status: 'rejected', logo: 'x' }), [true, true, false, false]);
  assert.deepEqual(done({ status: 'pending', logo: 'x', lat: 3.12, lng: 101.65 }), [true, true, true, true]);
  assert.equal(G.tasksFor(merchant({ status: 'verified' })).cta, 'Go to my shop');
  assert.equal(G.tasksFor(merchant(null)).cta, 'Set up my shop');
});
test('every phrase in the guide has a Malay translation', () => {
  const phrases = new Set([
    ...texts(G.stepsFor(student, { has: all })), ...texts(G.stepsFor(student, { first: false, has: all })),
    ...texts(G.stepsFor({ ...student, profile: {} }, { has: all })),
    ...texts(G.stepsFor(merchant(), { has: all })), ...texts(G.stepsFor(merchant({ status: 'verified' }), { first: false, has: all })),
    'Step 2 of 8', 'Skip for now', 'Show me around', 'Skip tour', 'Next', 'Back', 'Done',
    'You can replay this tour from your account menu.', 'Take the tour', 'Getting started', 'Sign in', 'Your profile', 'Quick tour',
    'Signed in as aina@gmail.com. One quick step, then we’ll show you around.',
  ]);
  const missing = [...phrases].filter((p) => _test.translate(p) === p);
  assert.deepEqual(missing, []);
});

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
