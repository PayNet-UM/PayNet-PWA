# +Onz

+Onz is a campus rewards app for Universiti Malaya, built on Firebase. It has three roles, split across two websites:

| Role | What they do | Website |
|---|---|---|
| **Student** | Checks in at shops using GPS to collect points, then redeems rewards and completes missions and lessons | Student and merchant app |
| **Merchant** | Registers a shop with its logo and map pin, redeems student vouchers, and runs offers and live deals | Student and merchant app |
| **HEP (admin)** | Verifies merchants, approves offers, deals and missions, manages rules and compares activity with PayNet's monthly counts | HEP admin dashboard |

| Website | What it is | Source |
|---|---|---|
| **Student and merchant app** | The installable web app (PWA), built for phones. Works offline after the first visit. | `app/client` + `app/shared` |
| **HEP admin dashboard** | A desktop web dashboard for HEP staff only. Not installable. Anyone who isn't a HEP admin is turned away. | `app/admin` + `app/shared` |

Both websites use the same Firebase project, accounts and database. A HEP admin who signs in to the student and merchant app is offered a link to the dashboard.

The app doesn't record payments and never moves money. Students pay with DuitNow QR in their own bank or e-wallet app.

The code and settings still say `mpp` in places, such as `MPP_ADMIN_EMAILS` and the `mppEmails` database field. These all mean the HEP admin role.

## Links

| | Production | Staging |
|---|---|---|
| **Student and merchant app** | https://umconnectproduction.web.app *(live after the first production release)* | https://umconnect-e455a.web.app |
| **HEP admin dashboard** | https://umconnectproduction-admin.web.app *(live after the first production release)* | https://umconnect-e455a-admin.web.app |
| **Git branch** | `main` | `development` |
| **Firebase console** | https://console.firebase.google.com/project/umconnectproduction | https://console.firebase.google.com/project/umconnect-e455a |
| **Database** | Production Firestore | Staging Firestore |
| **Use it for** | Real users and real data | Testing, with test data only |

- **Repository:** https://github.com/PayNet-UM/PayNet-PWA
- **Deploy runs:** https://github.com/PayNet-UM/PayNet-PWA/actions

## How code gets to each environment

```
feature/xyz ──PR──▶ development ──auto──▶ STAGING  (test here)
                         │
                       PR + approval
                         ▼
                        main ──auto──▶ PRODUCTION
```

Never commit directly to `main` or `development`. The full guide is in [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md).

## Get started

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm ci
npm run dev:demo     # no setup needed
```

| Open | For |
|---|---|
| http://localhost:5173/ | The student and merchant app |
| http://localhost:5173/admin/ | The HEP admin dashboard |

Demo mode keeps all data in your browser, so it's the quickest way to try the app. Both sites share the same demo data, so a merchant you approve in the dashboard shows up in the app. The demo accounts are on each site's sign-in screen (Student and Merchant on the app, HEP admin on the dashboard), and the demo password is `demo1234`.

### Connect to staging
1. Copy `.env.example` to `.env.local`.
2. Fill in the values from the [staging project settings](https://console.firebase.google.com/project/umconnect-e455a/settings/general), under **Your apps**.
3. Run `npm run dev`. The same two addresses as above now use the staging database.

`npm run dev` uses the **real staging database**, so anything you do there is saved and shared with the team.

## Environment files

| File | Environment | Committed? |
|---|---|---|
| `.env.example` | Template only, with no values | Yes |
| `.env.local` | Staging, used by `npm run dev` and staging deploys | **No** |
| `.env.production` | Production, used by production deploys | **No** |

| Variable | Where it comes from |
|---|---|
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` | Firebase console > Project settings > General > Your apps |
| `MPP_ADMIN_EMAILS` | Comma-separated admin addresses. Each one must be able to receive mail, because admins must verify their email. |

Don't put real values in `app/shared/js/firebase-config.js` or `firestore.rules`. The committed versions hold placeholders, and the build fills them in for each environment.

## Commands

| Command | What it does |
|---|---|
| `npm run dev:demo` | Runs locally in Demo mode: the student/merchant app at `http://localhost:5173/`, the HEP dashboard at `http://localhost:5173/admin/` |
| `npm run dev` | Same, against **staging** |
| `npm test` | Runs the rule, business and deploy-guard tests |
| `npm run test:e2e` | Drives the real UI in a browser; start `npm run dev:demo` first. Run `npx playwright install chromium` once beforehand. |
| `npm run test:emulator` | Runs the scenarios on Google's Firestore emulator; needs Java 21 or newer |
| `npm run test:legacy` | Tests the old demo |
| `npm run build` | Builds both sites for staging: `dist/client` and `dist/admin` |
| `npm run deploy:staging` | Manually deploys both sites to staging |
| `npm run deploy:production` | Manually deploys both sites to production, from a clean `main` only |

