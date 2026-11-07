// One-time backfill after deploying KK League. Uses Application Default Credentials.
// Usage: node functions/rebuild-league.js --project YOUR_FIREBASE_PROJECT_ID
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { syncLeagueStudent } from './league.js';

const flag = process.argv.indexOf('--project');
const projectId = flag >= 0 ? process.argv[flag + 1] : '';
if (!projectId || projectId.startsWith('-')) throw new Error('Pass an explicit --project PROJECT_ID.');
initializeApp({ projectId });
const db = getFirestore();
// Include previous members so removed accounts/college changes are reconciled.
const [users, members] = await Promise.all([db.collection('users').get(), db.collection('leagueMembers').get()]);
const ids = new Set([...users.docs, ...members.docs].map((doc) => doc.id));
for (const uid of ids) await syncLeagueStudent(db, uid);
console.log(`KK League reconciled for ${ids.size} accounts in ${projectId}.`);
