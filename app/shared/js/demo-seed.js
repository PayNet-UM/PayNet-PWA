// Demo mode only: builds a small, realistic campus (through the same rules as live) on first open.
import * as D from './data.js';
import { sheet, closeSheet, toast, esc, icon, $, $$ } from './ui.js';
import { mppBootstrapEmails, siteUrls } from './firebase-config.js';
const MPP_EMAIL = mppBootstrapEmails[0];

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_ACCOUNTS = [
  ['aina@siswa.um.edu.my', 'Student: Aina (KK3)'], ['badrul@siswa.um.edu.my', 'Student: Badrul (KK5)'],
  ['kopikolej@demo.my', 'Merchant: Kopi Kolej'], ['laundry@demo.my', 'Merchant: Fresh Laundry'], ['hana@demo.my', 'Merchant: Roti by Hana (awaiting HEP)'],
  [MPP_EMAIL, 'HEP admin'],
];
const MERCHANTS = [
  ['kopikolej@demo.my', 'Hafiz Rahman', 'Kopi Kolej', 'Kopi Kolej Enterprise', 'Food & drinks', 'Campus permanent merchant', 'KK3 cafeteria', 'Residential colleges', 40, 12, 3.1286, 101.6571],
  ['dailybowl@demo.my', 'Siti Aminah', 'The Daily Bowl', 'Daily Bowl Trading', 'Food & drinks', 'Campus permanent merchant', 'Kompleks Perdanasiswa', 'Central campus', 60, 41, 3.1212, 101.6563],
  ['print@demo.my', 'Ravi Kumar', 'Campus Print Co.', 'Campus Print Co.', 'Printing', 'Campus permanent merchant', 'Faculty of Science', 'Academic zone', 0, 0, 3.1219, 101.6534],
  ['laundry@demo.my', 'Mei Ling', 'Fresh Laundry', 'Fresh Laundry Sdn Bhd', 'Laundry', 'Within 100 m of UM gate', 'South Gate, 80 m outside', 'Campus edge', 0, 0, 3.1099, 101.6586],
  ['hana@demo.my', 'Hana Yusof', 'Roti by Hana', 'Hana Yusof', 'Student event stall', 'Temporary student entrepreneur', 'Perdanasiswa bazaar', 'Central campus', 0, 0, 3.1216, 101.6568],
];

