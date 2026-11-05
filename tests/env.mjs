// Tests the environment and deploy safety checks. No network, no real project values.
import assert from 'assert/strict'; import fs from 'fs'; import os from 'os'; import path from 'path';
import { parseEnv, resolveEnv, renderConfig, renderRules, deployProblems, loadEnv } from '../scripts/lib/env.mjs';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n    ${e.message}`); } };

const raw = (over = {}) => ({
  FIREBASE_API_KEY: 'test-key', FIREBASE_AUTH_DOMAIN: 'p.firebaseapp.com', FIREBASE_PROJECT_ID: 'stage-proj',
  FIREBASE_STORAGE_BUCKET: 'p.appspot.com', FIREBASE_MESSAGING_SENDER_ID: '1', FIREBASE_APP_ID: '1:1:web:1',
  MPP_ADMIN_EMAILS: 'A@um.edu.my, b@um.edu.my', ...over,
});
const projects = { staging: 'stage-proj', production: 'prod-proj' };
const envFor = (projectId) => resolveEnv(raw({ FIREBASE_PROJECT_ID: projectId }));
const deploy = (o) => deployProblems({ target: 'staging', env: envFor('stage-proj'), projects, branch: 'development', dirty: false, ...o });
const rulesTpl = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const configTpl = fs.readFileSync(new URL('../app/js/firebase-config.js', import.meta.url), 'utf8');

console.log('Env parsing');
test('parses values, quotes and comments', () => {
  assert.deepEqual(parseEnv('# note\nA=1\nB="two"\r\nexport C=\'three\'\n\nnot a line'), { A: '1', B: 'two', C: 'three' });
});
test('normalises admin emails', () => assert.deepEqual(resolveEnv(raw()).adminEmails, ['a@um.edu.my', 'b@um.edu.my']));
test('rejects missing values', () => assert.throws(() => resolveEnv(raw({ FIREBASE_API_KEY: '' })), /FIREBASE_API_KEY/));
test('rejects REPLACE placeholders', () => assert.throws(() => resolveEnv(raw({ FIREBASE_PROJECT_ID: 'REPLACE_ME' })), /FIREBASE_PROJECT_ID/));
test('rejects the placeholder admin', () => assert.throws(() => resolveEnv(raw({ MPP_ADMIN_EMAILS: 'mpp-admin@demo.invalid' })), /MPP_ADMIN_EMAILS/));
test('rejects an address that could break out of the rules', () => assert.throws(() => resolveEnv(raw({ MPP_ADMIN_EMAILS: "a'b@um.edu.my" })), /invalid address/));
test('the process environment overrides the file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umc-env-'));
  fs.writeFileSync(`${dir}/.env.local`, Object.entries(raw()).map(([k, v]) => `${k}=${v}`).join('\n'));
  assert.equal(loadEnv('staging', { dir, env: { FIREBASE_PROJECT_ID: 'from-ci' } }).firebaseConfig.projectId, 'from-ci');
  fs.rmSync(dir, { recursive: true, force: true });
});
test('rejects an unknown environment', () => assert.throws(() => loadEnv('prod'), /Unknown environment/));

console.log('Rendering');
test('committed config stays in Demo mode', () => {
  assert.match(configTpl, /"apiKey": "REPLACE/);
  assert.doesNotMatch(configTpl, /AIza/);
  assert.doesNotMatch(configTpl + rulesTpl, /umconnect-e455a/);
});
test('config renders the project and admins', () => {
  const out = renderConfig(configTpl, resolveEnv(raw()));
  assert.match(out, /"projectId": "stage-proj"/);
  assert.match(out, /mppBootstrapEmails = \["a@um.edu.my","b@um.edu.my"\]/);
  assert.doesNotMatch(out, /REPLACE|\.invalid/);
});
test('rules render the admins and nothing else changes', () => {
  const out = renderRules(rulesTpl, resolveEnv(raw()));
  assert.match(out, /bootstrapAdmins\(\) \{ return \['a@um.edu.my', 'b@um.edu.my'\]; \}/);
  assert.equal(out.split('\n').length, rulesTpl.split('\n').length);
  assert.doesNotMatch(out, /\.invalid/);
});
test('rendering refuses a template without the expected line', () => assert.throws(() => renderRules('no admins here', resolveEnv(raw())), /Expected exactly one/));

console.log('Deploy guards');
test('staging passes from a feature branch', () => assert.deepEqual(deploy({ branch: 'feature/x' }), []));
test('production passes from a clean main', () => assert.deepEqual(deploy({ target: 'production', env: envFor('prod-proj'), branch: 'main' }), []));
test('stops the staging config going to production', () => {
  const p = deploy({ target: 'production', branch: 'main' }).join();
  assert.match(p, /\.firebaserc says production/); assert.match(p, /points at the staging project/);
});
test('stops the production config going to staging', () => {
  const p = deploy({ env: envFor('prod-proj') }).join();
  assert.match(p, /\.firebaserc says staging/); assert.match(p, /points at the production project/);
});
test('stops production from another branch', () => assert.match(deploy({ target: 'production', env: envFor('prod-proj'), branch: 'development' }).join(), /must run from main/));
test('stops production with uncommitted changes', () => assert.match(deploy({ target: 'production', env: envFor('prod-proj'), branch: 'main', dirty: true }).join(), /clean working tree/));
test('stops when .firebaserc still has a placeholder', () => assert.match(deploy({ target: 'production', env: envFor('prod-proj'), branch: 'main', projects: { ...projects, production: 'REPLACE_WITH_PROD_PROJECT_ID' } }).join(), /no real project/));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
