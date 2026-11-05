// Builds dist/ for one environment: node scripts/build.mjs --env staging|production|demo
// Copies app/, stamps a version for cache busting, and writes that environment's config and rules.
// "demo" keeps the committed placeholders, so the output runs in Demo mode and can't reach a real project.
import fs from 'fs'; import path from 'path';
import { root, loadEnv, renderConfig, renderRules, ENV_FILES } from './lib/env.mjs';

const i = process.argv.indexOf('--env');
const name = i > -1 ? process.argv[i + 1] : '';
if (name !== 'demo' && !ENV_FILES[name]) {
  console.error('Usage: node scripts/build.mjs --env staging|production|demo');
  process.exit(1);
}
let env = null;
try { if (name !== 'demo') env = loadEnv(name); } catch (e) { console.error(e.message); process.exit(1); }

const src = path.join(root, 'app'), out = path.join(root, 'dist');
const version = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
for (const f of ['index.html', 'sw.js']) {
  const p = path.join(out, f); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('__VERSION__', version));
}
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
fs.writeFileSync(path.join(out, 'firestore.rules'), env ? renderRules(rules, env) : rules);
if (env) {
  const cfg = path.join(out, 'js/firebase-config.js');
  fs.writeFileSync(cfg, renderConfig(fs.readFileSync(cfg, 'utf8'), env));
}
console.log(`Built dist/ for ${name}${env ? ` (project ${env.firebaseConfig.projectId})` : ''}, version ${version}`);
