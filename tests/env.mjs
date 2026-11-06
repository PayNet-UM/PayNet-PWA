// Tests the environment and deploy safety checks. No network, no real project values.
import assert from 'assert/strict'; import fs from 'fs'; import os from 'os'; import path from 'path';
import { parseEnv, resolveEnv, renderConfig, renderRules, deployProblems, loadEnv } from '../scripts/lib/env.mjs';
import { SITES, copySite, siteUrlsFor, resolveSiteFile } from '../scripts/lib/sites.mjs';

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
const configTpl = fs.readFileSync(new URL('../app/shared/js/firebase-config.js', import.meta.url), 'utf8');
const firebaserc = JSON.parse(fs.readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'));

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

console.log('Google Maps');
test('maps values are optional', () => assert.deepEqual(resolveEnv(raw()).googleMaps, { apiKey: '', mapId: '' }));
test('maps key and map ID are written into the config', () => {
  const out = renderConfig(configTpl, resolveEnv(raw({ GOOGLE_MAPS_API_KEY: 'AIzaTest_key-1', GOOGLE_MAPS_MAP_ID: 'abc123' })));
  assert.match(out, /export const googleMapsApiKey = "AIzaTest_key-1";/);
  assert.match(out, /export const googleMapsMapId = "abc123";/);
});
test('rejects a maps key that could break out of the config', () => assert.throws(() => resolveEnv(raw({ GOOGLE_MAPS_API_KEY: "a';alert(1)//" })), /GOOGLE_MAPS_API_KEY/));

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

console.log('Two websites');
const sites = { client: 'https://stage-proj.web.app/', admin: 'https://stage-proj-admin.web.app/' };
test('committed config links the sites by path, for the dev server', () => assert.match(configTpl, /export const siteUrls = \{ client: '\/', admin: '\/admin\/' \};/));
test('config renders both site addresses', () => {
  const out = renderConfig(configTpl, { ...resolveEnv(raw()), siteUrls: sites });
  assert.match(out, /export const siteUrls = \{"client":"https:\/\/stage-proj\.web\.app\/","admin":"https:\/\/stage-proj-admin\.web\.app\/"\};/);
});
test('without site addresses the config keeps the dev paths', () => assert.match(renderConfig(configTpl, resolveEnv(raw())), /siteUrls = \{ client: '\/'/));
test('rejects a site address that could break out of the config', () => assert.throws(() => renderConfig(configTpl, { ...resolveEnv(raw()), siteUrls: { ...sites, admin: 'https://x.web.app/";alert(1)//' } }), /admin site address/));
test('.firebaserc has both hosting targets for every project', () => {
  for (const id of Object.values(firebaserc.projects)) {
    const urls = siteUrlsFor(firebaserc, id);
    assert.equal(urls.client, `https://${id}.web.app/`);
    assert.notEqual(urls.admin, urls.client);
  }
});
test('a project without hosting targets is refused', () => assert.throws(() => siteUrlsFor(firebaserc, 'other-proj'), /no hosting target "client"/));
test('each site gets the shared files and only its own views', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umc-sites-'));
  for (const site of Object.keys(SITES)) copySite(site, path.join(dir, site));
  const has = (site, f) => fs.existsSync(path.join(dir, site, f));
  for (const site of Object.keys(SITES)) {
    for (const f of ['index.html', 'js/data.js', 'js/views/auth.js', 'js/firebase-config.js', 'vendor/firebase.js']) assert.ok(has(site, f), `${site} is missing ${f}`);
  }
  assert.ok(has('client', 'js/views/student.js') && has('client', 'sw.js') && !has('client', 'js/views/mpp.js'), 'client files');
  assert.ok(has('admin', 'js/views/mpp.js') && !has('admin', 'js/views/student.js') && !has('admin', 'js/views/merchant.js') && !has('admin', 'sw.js'), 'admin files');
  fs.rmSync(dir, { recursive: true, force: true });
});
test('site files cannot escape their folders', () => assert.equal(resolveSiteFile('client', '/../../package.json'), null));
test('every relative import resolves on the site that loads it', () => {
  const seen = new Set();
  const walk = (site, file) => {
    const key = site + ':' + file; if (seen.has(key)) return; seen.add(key);
    const src = fs.readFileSync(resolveSiteFile(site, file), 'utf8');
    for (const [, spec] of src.matchAll(/(?:from\s+|import\()\s*'(\.{1,2}\/[^']+)'/g)) {
      const next = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      assert.ok(resolveSiteFile(site, next), `${site}: ${file} imports ${spec}, which isn't there`);
      if (next.endsWith('.js') && !next.startsWith('/vendor/')) walk(site, next);
    }
  };
  walk('client', '/js/main.js'); walk('admin', '/js/admin.js');
});

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
