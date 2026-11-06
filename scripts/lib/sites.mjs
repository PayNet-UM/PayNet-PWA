// The two websites and the folders each one is built from.
// app/shared/ is laid under each site's own folder, so a site's files and the shared files end up side by side
// (js/main.js next to js/data.js) and relative imports work the same in the source, the dev server and dist/.
import fs from 'fs'; import path from 'path';
import { root } from './env.mjs';

export const SITES = {
  client: { dir: 'app/client', label: 'students and merchants' },
  admin: { dir: 'app/admin', label: 'HEP admin dashboard' },
};
export const SHARED_DIR = 'app/shared';
// In dev both sites share one address so Demo mode (data kept in this browser) is shared between them.
export const DEV_ADMIN_PREFIX = '/admin';

const layers = (site) => [path.join(root, SITES[site].dir), path.join(root, SHARED_DIR)];

/** The file a URL path maps to for one site (its own folder first, then shared), or null. */
export function resolveSiteFile(site, urlPath) {
  for (const base of layers(site)) {
    const file = path.join(base, urlPath);
    if (!path.resolve(file).startsWith(path.resolve(base) + path.sep)) return null;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

function listFiles(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) out.push(...listFiles(dir, r)); else out.push(r);
  }
  return out;
}

/** Copies shared/ and then the site's own folder into out. A file in both places is a mistake, so it stops. */
export function copySite(site, out) {
  const [own, shared] = layers(site);
  const ownFiles = new Set(listFiles(own));
  const clash = listFiles(shared).filter((f) => ownFiles.has(f));
  if (clash.length) throw new Error(`${SITES[site].dir} and ${SHARED_DIR} both have: ${clash.join(', ')}`);
  fs.cpSync(shared, out, { recursive: true });
  fs.cpSync(own, out, { recursive: true });
}

/** Public addresses of both sites for one project, from the hosting targets in .firebaserc. */
export function siteUrlsFor(firebaserc, projectId) {
  const targets = firebaserc.targets?.[projectId]?.hosting || {};
  const urls = {};
  for (const site of Object.keys(SITES)) {
    const id = targets[site]?.[0];
    if (!id) throw new Error(`.firebaserc has no hosting target "${site}" for project ${projectId}. See docs/DEPLOY.md.`);
    urls[site] = `https://${id}.web.app/`;
  }
  return urls;
}
