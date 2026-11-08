// Runs the same scenarios against Google's official Firestore emulator.
// Usage (needs Java 21+ and internet the first time):  npm run test:emulator
import fs from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as sdk from 'firebase/firestore';
import { runScenarios } from './scenarios.mjs';

const testEnv = await initializeTestEnvironment({
  projectId: 'umc-rules-test',
  firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
});
await testEnv.clearFirestore();
// signedInHoursAgo sets the token's auth_time, which the rules use to require a recent sign-in for big HEP changes.
const makeCtx = async ({ uid, email, emailVerified = true, signedInHoursAgo = 0 }) => {
  const auth_time = Math.floor(Date.now() / 1000) - Math.round(signedInHoursAgo * 3600);
  const db = testEnv.authenticatedContext(uid, { email, email_verified: emailVerified, auth_time }).firestore();
  return { sdk, db, uid, email, profile: null };
};
const adminEmail = (/function bootstrapAdmins\(\) \{ return \['([^']+)'/.exec(fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')) || [])[1];
const r = await runScenarios({ adminEmail, makeCtx, seedHistory: async (entries) => testEnv.withSecurityRulesDisabled(async (ctx) => { for (const [path, value] of entries) await sdk.setDoc(sdk.doc(ctx.firestore(), path), value, { merge: true }); }), setTime: () => {}, canSetTime: false });
await testEnv.cleanup();
process.exit(r.failed ? 1 : 0);
