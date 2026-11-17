// Stall survey ("What kind of stall are you?"): asked once a merchant has sent their shop details. Fuller than the
// readiness check. Every question and answer carries English and Malay text, and the merchant picks the language on the
// page. Answers are saved as language-free codes, so the Admin team's analysis and exports read the same either way.
// Used by the merchant app, the admin dashboard, the demo backend and the tests, so keep it free of browser APIs.

export const STALL_SURVEY_VERSION = 1;
const o = (code, en, ms = en) => ({ code, en, ms });

const AREAS = [
  ...Array.from({ length: 13 }, (_, i) => o('KK' + (i + 1), 'KK' + (i + 1))),
  o('IHAJ', 'International House Apartment Jepun'),
  o('FBL', 'Faculty of Languages and Linguistics', 'Fakulti Bahasa dan Linguistik'),
  o('FAB', 'Faculty of Built Environment', 'Fakulti Alam Bina'),
  o('FPE', 'Faculty of Business and Economics', 'Fakulti Perniagaan dan Ekonomi'),
  o('FSKTM', 'Faculty of Computer Science', 'Fakulti Sains Komputer'),
  o('FPend', 'Faculty of Education', 'Fakulti Pendidikan'),
  o('FK', 'Faculty of Engineering', 'Fakulti Kejuruteraan'),
  o('FS', 'Faculty of Science', 'Fakulti Sains'),
  o('FSSS', 'Faculty of Social Sciences', 'Fakulti Sastera dan Sains Sosial'),
  o('FPer', 'Faculty of Medicine', 'Fakulti Perubatan'),
  o('FFar', 'Faculty of Pharmacy', 'Fakulti Farmasi'),
  o('PPUM', 'PPUM'),
  o('LaPalmas', 'La Palmas'),
  o('outside', 'Outside campus (within 100 m)', 'Luar kampus (dalam 100 m)'),
];

// Sections: "about" is the short part the field team used to fill in; "quiz" is the owner's 10 questions.
// type: single (radio), multi (checkboxes), text, number. other: adds an "Other" box. max: most choices for multi.
// none: a multi option that can't be combined with the others.
export const STALL_SECTIONS = [
  { id: 'about', en: 'About your stall', ms: 'Tentang kedai anda', note: { en: 'About 30 seconds.', ms: 'Kira-kira 30 saat.' } },
  { id: 'quiz', en: 'What kind of stall are you?', ms: 'Kedai anda jenis apa?',
    note: { en: '10 quick questions, and you get your stall type at the end.', ms: '10 soalan pantas, dan anda dapat jenis kedai anda di hujung.' } },
];