// Simple generated logos so the demo map shows real-looking pins.
function fakeLogo(name, color, motif) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 256, 256);
  x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(200, 40, 90, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = 12; x.lineCap = 'round';
  if (motif === 'cup') { x.beginPath(); x.moveTo(70, 90); x.lineTo(80, 180); x.lineTo(160, 180); x.lineTo(170, 90); x.closePath(); x.fill(); x.beginPath(); x.arc(178, 128, 24, -Math.PI / 2, Math.PI / 2); x.stroke(); }
  else if (motif === 'bowl') { x.beginPath(); x.arc(128, 120, 70, 0, Math.PI); x.fill(); x.fillRect(96, 186, 64, 12); x.fillRect(150, 60, 10, 60); x.fillRect(170, 50, 10, 70); }
  else if (motif === 'print') { x.fillRect(64, 110, 128, 70); x.fillStyle = color; x.fillRect(84, 150, 88, 50); x.fillStyle = '#fff'; x.fillRect(84, 60, 88, 50); }
  else if (motif === 'drop') { x.beginPath(); x.moveTo(128, 50); x.bezierCurveTo(60, 140, 80, 200, 128, 200); x.bezierCurveTo(176, 200, 196, 140, 128, 50); x.fill(); }
  else { x.beginPath(); x.ellipse(128, 132, 80, 54, 0, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#fff'; x.font = 'bold 34px Montserrat, sans-serif'; x.textAlign = 'center'; x.fillText(name.split(' ')[0].toUpperCase().slice(0, 8), 128, 238);
  return c.toDataURL('image/jpeg', 0.85);
}
const LOGOS = { 'Kopi Kolej': ['#7A4B2A', 'cup'], 'The Daily Bowl': ['#E8873A', 'bowl'], 'Campus Print Co.': ['#258DCE', 'print'], 'Fresh Laundry': ['#29B6F6', 'drop'], 'Roti by Hana': ['#D9A514', 'bread'] };

function fakeQR(name) {
  const c = document.createElement('canvas'); c.width = 360; c.height = 460; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 360, 460); x.fillStyle = '#ED0F7E'; x.fillRect(0, 0, 360, 70);
  x.fillStyle = '#fff'; x.font = 'bold 26px Montserrat, sans-serif'; x.textAlign = 'center'; x.fillText('DuitNow QR (demo)', 180, 46);
  const holder = document.createElement('div');
  // eslint-disable-next-line no-undef
  new QRCode(holder, { text: 'DEMO-DUITNOW-' + name, width: 280, height: 280, correctLevel: QRCode.CorrectLevel.M });
  const qc = holder.querySelector('canvas'); if (qc) x.drawImage(qc, 40, 90);
  x.fillStyle = '#0E1A2B'; x.font = 'bold 22px Montserrat, sans-serif'; x.fillText(name, 180, 420);
  return c.toDataURL('image/jpeg', 0.8);
}

// Demo students who show on the "Here now" map: [email, name, matric, college, shop email, audience]
const CROWD = [
  ['chloe@siswa.um.edu.my', 'Chloe Tan', '23005101', 'KK3', 'kopikolej@demo.my', 'everyone'],
  ['danish@siswa.um.edu.my', 'Danish Iskandar', '23005102', 'KK5', 'kopikolej@demo.my', 'everyone'],
  ['elena@siswa.um.edu.my', 'Elena Raj', '23005103', 'KK3', 'kopikolej@demo.my', 'college'],
  ['farid@siswa.um.edu.my', 'Farid Azman', '23005104', 'KK8', 'dailybowl@demo.my', 'everyone'],
  ['gayathri@siswa.um.edu.my', 'Gayathri Devi', '23005105', 'KK1', 'dailybowl@demo.my', 'everyone'],
  ['haziq@siswa.um.edu.my', 'Haziq Rahman', '23005106', 'KK5', 'print@demo.my', 'everyone'],
];
// The demo crowd's 2 hours would run out; move them to "just now" each time the demo opens.
function freshenCrowd(sdk) {
  if (!sdk._rawUpdate) return;
  sdk._rawUpdate((docs, Timestamp) => {
    let i = 0;
    for (const [k, v] of docs) {
      if (!k.startsWith('presence/') || !CROWD.some((c) => v && v.first === D.firstName(c[1]))) continue;
      const at = Date.now() - (5 + 11 * i++) * 60000;
      docs.set(k, { ...v, at: new Timestamp(at), expiresAt: new Timestamp(at + D.PRESENCE_HOURS * 3600000) });
    }
  });
}

export async function ensureDemoData(backend, progress = () => {}) {
  const { sdk, auth, db } = backend;
  if (sdk._rawDocs().has('stats/campus')) { freshenCrowd(sdk); return; }
  progress('Setting up the demo campus…');
  const as = async (email) => {
    try { await sdk.signInWithEmailAndPassword(auth, email, DEMO_PASSWORD); }
    catch { await sdk.createUserWithEmailAndPassword(auth, email, DEMO_PASSWORD); }
    const u = auth.currentUser; return { sdk, db, uid: u.uid, email: u.email, profile: await D.getProfile({ sdk, db, uid: u.uid }).catch(() => null) };
  };
  try {
    let mpp = await as(MPP_EMAIL);
    await D.initProgramme(mpp);
    await D.saveConfig(mpp, 'rules', { features: Object.fromEntries(D.FEATURES.map(([k]) => [k, true])) });
    await D.saveCampaign(mpp, null, { name: 'Cashless Campus Week', description: 'Visit +Onz merchants and pay cashless. Every check-in counts for your college.', start: D.dayKey(), end: D.dayKey(Date.now() + 6 * 86400000), location: 'All of campus', budgetCents: 150000 });
    await D.saveCampaign(mpp, null, { name: 'Student Makers Bazaar', description: 'Student-run stalls with DuitNow QR. Check in at three for the explorer mission.', start: D.dayKey(Date.now() + 9 * 86400000), end: D.dayKey(Date.now() + 11 * 86400000), location: 'Kompleks Perdanasiswa', budgetCents: 80000 });
    const ids = {};
    for (const [email, owner, name, account, type, segment, location, zone, seats, , lat, lng] of MERCHANTS) {
      const m = await as(email); ids[email] = m.uid;
      await D.createProfile(m, { role: 'merchant', name: owner });
      await D.submitApplication(m, { name, accountName: account, type, segment, location, zone, phone: '012-345 6789', ambassadorId: 'AMB-003', qrImage: fakeQR(name), lat, lng, logo: fakeLogo(name, ...LOGOS[name]),
        eventName: segment.startsWith('Temporary') ? 'Student Makers Bazaar' : '', eventEnd: segment.startsWith('Temporary') ? D.dayKey(Date.now() + 11 * 86400000) : '' });
      if (seats) await D.setReadiness(m);
    }
    mpp = await as(MPP_EMAIL);
    for (const [email] of MERCHANTS.slice(0, 4)) await D.reviewMerchant(mpp, ids[email], 'verified', 'QR name matches business');
    for (const [email, , name, , , , , , seats, occupied] of MERCHANTS.slice(0, 2)) {
      const m = await as(email); m.merchantName = name;
      await D.setOccupancy(m, seats, occupied);
      await D.createOffer(m, { title: email.startsWith('kopi') ? 'Double points on your first visit' : 'Free iced tea with any rice bowl', type: 'First-visit bonus', endDate: D.dayKey(Date.now() + 30 * 86400000) });
      await D.createDeal(m, { title: email.startsWith('kopi') ? 'Afternoon study break' : 'Late lunch, extra points', startMin: email.startsWith('kopi') ? 14 * 60 : 14 * 60 + 30, endMin: email.startsWith('kopi') ? 17 * 60 : 16 * 60 + 30, threshold: 60, bonus: email.startsWith('kopi') ? 40 : 30, limit: 12 });
    }
    mpp = await as(MPP_EMAIL);
    for (const o of await D.pendingOffers(mpp)) await D.reviewOffer(mpp, o, 'approved');
    for (const d of await D.pendingDeals(mpp)) await D.reviewDeal(mpp, d.id, 'approved');
    await D.saveReward(mpp, 'kopi-rm3', { title: 'RM3 off at Kopi Kolej', merchantId: ids['kopikolej@demo.my'], cost: 300, valueCents: 300, stock: 50, issued: 0, lastVoucher: '', validDays: 30, active: true, icon: 'coffee' });

    const aina = await as('aina@siswa.um.edu.my');
    await D.createProfile(aina, { role: 'student', name: 'Aina Nadhirah', matric: '23001234', college: 'KK3', faculty: 'Faculty of Science' });
    await D.saveAvatar(aina, { skin: 3, hair: 'tudung', hairColor: 9, outfit: 'baju', outfitColor: 4, hat: 'none', bag: 'tote', accent: 5, glasses: false, freckles: false, face: 'smile', bg: 4 });
    aina.profile = await D.getProfile(aina);
    const badrul = await as('badrul@siswa.um.edu.my');
    await D.createProfile(badrul, { role: 'student', name: 'Badrul Hisham', matric: '23004567', college: 'KK5', faculty: 'Faculty of Engineering' });
    badrul.profile = await D.getProfile(badrul);
    await D.applyInviterCode(badrul, aina.profile.referralCode);

    const rules = D.DEFAULT_RULES;
    const pins = Object.fromEntries(MERCHANTS.map((r) => [r[0], { id: ids[r[0]], name: r[2], lat: r[10], lng: r[11] }]));
    const visit = async (studentEmail, merchantEmail) => {
      const s = await as(studentEmail); s.profile = await D.getProfile(s);
      const m = pins[merchantEmail];
      await D.checkIn(s, m, { lat: m.lat + 0.00005, lng: m.lng - 0.00004, accuracy: 12 }, rules, null);
    };
    progress('Recording a few check-ins…');
    await visit('aina@siswa.um.edu.my', 'kopikolej@demo.my');
    await visit('aina@siswa.um.edu.my', 'dailybowl@demo.my');
    await visit('aina@siswa.um.edu.my', 'print@demo.my');
    await visit('badrul@siswa.um.edu.my', 'laundry@demo.my');
    await visit('badrul@siswa.um.edu.my', 'kopikolej@demo.my');
    const b = await as('badrul@siswa.um.edu.my'); b.profile = await D.getProfile(b); await D.claimFriendBonus(b, rules);
    progress('Adding students to the campus map…');
    for (const [email, name, matric, college, shop, audience] of CROWD) {
      const s = await as(email);
      await D.createProfile(s, { role: 'student', name, matric, college, faculty: '' });
      await D.setMapVisibility(s, true, audience);
      s.profile = await D.getProfile(s);
      const m = pins[shop];
      await D.checkIn(s, m, { lat: m.lat + 0.00004, lng: m.lng + 0.00003, accuracy: 10 }, rules, null);
    }
    const admin = await as(MPP_EMAIL);
    await D.adjustPoints(admin, aina.uid, 300, 'Pilot tester welcome bonus');
  } catch (e) {
    console.error('Demo setup failed', e);
    toast('Demo setup hit a problem: ' + e.message, true);
  } finally {
    await sdk.signOut(auth);
  }
}

export function demoSheet(app) {
  const { sdk, auth } = app.backend;
  const admin = app.site === 'admin';
  const el = sheet(`<h2>You’re in Demo mode</h2><p class="muted">No Firebase project is connected, so everything is stored in this browser and checked against the same security rules as the live app. On the Check in screen you can pretend to stand at any merchant.</p>
    <h3 style="margin-top:18px">Switch account</h3><p class="faint">All demo passwords are ${DEMO_PASSWORD}.</p>
    <div class="stack" style="margin-top:8px">${DEMO_ACCOUNTS.filter(([e]) => (e === MPP_EMAIL) === admin).map(([e, l]) => `<button class="btn block" data-as="${esc(e)}" style="justify-content:flex-start">${icon('user')} ${esc(l)}</button>`).join('')}
      <a class="btn block" href="${esc(admin ? siteUrls.client : siteUrls.admin)}" style="justify-content:flex-start">${icon(admin ? 'house' : 'layout-dashboard')} ${admin ? 'Open the student and merchant app' : 'Open the HEP dashboard'}</a></div>
    <h3 style="margin-top:18px">Start over</h3><p class="faint">Deletes every demo account and record in this browser, then rebuilds the demo campus.</p>
    <button class="btn warn block" id="reset" style="margin-top:8px">${icon('rotate-ccw')} Reset demo data</button>`);
  $$('[data-as]', el).forEach((b) => {
    b.onclick = async () => { closeSheet(); await sdk.signOut(auth); location.hash = ''; await sdk.signInWithEmailAndPassword(auth, b.dataset.as, DEMO_PASSWORD).catch((e) => toast(e.code || e.message, true)); };
  });
  $('#reset', el).onclick = () => { sdk.resetDemoData(); sessionStorage.clear(); location.hash = ''; location.reload(); };
}
