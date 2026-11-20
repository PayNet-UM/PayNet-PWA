// +Onz Merchant Assessment (Merchant Digital & Financial Readiness Assessment), shown as the "Stall survey": asked
// once a merchant has sent their shop details, and required before the rest of the merchant app opens. Every question
// and answer carries English and Malay text, and the merchant picks the language on the page. Answers are saved as
// language-free codes, so the Admin team's analysis and exports read the same either way.
// Used by the merchant app, the admin dashboard, the demo backend and the tests, so keep it free of browser APIs.
//
// Version 2 follows the assessment's Sections A–D. Version 1 (the earlier "What kind of stall are you?" quiz) is kept
// below as STALL_QUESTIONS_V1, only so answers given to it can still be exported and used to pre-fill version 2.

export const STALL_SURVEY_VERSION = 2;
const o = (code, en, ms = en) => ({ code, en, ms });

const FACULTY_AREAS = [
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
];
const KK_AREAS = [...Array.from({ length: 13 }, (_, i) => o('KK' + (i + 1), 'KK' + (i + 1))), o('IHAJ', 'International House Apartment Jepun')];

// Sections A–D of the assessment.
export const STALL_SECTIONS = [
  { id: 'profile', en: 'A. Business profile', ms: 'A. Profil perniagaan' },
  { id: 'readiness', en: 'B. Digital and financial readiness', ms: 'B. Kesediaan digital dan kewangan' },
  { id: 'growth', en: 'C. Growth and financial needs', ms: 'C. Pertumbuhan dan keperluan kewangan' },
  { id: 'consent', en: 'D. Onboarding and consent', ms: 'D. Pendaftaran dan persetujuan' },
];
export const STALL_INTRO = {
  title: { en: '+Onz Merchant Assessment', ms: 'Penilaian Peniaga +Onz' },
  subtitle: { en: 'Merchant Digital & Financial Readiness Assessment', ms: 'Penilaian Kesediaan Digital & Kewangan Peniaga' },
  body: { en: 'We want to understand your business better so we can connect you with more customers, digital payment solutions and opportunities to grow.',
    ms: 'Kami ingin memahami perniagaan anda dengan lebih baik supaya kami dapat menghubungkan anda dengan lebih ramai pelanggan, penyelesaian pembayaran digital dan peluang untuk berkembang.' },
  thanks: { en: 'Thank you for being part of +Onz! Your responses will help us understand your business and connect you with relevant opportunities to grow.',
    ms: 'Terima kasih kerana menjadi sebahagian daripada +Onz! Jawapan anda akan membantu kami memahami perniagaan anda dan menghubungkan anda dengan peluang yang berkaitan untuk berkembang.' },
};

