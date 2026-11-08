// Tiny static server for local testing. Serves both websites on one address:
//   http://localhost:5173/        students and merchants (app/client + app/shared)
//   http://localhost:5173/admin/  HEP admin dashboard (app/admin + app/shared)
// Sharing one address lets Demo mode (data kept in this browser) show the same data on both sites.
//   npm run dev              uses staging values from .env.local (Demo mode if the file is missing)
//   npm run dev:demo         Demo mode, even if .env.local exists
//   node scripts/serve.mjs dist   serves a build: dist/client at / and dist/admin at /admin/
import http from 'http'; import fs from 'fs'; import path from 'path';
import { root, loadEnv, renderConfig, renderRules, ENV_FILES } from './lib/env.mjs';
import { resolveSiteFile, DEV_ADMIN_PREFIX } from './lib/sites.mjs';

const args = process.argv.slice(2);
const demo = args.includes('--demo');
const built = args.includes('dist');
const port = Number(process.env.PORT || 5173);
const useEnv = !built && !demo && fs.existsSync(path.join(root, ENV_FILES.staging));
let env = null;
if (useEnv) {
  try { env = loadEnv('staging'); } catch (e) { console.error(`${e.message}\nFix ${ENV_FILES.staging}, or run npm run dev:demo.`); process.exit(1); }
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.rules': 'text/plain', '.txt': 'text/plain' };
const rulesFile = path.join(root, 'firestore.rules');
const generate = (p, file) => {
  if (!env) return null;
  if (p === '/js/firebase-config.js') return renderConfig(fs.readFileSync(file, 'utf8'), env);
  if (p === '/firestore.rules') return renderRules(fs.readFileSync(rulesFile, 'utf8'), env);
  return null;
};
function resolve(site, p) {
  if (built) {
    const base = path.join(root, 'dist', site); const file = path.join(base, p);
    return path.resolve(file).startsWith(path.resolve(base) + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
  }
  if (p === '/firestore.rules') return rulesFile;
  return resolveSiteFile(site, p);
}

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === DEV_ADMIN_PREFIX) { res.writeHead(301, { Location: DEV_ADMIN_PREFIX + '/' }); return res.end(); }
  const site = p.startsWith(DEV_ADMIN_PREFIX + '/') ? 'admin' : 'client';
  if (site === 'admin') p = p.slice(DEV_ADMIN_PREFIX.length);
  if (p.endsWith('/')) p += 'index.html';
  const file = resolve(site, p);
  if (!file) { res.writeHead(404); return res.end('Not found'); }
  const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
  const generated = generate(p, file);
  if (generated !== null) { res.writeHead(200, headers); return res.end(generated); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, headers); res.end(data);
  });
}).listen(port, () => {
  const mode = env ? `STAGING project ${env.firebaseConfig.projectId}` : built ? 'as built' : 'Demo mode';
  console.log(`+Onz (${mode})\n  students and merchants  http://localhost:${port}/\n  HEP admin dashboard     http://localhost:${port}${DEV_ADMIN_PREFIX}/`);
});
