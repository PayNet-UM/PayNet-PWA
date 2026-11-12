// Placeholder values: don't put real values here. scripts/build.mjs and scripts/serve.mjs fill these in
// from .env.local (staging) or .env.production. While apiKey is the placeholder, the app runs in Demo mode,
// keeping data in this browser so you can try every feature without a backend.
export const firebaseConfig = {
  "apiKey": "REPLACE_ME",
  "authDomain": "REPLACE_ME",
  "projectId": "REPLACE_ME",
  "storageBucket": "REPLACE_ME",
  "messagingSenderId": "REPLACE_ME",
  "appId": "REPLACE_ME"
};

// Emails that get Admin team access on day one, from MPP_ADMIN_EMAILS. The same list fills bootstrapAdmins()
// in firestore.rules. More Admin team members can be added later in the app under Settings.
export const mppBootstrapEmails = ['mpp-admin@demo.invalid'];

// Where each website lives. The student/merchant app and the Admin dashboard are separate sites.
// On the dev server both share one address (the dashboard at /admin/). The build fills in each project's
// Firebase Hosting addresses from the hosting targets in .firebaserc.
export const siteUrls = { client: '/', admin: '/admin/' };

// Google Maps (optional), from GOOGLE_MAPS_API_KEY and GOOGLE_MAPS_MAP_ID. A browser key with the "Maps JavaScript API"
// enabled and restricted to your site. Left empty, the app uses the built-in OpenStreetMap map.
export const googleMapsApiKey = '';
// Optional Map ID from Google Cloud > Google Maps Platform > Map management (needed for custom map styles).
export const googleMapsMapId = '';
