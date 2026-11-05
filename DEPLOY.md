# Kampus Kita+ PWA on Firebase

The installable web app for students, merchants and MPP lives in `app/`. It runs in two modes:

- **Demo mode** (no setup): if `app/js/firebase-config.js` still has the placeholder key, data stays in the browser and every read and write is checked against `firestore.rules`. It's useful for pitching and for trying the flows. Open two tabs to act as a student and a merchant at the same time. The demo password is `demo1234`.
- **Live mode**: real accounts and a shared database on Firebase (Auth + Firestore + Hosting). This runs on the free Spark plan, with no credit card and no Cloud Functions.

The original demonstrator (`index.html`, `app.js`, `campus.js`, …) is untouched.

## Try it locally (2 minutes)

```bash
npm install
npm run dev          # http://localhost:5173 opens in Demo mode
npm test             # 90 rule and business scenarios against the local rules evaluator
```

## Go live (about 20 minutes)

1. **Create a Firebase project** at console.firebase.google.com. Skip Google Analytics.
2. **Turn on sign-in.** Go to Build > Authentication > Get started > Sign-in method:
   - Enable **Google**. Pick a project support email, then save.
   - Enable **Email/Password** as well. It's a fallback for merchants without a Google account.
   - Under Settings > Authorized domains, `localhost` and your `*.web.app` / `*.firebaseapp.com` domains are already listed. Add any custom domain you use.
3. **Create the Firestore database.** Go to Build > Firestore Database > Create database, choose **asia-southeast1 (Singapore)**, and start in production mode.
4. **Register a web app** under Project settings > General > Your apps > `</>`, and copy the `firebaseConfig`.
5. **Run setup and deploy:**
   ```bash
   npm run setup        # paste the config and your MPP admin email
   npx firebase login
   npm run deploy       # runs the tests, then deploys the rules and the site
   ```
   You'll get a URL like `https://<project>.web.app`.
6. **Sign in as MPP** with the admin email you entered. If it's a Google account, use **Continue with Google**; otherwise create an email account and verify it via the link Firebase emails you. The dashboard opens on **Set up the programme**. Click it once to create the points rules, rewards and counters.
7. Under **Settings**, add other MPP reviewers and any pilot testers who don't have a `@siswa.um.edu.my` email.

Students install it from the browser: Chrome shows **Install app**, and on iPhone use Safari > Share > **Add to Home Screen**. The camera scanner needs HTTPS, which Firebase Hosting provides.

## Google Maps (optional, about 10 minutes)

Without a key the app shows a free OpenStreetMap map. To use Google Maps:

1. Open console.cloud.google.com and pick the **same project** as Firebase (umconnect-e455a). Google Maps needs a **billing account** on the project; Essentials map loads include a free monthly allowance, so a campus pilot normally costs nothing. Set a budget alert anyway (Billing > Budgets & alerts).
2. APIs & Services > Library: enable **Maps JavaScript API**.
3. APIs & Services > Credentials > Create credentials > API key. Then edit the key:
   - Application restrictions: **Websites**. Add `https://umconnect-e455a.web.app/*`, `https://umconnect-e455a.firebaseapp.com/*` and `http://localhost:5173/*`.
   - API restrictions: **Restrict key** to Maps JavaScript API.
4. Paste the key into `app/js/firebase-config.js` as `googleMapsApiKey`, then `npm run deploy`.
5. Optional: Google Maps Platform > Map management > Create Map ID (JavaScript, Vector) and paste it as `googleMapsMapId`. Without one the app uses Google's demo map ID, which works but can't be styled.

If Google rejects the key on some address, the app switches to the OpenStreetMap map automatically and says so.

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
- `npm run test:emulator` runs **the same scenarios on Google's official Firestore emulator**. It needs Java 11+ and an internet connection the first time. **Run this before the pilot**, because the local evaluator is a close copy of the rules language, not Google's own engine.
- `npm run dev` in one terminal and `npm run test:e2e` in another drives the real UI. A student checks in at a shop, customises an avatar and redeems a voucher at the merchant; a new merchant must give a logo and pin; every MPP screen is opened; and a pass with a fake Google Maps key checks the Google Maps path.

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
