// One-time backfill of the HEP Dashboard's daily summaries (dailyStats), from the first sign-up to today.
// Safe to run again: each day is recalculated from the records that exist now. Uses Application Default Credentials.
// Usage: node functions/rebuild-daily.js --project YOUR_FIREBASE_PROJECT_ID
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildAll } from './daily-stats-load.js';
import { dayOf } from './daily-stats.js';

const flag = process.argv.indexOf('--project');
const projectId = flag >= 0 ? process.argv[flag + 1] : '';
if (!projectId || projectId.startsWith('-')) throw new Error('Pass an explicit --project PROJECT_ID.');
initializeApp({ projectId });
const n = await buildAll(getFirestore(), dayOf(Date.now()));
console.log(`Daily summaries rebuilt for ${n} days in ${projectId}.`);
