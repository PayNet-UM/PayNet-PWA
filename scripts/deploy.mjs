// Deploys rules and hosting to one named environment: node scripts/deploy.mjs staging|production [--dry-run]
// --dry-run runs every check, the tests and the build, then stops before calling Firebase.
// Deploys Firestore rules, the website and the server functions (functions/, the iPhone sign-in hand-off).
import fs from 'fs'; import path from 'path'; import readline from 'readline'; import { execSync, execFileSync } from 'child_process';
import { root, loadEnv, deployProblems, ENV_FILES } from './lib/env.mjs';

const target = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const ci = process.env.CI === 'true';
const fail = (msg) => { console.error(`\nDeploy stopped: ${msg}`); process.exit(1); };
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const read = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();

if (!ENV_FILES[target]) fail('usage: node scripts/deploy.mjs staging|production [--dry-run]');

let env;
try { env = loadEnv(target); } catch (e) { fail(e.message); }
const { projects } = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8'));
const projectId = env.firebaseConfig.projectId;
const branch = process.env.GITHUB_REF_NAME || read('git rev-parse --abbrev-ref HEAD');
const dirty = read('git status --porcelain') !== '';

const problems = deployProblems({ target, env, projects, branch, dirty });
if (problems.length) fail(`\n  - ${problems.join('\n  - ')}`);

if (target === 'production' && !ci && !dryRun) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const typed = await new Promise((r) => rl.question(`Type the production project ID (${projectId}) to deploy: `, r));
  rl.close();
  if (typed.trim() !== projectId) fail('project ID did not match');
}

run('npm test');
execFileSync(process.execPath, ['scripts/build.mjs', '--env', target], { cwd: root, stdio: 'inherit' });

// Check what was actually built, not only the inputs.
const builtConfig = fs.readFileSync(path.join(root, 'dist/js/firebase-config.js'), 'utf8');
const builtRules = fs.readFileSync(path.join(root, 'dist/firestore.rules'), 'utf8');
if (!builtConfig.includes(`"projectId": "${projectId}"`)) fail('dist/ config does not match the target project');
for (const [other, id] of Object.entries(projects)) {
  if (other !== target && builtConfig.includes(id)) fail(`dist/ config contains the ${other} project ID`);
}
if (/REPLACE|\.invalid/.test(builtConfig) || /\.invalid'/.test(builtRules)) fail('dist/ still contains a placeholder');

if (dryRun) { console.log(`\nDry run passed. Would deploy firestore, hosting and functions to ${target} (${projectId}).`); process.exit(0); }
// Server functions (functions/): install their packages so the Firebase CLI can read them.
run('npm ci --prefix functions --no-audit --no-fund');
// --force accepts the default clean-up policy for old function images on the first deploy.
run(`npx firebase deploy --project ${projectId} --only firestore,hosting,functions --non-interactive --force`);
console.log(`\nDeployed ${target}: https://${projectId}.web.app`);
