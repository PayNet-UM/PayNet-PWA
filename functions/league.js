// Server-only aggregate. Reconcile from the immutable ledger so retries and
// out-of-order trigger deliveries cannot award the same points twice.
// A student's earned points count for their residential college (KK League, KK1–KK13 only) and for their
// faculty (Faculty League). Students without a KK still count for their faculty.
export function leagueContribution(profile, entries) {
  if (profile?.role !== 'student') return { college: '', faculty: '', earned: 0 };
  const college = /^KK(?:[1-9]|1[0-3])$/.test(profile.college || '') ? profile.college : '';
  const faculty = typeof profile.faculty === 'string' && profile.faculty.trim().length > 1 && profile.faculty.length <= 100 ? profile.faculty.trim() : '';
  if (!college && !faculty) return { college: '', faculty: '', earned: 0 };
  return { college, faculty, earned: entries.reduce((sum, entry) =>
    sum + (entry.type !== 'welfare' && Number.isSafeInteger(entry.delta) && entry.delta > 0 ? entry.delta : 0), 0) };
}

export async function syncLeagueStudent(db, uid) {
  const user = db.doc(`users/${uid}`);
  const member = db.doc(`leagueMembers/${uid}`);
  const league = db.doc('stats/league');
  return db.runTransaction(async (tx) => {
    const [profile, previous, score] = await Promise.all([tx.get(user), tx.get(member), tx.get(league)]);
    const ledger = profile.exists && profile.data().role === 'student'
      ? await tx.get(user.collection('ledger').where('delta', '>', 0)) : { docs: [] };
    const next = leagueContribution(profile.exists ? profile.data() : null, ledger.docs.map((d) => d.data()));
    const old = { college: '', faculty: '', earned: 0, ...(previous.exists ? previous.data() : {}) };
    if (score.exists && previous.exists && next.college === old.college && next.faculty === old.faculty && next.earned === old.earned
      && (!next.faculty || score.data().faculties)) return;
    const colleges = { ...(score.exists ? score.data().colleges : {}) };
    const faculties = { ...(score.exists ? score.data().faculties : {}) };
    if (old.college) colleges[old.college] = Math.max(0, (colleges[old.college] || 0) - old.earned);
    if (next.college) colleges[next.college] = (colleges[next.college] || 0) + next.earned;
    // Members saved before the Faculty League have no faculty; their points simply start counting now.
    if (old.faculty) faculties[old.faculty] = Math.max(0, (faculties[old.faculty] || 0) - old.earned);
    if (next.faculty) faculties[next.faculty] = (faculties[next.faculty] || 0) + next.earned;
    for (const map of [colleges, faculties]) for (const k of Object.keys(map)) if (!map[k]) delete map[k];
    tx.set(member, next);
    tx.set(league, { colleges, faculties, metric: 'totalEarned', updatedAt: new Date() });
  });
}
