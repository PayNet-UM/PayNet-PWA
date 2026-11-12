// One-time backfill after deploying the KK League, the Faculty League or the referral board. Uses Application Default Credentials.
// Usage: node functions/rebuild-league.js --project YOUR_FIREBASE_PROJECT_ID
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { syncLeagueStudent } from './league.js';
import { rebuildReferralBoard } from './referrals.js';

const flag = process.argv.indexOf('--project');
const projectId = flag >= 0 ? process.argv[flag + 1] : '';
if (!projectId || projectId.startsWith('-')) throw new Error('Pass an explicit --project PROJECT_ID.');
initializeApp({ projectId });
const db = getFirestore();
// Include previous members so removed accounts/college changes are reconciled.
const [users, members] = await Promise.all([db.collection('users').get(), db.collection('leagueMembers').get()]);
const ids = new Set([...users.docs, ...members.docs].map((doc) => doc.id));
for (const uid of ids) await syncLeagueStudent(db, uid);
const top = await rebuildReferralBoard(db);
console.log(`KK and Faculty Leagues reconciled for ${ids.size} accounts, referral board rebuilt (${top.length} students) in ${projectId}.`);