Deploys normally run through GitHub Actions. See [docs/DEPLOY.md](docs/DEPLOY.md).

## Project layout

```
app/                 The two websites, built by laying shared/ under each site's own folder
  client/            Students and merchants: the installable PWA (main.js, views/student, views/merchant, sw.js)
  admin/             HEP admin dashboard (admin.js, views/mpp.js); no service worker
  shared/            Used by both: data layer, sign-in, UI, i18n, map, js/fake for Demo mode, vendor, css
functions/           Server code for Google sign-in in the iPhone home-screen app
scripts/             Dev server, build and deploy; lib/env.mjs holds the environment logic, lib/sites.mjs the two sites
tests/               Rule scenarios, deploy-guard tests and the browser test
docs/                Deployment guide, Git workflow, project PDF
legacy/              The old browser-only demo, kept for reference and not deployed to Firebase
.github/workflows/   ci.yml tests pull requests; deploy.yml deploys branches
firestore.rules      Database security rules, with a placeholder admin
firebase.json        Hosting (client and admin sites), Firestore and emulator settings
.firebaserc          Maps staging and production to their Firebase projects, and each project's two Hosting sites
```

## Security notes

- **The Firebase web API key isn't a secret.** Every web app sends it to the browser, so moving it to `.env` keeps environments apart but doesn't hide it. Protection comes from `firestore.rules`, plus restricting the key in Google Cloud Console.
- **Service account keys are secret.** They give admin access to a project, so they belong only in GitHub Environment secrets. Never commit or share one.
- **The separate HEP dashboard site is not a security boundary.** It keeps the dashboard code off the student app and gives HEP its own address, but what each account can read and change is still decided by `firestore.rules`.
- **Admin emails are publicly readable.** They appear in the site's JavaScript and at `/firestore.rules`, so use a shared team mailbox rather than a personal address.
- **Keep staging free of real personal data.** It has weaker controls and more people with access.

## Go-live checklist

Do these once for production. [docs/DEPLOY.md](docs/DEPLOY.md) has the details.

- [ ] Firestore region is confirmed; it can't be changed later
- [ ] The HEP dashboard's Hosting site exists (`umconnectproduction-admin`), and its two addresses are under Authentication > Authorized domains and in the OAuth client's redirect URIs
- [ ] HEP staff know the dashboard's address: https://umconnectproduction-admin.web.app
- [ ] Google sign-in is on, and the admin has signed in **before** Email/Password sign-in is turned on
- [ ] Email/Password sign-in is on, for merchants without a Google account
- [ ] API key is restricted in Google Cloud Console, for both projects
- [ ] GitHub Environments, variables and secrets are set up
- [ ] The sign-in server is set up: `functions/.env.umconnectproduction` is committed, and its account has the **Service Account Token Creator** role
- [ ] Students are told what location and personal data the app collects
- [ ] `main` and `development` are protected
- [ ] Scheduled Firestore backups are on (this may need the Blaze plan)
- [ ] Programme defaults are reviewed on first admin login, especially the allocation and allowed student domains (`gmail.com` is allowed by default)

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm run dev` stops with `Invalid staging configuration` | A value in `.env.local` is missing or still a placeholder. Fix it, or use `npm run dev:demo`. |
| `Deploy stopped: ...` | A safety check failed, and the message lists why. Don't work around it: a wrong project ID could send staging config to production. |
| `npm ci` says the lockfile is out of sync | Update npm (`npm install -g npm@latest`), then try again. |
| Emulator says Java version is too old | Install JDK 21 or newer. |
| An admin only sees "verify your email" | Open the link sent to that mailbox, or sign in with Google using that address. |
| The dashboard says "This account isn't a HEP admin" | That email isn't in `MPP_ADMIN_EMAILS` or under Settings in the dashboard. Ask an existing HEP admin to add it. |
| Google sign-in on the dashboard shows `redirect_uri_mismatch` | The dashboard's `/__/auth/handler` addresses aren't in the OAuth client's redirect URIs. See [docs/DEPLOY.md](docs/DEPLOY.md). |
| Sign-in on the dashboard says the address "isn't authorised" | Add the dashboard's `.web.app` and `.firebaseapp.com` addresses under Authentication > Settings > Authorized domains. |
| A deploy fails on the `admin` hosting target | The dashboard's Hosting site doesn't exist in that project yet. Create it (see [docs/DEPLOY.md](docs/DEPLOY.md)) or fix its name in `.firebaserc`. |
| The student and merchant app looks stale after a deploy | The service worker is serving its cache. Reload twice, or clear the site's data. The dashboard has no service worker. |
| You're stuck in Demo mode on a live site | Open the site with `?mode=live` added to the URL. |
| Old GitHub Pages links stop working | The repo moved to the `PayNet-UM` organization, and the old demo moved to `legacy/`. The app itself is on Firebase, so use the links above. |
