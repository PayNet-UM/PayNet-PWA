# Kampus Kita+ PWA on Firebase

The installable web app for students, merchants and MPP lives in `app/`. It runs in two modes:

- **Demo mode** (no setup): if no environment values are loaded, data stays in the browser and every read and write is checked against `firestore.rules`. It's useful for pitching and for trying the flows. Open two tabs to act as a student and a merchant at the same time. The demo password is `demo1234`.
- **Live mode**: real accounts and a shared database on Firebase (Auth + Firestore + Hosting). This runs on the free Spark plan, with no credit card and no Cloud Functions.

The original demonstrator is now in `legacy/`. For branches, links and day-to-day commands, see the [README](../README.md).

## Try it locally (2 minutes)

```bash
npm ci
npm run dev:demo     # http://localhost:5173 opens in Demo mode
npm test             # rule, business and deploy-guard tests against the local rules evaluator
```

## Set up a Firebase project

Do this once for each environment. Staging is `umconnect-e455a`; the steps matter most for production.

1. **Create a Firebase project** at console.firebase.google.com. Skip Google Analytics.
2. **Create the admin account first.** Under Build > Authentication, create the account for your admin mailbox **before** turning on Email/Password sign-in, so nobody else can claim that address.
   Then turn on sign-in under Sign-in method:
   - Enable **Google**. Pick a project support email, then save.
   - Enable **Email/Password** as well. It's a fallback for merchants without a Google account.
   - Under Settings > Authorized domains, `localhost` and your `*.web.app` / `*.firebaseapp.com` domains are already listed. Add any custom domain you use.
