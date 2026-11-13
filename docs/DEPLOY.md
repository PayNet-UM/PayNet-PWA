# +Onz PWA on Firebase

"HEP" is the admin role. The code and settings still say `mpp` in places, such as `MPP_ADMIN_EMAILS`.

There are two websites, both on the same Firebase project and database:

| Site | Who | Source | Address |
|---|---|---|---|
| `client` | Students and merchants (installable PWA) | `app/client` + `app/shared` | `https://<project>.web.app` |
| `admin` | HEP admin dashboard | `app/admin` + `app/shared` | `https://<project>-admin.web.app` |

The Hosting site IDs are set per project under `targets` in `.firebaserc`. The build reads them so each site can link to the other.
On the dev server both sites share one address (the dashboard at `/admin/`), so Demo mode shows the same data on both.

Both sites run in two modes:

- **Demo mode** (no setup): if no environment values are loaded, data stays in the browser and every read and write is checked against `firestore.rules`. It's useful for pitching and for trying the flows. Open two tabs to act as a student and a merchant at the same time. The demo password is `demo1234`.
- **Live mode**: real accounts and a shared database on Firebase (Auth + Firestore + Hosting). This needs the **Blaze** plan, because the iPhone sign-in server runs on Cloud Functions.

The original demonstrator is now in `legacy/`. For branches, links and day-to-day commands, see the [README](../README.md).

## Try it locally (2 minutes)

```bash
npm ci
npm run dev:demo     # Demo mode: http://localhost:5173 (students, merchants), http://localhost:5173/admin/ (HEP)
npm test             # rule, business and deploy-guard tests against the local rules evaluator
```

## Set up a Firebase project

Do this once for each environment. Staging is `umconnect-e455a`; the steps matter most for production.

1. **Create a Firebase project** at console.firebase.google.com. Skip Google Analytics.
2. **Turn on sign-in in this order,** so nobody else can claim the admin address:
   - Enable **Google** under Build > Authentication > Sign-in method. Pick a project support email, then save.
   - Enable **Email/Password** only after the admin has signed in (step 7). It's a fallback for merchants without a Google account.
   - Under Settings > Authorized domains, `localhost` and the default `<project>.web.app` / `<project>.firebaseapp.com` are already listed. **Add the dashboard's** `<project>-admin.web.app` and `<project>-admin.firebaseapp.com`, and any custom domain you use.
3. **Create the Firestore database.** Go to Build > Firestore Database > Create database, choose **asia-southeast1 (Singapore)**, and start in production mode.
4. **Register a web app** under Project settings > General > Your apps > `</>`, and copy the `firebaseConfig`.
5. **Create the HEP dashboard's Hosting site** (once per project):
   ```bash
   npx firebase hosting:sites:create <project>-admin --project <project>
   ```
   If that ID is taken, pick another and put it under `targets.<project>.hosting.admin` in `.firebaserc`.
   Then, for Google sign-in on the dashboard: Google Cloud Console > APIs & Services > Credentials > the **Web client (auto created by Google Service)** OAuth client >
   Authorized redirect URIs: add `https://<project>-admin.web.app/__/auth/handler` and `https://<project>-admin.firebaseapp.com/__/auth/handler`.
   Without it, Google sign-in on the dashboard fails with `redirect_uri_mismatch`; email and password still work.