export const STALL_QUESTIONS = [
  { id: 'area', section: 'about', type: 'single', required: true, other: true, en: 'Area', ms: 'Kawasan', options: AREAS },
  { id: 'mid', section: 'about', type: 'text', max: 40, en: 'Merchant ID or Terminal ID (from the QR sticker or card machine)', ms: 'Merchant ID atau Terminal ID (dari pelekat QR atau mesin kad)',
    hint: { en: 'Leave blank if there is none.', ms: 'Kosongkan jika tiada.' } },
  { id: 'peakQr', section: 'about', type: 'number', en: '10-minute peak count: QR', ms: 'Kiraan 10 minit waktu puncak: QR',
    hint: { en: 'How many customers paid this way in a busy 10 minutes. Numbers only. Leave blank if you’re not sure.', ms: 'Berapa ramai pelanggan membayar cara ini dalam 10 minit yang sibuk. Nombor sahaja. Kosongkan jika tidak pasti.' } },
  { id: 'peakCash', section: 'about', type: 'number', en: '10-minute peak count: Cash', ms: 'Kiraan 10 minit waktu puncak: Tunai' },
  { id: 'peakCard', section: 'about', type: 'number', en: '10-minute peak count: Card', ms: 'Kiraan 10 minit waktu puncak: Kad' },

  { id: 'sell', section: 'quiz', type: 'single', required: true, other: true, en: 'What do you sell?', ms: 'Apa yang anda jual?', options: [
    o('food', 'Food and drinks', 'Makanan dan minuman'), o('coffee', 'Coffee and snacks', 'Kopi dan snek'),
    o('groceries', 'Groceries and daily needs', 'Barang runcit'), o('printing', 'Printing and stationery', 'Cetakan dan alat tulis'),
    o('services', 'Services (laundry, repairs)', 'Servis (dobi, baiki)'), o('events', 'I sell at events and bazaars', 'Saya jual di event dan bazar'),
    o('online', 'I sell online', 'Saya jual online')] },
  { id: 'customers', section: 'quiz', type: 'single', required: true, en: 'How many customers a day?', ms: 'Berapa ramai pelanggan sehari?', options: [
    o('u50', 'Under 50', 'Bawah 50'), o('50to100', '50 to 100', '50 hingga 100'), o('100to200', '100 to 200', '100 hingga 200'), o('o200', 'Over 200', 'Lebih 200')] },
  { id: 'style', section: 'quiz', type: 'single', required: true, en: 'Which one sounds most like you?', ms: 'Yang mana paling macam anda?',
    hint: { en: 'Event and online sellers: pick the line that fits how you get paid.', ms: 'Penjual event dan online: pilih yang paling sama dengan cara anda terima bayaran.' }, options: [
      o('cash', '“Cash only, it’s easy.” Mostly cash', '“Cash je, senang.” Kebanyakan tunai'),
      o('personalQr', 'Customers scan my own DuitNow QR', 'Pelanggan scan DuitNow QR peribadi saya'),
      o('businessQr', 'I have a Business QR from my bank or e-wallet', 'Saya ada Business QR dari bank atau e-wallet'),
      o('card', 'We have a card machine', 'Kami ada mesin kad')] },
  { id: 'payments', section: 'quiz', type: 'multi', required: true, en: 'Any other ways you take payment?', ms: 'Cara bayaran lain?',
    hint: { en: 'Tick all that apply.', ms: 'Tanda semua yang berkenaan.' }, options: [
      o('cash', 'Cash', 'Tunai'), o('personalQr', 'Personal QR', 'QR peribadi'), o('businessQr', 'Business QR'), o('card', 'Card', 'Kad'),
      o('online', 'Online (Shopee, TikTok Shop)'), o('ewallet', 'E-wallet (TNG, Boost, ShopeePay, GrabPay)')] },
  { id: 'bank', section: 'quiz', type: 'single', required: true, other: true, en: 'Your main bank or e-wallet?', ms: 'Bank atau e-wallet utama?', options: [
    o('maybank', 'Maybank'), o('cimb', 'CIMB'), o('bankislam', 'Bank Islam'), o('rhb', 'RHB'), o('hongleong', 'Hong Leong'),
    o('publicbank', 'Public Bank'), o('bsn', 'BSN'), o('bankrakyat', 'Bank Rakyat'), o('tng', 'TNG eWallet')] },
  { id: 'barriers', section: 'quiz', type: 'multi', required: true, en: 'What stops you using (more) QR?', ms: 'Apa yang buat anda tak guna (lebih) QR?',
    hint: { en: 'Tick all that apply.', ms: 'Tanda semua yang berkenaan.' }, none: 'none', options: [
      o('fees', 'Fees', 'Caj'), o('setup', 'Setup is a hassle', 'Susah nak setup'), o('internet', 'Slow internet', 'Internet lambat'),
      o('cashCustomers', 'My customers prefer cash', 'Pelanggan suka tunai'), o('tax', 'Worried about tax', 'Risau pasal cukai'),
      o('dontKnow', 'Don’t know how', 'Tak tahu caranya'), o('none', 'Nothing, I’m fine', 'Tiada, saya okay')] },
  { id: 'help', section: 'quiz', type: 'multi', required: true, max: 2, other: true, en: 'What would help you most?', ms: 'Apa yang paling membantu?',
    hint: { en: 'Pick up to 2.', ms: 'Pilih sampai 2.' }, options: [
      o('qrSetup', 'Free QR setup at my stall', 'Setup QR percuma di kedai'), o('zeroFees', 'Zero fees', 'Tiada caj'),
      o('students', 'More student customers', 'Lebih ramai pelanggan pelajar'), o('socials', 'Deals promoted on UM socials', 'Promosi di media sosial UM'),
      o('records', 'Sales records for a loan', 'Rekod jualan untuk pinjaman'), o('cashBonus', 'A cash bonus', 'Bonus tunai')] },
  { id: 'trade', section: 'quiz', type: 'single', required: true, en: 'When do you trade?', ms: 'Bila anda berniaga?', options: [
    o('daily', 'Every day', 'Setiap hari'), o('weekdays', 'Weekdays only', 'Hari bekerja sahaja'),
    o('semester', 'Semester only', 'Semester sahaja'), o('events', 'Events only', 'Event sahaja')] },
  { id: 'listing', section: 'quiz', type: 'single', required: true, en: 'Can we list your stall for UM’s count and in +Onz?', ms: 'Boleh kami senaraikan kedai anda untuk kiraan UM dan dalam +Onz?', options: [
    o('yes', 'Yes', 'Ya'), o('maybe', 'Maybe, tell me more', 'Mungkin, ceritakan lagi'), o('no', 'No thanks', 'Tak apa, terima kasih')] },
  { id: 'bankHelp', section: 'quiz', type: 'single', required: true, en: 'Do you need bank assistance to register for an SME or business account?', ms: 'Adakah anda perlukan bantuan pihak bank untuk mendaftar akaun perniagaan/SME?', options: [
    o('yes', 'Yes, I really need help', 'Ya, sangat perlukan'), o('maybe', 'Maybe, tell me more', 'Boleh pertimbangkan'),
    o('no', 'No thanks, I already have one', 'Tidak perlu, sudah ada')] },
  { id: 'whatsapp', section: 'quiz', type: 'tel', max: 20, en: 'WhatsApp number (optional)', ms: 'No. WhatsApp (pilihan)',
    hint: { en: 'Only so we can reach you about the setup.', ms: 'Hanya untuk kami hubungi anda tentang setup.' } },
];
export const STALL_QUIZ_COUNT = STALL_QUESTIONS.filter((q) => q.section === 'quiz' && q.type !== 'tel').length;