// type: single (radio), multi (checkboxes), text, tel, consent (one tick box, true/false). other: adds an "Other" box.
// max: most choices for multi. showIf: [questionId, [codes]], asked only when that answer is one of the codes.
// requiredIf: like required, but only while the question is shown. prefill: 'merchantName' or 'ownerName'.
const PICK3 = { en: 'Select up to three.', ms: 'Pilih sehingga tiga.' };
const ALL = { en: 'Select all that apply.', ms: 'Pilih semua yang berkenaan.' };
const IF_INTERESTED = ['financing', ['later', 'looking']];
export const STALL_QUESTIONS = [
  // A. Business profile
  { id: 'name', n: 1, section: 'profile', type: 'text', required: true, max: 80, prefill: 'merchantName', en: 'Business or stall name', ms: 'Nama perniagaan atau kedai' },
  { id: 'location', n: 1, section: 'profile', type: 'single', required: true, other: true, en: 'Location', ms: 'Lokasi', options: [
    ...KK_AREAS, ...FACULTY_AREAS, o('KPS', 'KPS (Kompleks Perdanasiswa)')] },
  { id: 'type', n: 2, section: 'profile', type: 'single', required: true, other: true, en: 'What type of business do you operate?', ms: 'Apakah jenis perniagaan anda?', options: [
    o('food', 'Food and beverages', 'Makanan dan minuman'), o('retail', 'Retail or groceries', 'Runcit atau barangan harian'),
    o('coffee', 'Coffee and snacks', 'Kopi dan snek'), o('printing', 'Printing and stationery', 'Cetakan dan alat tulis'),
    o('services', 'Services (laundry, repairs, etc.)', 'Servis (dobi, baiki, dll.)'), o('vending', 'Vending machines', 'Mesin layan diri'),
    o('onlineEvent', 'Online or event vendor', 'Penjual online atau event')] },
  { id: 'age', n: 3, section: 'profile', type: 'single', required: true, en: 'How long has your business been operating?', ms: 'Sudah berapa lama perniagaan anda beroperasi?', options: [
    o('u6m', 'Below 6 months', 'Kurang 6 bulan'), o('6to12m', '6 months to 1 year', '6 bulan hingga 1 tahun'), o('1to3y', '1 to 3 years', '1 hingga 3 tahun'),
    o('3to5y', '3 to 5 years', '3 hingga 5 tahun'), o('o5y', 'Above 5 years', 'Lebih 5 tahun')] },
  { id: 'registered', n: 4, section: 'profile', type: 'single', required: true, en: 'Is your business formally registered?', ms: 'Adakah perniagaan anda berdaftar secara rasmi?', options: [
    o('sole', 'Sole proprietorship or enterprise', 'Milikan tunggal atau enterprise'), o('partnership', 'Partnership', 'Perkongsian'),
    o('sdnbhd', 'Sdn. Bhd.'), o('otherEntity', 'Other registered entity', 'Entiti berdaftar lain'),
    o('no', 'Not registered', 'Tidak berdaftar'), o('notSure', 'Not sure', 'Tidak pasti')] },

  // B. Digital and financial readiness
  { id: 'payments', n: 5, section: 'readiness', type: 'multi', required: true, hint: ALL, en: 'Which payment methods do you currently accept?', ms: 'Kaedah bayaran apa yang anda terima sekarang?', options: [
    o('cash', 'Cash', 'Tunai'), o('personalQr', 'Personal DuitNow QR', 'DuitNow QR peribadi'), o('businessQr', 'Business DuitNow QR', 'DuitNow QR perniagaan'),
    o('card', 'Debit or credit card', 'Kad debit atau kredit'), o('ewallet', 'E-wallet (TNG, Boost, GrabPay, etc.)', 'E-wallet (TNG, Boost, GrabPay, dll.)'),
    o('banking', 'Online banking or transfers', 'Perbankan dalam talian atau pindahan')] },
  { id: 'banks', n: 6, section: 'readiness', type: 'multi', required: true, other: true, hint: ALL, en: 'Which bank or payment provider do you currently use?', ms: 'Bank atau penyedia pembayaran mana yang anda gunakan sekarang?', options: [
    o('maybank', 'Maybank'), o('cimb', 'CIMB'), o('rhb', 'RHB'), o('bankislam', 'Bank Islam'), o('hongleong', 'Hong Leong'),
    o('publicbank', 'Public Bank'), o('bsn', 'BSN'), o('muamalat', 'Bank Muamalat'), o('tng', 'TNG Digital'), o('boost', 'Boost')] },
  { id: 'bizAccount', n: 7, section: 'readiness', type: 'single', required: true, en: 'Do you have a dedicated business bank account?', ms: 'Adakah anda mempunyai akaun bank khas untuk perniagaan?', options: [
    o('yes', 'Yes', 'Ya'), o('personal', 'No, I use my personal account', 'Tidak, saya guna akaun peribadi'),
    o('opening', 'In the process of opening one', 'Sedang dalam proses membukanya'), o('notSure', 'Not sure', 'Tidak pasti')] },
  { id: 'records', n: 8, section: 'readiness', type: 'single', required: true, en: 'How do you currently record your business sales and expenses?', ms: 'Bagaimana anda merekod jualan dan perbelanjaan perniagaan sekarang?', options: [
    o('manual', 'Manual records or notebook', 'Rekod manual atau buku nota'), o('sheets', 'Excel or Google Sheets', 'Excel atau Google Sheets'),
    o('bank', 'Bank transaction records', 'Rekod transaksi bank'), o('pos', 'POS or accounting software', 'POS atau perisian perakaunan'),
    o('none', 'I do not regularly maintain records', 'Saya tidak menyimpan rekod secara tetap')] },
  { id: 'customers', n: 9, section: 'readiness', type: 'single', required: true, en: 'Approximately how many customers do you serve daily?', ms: 'Anggaran berapa ramai pelanggan yang anda layan setiap hari?', options: [
    o('u50', 'Below 50', 'Kurang 50'), o('50to100', '50 to 100', '50 hingga 100'), o('101to200', '101 to 200', '101 hingga 200'), o('o200', 'Above 200', 'Lebih 200')] },
  { id: 'challenges', n: 10, section: 'readiness', type: 'multi', required: true, max: 3, other: true, hint: PICK3, en: 'What are your biggest challenges in running your business?', ms: 'Apakah cabaran terbesar anda dalam menjalankan perniagaan?', options: [
    o('traffic', 'Low customer traffic or sales', 'Pelanggan atau jualan rendah'), o('costs', 'High operating costs', 'Kos operasi tinggi'),
    o('cashflow', 'Cash flow difficulties', 'Masalah aliran tunai'), o('inventory', 'Inventory management', 'Pengurusan inventori'),
    o('labour', 'Labour or staffing', 'Tenaga kerja atau pekerja'), o('digital', 'Limited digital payment adoption', 'Penggunaan pembayaran digital yang terhad'),
    o('records', 'Lack of financial records', 'Kekurangan rekod kewangan'), o('financing', 'Difficulty accessing financing', 'Sukar mendapatkan pembiayaan')] },

  // C. Growth and financial needs
  { id: 'financing', n: 11, section: 'growth', type: 'single', required: true, en: 'Are you interested in business financing?', ms: 'Adakah anda berminat dengan pembiayaan perniagaan?', options: [
    o('no', 'Not interested', 'Tidak berminat'), o('later', 'Interested, but not immediately', 'Berminat, tetapi bukan sekarang'),
    o('looking', 'Currently looking for financing', 'Sedang mencari pembiayaan')] },
  { id: 'financingPurpose', n: 11, section: 'growth', type: 'multi', requiredIf: true, showIf: IF_INTERESTED, other: true, hint: ALL, en: 'What would you need it for?', ms: 'Untuk apa anda memerlukannya?', options: [
    o('working', 'Working capital', 'Modal kerja'), o('inventory', 'Inventory or stock', 'Inventori atau stok'),
    o('equipment', 'Equipment or renovation', 'Peralatan atau pengubahsuaian'), o('expansion', 'Business expansion', 'Pengembangan perniagaan'),
    o('digital', 'Digitalisation', 'Pendigitalan')] },
  { id: 'financingAmount', n: 11, section: 'growth', type: 'single', showIf: IF_INTERESTED, hint: { en: 'Optional.', ms: 'Pilihan.' }, en: 'Estimated financing requirement', ms: 'Anggaran keperluan pembiayaan', options: [
    o('u5k', 'Below RM5,000', 'Kurang RM5,000'), o('5to10k', 'RM5,000 to RM10,000', 'RM5,000 hingga RM10,000'), o('10to30k', 'RM10,001 to RM30,000', 'RM10,001 hingga RM30,000'),
    o('30to50k', 'RM30,001 to RM50,000', 'RM30,001 hingga RM50,000'), o('o50k', 'Above RM50,000', 'Lebih RM50,000'), o('notSure', 'Not sure', 'Tidak pasti')] },
  { id: 'priorities', n: 12, section: 'growth', type: 'multi', required: true, max: 2, hint: { en: 'Select up to two.', ms: 'Pilih sehingga dua.' }, en: 'What is your biggest business priority over the next 12 months?', ms: 'Apakah keutamaan terbesar perniagaan anda dalam 12 bulan akan datang?', options: [
    o('sales', 'Increase sales and customer base', 'Meningkatkan jualan dan bilangan pelanggan'), o('cashflow', 'Improve cash flow', 'Memperbaiki aliran tunai'),
    o('expand', 'Expand business operations', 'Mengembangkan operasi perniagaan'), o('digital', 'Improve digital payment adoption', 'Meningkatkan penggunaan pembayaran digital'),
    o('management', 'Improve business management', 'Memperbaiki pengurusan perniagaan'), o('costs', 'Reduce operating costs', 'Mengurangkan kos operasi'),
    o('register', 'Formalise or register my business', 'Merasmikan atau mendaftarkan perniagaan saya'), o('online', 'Expand online presence', 'Meluaskan kehadiran dalam talian')] },
  { id: 'support', n: 13, section: 'growth', type: 'multi', required: true, max: 3, other: true, hint: PICK3, en: 'What kind of support would benefit your business most?', ms: 'Sokongan jenis apa yang paling bermanfaat untuk perniagaan anda?', options: [
    o('qr', 'Business QR or digital payment setup', 'Setup Business QR atau pembayaran digital'), o('literacy', 'Financial literacy and cash flow management', 'Celik kewangan dan pengurusan aliran tunai'),
    o('bookkeeping', 'Bookkeeping and accounting training', 'Latihan simpan kira dan perakaunan'), o('financing', 'Business financing opportunities', 'Peluang pembiayaan perniagaan'),
    o('marketing', 'Marketing and customer acquisition', 'Pemasaran dan mendapatkan pelanggan'), o('operations', 'Business operations and inventory management', 'Operasi perniagaan dan pengurusan inventori'),
    o('registration', 'Business registration support', 'Sokongan pendaftaran perniagaan'), o('equipment', 'Equipment and technology support', 'Sokongan peralatan dan teknologi'),
    o('takaful', 'Insurance or takaful awareness', 'Kesedaran insurans atau takaful')] },

  // D. Onboarding and consent
  { id: 'listing', n: 14, section: 'consent', type: 'single', required: true, en: 'Would you like your business to be listed on +Onz and be introduced to relevant business development opportunities?', ms: 'Adakah anda mahu perniagaan anda disenaraikan di +Onz dan diperkenalkan kepada peluang pembangunan perniagaan yang berkaitan?', options: [
    o('yes', 'Yes', 'Ya'), o('maybe', 'Maybe, tell me more', 'Mungkin, ceritakan lagi'), o('no', 'No', 'Tidak')] },
  { id: 'ownerName', n: 15, section: 'consent', type: 'text', required: true, max: 80, prefill: 'ownerName', en: 'Business owner’s or representative’s name', ms: 'Nama pemilik atau wakil perniagaan' },
  { id: 'whatsapp', n: 15, section: 'consent', type: 'tel', max: 20, en: 'WhatsApp number', ms: 'Nombor WhatsApp', hint: { en: 'Optional. Only so +Onz can reach you.', ms: 'Pilihan. Hanya untuk +Onz menghubungi anda.' } },
  { id: 'consentContact', n: 15, section: 'consent', type: 'consent', lead: { en: 'Please indicate your preferences:', ms: 'Sila nyatakan pilihan anda:' }, en: 'I agree to be contacted by +Onz regarding merchant onboarding and business development programmes.',
    ms: 'Saya bersetuju untuk dihubungi oleh +Onz berkenaan pendaftaran peniaga dan program pembangunan perniagaan.' },
  { id: 'consentPartners', n: 15, section: 'consent', type: 'consent', en: 'I agree to be introduced to relevant financial partners regarding products and services suited to my business needs, with relevant information shared for this purpose.',
    ms: 'Saya bersetuju untuk diperkenalkan kepada rakan kewangan yang berkaitan berkenaan produk dan perkhidmatan yang sesuai dengan keperluan perniagaan saya, dengan maklumat berkaitan dikongsi untuk tujuan ini.',
    hint: { en: 'Declining partner introductions will not affect basic merchant registration.', ms: 'Menolak perkenalan rakan kongsi tidak akan menjejaskan pendaftaran asas peniaga.' } },
];
export const STALL_QUESTION_COUNT = 15;
export const STALL_QUIZ_COUNT = STALL_QUESTION_COUNT; // kept for older callers
const SHOWN = (q, answers) => !q.showIf || q.showIf[1].includes(answers[q.showIf[0]]);
export const stallQuestionShown = SHOWN;

