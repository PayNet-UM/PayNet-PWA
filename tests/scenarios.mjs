// End-to-end business scenarios. Each step calls the app's own data layer (app/shared/js/data.js),
// so these tests check that the app's writes satisfy firestore.rules and that abuse is blocked.
// Backends: the local rules evaluator (default) or the official emulator (tests/emulator.mjs).
import * as D from '../app/shared/js/data.js';

export async function runScenarios({ makeCtx, seedHistory, setTime, canSetTime = true, adminEmail = 'mpp@um.edu.my', log = console.log }) {
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
  const allFeatures = (on) => D.saveConfig(mpp, 'rules', { features: Object.fromEntries(D.FEATURES.map(([k]) => [k, on])) });
  await ok('features start off', async () => { const r = await D.getRules(mpp); for (const [k] of D.FEATURES) eq(D.featureOn(r, k), false, k); });
  await denied('a student cannot turn features on', () => D.saveConfig(stuA, 'rules', { features: { overview: true } }));
  await ok('HEP turns all features on for the scenarios below', async () => { await allFeatures(true); rules = await D.getRules(mpp); });
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

  log('Retired attendance and historical records');
  const kopi = { id: 'mer1', name: 'Kopi Kolej', lat: 3.1270, lng: 101.6551 };
  const laundry = { id: 'mer2', name: 'Fresh Laundry', lat: 3.1099, lng: 101.6586 };
  const at = (m) => ({ lat: m.lat, lng: m.lng, accuracy: 12 });
  const pts = async (c) => (await D.getProfile(c)).points;
  await denied('attendance API never awards points, even at the merchant', () => D.checkIn(stuA, kopi, at(kopi), rules));
  await denied('direct attendance documents are also blocked', () => stuA.sdk.setDoc(stuA.sdk.doc(stuA.db, 'checkins', 'stuA_mer1'), { uid: 'stuA', merchantId: 'mer1', n: 1, at: stuA.sdk.serverTimestamp(), lat: kopi.lat, lng: kopi.lng, acc: 12 }));
  await denied('direct visit records cannot recreate attendance', () => stuA.sdk.setDoc(stuA.sdk.doc(stuA.db, 'visits', 'forged'), { uid: 'stuA', merchantId: 'mer1', at: stuA.sdk.serverTimestamp() }));
  await denied('legacy point credits cannot bypass the retired API', async () => {
    const b = stuA.sdk.writeBatch(stuA.db);
    b.set(stuA.sdk.doc(stuA.db, 'users', 'stuA', 'ledger', 'fake_attendance'), { type: 'checkin', delta: 10, by: 'stuA', createdAt: stuA.sdk.serverTimestamp() });
    b.update(stuA.sdk.doc(stuA.db, 'users', 'stuA'), { points: stuA.sdk.increment(10), lastTx: 'fake_attendance' });
    await b.commit();
  });
  await ok('historical records remain readable without permitting new attendance', async () => {
    const entries = [];
    for (let i = 0; i < 4; i++) {
      const owner = i === 3 ? stuB : stuA, id = 'archive_' + i;
      entries.push(['visits/' + id, { uid: owner.uid, name: owner.uid === 'stuA' ? 'Aina Nadhirah' : 'Badrul Hisham', college: owner.uid === 'stuA' ? 'KK3' : 'KK5', merchantId: i === 3 ? 'mer2' : 'mer1', merchantName: i === 3 ? 'Fresh Laundry' : 'Kopi Kolej', day: D.dayKey(T), month: D.monthKey(T), points: 10, at: stuA.sdk.Timestamp.fromMillis(T - 60000), deal: '', acc: 12 }]);
      entries.push([`users/${owner.uid}/ledger/${id}`, { type: 'checkin', delta: 10, merchantName: 'Kopi Kolej', createdAt: stuA.sdk.Timestamp.fromMillis(T - 60000) }]);
    }
    entries.push(['users/stuA', { points: 30, lastTx: 'archive_2' }], ['users/stuB', { points: 10, lastTx: 'archive_3' }]);
    await seedHistory(entries);
    eq((await D.monthVisits(mpp, D.monthKey(T))).length, 4);
    await D.adjustPoints(mpp, 'stuA', 500, 'Test programme points');
    await D.adjustPoints(mpp, 'stuB', 500, 'Test programme points');
  });
  await denied('other merchants cannot read historical visits', () => merch2.sdk.getDoc(merch2.sdk.doc(merch2.db, 'visits', 'archive_0')));

  log('Earning');
  stuA.profile = await D.getProfile(stuA);
  await denied('survey bonus cannot be claimed without a survey on file', async () => {
    const b = stuB.sdk.writeBatch(stuB.db);
    b.set(stuB.sdk.doc(stuB.db, 'users', 'stuB', 'ledger', 'survey'), { type: 'survey', delta: 50, by: 'stuB', createdAt: stuB.sdk.serverTimestamp() });
    b.update(stuB.sdk.doc(stuB.db, 'users', 'stuB'), { points: stuB.sdk.increment(50), lastTx: 'survey' });
    await b.commit();
  });
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
  await ok('a referral immediately creates a pending friend request without usernames', async () => {
    const id = ['stuA', 'stuB'].sort().join('_');
    const friend = await stuA.sdk.getDoc(stuA.sdk.doc(stuA.db, 'friendships', id));
    eq(friend.data().from, 'stuB'); eq(friend.data().to, 'stuA');
    eq(friend.data().status, 'pending'); eq(friend.data().referralCode, stuA.profile.referralCode);
  });
  await denied('B cannot change inviter later', () => D.updateProfile(stuB, { inviterUid: 'mpp1', inviterCode: stuA.profile.referralCode }));
  stuA.profile = await D.getProfile(stuA);
  await denied('inviter rewards stay paused instead of depending on attendance', () => D.claimInviterBonus(stuA, 'stuB', rules));
  await denied('friend rewards stay paused instead of depending on attendance', () => D.claimFriendBonus(stuB, rules));
  await ok('referral still connects friends without qualifying a point reward', async () => { const rows = await D.myReferrals(stuA); eq(rows.length, 1); eq(rows[0].qualified, false); });
  await denied('a student cannot mark their own referral reward qualified', () => stuB.sdk.updateDoc(stuB.sdk.doc(stuB.db, 'referrals', 'stuB'), { qualified: true }));

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

  log('Welfare support requests');
  let welfareRequest, rejectedRequest;
  await ok('student requests pooled points without moving any points', async () => {
    const before = await pts(stuA);
    welfareRequest = await D.submitWelfareRequest(stuA, 6, 'Help with meals and study essentials.');
    eq(await pts(stuA), before);
    eq((await D.pendingWelfareRequests(mpp)).some((r) => r.id === welfareRequest), true);
  });
  await denied('other students cannot read a private welfare reason', () => stuB.sdk.getDoc(stuB.sdk.doc(stuB.db, 'welfareRequests', welfareRequest)));
  await ok('another student can submit their own private request', async () => {
    rejectedRequest = await D.submitWelfareRequest(stuB, 5, 'Help with printing study materials.');
  });
  await ok('the app refuses a second welfare request on the same day', async () => {
    let message = '';
    try { await D.submitWelfareRequest(stuB, 5, 'A second request on the same day.'); } catch (e) { message = e.message; }
    eq(message.startsWith('You’ve already sent a request today'), true, message);
  });
  await denied('a second welfare request cannot overwrite the first', () => stuB.sdk.setDoc(stuB.sdk.doc(stuB.db, 'welfareRequests', rejectedRequest), { studentUid: 'stuB', name: stuB.profile.name, college: stuB.profile.college, amount: 7, reason: 'Trying to replace my request.', status: 'pending', createdAt: stuB.sdk.serverTimestamp() }));
  const limitStudent = await makeCtx({ uid: 'stuLimit', email: 'limit@siswa.um.edu.my' });
  await D.createProfile(limitStudent, { role: 'student', name: 'Limit Student', matric: 'LIMIT0001', college: 'KK1', faculty: 'FS' });
  const welfareDoc = (amount) => ({ studentUid: 'stuLimit', name: 'Limit Student', college: 'KK1', amount, reason: 'Testing the request limits.', status: 'pending', createdAt: limitStudent.sdk.serverTimestamp() });
  const limitToday = limitStudent.sdk.doc(limitStudent.db, 'welfareRequests', 'stuLimit_' + D.dayKey(D.clock(limitStudent)));
  await denied('a welfare request cannot ask for more than 1,000 points', () => limitStudent.sdk.setDoc(limitToday, welfareDoc(1001)));
  await denied('a welfare request cannot pick its own ID to get round the daily limit', () => limitStudent.sdk.setDoc(limitStudent.sdk.doc(limitStudent.db, 'welfareRequests', 'stuLimit_extra'), welfareDoc(5)));
  await ok('a welfare request for exactly 1,000 points is allowed', () => limitStudent.sdk.setDoc(limitToday, welfareDoc(1000)));
  await denied('a name cannot be longer than 100 characters', () => stuA.sdk.updateDoc(stuA.sdk.doc(stuA.db, 'users', 'stuA'), { name: 'A'.repeat(101) }));
  const matricSquatter = await makeCtx({ uid: 'squatter', email: 'squatter@shop.my' });
  await denied('a merchant account cannot claim a student matric number', async () => {
    const b = matricSquatter.sdk.writeBatch(matricSquatter.db);
    b.set(matricSquatter.sdk.doc(matricSquatter.db, 'users', 'squatter'), { role: 'merchant', name: 'Squatter', email: 'squatter@shop.my', matric: 'SQUAT0001', college: '', faculty: '', points: 0, lastTx: '', referralCode: '', createdAt: matricSquatter.sdk.serverTimestamp() });
    b.set(matricSquatter.sdk.doc(matricSquatter.db, 'matrics', 'SQUAT0001'), { uid: 'squatter' });
    await b.commit();
  });
  await denied('student cannot list all welfare applications', () => stuA.sdk.getDocs(stuA.sdk.collection(stuA.db, 'welfareRequests')));
  await denied('merchant cannot apply for student welfare points', () => D.submitWelfareRequest(merch, 5, 'Not a student application.'));
  await denied('student cannot approve their own welfare request', () => D.reviewWelfareRequest(stuA, welfareRequest, true));
  await denied('student cannot edit the requested amount after submission', () => stuA.sdk.updateDoc(stuA.sdk.doc(stuA.db, 'welfareRequests', welfareRequest), { amount: 100 }));
  await denied('HEP cannot mark a request approved without transferring its points', () => mpp.sdk.updateDoc(mpp.sdk.doc(mpp.db, 'welfareRequests', welfareRequest), {
    status: 'approved', response: '', reviewedBy: mpp.email, reviewedAt: mpp.sdk.serverTimestamp(),
  }));
  await ok('HEP approval debits the pool and credits the student in one ledger-backed batch', async () => {
    const before = await pts(stuA);
    await D.reviewWelfareRequest(mpp, welfareRequest, true, 'Approved for essentials.');
    eq(await pts(stuA), before + 6);
    eq((await D.getWelfareFund(mpp)).points, 4);
    eq((await stuA.sdk.getDoc(stuA.sdk.doc(stuA.db, 'users', stuA.uid, 'ledger', 'welfare_' + welfareRequest))).data().type, 'welfare');
    eq((await stuA.sdk.getDoc(stuA.sdk.doc(stuA.db, 'welfareRequests', welfareRequest))).data().status, 'approved');
  });
  await ok('a reviewed welfare request cannot be paid twice', async () => {
    const before = await pts(stuA);
    try { await D.reviewWelfareRequest(mpp, welfareRequest, true); throw new Error('duplicate approval succeeded'); }
    catch (e) { if (!e.message.includes('already been reviewed')) throw e; }
    eq(await pts(stuA), before); eq((await D.getWelfareFund(mpp)).points, 4);
  });
  await ok('insufficient welfare funds leave the request pending and the pool unchanged', async () => {
    try { await D.reviewWelfareRequest(mpp, rejectedRequest, true); throw new Error('overdraw succeeded'); }
    catch (e) { if (!e.message.includes('does not have enough points')) throw e; }
    eq((await D.getWelfareFund(mpp)).points, 4);
    eq((await stuB.sdk.getDoc(stuB.sdk.doc(stuB.db, 'welfareRequests', rejectedRequest))).data().status, 'pending');
  });
  await denied('rules also prevent an overdraw when HEP bypasses the app check', async () => {
    const id = 'welfare_' + rejectedRequest, b = mpp.sdk.writeBatch(mpp.db);
    b.update(mpp.sdk.doc(mpp.db, 'welfareRequests', rejectedRequest), { status: 'approved', response: '', reviewedBy: mpp.email, reviewedAt: mpp.sdk.serverTimestamp() });
    b.set(mpp.sdk.doc(mpp.db, 'users', stuB.uid, 'ledger', id), { type: 'welfare', delta: 5, requestId: rejectedRequest, by: mpp.uid, createdAt: mpp.sdk.serverTimestamp() });
    b.update(mpp.sdk.doc(mpp.db, 'users', stuB.uid), { points: mpp.sdk.increment(5), lastTx: id });
    b.update(mpp.sdk.doc(mpp.db, 'stats', 'welfare'), { points: mpp.sdk.increment(-5), lastRequest: rejectedRequest });
    await b.commit();
  });
  await ok('declining a request records a response and transfers no points', async () => {
    const before = await pts(stuB); await D.reviewWelfareRequest(mpp, rejectedRequest, false, 'Please contact HEP to discuss other support.');
    eq(await pts(stuB), before); eq((await D.getWelfareFund(mpp)).points, 4);
    eq((await stuB.sdk.getDoc(stuB.sdk.doc(stuB.db, 'welfareRequests', rejectedRequest))).data().status, 'rejected');
  });

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
  await denied('live deals cannot award location-based bonus points', () => D.checkIn(farah, kopi, at(kopi), rules, deal));
  await ok('live deal availability depends on time and occupancy, not attendance claims', async () => {
    await D.setOccupancy(merch, 40, 10);
    eq(D.dealStatus(deal, await D.getMerchant(stuB, 'mer1'), 999, T), 'Available');
  });
  await denied('attendance mission claims are paused at the API', () => D.claimMission(stuA, {}, D.weekKey(T), 5));
  await denied('direct mission claims cannot restart attendance missions', () => stuA.sdk.setDoc(stuA.sdk.doc(stuA.db, 'missionClaims', 'new_claim'), { uid: stuA.uid, status: 'pending', week: D.weekKey(T), mission: 'five-days', createdAt: stuA.sdk.serverTimestamp() }));
  await ok('HEP can still settle an archived mission claim', async () => {
    const claim = { id: 'archive_mission', uid: 'stuA', name: 'Aina', title: 'Archived mission', week: D.weekKey(T), bonus: 150, status: 'pending', progress: 3 };
    await seedHistory([['missionClaims/' + claim.id, claim]]);
    const before = await pts(stuA); await D.reviewMissionClaim(mpp, claim, true); eq(await pts(stuA), before + 150);
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
  log('Here now (campus map presence)');
  const hn1 = await makeCtx({ uid: 'hn1', email: 'hana.here@gmail.com' });
  const hn2 = await makeCtx({ uid: 'hn2', email: 'imran.here@gmail.com' });
  const hn3 = await makeCtx({ uid: 'hn3', email: 'jia.here@gmail.com' });
  await D.createProfile(hn1, { role: 'student', name: 'Hana Lee', matric: '23009001', college: 'KK3', faculty: '' });
  await D.createProfile(hn2, { role: 'student', name: 'Imran Hakim', matric: '23009002', college: 'KK5', faculty: '' });
  await D.createProfile(hn3, { role: 'student', name: 'Jia Wen', matric: '23009003', college: 'KK1', faculty: '' });
  const presence = (c, uid) => c.sdk.getDoc(c.sdk.doc(c.db, 'presence', uid)).then((s) => s.exists() ? s.data() : null);
  const pair = ['hn1', 'hn2'].sort().join('_');
  await ok('students claim unique usernames', async () => {
    await D.claimUsername(hn1, 'Hana_UM'); hn1.profile = await D.getProfile(hn1);
    await D.claimUsername(hn2, 'imran_um'); hn2.profile = await D.getProfile(hn2);
    await D.claimUsername(hn3, 'jia_um'); hn3.profile = await D.getProfile(hn3);
    eq((await D.findUsername(hn2, '@HANA_UM')).uid, 'hn1');
  });
  await denied('a username cannot be claimed twice', () => D.claimUsername(hn3, 'hana_um'));
  await denied('a student cannot change a claimed username', () => D.claimUsername(hn1, 'new_hana'));
  await ok('student sends a friend request by username', async () => {
    await D.requestFriend(hn1, await D.findUsername(hn1, 'imran_um'));
  });
  await ok('a referral preserves an existing pending request', async () => {
    await D.applyInviterCode(hn1, hn2.profile.referralCode);
    const friend = await hn1.sdk.getDoc(hn1.sdk.doc(hn1.db, 'friendships', pair));
    eq(friend.data().status, 'pending'); eq('referralCode' in friend.data(), false);
  });
  await ok('the existing-user directory contains usernames only', async () => {
    const directory = await D.listUsernames(hn1);
    eq(directory.some((p) => p.username === 'imran_um'), true);
    eq(directory.every((p) => Object.keys(p).sort().join(',') === 'uid,username'), true);
  });
  await denied('the sender cannot accept their own request', () => D.acceptFriend(hn1, pair));
  await denied('a third student cannot read friend requests', () => hn3.sdk.getDoc(hn3.sdk.doc(hn3.db, 'friendships', pair)));
  await denied('enabling attendance-based place sharing is paused', () => D.setMapVisibility(hn2, true));
  await denied('direct presence creation is blocked', () => hn2.sdk.setDoc(hn2.sdk.doc(hn2.db, 'presence', 'hn2'), { uid: 'hn2', zone: 'mer1' }));
  await denied('direct attendance-dependent waves are blocked', () => hn1.sdk.setDoc(hn1.sdk.doc(hn1.db, 'waves', 'hn2', 'inbox', 'hn1'), { fromFirst: 'Hana', zoneName: 'Kopi Kolej', at: hn1.sdk.serverTimestamp() }));
  await denied('direct deal-claim counters cannot restart attendance bonuses', () => hn1.sdk.setDoc(hn1.sdk.doc(hn1.db, 'dealDays', 'retired_deal'), { count: 1, last: 'fake' }));
  await ok('the recipient can still accept a friendship', () => D.acceptFriend(hn2, pair));
  await ok('historical shared places keep accepted-friend privacy', async () => {
    await seedHistory([['users/hn2', { showOnMap: true, mapAudience: 'friends' }], ['presence/hn2', { uid: 'hn2', first: 'Imran', college: 'KK5', audience: 'friends', zone: 'mer1', zoneName: 'Kopi Kolej', at: hn2.sdk.Timestamp.fromMillis(T - 60000), expiresAt: hn2.sdk.Timestamp.fromMillis(T + 3600000) }]]);
    eq((await presence(hn1, 'hn2')).first, 'Imran');
  });
  await denied('unrelated students cannot read archived presence', () => presence(hn3, 'hn2'));
  await denied('merchants cannot read archived student presence', () => presence(merch, 'hn2'));
  await denied('attendance waves cannot be created', () => D.sendWave(hn1, 'hn2', { first: 'Hana' }, 'Kopi Kolej'));
  await ok('removing a friend still revokes access to historical presence', () => D.removeFriend(hn1, pair));
  await denied('removed friends cannot read archived presence', () => presence(hn1, 'hn2'));
  await ok('switching sharing off still removes historical presence', async () => { await D.setMapVisibility(hn2, false); eq(await presence(hn2, 'hn2'), null); });

  log('Feature switches');
  await D.saveReward(mpp, 'sw-shop', { title: 'Switch shop', merchantId: 'mer1', cost: 1, valueCents: 100, stock: 50, issued: 0, lastVoucher: '', validDays: 30, active: true, icon: 'coffee' });
  await D.saveReward(mpp, 'sw-hep', { title: 'Switch HEP', merchantId: '', cost: 1, valueCents: 100, stock: 50, issued: 0, lastVoucher: '', validDays: 30, active: true, icon: 'coffee' });
  await D.adjustPoints(mpp, 'stuA', 10, 'switch tests');
  const rw = async (id) => (await D.listRewards(stuA)).find((x) => x.id === id);
  stuA.profile = await D.getProfile(stuA);
  const shopVoucher = await D.redeemReward(stuA, await rw('sw-shop'));
  const swMerchant = await makeCtx({ uid: 'swMer', email: 'sw@shop.my' });
  await D.createProfile(swMerchant, { role: 'merchant', name: 'Switch Shop' });
  await ok('HEP turns every feature off', async () => { await allFeatures(false); const r = await D.getRules(stuA); for (const [k] of D.FEATURES) eq(D.featureOn(r, k), false, k); });
  const newMerchant = await makeCtx({ uid: 'swNew', email: 'new@shop.my' });
  await denied('merchantSignup off: no new merchant accounts', () => D.createProfile(newMerchant, { role: 'merchant', name: 'New Shop' }));
  await denied('merchantSignup off: an existing merchant account cannot apply', () => swMerchant.sdk.setDoc(swMerchant.sdk.doc(swMerchant.db, 'merchants', 'swMer'), { ownerUid: 'swMer', status: 'pending', submittedAt: swMerchant.sdk.serverTimestamp(), name: 'Switch Shop', lat: 3.12, lng: 101.65, logo: 'data:image/png;base64,AA==' }));
  await denied('merchantSignup off: an existing merchant cannot upload a QR', () => swMerchant.sdk.setDoc(swMerchant.sdk.doc(swMerchant.db, 'merchantPrivate', 'swMer'), { accountName: 'Switch' }));
  await denied('merchantTools off: no new offers', () => merch.sdk.setDoc(merch.sdk.doc(merch.db, 'offers', 'sw1'), { merchantId: 'mer1', status: 'pending', createdAt: merch.sdk.serverTimestamp(), title: 'Offer' }));
  const dealDoc = { merchantId: 'mer1', status: 'pending', enabled: true, bonus: 0, limit: 1, minSpendCents: 0, startMin: 0, endMin: 100, threshold: 50 };
  await denied('merchantTools off: no new deals', () => merch.sdk.setDoc(merch.sdk.doc(merch.db, 'deals', 'sw1'), dealDoc));
  await denied('merchantTools off: a merchant cannot mark a voucher used', () => D.useVoucher(merch, shopVoucher));
  await denied('merchantTools off: students cannot buy a shop voucher nobody could redeem', async () => { stuA.profile = await D.getProfile(stuA); await D.redeemReward(stuA, await rw('sw-shop')); });
  await ok('switches off: HEP can still mark a shop voucher used', () => D.useVoucher(mpp, shopVoucher));
  await ok('switches off: HEP counter vouchers still work', async () => { stuA.profile = await D.getProfile(stuA); await D.redeemReward(stuA, await rw('sw-hep')); });
  await ok('switches off: students can still sign up', () => makeCtx({ uid: 'swStu2', email: 'swstu2@gmail.com' }).then((c) => D.createProfile(c, { role: 'student', name: 'Second Student', matric: 'SW000002', college: 'KK1' })));
  await ok('HEP turns only merchantTools on', () => D.saveConfig(mpp, 'rules', { features: { merchantTools: true } }));
  await ok('other switches stay off when one is saved', async () => { const r = await D.getRules(mpp); eq(D.featureOn(r, 'merchantTools'), true); eq(D.featureOn(r, 'merchantSignup'), false); eq(D.featureOn(r, 'dealsAndPay'), false); });
  await denied('merchantTools on, dealsAndPay off: still no new deals', () => merch.sdk.setDoc(merch.sdk.doc(merch.db, 'deals', 'sw2'), dealDoc));
  await ok('merchantTools on: offers are allowed again', () => merch.sdk.setDoc(merch.sdk.doc(merch.db, 'offers', 'sw3'), { merchantId: 'mer1', status: 'pending', createdAt: merch.sdk.serverTimestamp(), title: 'Offer' }));
  await ok('dealsAndPay on too: deals are allowed again', async () => { await D.saveConfig(mpp, 'rules', { features: { dealsAndPay: true } }); await merch.sdk.setDoc(merch.sdk.doc(merch.db, 'deals', 'sw2'), dealDoc); });
  await ok('merchantSignup on: merchant accounts are allowed again', async () => { await D.saveConfig(mpp, 'rules', { features: { merchantSignup: true } }); await D.createProfile(newMerchant, { role: 'merchant', name: 'New Shop' }); });

  log('Terms of Use and Privacy Notice');
  const tn = await makeCtx({ uid: 'terms1', email: 'terms.new@gmail.com' });
  await denied('a profile can’t be created without accepting the terms', () => tn.sdk.setDoc(tn.sdk.doc(tn.db, 'users', 'terms1'), {
    role: 'student', name: 'No Terms', email: 'terms.new@gmail.com', matric: 'T1234567', college: 'KK1', faculty: '', points: 0, lastTx: '', referralCode: '', createdAt: tn.sdk.serverTimestamp() }));
  await ok('signing up records which terms were accepted, and when', async () => {
    await D.createProfile(tn, { role: 'student', name: 'Terms New', matric: 'T7654321', college: 'KK1', faculty: '' });
    const p = await D.getProfile(tn); eq(p.termsVersion, D.TERMS_VERSION); eq(!!p.termsAcceptedAt, true); eq(D.needsTerms(p), false);
  });
  await ok('an existing user without accepted terms is asked once', () => { eq(D.needsTerms({ role: 'student' }), true); eq(D.needsTerms({ termsVersion: '2000-01-01' }), true); });
  await ok('accepting the terms later works', () => D.acceptTerms(tn));
  await denied('the acceptance time can’t be back-dated', () => tn.sdk.updateDoc(tn.sdk.doc(tn.db, 'users', 'terms1'), { termsVersion: D.TERMS_VERSION, termsAcceptedAt: new Date(T - 86400000 * 30) }));
  await denied('the terms version must be a real version date', () => tn.sdk.updateDoc(tn.sdk.doc(tn.db, 'users', 'terms1'), { termsVersion: 'anything', termsAcceptedAt: tn.sdk.serverTimestamp() }));
  await denied('nobody can record acceptance for someone else', () => tn.sdk.updateDoc(tn.sdk.doc(tn.db, 'users', 'stuA'), { termsVersion: D.TERMS_VERSION, termsAcceptedAt: tn.sdk.serverTimestamp() }));

  log(`\n${passed} passed, ${failed} failed`);
  return { passed, failed, results };
}
