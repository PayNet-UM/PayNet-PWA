import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../app/shared/js/stall-survey.js';
import * as sdk from '../app/shared/js/fake/fakefb.js';
import * as D from '../app/shared/js/data.js';

let passed = 0;
async function check(label, fn) { await fn(); passed++; console.log('  ✓ ' + label); }

const full = { name: ' Kopi Kolej ', location: 'KK3', type: 'coffee', age: '1to3y', registered: 'no', payments: ['cash', 'personalQr'], banks: ['maybank', 'tng'],
  bizAccount: 'personal', records: 'manual', customers: '50to100', challenges: ['traffic', 'cashflow'], financing: 'looking', financingPurpose: ['working'], financingAmount: 'u5k',
  priorities: ['sales', 'digital'], support: ['qr', 'bookkeeping', 'financing'], listing: 'yes', ownerName: 'Hafiz Rahman', whatsapp: ' 012-345 6789 ', consentContact: true, consentPartners: true };

await check('the questions follow the assessment (sections A–D, 15 numbered questions), in English and Malay', () => {
  assert.deepEqual(S.STALL_SECTIONS.map((x) => x.id), ['profile', 'readiness', 'growth', 'consent']);
  assert.deepEqual([...new Set(S.STALL_QUESTIONS.map((q) => q.n))], Array.from({ length: 15 }, (_, i) => i + 1));
  const ids = (sec) => S.STALL_QUESTIONS.filter((q) => q.section === sec).map((q) => q.id);
  assert.deepEqual(ids('profile'), ['name', 'location', 'type', 'age', 'registered']);
  assert.deepEqual(ids('readiness'), ['payments', 'banks', 'bizAccount', 'records', 'customers', 'challenges']);
  assert.deepEqual(ids('growth'), ['financing', 'financingPurpose', 'financingAmount', 'priorities', 'support']);
  assert.deepEqual(ids('consent'), ['listing', 'ownerName', 'whatsapp', 'consentContact', 'consentPartners']);
  const q = (id) => S.STALL_QUESTIONS.find((x) => x.id === id);
  assert.equal(q('type').options.length + 1, 8, 'business types plus Other');
  assert.equal(q('banks').options.length, 10); assert.ok(q('banks').other && q('banks').type === 'multi');
  assert.equal(q('challenges').max, 3); assert.equal(q('priorities').max, 2); assert.equal(q('support').max, 3);
  assert.equal(q('support').options.length + 1, 10);
  for (const x of S.STALL_QUESTIONS) {
    assert.ok(x.en && x.ms, x.id);
    if (x.hint) assert.ok(x.hint.en && x.hint.ms, x.id + ' hint');
    if (x.options) { assert.equal(new Set(x.options.map((y) => y.code)).size, x.options.length, x.id); for (const y of x.options) assert.ok(y.en && y.ms, `${x.id}.${y.code}`); }
  }
  for (const t of Object.values(S.STALL_TYPES)) assert.ok(t.en && t.ms && t.about.en && t.about.ms);
  for (const t of Object.values(S.STALL_INTRO)) assert.ok(t.en && t.ms);
});
await check('answers are cleaned to codes; text is trimmed and consents are true or false', () => {
  const { answers, errors } = S.cleanStallAnswers(full);
  assert.deepEqual(errors, []);
  assert.equal(answers.name, 'Kopi Kolej'); assert.equal(answers.whatsapp, '012-345 6789');
  assert.equal(answers.consentPartners, true);
  assert.equal(S.cleanStallAnswers({ ...full, consentPartners: undefined }).answers.consentPartners, false, 'an unticked box is saved as No');
  assert.equal(S.stallType(answers), 'personalQr');
});
await check('the financing follow-ups are only asked, and only kept, when the merchant is interested', () => {
  const no = S.cleanStallAnswers({ ...full, financing: 'no' });
  assert.deepEqual(no.errors, []); assert.ok(!('financingPurpose' in no.answers) && !('financingAmount' in no.answers));
  assert.deepEqual(S.cleanStallAnswers({ ...full, financing: 'later', financingPurpose: [] }).errors, ['financingPurpose']);
  assert.deepEqual(S.cleanStallAnswers({ ...full, financingAmount: '' }).errors, [], 'the amount is optional');
});
await check('required answers, “Other” text and the “up to” limits are enforced', () => {
  assert.deepEqual(S.cleanStallAnswers({ ...full, age: '' }).errors, ['age']);
  assert.deepEqual(S.cleanStallAnswers({ ...full, ownerName: ' ' }).errors, ['ownerName']);
  assert.deepEqual(S.cleanStallAnswers({ ...full, type: 'other' }).errors, ['typeOther']);
  assert.equal(S.cleanStallAnswers({ ...full, banks: ['other'], banksOther: 'Agrobank' }).answers.banksOther, 'Agrobank');
  assert.deepEqual(S.cleanStallAnswers({ ...full, challenges: ['traffic', 'costs', 'cashflow', 'labour'] }).errors, ['challenges']);
  assert.deepEqual(S.cleanStallAnswers({ ...full, priorities: ['sales', 'costs', 'online'] }).errors, ['priorities']);
  assert.deepEqual(S.cleanStallAnswers({ ...full, support: ['qr', 'literacy', 'bookkeeping', 'marketing'] }).errors, ['support']);
  assert.deepEqual(S.cleanStallAnswers({ ...full, payments: [] }).errors, ['payments']);
});
await check('stall type comes from the most digital payment method', () => {
  const t = (payments) => S.stallType({ payments });
  assert.equal(t(['cash']), 'cash'); assert.equal(t(['cash', 'ewallet']), 'personalQr'); assert.equal(t(['personalQr', 'businessQr']), 'businessQr');
  assert.equal(t(['cash', 'businessQr', 'card']), 'card'); assert.equal(t(['card']), 'personalQr');
});
await check('“How +Onz can help” follows the answers, and partner introductions only appear with consent', () => {
  const text = (a) => S.stallSetup(S.cleanStallAnswers(a).answers).map((x) => x.en).join(' | ');
  assert.match(text(full), /Business DuitNow QR/); assert.match(text(full), /business account/); assert.match(text(full), /financing partners/);
  assert.match(text(full), /registering your business/); assert.match(text(full), /sales records/);
  const noConsent = text({ ...full, consentPartners: false });
  assert.doesNotMatch(noConsent, /bank that can help|financing partners/);
  assert.doesNotMatch(text(full), /zero fee|bonus|guarantee|approved/i);
});
await check('answers to the earlier version carry over where they match', () => {
  const p = S.stallPrefillFromV1({ area: 'KK3', sell: 'groceries', customers: '100to200', payments: ['cash', 'online'], bank: 'bankrakyat', listing: 'maybe', whatsapp: '011' });
  assert.deepEqual(p, { location: 'KK3', type: 'retail', payments: ['cash', 'banking'], banks: ['other'], banksOther: 'Bank Rakyat', customers: '101to200', listing: 'maybe', whatsapp: '011' });
  assert.deepEqual(S.stallPrefillFromV1({ area: 'PPUM', sell: 'events' }), { type: 'onlineEvent' });
  assert.equal(S.isCurrentStallSurvey({ v: 1 }), false); assert.equal(S.isCurrentStallSurvey({ v: 2 }), true);
});
await check('analysis counts types, follow-ups and consents among the merchants asked', () => {
  const rs = [full, { ...full, financing: 'no', consentPartners: false, payments: ['cash', 'businessQr', 'card'], bizAccount: 'yes', type: 'other', typeOther: 'Kuih' },
    { ...full, payments: ['cash'], listing: 'no' }].map((a) => { const c = S.cleanStallAnswers(a).answers; return { answers: c, stallType: S.stallType(c) }; });
  const a = S.stallAnalysis(rs);
  assert.equal(a.total, 3);
  assert.deepEqual(a.types.map((t) => [t.code, t.count]), [['cash', 1], ['personalQr', 1], ['businessQr', 0], ['card', 1]]);
  assert.equal(a.headline.qrReady, 33); assert.equal(a.headline.noBizAccount, 67); assert.equal(a.headline.financing, 67); assert.equal(a.headline.partners, 67); assert.equal(a.headline.listYes, 67);
  assert.equal(a.questions.find((q) => q.id === 'financingPurpose').answered, 2, 'only merchants interested in financing were asked the purpose');
  assert.deepEqual(a.questions.find((q) => q.id === 'consentPartners').rows.map((r) => r.count), [2, 1]);
  assert.deepEqual(a.questions.find((q) => q.id === 'type').others, ['Kuih']);
  assert.equal(S.stallAnalysis(rs, 'ms').types[0].label, 'Klasik Tunai');
});
await check('exports: one English row per merchant with every numbered question, and old answers in their own format', () => {
  const c = S.cleanStallAnswers({ ...full, location: 'other', locationOther: 'Jalan Pantai' }).answers;
  const [head, row] = S.stallResponseRows([{ answers: c, stallType: 'personalQr', merchantName: 'Kopi Kolej Enterprise', merchantStatus: 'verified', lang: 'ms', at: Date.UTC(2026, 10, 16, 2, 30) }]);
  assert.equal(head.length, row.length);
  const col = (t) => row[head.indexOf(t)];
  assert.equal(col('Stall name (shop details)'), 'Kopi Kolej Enterprise'); assert.equal(col('1. Business or stall name'), 'Kopi Kolej');
  assert.equal(col('1. Location'), 'Other'); assert.equal(col('1. Location (other)'), 'Jalan Pantai');
  assert.equal(col('5. Which payment methods do you currently accept?'), 'Cash; Personal DuitNow QR');
  assert.equal(col('15. I agree to be contacted by +Onz regarding merchant onboarding and business development programmes.'), 'Yes');
  assert.equal(col('Language used'), 'Bahasa Melayu');
  assert.deepEqual(S.stallAnalysisRows(S.stallAnalysis([{ answers: c, stallType: 'personalQr' }]))[1], ['Responses', 1]);
  const [h1, r1] = S.stallResponseRowsV1([{ answers: { area: 'KK3', style: 'cash', payments: ['cash'] }, stallType: 'cash', v: 1 }]);
  assert.equal(r1[h1.indexOf('Which one sounds most like you?')], 'Mostly cash');
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
const good = () => ({ v: 2, lang: 'en', answers: S.cleanStallAnswers(full).answers, stallType: 'personalQr', at: sdk.serverTimestamp() });

await check('a merchant saves their own survey and can retake it', async () => {
  const res = await D.submitStallSurvey(shopA, full, 'ms');
  assert.equal(res.stallType, 'personalQr');
  await D.submitStallSurvey(shopA, { ...full, payments: ['businessQr'] }, 'en');
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
await check('the rules refuse the old version, extra fields, missing consents, too many picks or a long WhatsApp field', async () => {
  const ans = good().answers; const without = (k) => { const x = { ...ans }; delete x[k]; return x; };
  const bad = [
    { ...good(), v: 1 },
    { ...good(), score: 100 },
    { ...good(), answers: without('consentPartners') },
    { ...good(), answers: { ...ans, consentContact: 'yes' } },
    { ...good(), answers: { ...ans, priorities: ['sales', 'costs', 'online'] } },
    { ...good(), answers: { ...ans, challenges: ['traffic', 'costs', 'cashflow', 'labour'] } },
    { ...good(), answers: { ...ans, whatsapp: '0'.repeat(30) } },
    { ...good(), answers: { ...ans, ic: '900101-14-1234' } },
    { ...good(), answers: without('ownerName') },
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