// Stall types, from how the stall mostly gets paid.
export const STALL_TYPES = {
  cash: { icon: 'wallet', en: 'Cash Classic', ms: 'Klasik Tunai',
    about: { en: 'Your customers mostly pay cash. A Business DuitNow QR lets students pay the way they already do, with no change to count.',
      ms: 'Pelanggan anda kebanyakannya bayar tunai. Business DuitNow QR membolehkan pelajar bayar cara yang mereka biasa, tanpa perlu kira baki.' } },
  personalQr: { icon: 'qr-code', en: 'QR Starter', ms: 'Perintis QR',
    about: { en: 'Students already scan your personal QR. A Business QR keeps shop money separate and gives you sales records.',
      ms: 'Pelajar sudah scan QR peribadi anda. Business QR mengasingkan wang kedai dan memberi anda rekod jualan.' } },
  businessQr: { icon: 'badge-check', en: 'QR Ready', ms: 'Sedia QR',
    about: { en: 'You have a Business QR. Now let more students find you and come back.',
      ms: 'Anda sudah ada Business QR. Sekarang biar lebih ramai pelajar jumpa anda dan datang semula.' } },
  card: { icon: 'scan-line', en: 'All-in Digital', ms: 'Serba Digital',
    about: { en: 'You take cards and QR. You’re ready for live deals and campus promotion.',
      ms: 'Anda terima kad dan QR. Anda sedia untuk tawaran langsung dan promosi kampus.' } },
};
export const stallType = (answers = {}) => (STALL_TYPES[answers.style] ? answers.style : 'cash');