6. **Add the values and deploy:**
   - Put the config and `MPP_ADMIN_EMAILS` in `.env.local` (staging) or `.env.production`, and in that GitHub Environment.
   - For production, put the project ID in `.firebaserc`, under `projects` and `targets`.
   - Merge to the matching branch, or see [Manual deploys](#manual-deploys).

   The student/merchant app is then at `https://<project>.web.app` and the HEP dashboard at `https://<project>-admin.web.app`.
7. **Sign in to the HEP dashboard** (`https://<project>-admin.web.app`) with an address from `MPP_ADMIN_EMAILS`. If it's a Google account, use **Continue with Google**; otherwise verify it via the link Firebase emails you. Admins can't do anything until their email is verified. The dashboard opens on **Set up the programme**. Click it once to create the points rules, rewards and counters.
8. Under **Settings**, add other HEP reviewers and any pilot testers who don't have a `@siswa.um.edu.my` email.
9. Under **Settings > Features**, turn on what's launching. Everything there starts off. See [Turning features on and off](../README.md#turning-features-on-and-off).
10. HEP sign-ins last 12 hours, and the dashboard signs out after 30 idle minutes. After the deploy that adds this, admins who were already signed in for longer are asked to sign in again once. Changes appear under **Activity log**.

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
2. Grant **Firebase Admin**, **Service Usage Consumer**, **Cloud Functions Admin**, **Service Account User** and **Cloud Run Admin**. If the first deploy reports a missing permission, add that role.
3. Under Keys, add a JSON key and paste its contents into the secret.
4. Delete the downloaded file. Never commit it.

## Database-triggered functions (once per project)

The KK League functions run when the database changes, so the first deploy on each project needs two extra steps. The deploy account deliberately can't change project permissions, so a project Owner does the first one.

1. **Grant the permissions.** The deploy stops with `We failed to modify the IAM policy` and prints three `gcloud` commands, using that project's number. Run them in [Cloud Shell](https://shell.cloud.google.com/) as an Owner. They give Pub/Sub's service account **Service Account Token Creator**, and the default compute account **Cloud Run Invoker** and **Eventarc Event Receiver**.
2. **Re-run the deploy.** It may then stop with `Permission denied while using the Eventarc Service Agent`, which means Google is still setting up. Wait about 10 minutes, then use **Re-run failed jobs**.

If that second error doesn't clear, grant the role by hand, wait 5 minutes and re-run:

```bash
gcloud beta services identity create --service=eventarc.googleapis.com --project=<project>
gcloud projects add-iam-policy-binding <project> --member=serviceAccount:service-<project-number>@gcp-sa-eventarc.iam.gserviceaccount.com --role=roles/eventarc.serviceAgent
```

**A failed deploy can leave a project half updated.** The rules can be live before the website, so old screens may fail until a retry succeeds. Don't demo during this.

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
- `.firebaserc` has no `client` and `admin` hosting targets for the project
- the built sites don't carry the right site addresses, or the dashboard ended up in the student app

## Google Maps (optional, about 10 minutes)

Without a key the app shows a free OpenStreetMap map. To use Google Maps:

1. Open console.cloud.google.com and pick the **same project** as Firebase (one key per environment). Google Maps needs a **billing account** on the project; Essentials map loads include a free monthly allowance, so a campus pilot normally costs nothing. Set a budget alert anyway (Billing > Budgets & alerts).
2. APIs & Services > Library: enable **Maps JavaScript API**.
3. APIs & Services > Credentials > Create credentials > API key. Then edit the key:
   - Application restrictions: **Websites**. Add `https://<project>.web.app/*`, `https://<project>.firebaseapp.com/*`, the dashboard's `https://<project>-admin.web.app/*` and `https://<project>-admin.firebaseapp.com/*`, and `http://localhost:5173/*`.
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
3. **GitHub deploys:** the deploy service account (`FIREBASE_SERVICE_ACCOUNT`) needs the roles listed under
   [Set up GitHub Actions](#set-up-github-actions) to deploy functions. Add any that are missing on the same IAM page if a deploy
   stops with a permission error.

The first deploy with functions takes a few minutes longer: Google turns on Cloud Functions, Cloud Build and
Artifact Registry for the project. Tests: `node tests/handoff.mjs`.

## Retired attendance flows

There is no attendance-based system. New check-in, visit, place-presence, wave,
referral-qualification and attendance-mission writes are denied by security rules.
Legacy data-layer entry points also reject writes, so old cached clients cannot
restart the flow. Existing attendance records, points and ledger entries remain
available as historical records; they are not recast as current transactions.

Daily attendance points/streaks and visit missions are removed from active student
screens. Daily app streaks count app opens instead (see below).
Weekly missions are pending a replacement design. Referral codes continue
connecting friends, without a first-visit requirement or an active points promise.
Friend requests, acceptance, removal and usernames continue to work. Attendance-based
place sharing and waves are paused; Overview never publishes a GPS position.

Merchant activity and Insights use live-deal QR claims and applied discounts. HEP uses registered
accounts, readiness, welfare, KK earned totals, voucher redemptions and imported
PayNet counts. It does not derive footfall or conversions from map browsing.
Live deals publish immediately from verified merchants, require a merchant-issued QR and use time and occupancy availability checks. Successful scans award the configured points immediately; no attendance flow is used.
Survey/lesson rewards, vouchers, welfare requests and HEP corrections remain active.
Deploy the rules and both sites together. There is no attendance enable switch.

## Daily app check-in streaks

Home links to a compact Daily check-in streak card in Rewards (`#/rewards/streak`).
Opening, resuming or using the signed-in student app records one Malaysia calendar
date in `users/{uid}/appDays/{YYYY-MM-DD}`. No manual button, lesson, location or
extra point award is required. Reopening the app on the same day does not change
the record. A hidden background app does not count a new day. The first foreground
interaction after midnight can count if the app was left open. Sign-out removes
the activity listeners.

Rules restrict each record to the authenticated student, today's MYT date and a
server timestamp. Records cannot be rewritten, backfilled or future-dated. Only
the student and HEP may read them. A missed calendar day resets the streak; the
day after the last app use remains available to continue it. App-use records are
separate from learning completions and legacy attendance, and never increase the
point balance or KK League score. Existing learning history is not recast as app
opens. Completed lessons can still be practised without repeated points.

## Custom domain (e.g. addonz.my)

Students and merchants on `https://addonz.my/`, HEP on `https://admin.addonz.my/`. Once per Firebase project:

1. **Firebase console > Hosting**: on the student/merchant site click **Add custom domain**, enter `addonz.my`
   (tick "Redirect www.addonz.my" if you want `www` too). On the admin site (`<project>-admin`), add `admin.addonz.my`.
2. **At your domain registrar's DNS settings**, add exactly the records Firebase shows (usually a TXT record to
   prove ownership and an A record for `addonz.my`; for `admin` an A or CNAME record). Remove any old A/AAAA
   records for the same names. Firebase then issues the HTTPS certificate: minutes to 24 hours.
3. **Firebase > Authentication > Settings > Authorized domains**: add `addonz.my` and `admin.addonz.my`.
4. **Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs > "Web client (auto created by
   Google Service)"**: add `https://addonz.my` and `https://admin.addonz.my` to Authorized JavaScript origins, and
   `https://addonz.my/__/auth/handler` and `https://admin.addonz.my/__/auth/handler` to Authorized redirect URIs.
   (The app signs in on its own address, so Google must accept these.)
