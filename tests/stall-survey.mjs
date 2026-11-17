import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../app/shared/js/stall-survey.js';
import * as sdk from '../app/shared/js/fake/fakefb.js';
import * as D from '../app/shared/js/data.js';

let passed = 0;
async function check(label, fn) { await fn(); passed++; console.log('  ✓ ' + label); }

const full = { area: 'KK3', peakQr: '4', peakCash: '10', peakCard: '', sell: 'food', customers: 'u50', style: 'personalQr', payments: ['cash', 'personalQr'],
  bank: 'maybank', barriers: ['fees'], help: ['qrSetup', 'students'], trade: 'daily', listing: 'yes', bankHelp: 'maybe', whatsapp: ' 012-345 6789 ', mid: '' };

await check('every question and answer has English and Malay text, and codes are unique', () => {
  for (const q of S.STALL_QUESTIONS) {
    assert.ok(q.en && q.ms, q.id);
    if (q.hint) assert.ok(q.hint.en && q.hint.ms, q.id + ' hint');
    if (q.options) {
      assert.equal(new Set(q.options.map((x) => x.code)).size, q.options.length, q.id);
      for (const x of q.options) assert.ok(x.en && x.ms, `${q.id}.${x.code}`);
    }
  }
  for (const t of Object.values(S.STALL_TYPES)) assert.ok(t.en && t.ms && t.about.en && t.about.ms);
  assert.equal(S.STALL_QUIZ_COUNT, 10);
});
await check('answers are cleaned to codes and numbers; blanks are dropped', () => {
  const { answers, errors } = S.cleanStallAnswers(full);
  assert.deepEqual(errors, []);
  assert.equal(answers.peakQr, 4); assert.equal(answers.peakCash, 10); assert.ok(!('peakCard' in answers)); assert.ok(!('mid' in answers));
  assert.equal(answers.whatsapp, '012-345 6789');
  assert.equal(S.stallType(answers), 'personalQr');
});
await check('required questions, “Other” text and the 2-pick limit are enforced', () => {
  assert.deepEqual(S.cleanStallAnswers({ ...full, customers: '' }).errors, ['customers']);
  assert.deepEqual(S.cleanStallAnswers({ ...full, sell: 'other' }).errors, ['sellOther']);
  assert.equal(S.cleanStallAnswers({ ...full, sell: 'other', sellOther: 'Kuih' }).answers.sellOther, 'Kuih');
  assert.deepEqual(S.cleanStallAnswers({ ...full, help: ['qrSetup', 'students', 'records'] }).errors, ['help']);
  assert.deepEqual(S.cleanStallAnswers({ ...full, payments: [] }).errors, ['payments']);
  assert.deepEqual(S.cleanStallAnswers({ ...full, peakQr: '-3' }).errors, ['peakQr']);
  assert.deepEqual(S.cleanStallAnswers({ ...full, style: 'barter' }).errors, ['style']);
  assert.deepEqual(S.cleanStallAnswers({ ...full, barriers: ['none', 'fees'] }).answers.barriers, ['fees'], '“Nothing, I’m fine” can’t sit with a barrier');
});
await check('the free setup list follows the answers and never promises fees or cash', () => {
  const text = (a) => S.stallSetup(S.cleanStallAnswers(a).answers).map((x) => x.en).join(' | ');
  assert.match(text(full), /Business DuitNow QR/); assert.match(text(full), /SME or business account/); assert.match(text(full), /campus map/);
  const ready = text({ ...full, style: 'card', listing: 'no', bankHelp: 'no', help: ['zeroFees', 'cashBonus'] });
  assert.doesNotMatch(ready, /DuitNow QR at your stall|campus map|bank/); assert.match(ready, /Live deals/);
  for (const a of [full, { ...full, help: ['zeroFees', 'cashBonus'] }]) assert.doesNotMatch(text(a), /fee|bonus|loan approved/i);
});
await check('analysis counts stall types, shares and “Other” answers, in either language', () => {
  const rs = [full, { ...full, style: 'card', listing: 'no', bankHelp: 'yes', sell: 'other', sellOther: 'Kuih', payments: ['cash', 'card', 'ewallet'], peakQr: '6', peakCash: '0', peakCard: '4' },
    { ...full, style: 'cash', payments: ['cash'], peakQr: '', peakCash: '20' }].map((a) => { const c = S.cleanStallAnswers(a).answers; return { answers: c, stallType: S.stallType(c) }; });
  const a = S.stallAnalysis(rs);
  assert.equal(a.total, 3);
  assert.deepEqual(a.types.map((t) => [t.code, t.count]), [['cash', 1], ['personalQr', 1], ['businessQr', 0], ['card', 1]]);
  assert.equal(a.headline.qrReady, 33); assert.equal(a.headline.listYes, 67); assert.equal(a.headline.bankHelpYes, 33);
  const pay = a.questions.find((q) => q.id === 'payments');
  assert.equal(pay.rows.find((r) => r.code === 'cash').pct, 100, 'multi: share of stalls that ticked it');
  assert.deepEqual(a.questions.find((q) => q.id === 'sell').others, ['Kuih']);
  assert.deepEqual(a.peak.map((p) => [p.stalls, p.total]), [[2, 10], [3, 30], [1, 4]]);
  assert.equal(S.stallAnalysis(rs, 'ms').types[0].label, 'Klasik Tunai');
});
await check('exports: one English row per stall, with every question as a column', () => {
  const c = S.cleanStallAnswers({ ...full, area: 'other', areaOther: 'Jalan Pantai' }).answers;
  const [head, row] = S.stallResponseRows([{ answers: c, stallType: 'personalQr', merchantName: 'Kopi Kolej', merchantStatus: 'verified', lang: 'ms', at: Date.UTC(2026, 10, 16, 2, 30) }]);
  assert.equal(head.length, row.length);
  const col = (t) => row[head.indexOf(t)];
  assert.equal(col('Stall name'), 'Kopi Kolej'); assert.equal(col('Language used'), 'Bahasa Melayu'); assert.equal(col('Stall type'), 'QR Starter');
  assert.equal(col('Area'), 'Other'); assert.equal(col('Area (other)'), 'Jalan Pantai');
  assert.equal(col('Any other ways you take payment?'), 'Cash; Personal QR');
  const rows = S.stallAnalysisRows(S.stallAnalysis([{ answers: c, stallType: 'personalQr' }]));
  assert.deepEqual(rows[1], ['Responses', 1]);
});