// What the team can set up, free, for this stall. Nothing here promises fees, bonuses or loans.
export function stallSetup(answers = {}) {
  const has = (k, v) => [].concat(answers[k] || []).includes(v);
  const type = stallType(answers); const out = [];
  if (type === 'cash' || type === 'personalQr' || has('help', 'qrSetup')) out.push({ en: 'Help setting up a Business DuitNow QR at your stall, with your bank.', ms: 'Bantuan setup Business DuitNow QR di kedai anda, bersama bank anda.' });
  if (answers.bankHelp === 'yes' || answers.bankHelp === 'maybe') out.push({ en: 'An introduction to a bank that can help you open an SME or business account.', ms: 'Perkenalan kepada bank yang boleh bantu anda buka akaun SME atau perniagaan.' });
  if (has('barriers', 'dontKnow') || has('barriers', 'setup')) out.push({ en: 'A short walkthrough for you and your staff.', ms: 'Panduan ringkas untuk anda dan pekerja anda.' });
  if (answers.listing !== 'no') out.push({ en: 'Your stall on the +Onz campus map, so students can find you.', ms: 'Kedai anda di peta kampus +Onz, supaya pelajar boleh jumpa anda.' });
  if (has('help', 'students') || has('help', 'socials') || type === 'businessQr' || type === 'card') out.push({ en: 'Live deals that bring student customers to your stall.', ms: 'Tawaran langsung yang membawa pelanggan pelajar ke kedai anda.' });
  if (has('help', 'records')) out.push({ en: 'A guide to using your QR sales records when you apply for financing.', ms: 'Panduan menggunakan rekod jualan QR anda semasa memohon pembiayaan.' });
  return out;
}

// ---------------------------------------------------------------- validation (mirrors firestore.rules)
const OTHER_MAX = 80;
export function cleanStallAnswers(raw = {}) {
  const out = {}; const errors = [];
  for (const q of STALL_QUESTIONS) {
    const codes = new Set((q.options || []).map((x) => x.code));
    let v = raw[q.id];
    if (q.type === 'multi') {
      v = [...new Set([].concat(v || []).map(String))].filter((c) => codes.has(c) || (q.other && c === 'other'));
      if (q.none && v.includes(q.none) && v.length > 1) v = v.filter((c) => c !== q.none);
      if (q.max && v.length > q.max) errors.push(q.id);
      if (q.required && !v.length) errors.push(q.id);
      if (v.length) out[q.id] = v;
    } else if (q.type === 'single') {
      v = String(v || '');
      if (!(codes.has(v) || (q.other && v === 'other'))) { if (q.required) errors.push(q.id); continue; }
      out[q.id] = v;
    } else if (q.type === 'number') {
      if (v === '' || v == null) continue;
      const num = Number(v);
      if (!Number.isInteger(num) || num < 0 || num > 999) { errors.push(q.id); continue; }
      out[q.id] = num;
    } else {
      v = String(v || '').trim().slice(0, q.max || 80);
      if (q.type === 'tel') v = v.replace(/[^\d+ -]/g, '');
      if (v) out[q.id] = v;
    }
    if (q.other && [].concat(out[q.id] || []).includes('other')) {
      const text = String(raw[q.id + 'Other'] || '').trim().slice(0, OTHER_MAX);
      if (!text) errors.push(q.id + 'Other'); else out[q.id + 'Other'] = text;
    }
  }
  return { answers: out, errors };
}

// ---------------------------------------------------------------- analysis and export (admin)
export const stallLabel = (q, code, lang = 'en') => {
  if (code === 'other') return lang === 'ms' ? 'Lain-lain' : 'Other';
  const opt = (q.options || []).find((x) => x.code === code); return opt ? opt[lang] : String(code);
};
const pct = (count, total) => (total ? Math.round((count / total) * 100) : 0);

