// Shared environment logic for the dev server, build and deploy scripts.
// Values come from the process environment first (CI), then from the environment's file (laptops).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ENV_FILES = { staging: '.env.local', production: '.env.production' };
const CONFIG_KEYS = {
  apiKey: 'FIREBASE_API_KEY', authDomain: 'FIREBASE_AUTH_DOMAIN', projectId: 'FIREBASE_PROJECT_ID',
  storageBucket: 'FIREBASE_STORAGE_BUCKET', messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID', appId: 'FIREBASE_APP_ID',
};
const REQUIRED = [...Object.values(CONFIG_KEYS), 'MPP_ADMIN_EMAILS'];
// Optional: left empty, the app shows the free OpenStreetMap map instead of Google Maps.
const OPTIONAL = ['GOOGLE_MAPS_API_KEY', 'GOOGLE_MAPS_MAP_ID', 'CLIENT_URL', 'ADMIN_URL'];
// Optional custom domains, e.g. CLIENT_URL=https://addonz.my/ and ADMIN_URL=https://admin.addonz.my/.
// Without them the sites use their <hosting-site>.web.app addresses from .firebaserc.
const SITE_URL = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+\/$/;
const RULES_ADMINS = /function bootstrapAdmins\(\) \{ return \[.*?\]; \}/g;
const CONFIG_BLOCK = /export const firebaseConfig = \{[\s\S]*?\};/;
const ADMINS_LINE = /export const mppBootstrapEmails = \[.*?\];/;
const MAPS_KEY_LINE = /export const googleMapsApiKey = .*?;/;
const MAPS_ID_LINE = /export const googleMapsMapId = .*?;/;
const SITE_URLS_LINE = /export const siteUrls = \{.*?\};/;

export const isPlaceholder = (v) => !v || /^REPLACE/i.test(v) || /\.invalid$/i.test(v);

export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/** Validates raw values and returns { firebaseConfig, adminEmails }, or throws listing every problem. */
export function resolveEnv(raw, label = 'environment') {
  const problems = REQUIRED.filter((k) => isPlaceholder(raw[k])).map((k) => `${k} is missing or still a placeholder`);
  const adminEmails = String(raw.MPP_ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!isPlaceholder(raw.MPP_ADMIN_EMAILS)) {
    for (const e of adminEmails) if (!/^[^@\s'"\\]+@[^@\s'"\\]+\.[^@\s'"\\]+$/.test(e)) problems.push(`MPP_ADMIN_EMAILS has an invalid address: ${e}`);
  }
  if (raw.FIREBASE_PROJECT_ID && !isPlaceholder(raw.FIREBASE_PROJECT_ID) && !/^[a-z0-9-]+$/.test(raw.FIREBASE_PROJECT_ID)) problems.push('FIREBASE_PROJECT_ID has invalid characters');
  if (problems.length) throw new Error(`Invalid ${label} configuration:\n  - ${problems.join('\n  - ')}`);
  const firebaseConfig = Object.fromEntries(Object.entries(CONFIG_KEYS).map(([k, v]) => [k, raw[v]]));
  const googleMaps = { apiKey: isPlaceholder(raw.GOOGLE_MAPS_API_KEY) ? '' : raw.GOOGLE_MAPS_API_KEY, mapId: isPlaceholder(raw.GOOGLE_MAPS_MAP_ID) ? '' : raw.GOOGLE_MAPS_MAP_ID };
  for (const [k, v] of Object.entries(googleMaps)) if (v && !/^[A-Za-z0-9_-]+$/.test(v)) throw new Error(`Invalid ${label} configuration:\n  - GOOGLE_MAPS_${k === 'apiKey' ? 'API_KEY' : 'MAP_ID'} has invalid characters`);
  const customUrls = {};
  for (const [site, key] of [['client', 'CLIENT_URL'], ['admin', 'ADMIN_URL']]) {
    if (isPlaceholder(raw[key])) continue;
    const v = String(raw[key]).trim().toLowerCase().replace(/\/?$/, '/');
    if (!SITE_URL.test(v)) throw new Error(`Invalid ${label} configuration:\n  - ${key} must look like https://addonz.my/ (https, a domain, nothing after the slash)`);
    customUrls[site] = v;
  }
  return { firebaseConfig, adminEmails, googleMaps, customUrls };
}

/** Loads one named environment. Set values in the process environment take priority over the file. */
export function loadEnv(name, { dir = root, env = process.env } = {}) {
  if (!ENV_FILES[name]) throw new Error(`Unknown environment "${name}". Use: ${Object.keys(ENV_FILES).join(', ')}`);
  const file = path.join(dir, ENV_FILES[name]);
  const fromFile = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
  const merged = { ...fromFile };
  for (const k of [...REQUIRED, ...OPTIONAL]) if (env[k]) merged[k] = env[k];
  return resolveEnv(merged, `${name} (${ENV_FILES[name]})`);
}

function replaceOnce(text, pattern, value, what) {
  const count = (text.match(new RegExp(pattern.source, 'g')) || []).length;
  if (count !== 1) throw new Error(`Expected exactly one ${what}, found ${count}`);
  return text.replace(new RegExp(pattern.source), () => value);
}

// siteUrls is left as committed (same-address paths) when not given, as on the dev server.
export function renderConfig(template, { firebaseConfig, adminEmails, googleMaps = { apiKey: '', mapId: '' }, siteUrls = null }) {
  let out = replaceOnce(template, CONFIG_BLOCK, `export const firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};`, 'firebaseConfig block');
  out = replaceOnce(out, ADMINS_LINE, `export const mppBootstrapEmails = ${JSON.stringify(adminEmails)};`, 'mppBootstrapEmails line');
  out = replaceOnce(out, MAPS_KEY_LINE, `export const googleMapsApiKey = ${JSON.stringify(googleMaps.apiKey)};`, 'googleMapsApiKey line');
  out = replaceOnce(out, MAPS_ID_LINE, `export const googleMapsMapId = ${JSON.stringify(googleMaps.mapId)};`, 'googleMapsMapId line');
  if (!siteUrls) return out;
  const urls = { client: siteUrls.client, admin: siteUrls.admin };
  for (const [k, v] of Object.entries(urls)) if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+\/$/.test(v || '')) throw new Error(`Invalid ${k} site address: ${v}`);
  return replaceOnce(out, SITE_URLS_LINE, `export const siteUrls = ${JSON.stringify(urls)};`, 'siteUrls line');
}

export function renderRules(template, { adminEmails }) {
  return replaceOnce(template, RULES_ADMINS, `function bootstrapAdmins() { return [${adminEmails.map((e) => `'${e}'`).join(', ')}]; }`, 'bootstrapAdmins() line');
}

/** Returns every reason a deploy must not run. An empty list means the deploy may continue. */
export function deployProblems({ target, env, projects, branch, dirty }) {
  const problems = [];
  const projectId = env.firebaseConfig.projectId;
  const expected = projects[target];
  if (isPlaceholder(expected)) problems.push(`.firebaserc has no real project for "${target}"`);
  else if (projectId !== expected) problems.push(`config is for "${projectId}" but .firebaserc says ${target} is "${expected}"`);
  for (const [other, id] of Object.entries(projects)) {
    if (other !== target && id === projectId) problems.push(`${target} config points at the ${other} project "${id}"`);
  }
  if (target === 'production') {
    if (branch !== 'main') problems.push(`production deploys must run from main, not "${branch}"`);
    if (dirty) problems.push('production deploys need a clean working tree');
  }
  return problems;
}