3. **Create the Firestore database.** Go to Build > Firestore Database > Create database, choose **asia-southeast1 (Singapore)**, and start in production mode.
4. **Register a web app** under Project settings > General > Your apps > `</>`, and copy the `firebaseConfig`.
5. **Add the values and deploy:**
   - Put the config and `MPP_ADMIN_EMAILS` in `.env.local` (staging) or `.env.production`, and in that GitHub Environment.
   - For production, put the project ID in `.firebaserc`.
   - Merge to the matching branch, or see [Manual deploys](#manual-deploys).

   The site is then at `https://<project>.web.app`.
6. **Sign in as MPP** with an address from `MPP_ADMIN_EMAILS`. If it's a Google account, use **Continue with Google**; otherwise verify it via the link Firebase emails you. Admins can't do anything until their email is verified. The dashboard opens on **Set up the programme**. Click it once to create the points rules, rewards and counters.
7. Under **Settings**, add other MPP reviewers and any pilot testers who don't have a `@siswa.um.edu.my` email.

Students install it from the browser: Chrome shows **Install app**, and on iPhone use Safari > Share > **Add to Home Screen**. The camera scanner needs HTTPS, which Firebase Hosting provides.

## Set up GitHub Actions

A repo admin does this once. Merging to `development` deploys staging, and merging to `main` deploys production.

**1. Create two environments** under Settings > Environments, named exactly `staging` and `production`:

| Environment | Deployment branches | Required reviewers |
|---|---|---|
| `staging` | `development` only | None |
| `production` | `main` only | At least one |

**2. Add these to each environment:**
- **Variables:** `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `MPP_ADMIN_EMAILS`, and optionally `GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_MAP_ID`
- **Secret:** `FIREBASE_SERVICE_ACCOUNT`, holding that project's service account key

**3. Create one service account per Firebase project:**
1. In Google Cloud Console, go to IAM & Admin > Service Accounts and create an account.
2. Grant **Firebase Admin** and **Service Usage Consumer**. If the first deploy reports a missing permission, add that role.
3. Under Keys, add a JSON key and paste its contents into the secret.
4. Delete the downloaded file. Never commit it.

## Manual deploys

GitHub Actions is the normal route. These commands are the fallback:

```bash
npx firebase login
npm run deploy:staging
npm run deploy:production     # from a clean main only; asks you to type the project ID
```

Add `-- --dry-run` to run every check, the tests and the build without deploying.

The script refuses to deploy if:
- a value is missing or still a placeholder
- the config's project doesn't match `.firebaserc`
- the config points at the other environment's project
- a production deploy isn't on a clean `main`

## Google Maps (optional, about 10 minutes)

Without a key the app shows a free OpenStreetMap map. To use Google Maps:

1. Open console.cloud.google.com and pick the **same project** as Firebase (one key per environment). Google Maps needs a **billing account** on the project; Essentials map loads include a free monthly allowance, so a campus pilot normally costs nothing. Set a budget alert anyway (Billing > Budgets & alerts).
2. APIs & Services > Library: enable **Maps JavaScript API**.
3. APIs & Services > Credentials > Create credentials > API key. Then edit the key:
   - Application restrictions: **Websites**. Add `https://<project>.web.app/*`, `https://<project>.firebaseapp.com/*` and `http://localhost:5173/*`.
   - API restrictions: **Restrict key** to Maps JavaScript API.
4. Put the key in `GOOGLE_MAPS_API_KEY` in `.env.local` / `.env.production` and in each GitHub Environment's variables, then deploy.
5. Optional: Google Maps Platform > Map management > Create Map ID (JavaScript, Vector) and put it in `GOOGLE_MAPS_MAP_ID`. Without one the app uses Google's demo map ID, which works but can't be styled.

If Google rejects the key on some address, the app switches to the OpenStreetMap map automatically and says so.

## Google sign-in in the iPhone home-screen app (server, one-time set-up)

An app added to the iPhone home screen opens Google's sign-in in a separate Safari window, which can't hand the
session back. So the app uses a small server hand-off (`functions/`, deployed with the rest):

1. In the home-screen app, "Continue with Google" makes a random secret, keeps it, and opens Safari with only its hash.
2. The student signs in with Google in Safari; that page registers the hash with the server (`/api/handoff/create`).
3. Back in the app, it trades the secret for a one-time sign-in token (`/api/handoff/redeem`) and is signed in.
   Codes work once and expire after 3 minutes. Android, computers and Safari itself keep the normal Google sign-in.

Needs the **Blaze** plan. Once per Firebase project (staging and production):

1. **Let the server create sign-in tokens.** The server runs as the account named in
   `functions/.env.<project-id>` (`HANDOFF_SERVICE_ACCOUNT`). Staging uses
   `firebase-adminsdk-fbsvc@umconnect-e455a.iam.gserviceaccount.com`. In Google Cloud Console > IAM, that account
   needs **Service Account Token Creator** (pencil > Add another role). For production, create
   `functions/.env.umconnectproduction` with that project's `firebase-adminsdk-…` address and give it the same role.
   Without it the app says "The sign-in server isn't allowed to create sign-in tokens yet".
2. **Optional clean-up:** Firestore > TTL policies > create one on collection group `handoffs`, field `expiresAt`,
   so unused codes are deleted automatically (used codes are deleted straight away).
3. **GitHub deploys:** the deploy service account (`FIREBASE_SERVICE_ACCOUNT`) also needs **Cloud Functions Admin**,
   **Service Account User** and **Cloud Run Admin** to deploy functions. Add them in the same IAM page if a deploy
   stops with a permission error.

The first deploy with functions takes a few minutes longer: Google turns on Cloud Functions, Cloud Build and
Artifact Registry for the project. Tests: `node tests/handoff.mjs`.

## "Here now" campus map (optional clean-up)

Students who switch on "Show me on the campus map" appear at a shop for 2 hours after each check-out
(collection `presence`, one document per student). The app hides entries after 2 hours by itself. To delete
old entries from the database too: Firestore > TTL policies > create one on collection group `presence`,
field `expiresAt`. Rules: `presence` and `waves` in `firestore.rules`; tests: "Here now" in `tests/scenarios.mjs`.

## How the trust model works

| Step | Who | Enforced in `firestore.rules` |
|---|---|---|
| Sign up as student | Google sign-in (or a verified email) on an allowed domain, `gmail.com` by default, or a tester listed by MPP | yes |
| One account per student | Each matric number can register once and can't be changed afterwards | yes |
| Join the map and PayNet list | Merchant sends details, **logo**, **exact map pin** and DuitNow QR, then MPP verifies | logo and pin required; only MPP can set `verified` |
| Earn points for a check-in | Student taps Check in while standing at a merchant's pin | within 60 m of the pin, once per 3 hours per shop, max 5 a day (all set by MPP in Settings) |
| Every points change | Written with an immutable ledger entry in the same batch | balance can't go negative or change without a matching entry |
| Lessons | Answer keys are hidden from students; the rules check the answer | yes |
| Referrals, quiet-hour bonuses, vouchers, donations, avatars | Each has its own once-only and limit checks | yes |
| Mission bonuses, corrections | MPP approves, and the note is stored on the ledger | yes |

## Testing before real students

- `npm test` runs the rules locally using the rules evaluator in `app/js/fake/rules-engine.js`.
- `npm run test:emulator` runs **the same scenarios on Google's official Firestore emulator**. It needs Java 21+ and an internet connection the first time. **Run this before the pilot**, because the local evaluator is a close copy of the rules language, not Google's own engine.
- `npm run dev:demo` in one terminal and `npm run test:e2e` in another drives the real UI. A student checks in at a shop, customises an avatar and redeems a voucher at the merchant; a new merchant must give a logo and pin; every MPP screen is opened; and a pass with a fake Google Maps key checks the Google Maps path.
  It refuses to run against a live config.

## Limits worth knowing

- **Gmail sign-in proves the email address, not that the person is a UM student.** The matric number limits each student to one account, but MPP should spot-check matric numbers against the student list before paying out rewards. If your UM student email is hosted on Google Workspace, you can remove `gmail.com` under Settings so only UM accounts can join.
- **Installed iPhone app:** Google sign-in can't open a popup from an installed iPhone app, so the app automatically falls back to a full-page redirect.

- **QR photos are stored in Firestore.** They're compressed to under about 600 KB because Cloud Storage now needs the Blaze plan. This is fine for a few hundred merchants.
- **There is no server code**, so these happen when someone opens the app rather than on a timer:
  - Mission claims wait for MPP.
  - Points don't auto-expire.
- **Free-tier quota:** Spark allows 50k document reads a day. A pilot with ~150 students fits easily. Watch Usage in the console before going campus-wide; Blaze has the same free allowance and pay-as-you-go above it.
- **Check-ins trust the phone's location.** A determined student could fake GPS, so check-in points are kept small and capped per day. Activity check (MPP) flags check-ins that are too far apart too quickly, or with a rough location fix, and lets you reverse points.
- **The app doesn't record payments and never moves money.** PayNet's monthly DuitNow QR counts remain the source of truth for transactions; import them on Activity check to compare with check-ins.