// responses: [{ answers, stallType }]. For each choice question: [{ code, label, count, pct }] with "Other" last;
// for multi questions pct is the share of respondents who ticked it.
export function stallAnalysis(responses, lang = 'en') {
  const total = responses.length;
  const questions = STALL_QUESTIONS.filter((q) => q.options).map((q) => {
    const counts = new Map([...q.options.map((x) => [x.code, 0]), ...(q.other ? [['other', 0]] : [])]);
    let answered = 0;
    for (const r of responses) {
      const v = [].concat(r.answers?.[q.id] || []); if (v.length) answered++;
      for (const c of v) if (counts.has(c)) counts.set(c, counts.get(c) + 1);
    }
    const others = q.other ? responses.map((r) => r.answers?.[q.id + 'Other']).filter(Boolean) : [];
    return { id: q.id, title: q[lang], type: q.type, answered, others,
      rows: [...counts].map(([code, count]) => ({ code, label: stallLabel(q, code, lang), count, pct: pct(count, answered) })) };
  });
  const types = Object.entries(STALL_TYPES).map(([code, t]) => {
    const count = responses.filter((r) => (r.stallType || stallType(r.answers)) === code).length;
    return { code, label: t[lang], count, pct: pct(count, total) };
  });
  const peak = ['peakQr', 'peakCash', 'peakCard'].map((id) => {
    const vals = responses.map((r) => r.answers?.[id]).filter((v) => Number.isInteger(v));
    return { id, label: { peakQr: 'QR', peakCash: lang === 'ms' ? 'Tunai' : 'Cash', peakCard: lang === 'ms' ? 'Kad' : 'Card' }[id],
      stalls: vals.length, total: vals.reduce((s, v) => s + v, 0) };
  });
  const peakAll = peak.reduce((s, p) => s + p.total, 0);
  peak.forEach((p) => { p.share = pct(p.total, peakAll); });
  const share = (id, code) => pct(responses.filter((r) => r.answers?.[id] === code).length, total);
  return { total, types, questions, peak,
    headline: { qrReady: pct(responses.filter((r) => ['businessQr', 'card'].includes(r.stallType || stallType(r.answers))).length, total),
      listYes: share('listing', 'yes'), bankHelpYes: share('bankHelp', 'yes'), whatsapp: responses.filter((r) => r.answers?.whatsapp).length } };
}

const join = (q, v) => [].concat(v || []).map((c) => stallLabel(q, c)).join('; ');
// One row per stall, in English, with the merchant's own details first.
export function stallResponseRows(responses) {
  const qs = STALL_QUESTIONS;
  const head = ['Submitted', 'Stall name', 'Merchant status', 'Language used', 'Stall type',
    ...qs.flatMap((q) => [q.en, ...(q.other ? [q.en + ' (other)'] : [])])];
  const rows = responses.map((r) => [r.at ? new Date(r.at).toISOString().replace('T', ' ').slice(0, 16) : '', r.merchantName || '', r.merchantStatus || '',
    r.lang === 'ms' ? 'Bahasa Melayu' : 'English', STALL_TYPES[r.stallType || stallType(r.answers)].en,
    ...qs.flatMap((q) => [q.options ? join(q, r.answers?.[q.id]) : (r.answers?.[q.id] ?? ''), ...(q.other ? [r.answers?.[q.id + 'Other'] || ''] : [])])]);
  return [head, ...rows];
}
export function stallAnalysisRows(a) {
  const out = [['Stall survey analysis'], ['Responses', a.total], ['QR-ready stalls (Business QR or card)', a.headline.qrReady + '%'],
    ['Happy to be listed', a.headline.listYes + '%'], ['Need bank help for an SME account', a.headline.bankHelpYes + '%'],
    ['Left a WhatsApp number', a.headline.whatsapp], [], ['Stall type', 'Stalls', '% of stalls'], ...a.types.map((t) => [t.label, t.count, t.pct + '%']), [],
    ['10-minute peak counts', 'Stalls answering', 'Payments counted', '% of payments'], ...a.peak.map((p) => [p.label, p.stalls, p.total, p.share + '%'])];
  for (const q of a.questions) {
    out.push([], [q.title + (q.type === 'multi' ? ' (tick all that apply)' : ''), 'Stalls', `% of ${q.answered} answering`]);
    for (const r of q.rows) out.push([r.label, r.count, r.pct + '%']);
    if (q.others.length) out.push(['Other answers', q.others.join('; ')]);
  }
  return out;
}
