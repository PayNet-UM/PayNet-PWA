// Chooses the live Firebase backend or Demo mode and exposes one SDK-shaped object.
import { firebaseConfig, siteUrls } from './firebase-config.js';

export const configured = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('REPLACE');

function wantDemo() {
  const p = new URLSearchParams(location.search).get('mode');
  try {
    if (p === 'demo') localStorage.setItem('umc-mode', 'demo');
    if (p === 'live') localStorage.removeItem('umc-mode');
    return !configured || localStorage.getItem('umc-mode') === 'demo';
  } catch { return !configured; }
}

export async function initBackend() {
  if (wantDemo()) {
    const sdk = await import('./fake/fakefb.js');
    await sdk.loadRules('firestore.rules');
    const app = sdk.initializeApp({});
    return { sdk, mode: 'demo', auth: sdk.getAuth(app), db: sdk.getFirestore(app) };
  }
  const sdk = await import('../vendor/firebase.js');
  // Run Google sign-in on the same domain as the app. Chrome blocks the popup handshake when the
  // auth domain (firebaseapp.com) differs from the site (web.app). Firebase Hosting serves
  // /__/auth/handler on every site of the project (the student/merchant app and the HEP dashboard),
  // on both their web.app and firebaseapp.com addresses, and on any custom domain connected to them
  // (siteUrls holds the custom domains when CLIENT_URL / ADMIN_URL are set).
  const cfg = { ...firebaseConfig };
  const host = location.hostname;
  const ours = [`${cfg.projectId}.web.app`, `${cfg.projectId}.firebaseapp.com`];
  for (const u of Object.values(siteUrls)) {
    if (!/^https:\/\//.test(u)) continue;
    const h = new URL(u).hostname; ours.push(h, h.replace(/\.web\.app$/, '.firebaseapp.com'));
  }
  // Also this project's other Hosting addresses (e.g. <project>-admin.web.app) when custom domains are set.
  const projectHost = cfg.projectId && host.startsWith(cfg.projectId) && /\.(web\.app|firebaseapp\.com)$/.test(host);
  if (cfg.projectId && (ours.includes(host) || projectHost)) cfg.authDomain = host;
  const app = sdk.initializeApp(cfg);
  let db;
  try {
    db = sdk.initializeFirestore(app, { localCache: sdk.persistentLocalCache({ tabManager: sdk.persistentMultipleTabManager() }) });
  } catch { db = sdk.getFirestore(app); }
  return { sdk, mode: 'live', auth: sdk.getAuth(app), db };
}