// Stall types, shown at the end, from the most digital way the stall takes payment (question 5).
export const STALL_TYPES = {
  cash: { icon: 'wallet', en: 'Cash Classic', ms: 'Klasik Tunai',
    about: { en: 'Your customers mostly pay cash. A Business DuitNow QR lets students pay the way they already do, with no change to count.',
      ms: 'Pelanggan anda kebanyakannya bayar tunai. Business DuitNow QR membolehkan pelajar bayar cara yang mereka biasa, tanpa perlu kira baki.' } },
  personalQr: { icon: 'qr-code', en: 'QR Starter', ms: 'Perintis QR',
    about: { en: 'Students can already pay you digitally. A Business QR keeps shop money separate and gives you sales records.',
      ms: 'Pelajar sudah boleh bayar anda secara digital. Business QR mengasingkan wang kedai dan memberi anda rekod jualan.' } },
  businessQr: { icon: 'badge-check', en: 'QR Ready', ms: 'Sedia QR',
    about: { en: 'You have a Business QR. Now let more students find you and come back.',
      ms: 'Anda sudah ada Business QR. Sekarang biar lebih ramai pelajar jumpa anda dan datang semula.' } },
  card: { icon: 'scan-line', en: 'All-in Digital', ms: 'Serba Digital',
    about: { en: 'You take cards and QR. You’re ready for live deals and campus promotion.',
      ms: 'Anda terima kad dan QR. Anda sedia untuk tawaran langsung dan promosi kampus.' } },
};
export function stallType(answers = {}) {
  if (answers.style && STALL_TYPES[answers.style]) return answers.style; // version 1 answers
  const p = new Set([].concat(answers.payments || []));
  if (p.has('card') && (p.has('businessQr') || p.has('personalQr'))) return 'card';
  if (p.has('businessQr')) return 'businessQr';
  if (p.has('personalQr') || p.has('ewallet') || p.has('banking') || p.has('card')) return 'personalQr';
  return 'cash';
}

