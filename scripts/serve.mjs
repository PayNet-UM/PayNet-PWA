// Tiny static server for local testing.
//   npm run dev        serves app/ using staging values from .env.local (Demo mode if the file is missing)
//   npm run dev:demo   serves app/ in Demo mode, even if .env.local exists
import http from 'http'; import fs from 'fs'; import path from 'path';
import { root, loadEnv, renderConfig, renderRules, ENV_FILES } from './lib/env.mjs';

const args = process.argv.slice(2);
const demo = args.includes('--demo');
const dirName = args.find((a) => !a.startsWith('--')) || 'app';
const dir = path.join(root, dirName); const port = Number(process.env.PORT || 5173);
const useEnv = dirName === 'app' && !demo && fs.existsSync(path.join(root, ENV_FILES.staging));
let env = null;
if (useEnv) {
  try { env = loadEnv('staging'); } catch (e) { console.error(`${e.message}\nFix ${ENV_FILES.staging}, or run npm run dev:demo.`); process.exit(1); }
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.rules': 'text/plain', '.txt': 'text/plain' };
const rulesFile = path.join(root, 'firestore.rules');
const generate = (p, file) => {
  if (!env) return null;
  if (p === '/js/firebase-config.js') return renderConfig(fs.readFileSync(file, 'utf8'), env);
  if (p === '/firestore.rules') return renderRules(fs.readFileSync(rulesFile, 'utf8'), env);
  return null;
};
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  let file = path.join(dir, p);
  if (p === '/firestore.rules' && !fs.existsSync(file)) file = rulesFile;
  if (!path.resolve(file).startsWith(path.resolve(dir)) && file !== rulesFile) { res.writeHead(403); return res.end(); }
  const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
  const generated = generate(p, file);
  if (generated !== null) { res.writeHead(200, headers); return res.end(generated); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, headers); res.end(data);
  });
}).listen(port, () => {
  const mode = env ? `STAGING project ${env.firebaseConfig.projectId}` : dirName === 'app' ? 'Demo mode' : 'as built';
  console.log(`+Onz on http://localhost:${port} (serving ${dirName}/, ${mode})`);
});
