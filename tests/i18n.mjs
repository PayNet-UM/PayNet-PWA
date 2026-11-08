// Regression checks for translated UI fragments and the language switch.
// No browser or network required.
import assert from 'node:assert/strict';

const observers = [];
globalThis.MutationObserver = class {
  constructor(callback) { this.callback = callback; observers.push(this); }
  observe() {}
  takeRecords() { return []; }
};
globalThis.NodeFilter = { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_REJECT: 2, FILTER_ACCEPT: 1 };
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
} });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'en-MY' } });

class Element {
  constructor(name, attrs = {}) {
    this.nodeType = 1; this.nodeName = name; this.attrs = { ...attrs }; this.children = [];
  }
  hasAttribute(name) { return name in this.attrs; }
  getAttribute(name) { return this.attrs[name]; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  get value() { return this.attrs.value ?? this.children.map((child) => child.data || '').join(''); }
  closest() { return this.hasAttribute('data-no-i18n') ? this : this.parentElement?.closest(); }
  append(child) { child.parentElement = this; this.children.push(child); return child; }
  text(data) { return this.append({ nodeType: 3, data }); }
}
const body = new Element('BODY');
globalThis.document = {
  body, documentElement: { lang: 'en' }, title: 'Friends · +Onz Student', head: {},
  addEventListener() {},
  querySelectorAll: () => [],
  querySelector: () => ({}),
  createTreeWalker(root, _show, filter) {
    const nodes = [];
    function visit(element) {
      for (const child of element.children || []) {
        if (filter.acceptNode(child) === NodeFilter.FILTER_REJECT) continue;
        nodes.push(child); visit(child);
      }
    }
    visit(root);
    let index = 0;
    return { nextNode: () => nodes[index++] || null };
  },
};

const { _test, initI18n, setLang, tr } = await import('../app/shared/js/i18n.js');
const { MS } = await import('../app/shared/js/i18n-ms.js');
let passed = 0;
function check(label, callback) { callback(); passed++; console.log('  ✓ ' + label); }
const translations = [
  ['Join +Onz, UM’s campus app for merchants, events and rewards. Use my code AINA-7K2Q for a welcome bonus: https://example.test/', 'Sertai +Onz, aplikasi kampus UM untuk peniaga, acara dan ganjaran. Gunakan kod saya AINA-7K2Q untuk mendapat bonus alu-aluan: https://example.test/'],
  ["Block Aina? They won't be able to earn or redeem until you unblock them.", 'Sekat Aina? Pelajar ini tidak dapat mengumpul atau menebus mata sehingga sekatan ditarik balik.'],
  ['Release matric number 23001234?', 'Lepaskan nombor matrik 23001234?'],
  ['Your circle', 'Rakan anda'],
  ['Friends', 'Rakan'],
  ['Request inbox', 'Peti permintaan'],
  ['Request sent', 'Permintaan dihantar'],
  ['Username copied', 'Nama pengguna disalin'],
  ['Copy username', 'Salin nama pengguna'],
  ['Live deals', 'Tawaran aktif'],
  ['Shop readiness', 'Kesediaan kedai'],
  ['Scan to claim', 'Imbas untuk menuntut'],
  ['Redeem with HEP/admin', 'Tebus melalui HEP/pentadbir'],
  ['QR expires in 75s', 'QR tamat tempoh dalam 75s'],
  ['Promote live deals', 'Promosikan tawaran aktif'],
  ['Ready to scan?', 'Sedia untuk mengimbas?'],
  ['28 seats free', '28 tempat duduk kosong'],
  ['3/4 completed', '3/4 selesai'],
  ['Café occupancy', 'Pengisian tempat duduk kafe'],
  ['Reporting month', 'Bulan pelaporan'],
  ['Financial Literacy', 'Literasi Kewangan'],
  ['Daily streak', 'Rentetan harian'],
  ['day running', 'hari berturut-turut'],
  ['Reach Explorer', 'Capai tahap Penjelajah'],
  ['Regular — ways to earn points', 'Pengguna tetap — cara mengumpul mata'],
  ['1-day streak. View your streak in Rewards', '1 hari berturut-turut. Lihat rentetan anda dalam Ganjaran'],
  ['2026-11-07, today, checked out', '2026-11-07, hari ini, telah daftar keluar'],
  ['3 lessons left · points per correct quiz, once per lesson.', '3 pelajaran berbaki · mata bagi jawapan kuiz yang betul, sekali bagi setiap pelajaran.'],
  ['+40 live deal bonus on this checkout', 'Bonus tawaran aktif +40 untuk daftar keluar ini'],
  ['11 of 12', '11 daripada 12'],
  ['1/12 claimed today', '1/12 dituntut hari ini'],
  ['12/40 seats taken · 40 bonus pts awarded', '12/40 tempat duduk digunakan · 40 mata bonus diberikan'],
  ['14:00–17:00 MYT · under 60% full · +40 pts', '14:00–17:00 Waktu Malaysia · bawah 60% penuh · +40 mata'],
  ['Review deals (2)', 'Semak tawaran (2)'],
  ['1 person here · 1 from KK3 · you’re here', '1 orang di sini · 1 dari KK3 · anda di sini'],
  ['Friends can see you on the campus map at Kopi Kolej for 2 hours.', 'Rakan boleh melihat kehadiran anda pada peta kampus di Kopi Kolej selama 2 jam.'],
  ['Show poster 3: Pre-FESKUM calendar', 'Paparkan poster 3: Kalendar Pra-FESKUM'],
  ['Booth F01, Dapur Kampus, Meals', 'Gerai F01, Dapur Kampus, Hidangan'],
  ['Food Fest · Row 2', 'Pesta makanan · Baris 2'],
  ['Position 3 · Aisle A', 'Kedudukan 3 · Laluan A'],
  ['Background 4', 'Latar belakang 4'],
  ['Your last result: 75/100', 'Keputusan terakhir anda: 75/100'],
  ['7 October 2026', '7 Oktober 2026'],
  ['8:00 pm', '8:00 malam'],
  ['12:30 pm', '12:30 tengah hari'],
];
console.log('Bahasa Melayu');
for (const [english, malay] of translations) {
  check(english, () => assert.equal(_test.translate(english), malay));
}
check('dictionary entries are well formed', () => {
  for (const line of MS.split('\n').filter((line) => line.includes('|'))) {
    const [english, malay] = line.split('|');
    assert.ok(english.trim() && malay.trim(), line);
  }
});
check('names, identifiers and amounts stay intact', () => {
  for (const value of ['@aina_um', 'AINA-7K2Q', '23001234', 'Kopi Kolej', 'RM5.00', 'HEP', 'PayNet', 'DuitNow QR']) {
    assert.equal(_test.translate(value), value);
  }
});

const label = body.append(new Element('P')).text('  Request sent  ');
const input = body.append(new Element('INPUT', { placeholder: '@username', 'aria-label': 'Find by username' }));
const image = body.append(new Element('IMG', { alt: 'Pre-FESKUM calendar — original FESKUM event poster' }));
const option = body.append(new Element('OPTION')); const optionText = option.text('Discount');
const user = body.append(new Element('SPAN', { 'data-no-i18n': '' })).text('Regular');
const button = body.append(new Element('BUTTON', { title: 'Copy username' }));
initI18n();
check('switch to Malay translates text, title and accessible attributes', () => {
  setLang('ms');
  assert.equal(label.data, '  Permintaan dihantar  ');
  assert.equal(input.getAttribute('placeholder'), '@nama_pengguna');
  assert.equal(input.getAttribute('aria-label'), 'Cari mengikut nama pengguna');
  assert.equal(document.title, 'Rakan · +Onz Pelajar');
  assert.equal(button.getAttribute('title'), 'Salin nama pengguna');
  assert.equal(image.getAttribute('alt'), 'Kalendar Pra-FESKUM — poster acara FESKUM asal');
  assert.equal(option.value, 'Discount');
  assert.equal(optionText.data, 'Diskaun');
  assert.equal(user.data, 'Regular');
});
check('new text and changing attributes translate after rendering', () => {
  label.data = 'Live now'; input.setAttribute('aria-label', 'Copy username');
  observers[0].callback([
    { type: 'characterData', target: label },
    { type: 'attributes', target: input },
  ]);
  assert.equal(label.data, 'Aktif sekarang');
  assert.equal(input.getAttribute('aria-label'), 'Salin nama pengguna');
  assert.equal(tr('Request sent'), 'Permintaan dihantar');
});
check('English restores current originals and form values', () => {
  setLang('en');
  assert.equal(label.data, 'Live now');
  assert.equal(input.getAttribute('placeholder'), '@username');
  assert.equal(input.getAttribute('aria-label'), 'Copy username');
  assert.equal(document.title, 'Friends · +Onz Student');
  assert.equal(image.getAttribute('alt'), 'Pre-FESKUM calendar — original FESKUM event poster');
  assert.equal(option.value, 'Discount');
  assert.equal(optionText.data, 'Discount');
  assert.equal(tr('Request sent'), 'Request sent');
});
console.log('\n' + passed + ' passed, 0 failed');