// What the team can help with, from the answers. Nothing here promises fees, bonuses or loans, and partner introductions
// only appear when the merchant agreed to them.
export function stallSetup(answers = {}) {
  const has = (k, v) => [].concat(answers[k] || []).includes(v);
  const type = stallType(answers); const partners = answers.consentPartners === true; const out = [];
  if (type === 'cash' || type === 'personalQr' || has('support', 'qr')) out.push({ en: 'Help setting up a Business DuitNow QR at your stall, with your bank.', ms: 'Bantuan setup Business DuitNow QR di kedai anda, bersama bank anda.' });
  if (partners && ['personal', 'opening', 'notSure'].includes(answers.bizAccount)) out.push({ en: 'An introduction to a bank that can help you open a business account.', ms: 'Perkenalan kepada bank yang boleh bantu anda membuka akaun perniagaan.' });
  if (partners && ['later', 'looking'].includes(answers.financing)) out.push({ en: 'An introduction to financing partners that suit what you need.', ms: 'Perkenalan kepada rakan pembiayaan yang sesuai dengan keperluan anda.' });
  if (has('support', 'literacy') || has('support', 'bookkeeping') || answers.records === 'none') out.push({ en: 'Simple ways to keep sales records, starting with your QR sales history.', ms: 'Cara mudah menyimpan rekod jualan, bermula dengan sejarah jualan QR anda.' });
  if (has('support', 'registration') || ['no', 'notSure'].includes(answers.registered)) out.push({ en: 'Pointers on registering your business.', ms: 'Panduan mendaftarkan perniagaan anda.' });
  if (answers.listing !== 'no') out.push({ en: 'Your stall on the +Onz campus map, so students can find you.', ms: 'Kedai anda di peta kampus +Onz, supaya pelajar boleh jumpa anda.' });
  if (has('support', 'marketing') || has('priorities', 'sales') || type === 'businessQr' || type === 'card') out.push({ en: 'Live deals that bring student customers to your stall.', ms: 'Tawaran langsung yang membawa pelanggan pelajar ke kedai anda.' });
  return out;
}

