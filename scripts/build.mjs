// Builds both websites for one environment: node scripts/build.mjs --env staging|production|demo
//   dist/client  students and merchants (app/shared + app/client)
//   dist/admin   HEP admin dashboard  (app/shared + app/admin)
// Stamps a version for cache busting and writes that environment's config and rules into each site.
// "demo" keeps the committed placeholders, so the output runs in Demo mode and can't reach a real project.
import fs from 'fs'; import path from 'path';
import { root, loadEnv, renderConfig, renderRules, ENV_FILES } from './lib/env.mjs';
import { SITES, copySite, siteUrlsFor } from './lib/sites.mjs';

const i = process.argv.indexOf('--env');
const name = i > -1 ? process.argv[i + 1] : '';
if (name !== 'demo' && !ENV_FILES[name]) {
  console.error('Usage: node scripts/build.mjs --env staging|production|demo');
  process.exit(1);
}
let env = null;
try {
  if (name !== 'demo') {
    env = loadEnv(name);
    const firebaserc = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8'));
    env.siteUrls = siteUrlsFor(firebaserc, env.firebaseConfig.projectId, env.customUrls);
  }
} catch (e) { console.error(e.message); process.exit(1); }

const out = path.join(root, 'dist');
const version = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const template = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const rules = env ? renderRules(template, env) : template;
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// Deployed to Firestore by firebase.json.
fs.writeFileSync(path.join(out, 'firestore.rules'), rules);

for (const site of Object.keys(SITES)) {
  const dir = path.join(out, site);
  try { copySite(site, dir); } catch (e) { console.error(e.message); process.exit(1); }
  for (const f of ['index.html', 'sw.js']) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('__VERSION__', version));
  }
  // Demo mode checks every read and write against these rules in the browser.
  fs.writeFileSync(path.join(dir, 'firestore.rules'), rules);
  if (env) {
    const cfg = path.join(dir, 'js/firebase-config.js');
    fs.writeFileSync(cfg, renderConfig(fs.readFileSync(cfg, 'utf8'), env));
  }
}
const where = env ? ` (project ${env.firebaseConfig.projectId}: ${env.siteUrls.client} and ${env.siteUrls.admin})` : '';
console.log(`Built dist/client and dist/admin for ${name}${where}, version ${version}`);