5. **Google Maps key** (if used): add `https://addonz.my/*` and `https://admin.addonz.my/*` to its website restrictions.
6. **Tell the build**: set `CLIENT_URL=https://addonz.my/` and `ADMIN_URL=https://admin.addonz.my/` in
   `.env.local` / `.env.production` and in the GitHub Environment's variables, then deploy. Links between the two
   sites, sign-in and the share/install links then use the new addresses. The `.web.app` addresses keep working.

## How the trust model works

| Step | Who | Enforced in `firestore.rules` |
|---|---|---|
| Sign up as student | Google sign-in (or a verified email) on an allowed domain, `gmail.com` by default, or a tester listed by HEP | yes |
| One account per student | Each matric number can register once and can't be changed afterwards | yes |
| Join the map and PayNet list | Merchant sends details, **logo**, **exact map pin** and DuitNow QR, then HEP verifies | logo and pin required; only HEP can set `verified` |
| Browse Overview | Optional personal GPS and shop discovery | no attendance records, presence writes or point awards |
| Every points change | Written with an immutable ledger entry in the same batch | balance can't go negative or change without a matching entry |
| Lessons | Answer keys are hidden from students; the rules check the answer | yes |
| Vouchers, welfare, donations, avatars | Existing balance, pool and role checks | yes |
| Historical mission claims and corrections | HEP reviews archived claims or records a correction | yes |

## Testing before real students

- `npm test` runs the rules locally using the rules evaluator in `app/shared/js/fake/rules-engine.js`, and checks that each site gets the right files.
- `npm run test:emulator` runs **the same scenarios on Google's official Firestore emulator**. It needs Java 21+ and an internet connection the first time. **Run this before the pilot**, because the local evaluator is a close copy of the rules language, not Google's own engine.
- `npm run dev:demo` in one terminal and `npm run test:e2e` in another drives the real UI. A student browses nearby shops with location permission (and can browse without it), customises an avatar and collects a voucher through HEP and scans a merchant live-deal QR; a new merchant must give a logo and pin; a student is turned away from the dashboard site; every HEP screen is opened on it; and a pass with a fake Google Maps key checks the Google Maps path.
  It refuses to run against a live config.

## Pooled welfare-point requests

Community shows Give points and Request points cards together. Students request a
positive whole-number amount with a reason; their own request history updates live.
Only the applicant and HEP may read `welfareRequests`. HEP reviews pending requests
under Approvals, with a response required when declining.

Approval atomically marks the request reviewed, subtracts the amount from
`stats/welfare`, credits the student's wallet and creates the immutable
`welfare_<request-id>` ledger entry. Rules reject duplicate approvals, approvals
without a transfer and payouts exceeding available pooled points. These are points,
not cash payments; no RM conversion is assumed. Welfare credits do not count as
earned points for levels or KK League. Deploy the updated rules with both sites.

## Central Campus Shops directory

