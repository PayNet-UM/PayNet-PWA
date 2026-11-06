// End-to-end business scenarios. Each step calls the app's own data layer (app/shared/js/data.js),
// so these tests check that the app's writes satisfy firestore.rules and that abuse is blocked.
// Backends: the local rules evaluator (default) or the official emulator (tests/emulator.mjs).
import * as D from '../app/shared/js/data.js';

export async function runScenarios({ makeCtx, setTime, canSetTime = true, adminEmail = 'mpp@um.edu.my', log = console.log }) {
  let passed = 0, failed = 0;
  const results = [];
  const ok = async (name, fn) => {
    try { await fn(); passed++; results.push(['PASS', name]); log('  ✓ ' + name); }
    catch (e) { failed++; results.push(['FAIL', name, e.message]); log('  ✗ ' + name + '\n      ' + e.message); }
  };
  const denied = async (name, fn) => ok(name, async () => {
    try { await fn(); } catch (e) { if (e.code === 'permission-denied' || /permission/i.test(e.message)) return; throw e; }
    throw new Error('expected permission-denied, but the write succeeded');
  });
  const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'value'}: expected ${b}, got ${a}`); };

  let T = canSetTime ? Date.UTC(2026, 10, 10, 2, 0, 0) : Date.now(); // 10 Nov 2026, 10:00 MYT
  setTime(T);
  const tick = (ms) => { T += ms; setTime(T); };

  const mpp = await makeCtx({ uid: 'mpp1', email: adminEmail });
  const stuA = await makeCtx({ uid: 'stuA', email: 'aina@siswa.um.edu.my' });
  const stuB = await makeCtx({ uid: 'stuB', email: 'badrul@siswa.um.edu.my' });
  const outsider = await makeCtx({ uid: 'out1', email: 'someone@yahoo.com' });
  const gmailer = await makeCtx({ uid: 'gm1', email: 'farah.student@gmail.com' });
  const dupe = await makeCtx({ uid: 'gm2', email: 'copycat@gmail.com' });
  const merch = await makeCtx({ uid: 'mer1', email: 'owner@kopikolej.my' });
  const merch2 = await makeCtx({ uid: 'mer2', email: 'owner@laundry.my' });
  const unverified = await makeCtx({ uid: 'stuC', email: 'chong@siswa.um.edu.my', emailVerified: false });
  let rules = D.DEFAULT_RULES;

  log('Programme setup');
  await ok('students get a clear message before HEP has set up the programme', async () => {
    const early = await makeCtx({ uid: 'early1', email: 'early@gmail.com' });
    try { await D.createProfile(early, { role: 'student', name: 'Early Bird', matric: '23000001', college: 'KK1' }); } catch (e) { if (e.notReady) return; throw e; }
    throw new Error('sign-up was accepted before setup');
  });
  await denied('student cannot initialise the programme', () => D.initProgramme(stuA));
  await denied('an unverified account using the admin email cannot initialise the programme', async () => {
    const claimer = await makeCtx({ uid: 'claimer', email: adminEmail, emailVerified: false });
    await D.initProgramme(claimer);
  });
  await ok('bootstrap HEP admin initialises config, stats and rewards', () => D.initProgramme(mpp));
  await ok('HEP is recognised as HEP', async () => eq(await D.isMppUser(mpp), true));
  await ok('a student is not HEP', async () => eq(await D.isMppUser(stuA), false));

  await ok('an unverified account using the admin email is not HEP', async () => {
    const raw = await makeCtx({ uid: 'mpp0', email: adminEmail, emailVerified: false }); eq(await D.isMppUser(raw), false);
  });
  log('Sign-up');
  await ok('student with a UM email signs up', async () => {
    await D.createProfile(stuA, { role: 'student', name: 'Aina Nadhirah', matric: 'U2300123', college: 'KK3', faculty: 'Faculty of Science' });
    stuA.profile = await D.getProfile(stuA);
  });
  await ok('second student signs up', async () => {
    await D.createProfile(stuB, { role: 'student', name: 'Badrul Hisham', matric: 'U2300456', college: 'KK5', faculty: 'Faculty of Engineering' });
    stuB.profile = await D.getProfile(stuB);
  });
  await ok('student with a Gmail address signs up (gmail.com is allowed by default)', () => D.createProfile(gmailer, { role: 'student', name: 'Farah Aziz', matric: '23007777', college: 'KK1', faculty: 'Faculty of Law' }));
  await ok('the app warns when a matric number is already registered', async () => {
    try { await D.createProfile(dupe, { role: 'student', name: 'Copy Cat', matric: '23007777', college: 'KK1' }); } catch (e) { if (e.matricTaken) return; throw e; }
    throw new Error('duplicate matric was accepted');
  });
  await denied('the rules also refuse a reused matric number (bypassing the app check)', async () => {
    const { sdk, db } = dupe; const b = sdk.writeBatch(db);
    b.set(sdk.doc(db, 'users', 'gm2'), { role: 'student', name: 'Copy Cat', email: 'copycat@gmail.com', matric: '23007777', college: 'KK1', faculty: '', points: 0, lastTx: '', referralCode: '', createdAt: sdk.serverTimestamp() });
    b.set(sdk.doc(db, 'matrics', '23007777'), { uid: 'gm2' });
    await b.commit();
  });
  await denied('student cannot change matric number later', () => D.updateProfile(gmailer, { matric: '99999999' }));
  await denied('non-allowed email domain cannot sign up as a student', () => D.createProfile(outsider, { role: 'student', name: 'Out Sider', matric: '23008888', college: 'KK1' }));
  await denied('unverified email cannot sign up', () => D.createProfile(unverified, { role: 'student', name: 'Chong', matric: '23008889', college: 'KK1' }));
  await ok('merchants sign up', async () => {
    await D.createProfile(merch, { role: 'merchant', name: 'Hafiz (Kopi Kolej)' }); merch.profile = await D.getProfile(merch);
    await D.createProfile(merch2, { role: 'merchant', name: 'Mei (Fresh Laundry)' }); merch2.profile = await D.getProfile(merch2);
  });
  await denied('student cannot read another student', () => D.getProfile(stuA, 'stuB'));
  await denied('student cannot read lesson answer keys', () => D.getConfig(stuA, 'lessonKeys'));
  await denied('student cannot give themselves points', () => D.updateProfile(stuA, { points: 999 }));

  log('Merchant onboarding');
  const qr = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
  const logo = 'data:image/jpeg;base64,' + 'B'.repeat(3000);
  await ok('merchant submits application with logo, exact location and DuitNow QR', () => D.submitApplication(merch, { name: 'Kopi Kolej', type: 'Food & drinks',
    segment: 'Campus permanent merchant', location: 'KK3 cafeteria', zone: 'Residential colleges', accountName: 'Kopi Kolej Enterprise',
    phone: '0123456789', ambassadorId: 'amb-003', qrImage: qr, logo, lat: 3.1268, lng: 101.6553 }));
  await denied('a map pin far from campus is refused', () => D.submitApplication(merch, { name: 'Kopi Kolej', type: 'Food & drinks',
    segment: 'Campus permanent merchant', location: 'KK3 cafeteria', zone: 'Residential colleges', accountName: 'Kopi Kolej Enterprise', lat: 1.3521, lng: 103.8198 }));
  await denied('a new merchant must upload a logo', () => D.submitApplication(merch2, { name: 'Fresh Laundry', type: 'Laundry',
    segment: 'Within 100 m of UM gate', location: 'South Gate', zone: 'Campus edge', accountName: 'Fresh Laundry Sdn Bhd', qrImage: qr, lat: 3.1099, lng: 101.6586 }));
  await denied('a new merchant must pin its exact location', () => D.submitApplication(merch2, { name: 'Fresh Laundry', type: 'Laundry',
    segment: 'Within 100 m of UM gate', location: 'South Gate', zone: 'Campus edge', accountName: 'Fresh Laundry Sdn Bhd', qrImage: qr, logo }));
  await ok('second merchant submits application with logo and pin', () => D.submitApplication(merch2, { name: 'Fresh Laundry', type: 'Laundry',
    segment: 'Within 100 m of UM gate', location: 'South Gate', zone: 'Campus edge', accountName: 'Fresh Laundry Sdn Bhd', qrImage: qr, logo, lat: 3.1099, lng: 101.6586 }));
  await denied('a logo must be an image data URL', () => D.setMerchantLogo(merch2, 'javascript:alert(1)'));
  await denied('a pin needs both coordinates', () => merch2.sdk.updateDoc(merch2.sdk.doc(merch2.db, 'merchants', 'mer2'), { lat: 3.12, lng: merch2.sdk.deleteField ? merch2.sdk.deleteField() : null }));
  await denied('merchant cannot verify itself', () => D.reviewMerchant(merch, 'mer1', 'verified'));
  await denied('students cannot see unverified merchants', () => D.getMerchant(stuA, 'mer1'));
  await denied('student cannot check in at an unverified merchant', () => D.checkIn(stuA, { id: 'mer1', name: 'Kopi Kolej' }, { lat: 3.1268, lng: 101.6553, accuracy: 10 }, rules));
  await ok('HEP reads the private QR and verifies the merchants', async () => {
    const p = await D.getMerchantPrivate(mpp, 'mer1'); eq(p.qrImage.length, qr.length, 'qr length');
    await D.reviewMerchant(mpp, 'mer1', 'verified', 'Names match');
    await D.reviewMerchant(mpp, 'mer2', 'verified', 'Names match');
  });
  await ok('students see verified merchants with their logos', async () => { const l = await D.listVerifiedMerchants(stuA); eq(l.length, 2, 'merchant count'); eq(!!l[0].logo, true, 'logo'); });
  await denied('verified merchant cannot rename itself without review', () => merch.sdk.updateDoc(merch.sdk.doc(merch.db, 'merchants', 'mer1'), { name: 'Other' }));
  await ok('merchant completes staff readiness', () => D.setReadiness(merch));
  await ok('verified merchant updates its logo', () => D.setMerchantLogo(merch, 'data:image/png;base64,' + 'C'.repeat(500)));
  await ok('verified merchant moves its map pin', async () => {
    await D.setMerchantPin(merch, 3.1270, 101.6551);
    const m = await D.getMerchant(stuA, 'mer1'); eq(m.lat, 3.127, 'lat'); eq(m.lng, 101.6551, 'lng');
  });
  await denied('verified merchant cannot pin itself off campus', () => D.setMerchantPin(merch, 3.2, 101.6551));
  await denied('another merchant cannot move someone else’s pin', () => merch2.sdk.updateDoc(merch2.sdk.doc(merch2.db, 'merchants', 'mer1'), { lat: 3.12, lng: 101.65 }));

  log('Avatars');
  await ok('student saves an avatar', () => D.saveAvatar(stuA, { skin: 3, hair: 'tudung', hairColor: 2, outfit: 'baju', outfitColor: 1, hat: 'none', bag: 'tote', accent: 2, glasses: true, freckles: false, face: 'smile', bg: 1 }));
  await denied('an avatar cannot carry extra data', () => D.saveAvatar(stuA, Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['k' + i, i]))));
  stuA.profile = await D.getProfile(stuA);

  log('Check-ins');
  const kopi = { id: 'mer1', name: 'Kopi Kolej', lat: 3.1270, lng: 101.6551 };
  const laundry = { id: 'mer2', name: 'Fresh Laundry', lat: 3.1099, lng: 101.6586 };
  const at = (m) => ({ lat: m.lat + 0.0001, lng: m.lng - 0.0001, accuracy: 12 });
  const pts = async (c) => (await D.getProfile(c)).points;
  await denied('student 1 km away cannot check in', () => D.checkIn(stuA, kopi, { lat: kopi.lat + 0.01, lng: kopi.lng, accuracy: 10 }, rules));
  await ok('student at the shop checks in and earns 10 points', async () => {
    const before = await pts(stuA); await D.checkIn(stuA, kopi, at(kopi), rules); eq(await pts(stuA), before + 10, 'balance');
  });
  await ok('the check-in counts for KK3 on the leaderboard', async () => {
    const s = (await mpp.sdk.getDoc(mpp.sdk.doc(mpp.db, 'stats', 'campus'))).data(); eq(s.checkins, 1); eq(s.colleges.KK3, 1);
  });
  await ok('the merchant sees the visit, with the student’s avatar', async () => {
    const q = merch.sdk.query(merch.sdk.collection(merch.db, 'visits'), merch.sdk.where('merchantId', '==', 'mer1'));
    const v = (await merch.sdk.getDocs(q)).docs.map((d) => d.data()); eq(v.length, 1); eq(v[0].name, 'Aina Nadhirah'); eq(v[0].avatar.hair, 'tudung');
  });
  await denied('another merchant cannot see that visit', () => merch2.sdk.getDocs(merch2.sdk.query(merch2.sdk.collection(merch2.db, 'visits'), merch2.sdk.where('merchantId', '==', 'mer1'))));
  stuA.profile = await D.getProfile(stuA);
  await ok('the first check-in is recorded for referrals', async () => eq(!!stuA.profile.firstVisit, true));
  await denied('cannot check in at the same shop again within 3 hours', async () => { tick(60 * 60 * 1000); stuA.profile = await D.getProfile(stuA); await D.checkIn(stuA, kopi, at(kopi), rules); });
  await denied('cannot award yourself extra check-in points', async () => { stuA.profile = await D.getProfile(stuA); await D.checkIn(stuA, laundry, at(laundry), { ...rules, checkinPoints: 500 }); });
  await denied('cannot record a visit for another student', () => stuB.sdk.setDoc(stuB.sdk.doc(stuB.db, 'visits', 'ci_stuA_mer2_9'), { uid: 'stuA', name: 'Aina Nadhirah', college: 'KK3', merchantId: 'mer2', merchantName: 'x', at: stuB.sdk.serverTimestamp(), day: D.dayKey(T), month: D.monthKey(T), deal: '', points: 10, acc: 5 }));
  await ok('after 3 hours the student can check in at the same shop again', async () => {
    if (!canSetTime) { log('      (skipped: the emulator clock cannot be moved)'); return; }
    tick(3 * 60 * 60 * 1000); stuA.profile = await D.getProfile(stuA);
    const before = await pts(stuA); await D.checkIn(stuA, kopi, at(kopi), rules); eq(await pts(stuA), before + 10);
  });
  await denied('the daily limit of check-ins is enforced', async () => {
    await D.saveConfig(mpp, 'rules', { checkinDailyCap: canSetTime ? 2 : 1 }); stuA.profile = await D.getProfile(stuA);
    try { await D.checkIn(stuA, laundry, at(laundry), { ...rules, checkinDailyCap: 2 }); } finally { await D.saveConfig(mpp, 'rules', { checkinDailyCap: 5 }); }
  });
  await ok('with the normal limit the same check-in works', async () => { const before = await pts(stuA); await D.checkIn(stuA, laundry, at(laundry), rules); eq(await pts(stuA), before + 10); });

  log('Earning');
  stuA.profile = await D.getProfile(stuA);
  await ok('baseline survey earns 50 points once', async () => {
    const res = D.scoreSurvey('student', { k0: 1, k1: 0, k2: 1, k3: 1, d0: 2, d1: 2, d2: 2 });
    eq(res.grade, 'A'); eq(await D.submitSurvey(stuA, res, rules), 50);
    eq(await D.submitSurvey(stuA, res, rules), 0, 'second award');
  });
  await denied('survey bonus cannot be claimed twice by force', async () => {
    const b = stuA.sdk.writeBatch(stuA.db);
    b.set(stuA.sdk.doc(stuA.db, 'users', 'stuA', 'ledger', 'survey2'), { type: 'survey', delta: 50, by: 'stuA', createdAt: stuA.sdk.serverTimestamp() });
    b.update(stuA.sdk.doc(stuA.db, 'users', 'stuA'), { points: stuA.sdk.increment(50), lastTx: 'survey2' });
    await b.commit();
  });
  await ok('wrong lesson answer earns nothing', async () => eq(await D.answerLesson(stuA, 0, 0, rules), 'wrong'));
  await ok('right lesson answer earns 50', async () => eq(await D.answerLesson(stuA, 0, 1, rules), 'correct'));
  await ok('lesson cannot be repeated', async () => eq(await D.answerLesson(stuA, 0, 1, rules), 'done'));

  log('Referrals');
  stuB.profile = await D.getProfile(stuB);
  await ok('student B enters A’s referral code', () => D.applyInviterCode(stuB, stuA.profile.referralCode));
  await denied('B cannot change inviter later', () => D.updateProfile(stuB, { inviterUid: 'mpp1', inviterCode: stuA.profile.referralCode }));
  stuA.profile = await D.getProfile(stuA);
  await denied('A cannot claim before B’s first check-in', () => D.claimInviterBonus(stuA, 'stuB', rules));
  await denied('B cannot claim friend bonus before first check-in', () => D.claimFriendBonus(stuB, rules));
  await ok('B checks in at Fresh Laundry', async () => { stuB.profile = await D.getProfile(stuB); await D.checkIn(stuB, laundry, at(laundry), rules); });
  await ok('B claims the 100-point friend bonus', () => D.claimFriendBonus(stuB, rules));
  await denied('B cannot claim the friend bonus twice', () => D.claimFriendBonus(stuB, rules));
  await ok('A sees B as a qualified referral', async () => { const r = await D.myReferrals(stuA); eq(r.length, 1); eq(r[0].qualified, true); });
  await ok('A claims the 100-point inviter bonus', () => D.claimInviterBonus(stuA, 'stuB', rules));
  stuA.profile = await D.getProfile(stuA);
  await denied('A cannot claim the same friend twice', () => D.claimInviterBonus(stuA, 'stuB', rules));
  await ok('A’s refCount is 1', async () => { eq(stuA.profile.refCount, 1); });

  log('Rewards, vouchers, welfare');
  await ok('HEP adds a merchant-specific reward', () => D.saveReward(mpp, 'kopi-rm2', { title: 'Kopi Kolej RM2 off', merchantId: 'mer1',
    cost: 200, valueCents: 200, stock: 2, issued: 0, lastVoucher: '', validDays: 30, active: true, icon: 'coffee' }));
  let vid;
  await ok('A redeems the reward for 200 points', async () => {
    const before = await pts(stuA); const rw = (await D.listRewards(stuA)).find((r) => r.id === 'kopi-rm2');
    vid = await D.redeemReward(stuA, rw); eq(await pts(stuA), before - 200);
  });
  await denied('another merchant cannot see the voucher', () => D.findVoucher(merch2, 'UMV1:' + vid));
  await ok('Kopi Kolej looks up the voucher by short code and marks it used', async () => {
    const v = await D.findVoucher(merch, vid.slice(0, 8).toUpperCase()); eq(v.id, vid);
    await D.useVoucher(merch, vid);
  });
  await denied('a used voucher cannot be used again', () => D.useVoucher(merch, vid));
  await ok('A donates 10 points to the welfare pool', async () => {
    const before = await pts(stuA); await D.donatePoints(stuA, 10); eq(await pts(stuA), before - 10);
    eq((await stuA.sdk.getDoc(stuA.sdk.doc(stuA.db, 'stats', 'welfare'))).data().points, 10);
  });
  await denied('A cannot donate more points than they have', async () => D.donatePoints(stuA, (await pts(stuA)) + 1));

  log('Offers and quiet-hour bonuses');
  merch.merchantName = 'Kopi Kolej';
  await ok('merchant proposes an offer; HEP approves it', async () => {
    await D.createOffer(merch, { title: 'Double points Tuesdays', type: 'Extra points', endDate: '2026-12-31' });
    const [o] = await D.pendingOffers(mpp); await D.reviewOffer(mpp, o, 'approved');
    eq((await D.getMerchant(stuA, 'mer1')).offer, 'Double points Tuesdays');
  });
  let deal;
  await ok('merchant creates a quiet-hour bonus and sets seats; HEP approves', async () => {
    await D.createDeal(merch, { title: 'Quiet afternoon', startMin: canSetTime ? 14 * 60 : 0, endMin: canSetTime ? 17 * 60 : 1440, threshold: 60, bonus: 40, limit: 1 });
    await D.setOccupancy(merch, 40, 39);
    const [d] = await D.pendingDeals(mpp); await D.reviewDeal(mpp, d.id, 'approved'); deal = { ...d, status: 'approved' };
  });
  if (canSetTime) { T = Date.UTC(2026, 10, 10, 7, 0, 0); setTime(T); }
  const farah = gmailer; farah.profile = await D.getProfile(farah);
  await denied('no quiet-hour bonus while the café is busy', () => D.checkIn(farah, kopi, at(kopi), rules, deal));
  await ok('when the café is quiet, B checks in and gets +10 +40', async () => {
    await D.setOccupancy(merch, 40, 10);
    eq(D.dealStatus(deal, await D.getMerchant(stuB, 'mer1'), 0, T), 'Available');
    stuB.profile = await D.getProfile(stuB); const before = await pts(stuB);
    await D.checkIn(stuB, kopi, at(kopi), rules, deal); eq(await pts(stuB), before + 50);
  });
  await denied('the bonus stops after its daily limit (1)', async () => { farah.profile = await D.getProfile(farah); await D.checkIn(farah, kopi, at(kopi), rules, deal); });
  await ok('the student still gets normal check-in points without the bonus', async () => {
    farah.profile = await D.getProfile(farah); const before = await pts(farah); await D.checkIn(farah, kopi, at(kopi), rules, null); eq(await pts(farah), before + 10);
  });

  log('Missions and HEP tools');
  await ok('student claims a mission; HEP approves; points added', async () => {
    const before = (await D.getProfile(stuA)).points;
    await D.claimMission(stuA, D.MISSIONS[1], D.weekKey(T), 3);
    const [c] = await D.pendingMissionClaims(mpp); await D.reviewMissionClaim(mpp, c, true);
    eq((await D.getProfile(stuA)).points, before + 150);
  });
  await denied('student cannot approve their own mission', async () => {
    await D.claimMission(stuB, D.MISSIONS[0], D.weekKey(T), 5);
    const c = { id: `stuB_${D.weekKey(T)}_five-days`, uid: 'stuB', bonus: 100, title: 'x', week: D.weekKey(T) };
    await D.reviewMissionClaim(stuB, c, true);
  });
  await ok('HEP adjusts points with a note', async () => { await D.adjustPoints(mpp, 'stuB', -5, 'Correction: duplicate'); });
  await denied('HEP adjustment cannot make a balance negative', () => D.adjustPoints(mpp, 'stuB', -100000, 'Too much'));
  await ok('HEP lists users and this month’s check-ins', async () => {
    eq((await D.listUsers(mpp)).length >= 4, true, 'users');
    eq((await D.monthVisits(mpp, D.monthKey(T))).length >= 4, true, 'visits');
  });
  await denied('merchant cannot list every check-in', () => D.monthVisits(merch, D.monthKey(T)));
  await denied('nobody can read sign-in hand-off codes from the app', async () => {
    const { sdk, db } = stuA; await sdk.getDoc(sdk.doc(db, 'handoffs', 'a'.repeat(64)));
  });
  await denied('nobody can create a sign-in hand-off code from the app', async () => {
    const { sdk, db } = mpp; await sdk.setDoc(sdk.doc(db, 'handoffs', 'b'.repeat(64)), { uid: 'mpp1', expiresAt: 0 });
  });
  await ok('HEP can flag a visit after review', async () => { const [v] = await D.monthVisits(mpp, D.monthKey(T)); await D.flagVisit(mpp, v.id, 'ok', 'Reviewed'); });
  await ok('HEP adds another HEP reviewer by email', async () => {
    const a = await D.getConfig(mpp, 'access'); await D.saveConfig(mpp, 'access', { ...a, mppEmails: ['reviewer@um.edu.my'] });
  });
  const reviewer = await makeCtx({ uid: 'mpp2', email: 'reviewer@um.edu.my' });
  await ok('the new reviewer has HEP access', async () => eq(await D.isMppUser(reviewer), true));
  await ok('an added reviewer must verify their email first', async () => {
    const unv = await makeCtx({ uid: 'mpp3', email: 'reviewer@um.edu.my', emailVerified: false }); eq(await D.isMppUser(unv), false);
  });
  await ok('HEP saves Lampiran 2 rows and PayNet counts', async () => {
    await D.saveManualVolume(mpp, null, { name: 'Dobi KK3', location: 'KK3', method: 'Card', provider: 'Kiplepay', month: '2026-11', volume: 120 });
    await D.savePaynetCounts(mpp, '2026-11', [{ merchantId: 'mer1', merchantName: 'Kopi Kolej', count: 40 }]);
  });

  log('Security audit fixes');
  const qrEvil = 'x" onerror="alert(1)';
  const qrOwner = await makeCtx({ uid: 'merQ', email: 'qr@shop.my' });
  await ok('new merchant with a pending application for QR checks', async () => {
    await D.createProfile(qrOwner, { role: 'merchant', name: 'QR Shop' });
    await qrOwner.sdk.setDoc(qrOwner.sdk.doc(qrOwner.db, 'merchants', 'merQ'), { ownerUid: 'merQ', status: 'pending', submittedAt: qrOwner.sdk.serverTimestamp(), name: 'QR Shop', lat: 3.12, lng: 101.65, logo: 'data:image/png;base64,AA==' });
  });
  await ok('a harmless private update works, so the refusals below come from the image check', () => qrOwner.sdk.setDoc(qrOwner.sdk.doc(qrOwner.db, 'merchantPrivate', 'merQ'), { accountName: 'QR Shop' }));
  await denied('script payload as own QR is refused', () => qrOwner.sdk.setDoc(qrOwner.sdk.doc(qrOwner.db, 'merchantPrivate', 'merQ'), { qrImage: qrEvil }));
  await denied('a web link as own QR is refused', () => qrOwner.sdk.setDoc(qrOwner.sdk.doc(qrOwner.db, 'merchantPrivate', 'merQ'), { qrImage: 'https://evil.example/x.png' }));
  await ok('a real QR image is still accepted', () => qrOwner.sdk.setDoc(qrOwner.sdk.doc(qrOwner.db, 'merchantPrivate', 'merQ'), { qrImage: 'data:image/jpeg;base64,' + 'A'.repeat(600000) }));

  const forge = (c, over) => { const { sdk, db } = c; const r = stuRewardRef; const id = 'forgedvoucher' + Math.random().toString(36).slice(2, 8); const b = sdk.writeBatch(db);
    b.set(sdk.doc(db, 'vouchers', id), { studentUid: c.uid, studentName: c.profile.name, rewardId: r.id, title: r.title, merchantId: r.merchantId, cost: r.cost, valueCents: r.valueCents, status: 'issued', code: id.slice(0, 8).toUpperCase(), validDays: r.validDays, createdAt: sdk.serverTimestamp(), ...over });
    b.update(sdk.doc(db, 'rewards', r.id), { issued: sdk.increment(1), lastVoucher: id });
    b.set(sdk.doc(db, 'users', c.uid, 'ledger', id), { type: 'redeem', delta: -r.cost, reward: r.id, by: c.uid, createdAt: sdk.serverTimestamp() });
    b.update(sdk.doc(db, 'users', c.uid), { points: sdk.increment(-r.cost), lastTx: id });
    return b.commit(); };
  await ok('HEP adds a cheap reward for voucher checks', () => D.saveReward(mpp, 'sec-test', { title: 'Sec test', merchantId: '', cost: 1, valueCents: 100, stock: 100, issued: 0, lastVoucher: '', validDays: 14, active: true, icon: 'coffee' }));
  const stuRewardRef = (await D.listRewards(stuA)).find((r) => r.id === 'sec-test');
  stuA.profile = await D.getProfile(stuA);
  await denied('a voucher cannot carry a forged student name', () => forge(stuA, { studentName: 'Someone Else' }));
  await denied('a voucher cannot carry a chosen code', () => forge(stuA, { code: 'CHOSEN01' }));
  await denied('a voucher cannot set its own validity', () => forge(stuA, { validDays: 99999 }));
  await denied('a voucher cannot carry extra fields', () => forge(stuA, { note: 'free' }));
  await ok('an honest voucher still works', async () => { stuA.profile = await D.getProfile(stuA); await D.redeemReward(stuA, (await D.listRewards(stuA)).find((r) => r.id === 'sec-test')); });
  await ok('voucher expiry is calculated from its validity', () => { eq(D.voucherExpired({ createdAt: new Date(T), validDays: 14 }, T + 13 * 86400000), false); eq(D.voucherExpired({ createdAt: new Date(T), validDays: 14 }, T + 14 * 86400000), true); });
  if (canSetTime) {
    let expVid;
    await ok('voucher for the expiry check', async () => { stuA.profile = await D.getProfile(stuA); expVid = await D.redeemReward(stuA, (await D.listRewards(stuA)).find((r) => r.id === 'sec-test')); });
    tick(15 * 86400000);
    await denied('HEP cannot mark an expired voucher used', () => D.useVoucher(mpp, expVid));
    tick(-15 * 86400000);
  }

  stuB.profile = await D.getProfile(stuB);
  await ok('HEP blocks a student', () => D.setBlocked(mpp, 'stuB', true));
  await denied('a blocked student cannot redeem', async () => D.redeemReward(stuB, (await D.listRewards(stuB)).find((r) => r.id === 'sec-test')));
  await denied('a blocked student cannot edit their profile', () => D.updateProfile(stuB, { faculty: 'x' }));
  await denied('a student cannot unblock themselves', () => D.updateProfile(stuB, { disabled: false }));
  await denied('a student cannot block someone else', () => D.setBlocked(stuA, 'stuB', false));
  await ok('HEP unblocks a student', () => D.setBlocked(mpp, 'stuB', false));
  await ok('an unblocked student can edit again', () => D.updateProfile(stuB, { faculty: 'Science' }));

  const squatter = await makeCtx({ uid: 'squat1', email: 'squat@gmail.com' });
  await ok('someone claims a matric number first', () => D.createProfile(squatter, { role: 'student', name: 'Squatter', matric: 'U7777777', college: 'KK1' }));
  await denied('a student cannot release a matric number', () => D.releaseMatric(stuA, 'U7777777'));
  await ok('HEP releases the matric number', () => D.releaseMatric(mpp, 'U7777777'));
  const realOwner = await makeCtx({ uid: 'real1', email: 'real@siswa.um.edu.my' });
  await ok('the real student can then sign up', () => D.createProfile(realOwner, { role: 'student', name: 'Real Owner', matric: 'U7777777', college: 'KK1' }));

  log(`\n${passed} passed, ${failed} failed`);
  return { passed, failed, results };
}