// ---------------------------------------------------------------- validation (mirrors firestore.rules)
const OTHER_MAX = 80;
export function cleanStallAnswers(raw = {}) {
  const out = {}; const errors = [];
  for (const q of STALL_QUESTIONS) {
    if (!SHOWN(q, out)) continue; // a follow-up nobody was asked
    const required = q.required || q.requiredIf;
    const codes = new Set((q.options || []).map((x) => x.code));
    let v = raw[q.id];
    if (q.type === 'multi') {
      v = [...new Set([].concat(v || []).map(String))].filter((c) => codes.has(c) || (q.other && c === 'other'));
      if (q.max && v.length > q.max) errors.push(q.id);
      if (required && !v.length) errors.push(q.id);
      if (v.length) out[q.id] = v;
    } else if (q.type === 'single') {
      v = String(v || '');
      if (!(codes.has(v) || (q.other && v === 'other'))) { if (required) errors.push(q.id); continue; }
      out[q.id] = v;
    } else if (q.type === 'consent') {
      out[q.id] = v === true || v === 'on' || v === 'true';
    } else {
      v = String(v || '').trim().slice(0, q.max || 80);
      if (q.type === 'tel') v = v.replace(/[^\d+ -]/g, '');
      if (required && v.length < 2) errors.push(q.id);
      if (v) out[q.id] = v;
    }
    if (q.other && [].concat(out[q.id] || []).includes('other')) {
      const text = String(raw[q.id + 'Other'] || '').trim().slice(0, OTHER_MAX);
      if (!text) errors.push(q.id + 'Other'); else out[q.id + 'Other'] = text;
    }
  }
  return { answers: out, errors };
}

