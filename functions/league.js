// Server-only aggregate. Reconcile from the immutable ledger so retries and
// out-of-order trigger deliveries cannot award the same points twice.
export function leagueContribution(profile, entries) {
  if (profile?.role !== 'student' || !/^KK(?:[1-9]|1[0-3])$/.test(profile.college || '')) return { college: '', earned: 0 };
  return { college: profile.college, earned: entries.reduce((sum, entry) =>
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
    const old = previous.exists ? previous.data() : { college: '', earned: 0 };
    if (score.exists && previous.exists && next.college === old.college && next.earned === old.earned) return;
    const colleges = { ...(score.exists ? score.data().colleges : {}) };
    if (old.college) colleges[old.college] = Math.max(0, (colleges[old.college] || 0) - old.earned);
    if (next.college) colleges[next.college] = (colleges[next.college] || 0) + next.earned;
    tx.set(member, next);
    tx.set(league, { colleges, metric: 'totalEarned', updatedAt: new Date() });
  });
}
