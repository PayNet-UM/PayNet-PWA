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

// Emails that get MPP admin access on day one, from MPP_ADMIN_EMAILS. The same list fills bootstrapAdmins()
// in firestore.rules. More MPP reviewers can be added later in the app under Settings.
export const mppBootstrapEmails = ['mpp-admin@demo.invalid'];