// Answers from version 1 that carry over to version 2, so merchants who did the earlier quiz start part-filled.
export function stallPrefillFromV1(a = {}) {
  const out = {};
  if (a.area && STALL_QUESTIONS[1].options.some((x) => x.code === a.area)) out.location = a.area;
  else if (a.area === 'other' && a.areaOther) { out.location = 'other'; out.locationOther = a.areaOther; }
  const type = { food: 'food', coffee: 'coffee', groceries: 'retail', printing: 'printing', services: 'services', events: 'onlineEvent', online: 'onlineEvent' }[a.sell];
  if (type) out.type = type; else if (a.sell === 'other' && a.sellOther) { out.type = 'other'; out.typeOther = a.sellOther; }
  const pay = [].concat(a.payments || []).map((c) => ({ online: 'banking' }[c] || c)).filter((c) => ['cash', 'personalQr', 'businessQr', 'card', 'ewallet', 'banking'].includes(c));
  if (pay.length) out.payments = [...new Set(pay)];
  const bank = { maybank: 'maybank', cimb: 'cimb', bankislam: 'bankislam', rhb: 'rhb', hongleong: 'hongleong', publicbank: 'publicbank', bsn: 'bsn', tng: 'tng' }[a.bank];
  if (bank) out.banks = [bank]; else if (a.bank) { out.banks = ['other']; out.banksOther = a.bank === 'other' ? a.bankOther || '' : 'Bank Rakyat'; }
  const customers = { u50: 'u50', '50to100': '50to100', '100to200': '101to200', o200: 'o200' }[a.customers];
  if (customers) out.customers = customers;
  if (a.listing) out.listing = a.listing;
  if (a.whatsapp) out.whatsapp = a.whatsapp;
  return out;
}

// ---------------------------------------------------------------- analysis and export (admin)
export const stallLabel = (q, code, lang = 'en') => {
  if (code === 'other') return lang === 'ms' ? 'Lain-lain' : 'Other';
  const opt = (q.options || []).find((x) => x.code === code); return opt ? opt[lang] : String(code);
};
const pct = (count, total) => (total ? Math.round((count / total) * 100) : 0);
export const isCurrentStallSurvey = (s) => !!s && s.v === STALL_SURVEY_VERSION;