// ---------------------------------------------------------------- rules (the real firestore.rules)
const source = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
sdk.configureFake({ rulesSource: source, storage: null, session: null });
sdk.resetDemoData();
const context = (uid, email) => ({ sdk, db: sdk._testDb(sdk._testAuth({ uid, email, emailVerified: true })), uid, email });
const admin = context('admin', /function bootstrapAdmins\(\) \{ return \['([^']+)'/.exec(source)[1]);
await D.initProgramme(admin);
sdk._rawUpdate((docs) => { const r = docs.get('config/rules') || {}; docs.set('config/rules', { ...r, features: { ...(r.features || {}), merchantSignup: true } }); });
const shopA = context('shopA', 'shop.a@shop.my'), shopB = context('shopB', 'shop.b@shop.my'), stu = context('stu', 'stu@siswa.um.edu.my');
for (const m of [shopA, shopB]) { await D.createProfile(m, { role: 'merchant', name: 'Owner ' + m.uid }); m.profile = await D.getProfile(m); }
await D.createProfile(stu, { role: 'student', name: 'Student', matric: 'S1234567', college: 'KK3', faculty: 'Faculty of Science' }); stu.profile = await D.getProfile(stu);
const ref = (ctx, u) => sdk.doc(ctx.db, 'stallSurveys', u);
const good = () => ({ v: 1, lang: 'en', answers: S.cleanStallAnswers(full).answers, stallType: 'personalQr', at: sdk.serverTimestamp() });

await check('a merchant saves their own survey and can retake it', async () => {
  const res = await D.submitStallSurvey(shopA, full, 'ms');
  assert.equal(res.stallType, 'personalQr');
  await D.submitStallSurvey(shopA, { ...full, style: 'businessQr' }, 'en');
  const saved = await D.getStallSurvey(shopA);
  assert.equal(saved.stallType, 'businessQr'); assert.equal(saved.lang, 'en');
});
await check('incomplete answers are stopped before saving', async () => {
  await assert.rejects(D.submitStallSurvey(shopB, { ...full, listing: '' }), (e) => e.fields?.includes('listing'));
  assert.equal(await D.getStallSurvey(shopB), null);
});
await check('students and other merchants can’t write or read someone’s survey', async () => {
  await assert.rejects(sdk.setDoc(ref(stu, 'stu'), good()), { code: 'permission-denied' });
  await assert.rejects(sdk.setDoc(ref(shopB, 'shopA'), good()), { code: 'permission-denied' });
  await assert.rejects(sdk.getDoc(ref(shopB, 'shopA')), { code: 'permission-denied' });
  await assert.rejects(sdk.getDoc(ref(stu, 'shopA')), { code: 'permission-denied' });
});
await check('the rules refuse a forged stall type, extra fields, 3 “help” picks or a long WhatsApp field', async () => {
  const bad = [
    { ...good(), stallType: 'card' },
    { ...good(), score: 100 },
    { ...good(), answers: { ...good().answers, help: ['qrSetup', 'students', 'records'] } },
    { ...good(), answers: { ...good().answers, whatsapp: '0'.repeat(30) } },
    { ...good(), answers: { ...good().answers, ic: '900101-14-1234' } },
    { ...good(), at: new Date() },
  ];
  for (const doc of bad) await assert.rejects(sdk.setDoc(ref(shopB, 'shopB'), doc), { code: 'permission-denied' });
  await sdk.setDoc(ref(shopB, 'shopB'), good());
});
await check('the Admin team reads every survey for the analysis, but can’t edit one', async () => {
  const all = await D.listStallSurveys(admin);
  assert.deepEqual(all.map((s) => s.id).sort(), ['shopA', 'shopB']);
  await assert.rejects(sdk.setDoc(ref(admin, 'shopA'), good()), { code: 'permission-denied' });
  await assert.rejects(D.listStallSurveys(shopA), { code: 'permission-denied' });
});
console.log(`\n${passed} passed, 0 failed`);