The homepage Shops tile and the footer Campus Shops tab both open `#/explore`,
the single browsing-only directory. Legacy `#/checkin` bookmarks resolve to
`#/explore`, preserving a targeted merchant when present. `#/deals` opens the
directory's deals section, and `#/cafes` opens its public café listings. The
`#/explore/idea` view applies the student-venture filter in the same directory.
Merchant detail back-links, rewards, missions, community and friends all link
back to this directory. Location tracking starts
when the user selects My location, or automatically if browser permission was
already granted. Without permission, campus shops remain browsable. Revoking
permission removes the personal marker and distances. Leaving the page stops the
location watcher. Positions are not written to Firestore or published as presence.

The page creates no visits, point credits, referral qualifications or deal claims.
It combines search, shop categories, student ventures, directions, live deals,
accepted-friends map visibility and public café references. Shops without a map pin
remain listed without invalid directions or distances. The personal GPS marker is
separate from friends' shared places and is not published.
Legacy attendance records remain readable, while their creation paths are denied;
the replacement transaction-points flow is intentionally deferred.

## KK League totals

KK League uses the sum of positive ledger credits for students currently in each
KK (KK1–KK13), including lessons, surveys and HEP awards. Previously earned
legacy credits remain part of the historical cumulative total. Redemptions, donations and other
negative entries do not reduce the score. Welfare support is a transfer rather than
earned points, so it is excluded from KK League and level progress. A college change moves that student's
earned contribution to their new KK; off-campus accounts do not enter KK League.

Deploy the rules and functions together with the sites. `kkLeaguePoints` and
`kkLeagueCollege` reconcile ledger/profile changes transactionally into the
signed-in-readable `stats/league` document; duplicate trigger deliveries do not
double count. Individual contributions remain server-only in `leagueMembers`.
The existing `stats/campus` attendance counters are archival only.

After the first deployment, backfill existing accounts with Application Default
Credentials authorised for the intended project:

```sh
node functions/rebuild-league.js --project YOUR_FIREBASE_PROJECT_ID
```

The script is safe to rerun, includes historical credits and reconciles removed
accounts. Demo mode automatically derives the same totals from saved demo ledgers,
so existing demos need no reset. Live scores update shortly after earning points.

## Limits worth knowing

- **Gmail sign-in proves the email address, not that the person is a UM student.** The matric number limits each student to one account, but HEP should spot-check matric numbers against the student list before paying out rewards. If your UM student email is hosted on Google Workspace, you can remove `gmail.com` under Settings so only UM accounts can join.
- **Installed iPhone app:** Google sign-in can't open a popup from an installed iPhone app, so it uses the server hand-off described above.

- **QR photos are stored in Firestore.** They're compressed to under about 600 KB because Cloud Storage now needs the Blaze plan. This is fine for a few hundred merchants.
- **The server handles iPhone sign-in and KK League aggregation.** These still depend on user activity:
  - Mission claims wait for HEP.
  - Points don't auto-expire.
- **Usage and cost:** Blaze includes a free daily allowance, then charges for what you use above it. Set a budget alert, and watch Usage in the console before going campus-wide. Alerts warn you but don't stop spending.
- **The app doesn't record payments and never moves money.** PayNet's monthly DuitNow QR counts remain the source of truth for transactions; import them on Activity check for reporting.

### Live-deal QR flow and HEP voucher fulfilment

Deploy the updated Firestore rules alongside the client and admin sites. Voucher reads are limited to the student owner and HEP; only HEP can mark a voucher used. Legacy merchant associations remain historical metadata. Standalone merchant offers are retired; verified merchants publish live deals directly for discounts.

`liveDealQRs` records are immutable merchant-created sessions with unpredictable 128-bit IDs. Student listing is denied. Sessions expire after 90 seconds; rules cap them at 120 seconds to allow clock/network variance. `liveDealClaims` uses a fixed deal/student/Malaysia-day ID so repeated and concurrent scans cannot create duplicate daily claims. Rules verify the session, published deal, merchant ownership, current time, capacity and student identity; only the matching verified merchant can mark a claim applied within 15 minutes. Claim records are private to the student, merchant and HEP. Every successful scan writes the claim, an immutable `liveDeal` ledger credit and the student balance increment in one atomic batch. The rate is `config/rules.liveDealPoints` (default 10, controlled by HEP), captured on the claim. Missing, inflated or repeated credits are refused. Applying the discount later awards no additional points. Payment and GPS-presence records are not written.

HEP can review claim and applied-discount counts on Activity check separately from imported PayNet transactions. Demo state is browser-local; cross-device scanning requires the shared Firebase backend.