// responses: [{ answers, stallType }] for version 2. For each choice question: [{ code, label, count, pct }] with
// "Other" last; pct is the share of merchants who were asked that question (multi: who ticked it).
export function stallAnalysis(responses, lang = 'en') {
  const total = responses.length;
  const questions = STALL_QUESTIONS.filter((q) => q.options || q.type === 'consent').map((q) => {
    const asked = responses.filter((r) => SHOWN(q, r.answers || {}));
    if (q.type === 'consent') {
      const yes = asked.filter((r) => r.answers?.[q.id] === true).length;
      return { id: q.id, n: q.n, title: q[lang], type: q.type, answered: asked.length, others: [],
        rows: [{ code: 'yes', label: lang === 'ms' ? 'Bersetuju' : 'Agreed', count: yes, pct: pct(yes, asked.length) },
          { code: 'no', label: lang === 'ms' ? 'Tidak bersetuju' : 'Didn’t agree', count: asked.length - yes, pct: pct(asked.length - yes, asked.length) }] };
    }
    const counts = new Map([...q.options.map((x) => [x.code, 0]), ...(q.other ? [['other', 0]] : [])]);
    let answered = 0;
    for (const r of asked) {
      const v = [].concat(r.answers?.[q.id] || []); if (v.length) answered++;
      for (const c of v) if (counts.has(c)) counts.set(c, counts.get(c) + 1);
    }
    const others = q.other ? asked.map((r) => r.answers?.[q.id + 'Other']).filter(Boolean) : [];
    return { id: q.id, n: q.n, title: q[lang], type: q.type, answered, others,
      rows: [...counts].map(([code, count]) => ({ code, label: stallLabel(q, code, lang), count, pct: pct(count, answered) })) };
  });
  const types = Object.entries(STALL_TYPES).map(([code, t]) => {
    const count = responses.filter((r) => (r.stallType || stallType(r.answers)) === code).length;
    return { code, label: t[lang], count, pct: pct(count, total) };
  });
  const share = (test) => pct(responses.filter((r) => test(r.answers || {})).length, total);
  return { total, types, questions,
    headline: {
      qrReady: share((a) => [].concat(a.payments || []).some((c) => c === 'businessQr' || c === 'card')),
      noBizAccount: share((a) => a.bizAccount && a.bizAccount !== 'yes'),
      financing: share((a) => a.financing === 'later' || a.financing === 'looking'),
      listYes: share((a) => a.listing === 'yes'),
      partners: share((a) => a.consentPartners === true),
      contact: share((a) => a.consentContact === true),
      whatsapp: responses.filter((r) => r.answers?.whatsapp).length,
    } };
}

const cell = (q, a) => {
  const v = a?.[q.id];
  if (q.type === 'consent') return v === true ? 'Yes' : v === false ? 'No' : '';
  if (q.options) return [].concat(v || []).map((c) => stallLabel(q, c)).join('; ');
  return v ?? '';
};
function rowsFor(questions, responses) {
  const head = ['Submitted', 'Stall name (shop details)', 'Merchant status', 'Language used', 'Stall type',
    ...questions.flatMap((q) => [(q.n ? q.n + '. ' : '') + q.en, ...(q.other ? [(q.n ? q.n + '. ' : '') + q.en + ' (other)'] : [])])];
  const rows = responses.map((r) => [r.at ? new Date(r.at).toISOString().replace('T', ' ').slice(0, 16) : '', r.merchantName || '', r.merchantStatus || '',
    r.lang === 'ms' ? 'Bahasa Melayu' : 'English', STALL_TYPES[r.stallType || stallType(r.answers)]?.en || '',
    ...questions.flatMap((q) => [cell(q, r.answers), ...(q.other ? [r.answers?.[q.id + 'Other'] || ''] : [])])]);
  return [head, ...rows];
}
// One row per merchant, in English, with their shop details first. Version 1 answers use the old questions.
export const stallResponseRows = (responses) => rowsFor(STALL_QUESTIONS, responses);
export const stallResponseRowsV1 = (responses) => rowsFor(STALL_QUESTIONS_V1, responses);
export function stallAnalysisRows(a) {
  const out = [['+Onz Merchant Assessment: analysis'], ['Responses', a.total],
    ['Already take Business QR or card', a.headline.qrReady + '%'], ['No dedicated business bank account yet', a.headline.noBizAccount + '%'],
    ['Interested in financing', a.headline.financing + '%'], ['Happy to be listed on +Onz', a.headline.listYes + '%'],
    ['Agreed to be contacted by +Onz', a.headline.contact + '%'], ['Agreed to financial partner introductions', a.headline.partners + '%'],
    ['Left a WhatsApp number', a.headline.whatsapp], [], ['Stall type', 'Merchants', '% of merchants'], ...a.types.map((t) => [t.label, t.count, t.pct + '%'])];
  for (const q of a.questions) {
    out.push([], [`${q.n}. ${q.title}` + (q.type === 'multi' ? ' (could pick more than one)' : ''), 'Merchants', `% of ${q.answered} answering`]);
    for (const r of q.rows) out.push([r.label, r.count, r.pct + '%']);
    if (q.others.length) out.push(['Other answers', q.others.join('; ')]);
  }
  return out;
}

