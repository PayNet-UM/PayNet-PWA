// Referral leaderboard: the 10 students whose referral codes were used most, shown to everyone signed in.
// Recounted from the referrals collection on every change, so it never drifts. Kept free of Firebase so the
// demo (app/shared/js/fake/fakefb.js) and the tests use the same logic.
export const REFERRAL_TOP = 10;

// How a student appears on the board: their username if they chose one, otherwise their first name.
export function referralLabel(profile = {}) {
  if (profile.username) return '@' + profile.username;
  return String(profile.name || 'Student').trim().split(/\s+/)[0] || 'Student';
}

// referrals: [{ inviterUid }]; profiles: Map uid -> profile. Students who left are dropped.
export function referralBoard(referrals, profiles) {
  const counts = new Map();
  for (const r of referrals) if (r?.inviterUid) counts.set(r.inviterUid, (counts.get(r.inviterUid) || 0) + 1);
  return [...counts]
    .filter(([uid]) => profiles.get(uid)?.role === 'student')
    .map(([uid, count]) => ({ uid, count, label: referralLabel(profiles.get(uid)), college: profiles.get(uid).college || '' }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, REFERRAL_TOP);
}

export async function rebuildReferralBoard(db) {
  const snap = await db.collection('referrals').get();
  const referrals = snap.docs.map((d) => d.data());
  const ids = [...new Set(referrals.map((r) => r.inviterUid).filter(Boolean))];
  const profiles = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const refs = ids.slice(i, i + 100).map((uid) => db.doc(`users/${uid}`));
    if (refs.length) for (const s of await db.getAll(...refs)) if (s.exists) profiles.set(s.id, s.data());
  }
  const top = referralBoard(referrals, profiles);
  await db.doc('stats/referrals').set({ top, total: referrals.length, updatedAt: new Date() });
  return top;
}