// ---------------------------------------------------------------- version 1 (earlier quiz), for old answers only
const AREAS_V1 = [...KK_AREAS, ...FACULTY_AREAS, o('PPUM', 'PPUM'), o('LaPalmas', 'La Palmas'), o('outside', 'Outside campus (within 100 m)', 'Luar kampus (dalam 100 m)')];
export const STALL_QUESTIONS_V1 = [
  { id: 'area', other: true, en: 'Area', options: AREAS_V1 },
  { id: 'mid', en: 'Merchant ID or Terminal ID' },
  { id: 'peakQr', en: '10-minute peak count: QR' }, { id: 'peakCash', en: '10-minute peak count: Cash' }, { id: 'peakCard', en: '10-minute peak count: Card' },
  { id: 'sell', other: true, en: 'What do you sell?', options: [o('food', 'Food and drinks'), o('coffee', 'Coffee and snacks'), o('groceries', 'Groceries and daily needs'),
    o('printing', 'Printing and stationery'), o('services', 'Services (laundry, repairs)'), o('events', 'I sell at events and bazaars'), o('online', 'I sell online')] },
  { id: 'customers', en: 'How many customers a day?', options: [o('u50', 'Under 50'), o('50to100', '50 to 100'), o('100to200', '100 to 200'), o('o200', 'Over 200')] },
  { id: 'style', en: 'Which one sounds most like you?', options: [o('cash', 'Mostly cash'), o('personalQr', 'Customers scan my own DuitNow QR'),
    o('businessQr', 'I have a Business QR from my bank or e-wallet'), o('card', 'We have a card machine')] },
  { id: 'payments', en: 'Any other ways you take payment?', options: [o('cash', 'Cash'), o('personalQr', 'Personal QR'), o('businessQr', 'Business QR'), o('card', 'Card'),
    o('online', 'Online (Shopee, TikTok Shop)'), o('ewallet', 'E-wallet (TNG, Boost, ShopeePay, GrabPay)')] },
  { id: 'bank', other: true, en: 'Your main bank or e-wallet?', options: [o('maybank', 'Maybank'), o('cimb', 'CIMB'), o('bankislam', 'Bank Islam'), o('rhb', 'RHB'),
    o('hongleong', 'Hong Leong'), o('publicbank', 'Public Bank'), o('bsn', 'BSN'), o('bankrakyat', 'Bank Rakyat'), o('tng', 'TNG eWallet')] },
  { id: 'barriers', en: 'What stops you using (more) QR?', options: [o('fees', 'Fees'), o('setup', 'Setup is a hassle'), o('internet', 'Slow internet'),
    o('cashCustomers', 'My customers prefer cash'), o('tax', 'Worried about tax'), o('dontKnow', 'Don’t know how'), o('none', 'Nothing, I’m fine')] },
  { id: 'help', other: true, en: 'What would help you most?', options: [o('qrSetup', 'Free QR setup at my stall'), o('zeroFees', 'Zero fees'), o('students', 'More student customers'),
    o('socials', 'Deals promoted on UM socials'), o('records', 'Sales records for a loan'), o('cashBonus', 'A cash bonus')] },
  { id: 'trade', en: 'When do you trade?', options: [o('daily', 'Every day'), o('weekdays', 'Weekdays only'), o('semester', 'Semester only'), o('events', 'Events only')] },
  { id: 'listing', en: 'Can we list your stall for UM’s count and in +Onz?', options: [o('yes', 'Yes'), o('maybe', 'Maybe, tell me more'), o('no', 'No thanks')] },
  { id: 'bankHelp', en: 'Do you need bank assistance to register for an SME or business account?', options: [o('yes', 'Yes, I really need help'), o('maybe', 'Maybe, tell me more'), o('no', 'No thanks, I already have one')] },
  { id: 'whatsapp', en: 'WhatsApp number' },
];
