// Universal English / Bahasa Malaysia switch.
// The app is written in English; when Malay is on, every text node and the placeholder/aria-label/title
// attributes are translated in place, and a MutationObserver keeps newly rendered screens translated.
// Originals are remembered, so switching back to English is instant and loses no state.
import { MS } from './i18n-ms.js';

const KEY = 'umc-lang';
const DICT = new Map();
for (const line of MS.split('\n')) {
  const i = line.indexOf('|'); if (i < 1) continue;
  DICT.set(line.slice(0, i).trim(), line.slice(i + 1).trim());
}

const MONTHS = { January: 'Januari', February: 'Februari', March: 'Mac', April: 'April', May: 'Mei', June: 'Jun', July: 'Julai', August: 'Ogos', September: 'September', October: 'Oktober', November: 'November', December: 'Disember' };
const MON = { Jan: 'Jan', Feb: 'Feb', Mar: 'Mac', Apr: 'Apr', May: 'Mei', Jun: 'Jun', Jul: 'Jul', Aug: 'Ogo', Sep: 'Sep', Oct: 'Okt', Nov: 'Nov', Dec: 'Dis' };
const MONTH_RE = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g;
const dates = (s) => s.replace(MONTH_RE, (m) => MONTHS[m] || MON[m] || m).replace(/\b(\d{1,2}:\d{2}) ?(am|pm)\b/gi, (_, t, ap) => `${t} ${ap.toLowerCase() === 'am' ? 'pg' : 'ptg'}`);
const isDateish = (s) => /^[\d\s:,–\-]*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\d\s:,–\-]*|(?:am|pm)[\d\s:,–\-]*)+$/i.test(s) && /\d/.test(s);
const N = '([\\d,]+)';
const RM = '(RM[\\d.,]+)';

// [regex, (match groups…) => Malay]; t() translates a fragment recursively.
const PATTERNS = [
  [/^(\d+) students? here( right now\. People show here for 2 hours after they check out\.)?((?: · .+)*)$/, (n, long, rest) => `${n} pelajar di sini${long ? ' sekarang. Pelajar dipaparkan selama 2 jam selepas daftar keluar.' : ''}${(rest || '').replace(/ · (\d+) from (\S+)/, ' · $1 dari $2').replace(' · you’re here', ' · anda di sini')}`],
  [/^(.+) waved at you at (.+)$/, (a, b) => `${a} melambai kepada anda di ${b}`],
  [/^You’re on the campus map at (.+) for 2 hours\.$/, (a) => `Anda di peta kampus di ${a} selama 2 jam.`],
  [/^(\d+) students here at (.+)$/, (n, b) => `${n} pelajar di ${b}`],
  [/^Hi (.+)$/, (n) => `Hai ${n}`],
  [/^Google sign-in didn’t work \((.+)\)\. Try again, or use email and password\.$/, (c) => `Log masuk Google tidak berjaya (${c}). Cuba lagi, atau guna e-mel dan kata laluan.`],
  [new RegExp(`^${N} points?$`), (n) => `${n} mata`],
  [new RegExp(`^\\+${N} (?:pts|points)$`), (n) => `+${n} mata`],
  [new RegExp(`^${N} pts$`), (n) => `${n} mata`],
  [new RegExp(`^${N} more$`), (n) => `${n} lagi`],
  [new RegExp(`^${N} to (.+)$`), (n, l) => `${n} lagi ke ${t(l)}`],
  [/^(\d+)-day streak$/, (n) => `${n} hari berturut-turut`],
  [new RegExp(`^(${N}|${RM}) confirmed$`), (n) => `${n} disahkan`],
  [/^(\d+) min ago$/, (n) => `${n} minit lalu`],
  [/^(\d+) h ago$/, (n) => `${n} jam lalu`],
  [/^Last updated (.+)$/, (x) => `Kemas kini terakhir ${t(x)}`],
  [new RegExp(`^${RM} left this week\\.$`), (x) => `Baki ${x} minggu ini.`],
  [new RegExp(`^${RM} over your weekly goal\\.$`), (x) => `${x} melebihi sasaran mingguan anda.`],
  [new RegExp(`^Goal ${RM}$`), (x) => `Sasaran ${x}`],
  [new RegExp(`^${RM} in sales$`), (x) => `${x} jualan`],
  [new RegExp(`^${RM} paid out$`), (x) => `${x} telah dibayar`],
  [/^(.+) in ((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4})$/, (a, m) => `${t(a)} pada ${dates(m)}`],
  [/^App vs PayNet, (.+)$/, (m) => `Aplikasi lwn PayNet, ${dates(m)}`],
  [/^For (.+)\. A CSV with merchant name in the first column and transaction count in the second\.$/, (m) => `Untuk ${dates(m)}. Fail CSV dengan nama peniaga di lajur pertama dan bilangan transaksi di lajur kedua.`],
  [/^Opens (\d{1,2}:\d{2})$/, (x) => `Dibuka ${x}`],
  [/^Done (.+)$/, (x) => `Selesai ${t(x)}`],
  [/^Claim \+(\d+)$/, (n) => `Tuntut +${n}`],
  [/^Claim for (\d+) minutes$/, (n) => `Tuntut selama ${n} minit`],
  [/^All (\d+)$/, (n) => `Semua ${n}`],
  [/^(\d+) of (\d+)$/, (a, b) => `${a} daripada ${b}`],
  [/^of (\d+) signed up$/, (n) => `daripada ${n} yang mendaftar`],
  [/^(\d+) merchants?$/, (n) => `${n} peniaga`],
  [/^(\d+) merchants? to verify$/, (n) => `${n} peniaga untuk disahkan`],
  [/^(\d+) merchants? with QR images$/, (n) => `${n} peniaga dengan imej QR`],
  [/^(\d+) waiting for review$/, (n) => `${n} menunggu semakan`],
  [/^(\d+) made a first purchase$/, (n) => `${n} membuat pembelian pertama`],
  [/^(\d+) came back$/, (n) => `${n} kembali semula`],
  [/^(\d+) returning$/, (n) => `${n} berulang`],
  [/^(\d+) students? bought on 2 or more days$/, (n) => `${n} pelajar membeli pada 2 hari atau lebih`],
  [/^(\d+) vouchers? not yet used$/, (n) => `${n} baucar belum digunakan`],
  [/^(\d+) vouchers? used$/, (n) => `${n} baucar digunakan`],
  [/^(\d+) questions?$/, (n) => `${n} soalan`],
  [/^(\d+) of (\d+) finished the staff checklist$/, (a, b) => `${a} daripada ${b} telah melengkapkan senarai semak kakitangan`],
  [/^(\d+) signed up\. Adjust points to correct mistakes; every change is recorded with your note\.$/, (n) => `${n} telah mendaftar. Laraskan mata untuk membetulkan kesilapan; setiap perubahan direkodkan bersama nota anda.`],
  [/^(\d{1,2}:\d{2}) is your quietest hour\. A quiet-hour deal could bring students in then\.$/, (h) => `${h} ialah waktu paling lengang anda. Tawaran waktu lengang boleh menarik pelajar pada waktu itu.`],
  [/^quietest (.+)$/, (h) => `paling lengang ${h}`],
  [/^(\d+) left today$/, (n) => `baki ${n} hari ini`],
  [/^(\d+) left$/, (n) => `baki ${n}`],
  [/^valid (\d+) days$/, (n) => `sah ${n} hari`],
  [/^spend (RM[\d.,]+\+?)$/, (x) => `belanja ${x}`],
  [/^under (\d+%) full$/, (x) => `bawah ${x} penuh`],
  [/^(\d+)\/day$/, (n) => `${n}/hari`],
  [/^until (.+)$/, (x) => `hingga ${x}`],
  [/^ends (.+)$/, (x) => `tamat ${x}`],
  [/^(.+) \(ends (.+)\)$/, (a, b) => `${t(a)} (tamat ${b})`],
  [/^Students with a confirmed purchase \(of (\d+) signed up\)$/, (n) => `Pelajar dengan pembelian disahkan (daripada ${n} yang mendaftar)`],
  [/^Average knowledge score across (\d+) student money checks?$/, (n) => `Purata skor pengetahuan daripada ${n} semakan wang pelajar`],
  [/^Current balance ([\d,]+)\. Use a minus sign to remove points\.$/, (n) => `Baki semasa ${n}. Guna tanda tolak untuk membuang mata.`],
  [/^You have ([\d,]+) points\.$/, (n) => `Anda ada ${n} mata.`],
  [/^You’ll have ([\d,]+) points left\. The voucher is valid for (\d+) days\.$/, (a, b) => `Anda akan berbaki ${a} mata. Baucar sah selama ${b} hari.`],
  [/^Swap ([\d,]+) points for (.+)\?$/, (n, r) => `Tukar ${n} mata dengan ${r}?`],
  [/^You’ll earn (\d+) points? per RM1 after (.+) confirms the payment\.$/, (n, m) => `Anda akan mendapat ${n} mata bagi setiap RM1 selepas ${m} mengesahkan bayaran.`],
  [/^The cashier scans it and confirms the payment arrived\. You get (\d+) points? per RM1\.$/, (n) => `Juruwang mengimbasnya dan mengesahkan bayaran telah diterima. Anda dapat ${n} mata bagi setiap RM1.`],
  [/^Pay in your banking app first using (.+)’s DuitNow QR\. Max (RM[\d.,]+) per purchase\.$/, (m, x) => `Bayar dalam aplikasi perbankan anda dahulu menggunakan DuitNow QR ${m}. Maksimum ${x} setiap pembelian.`],
  [/^Scan (.+)’s DuitNow QR in your bank or e-wallet app\. Check the name and amount\.$/, (m) => `Imbas DuitNow QR ${m} dalam aplikasi bank atau e-dompet anda. Semak nama dan jumlah.`],
  [/^Pay (.+) with DuitNow QR, then open \+Onz and show your code at the counter\.$/, (m) => `Bayar ${m} dengan DuitNow QR, kemudian buka +Onz dan tunjukkan kod anda di kaunter.`],
  [/^Your purchases count for (.+)\.$/, (c) => `Pembelian anda dikira untuk ${c}.`],
  [/^after (RM[\d.,]+) set aside for campaigns$/, (x) => `selepas ${x} diperuntukkan untuk kempen`],
  [/^(.+) earned ([\d,]+) points for (RM[\d.,]+)\.$/, (s, n, x) => `${s} mendapat ${n} mata untuk ${x}.`],
  [/^Confirm and give ([\d,]+) points$/, (n) => `Sahkan dan beri ${n} mata`],
  [/^Confirmed by (.+)$/, (m) => `Disahkan oleh ${m}`],
  [/^code made (.+)$/, (x) => `kod dijana ${t(x)}`],
  [/^code (\w+)$/, (x) => `kod ${x}`],
  [/^used (.+)$/, (x) => `digunakan ${t(x)}`],
  [/^issued (.+)$/, (x) => `dikeluarkan ${t(x)}`],
  [/^worth (RM[\d.,]+)$/, (x) => `bernilai ${x}`],
  [/^not used yet$/, () => 'belum digunakan'],
  [/^Open my (student|merchant) app$/, (r) => `Buka aplikasi ${r === 'student' ? 'pelajar' : 'peniaga'} saya`],
  [/^Use “(.+)” \(\+(\d+) pts, spend (RM[\d.,]+)\+\)$/, (d, n, x) => `Guna “${d}” (+${n} mata, belanja ${x}+)`],
  [/^Purchases above (RM[\d.,]+) don’t earn points\.$/, (x) => `Pembelian melebihi ${x} tidak layak mendapat mata.`],
  [/^Thank you\. ([\d,]+) points given\.$/, (n) => `Terima kasih. ${n} mata telah diberi.`],
  [/^Correct\. \+(\d+) points$/, (n) => `Betul. +${n} mata`],
  [/^Voucher already used on (.+)\.$/, (x) => `Baucar sudah digunakan pada ${t(x)}.`],
  [/^Demo setup hit a problem: (.+)$/, (x) => `Persediaan demo menghadapi masalah: ${x}`],
  [/^Excel export failed: (.+)$/, (x) => `Eksport Excel gagal: ${x}`],
  [/^Adjust points for (.+)$/, (x) => `Laraskan mata untuk ${x}`],
  [/^Lampiran 1: DuitNow QR merchants$/, () => 'Lampiran 1: Peniaga DuitNow QR'],
  [/^([\d.,]+) (m|km) away$/, (n, u) => `${n} ${u} dari sini`],
  [/^(\d+) not on the map yet$/, (n) => `${n} belum ada pada peta`],
  [/^Pin placed \(accurate to about (\d+) m\)\. Drag it if it’s off\.$/, (n) => `Pin diletakkan (ketepatan kira-kira ${n} m). Seret jika tidak tepat.`],
  [/^Navigate to (.+)$/, (x) => `Navigasi ke ${x}`],
  [/^Map showing (.+)$/, (x) => `Peta menunjukkan ${x}`],
  [/^Where (.+) placed its shop$/, (x) => `Lokasi kedai ${x}`],
  [/^Again at (.+)$/, (x) => `Sekali lagi pada ${dates(x)}`],
  [/^At a \+Onz merchant\? Check in to earn (\d+) points\. Once every (\d+) hours per shop, up to (\d+) a day\.$/, (a, b, c) => `Di peniaga +Onz? Daftar masuk untuk mendapat ${a} mata. Sekali setiap ${b} jam bagi setiap kedai, sehingga ${c} sehari.`],
  [/^You’re at (.+)$/, (m) => `Anda di ${m}`],
  [/^Nearest: (.+), (.+)\. Walk over to check in\.$/, (m, d) => `Terdekat: ${m}, ${t(d)}. Berjalan ke sana untuk daftar masuk.`],
  [/^Accurate to about (\d+) m\. Step outside or wait a moment for a better fix\.$/, (n) => `Ketepatan kira-kira ${n} m. Keluar dari bangunan atau tunggu sebentar untuk lokasi yang lebih tepat.`],
  [/^Check in \+(\d+)$/, (n) => `Daftar masuk +${n}`],
  [/^Move closer to (.+) to check in\.$/, (m) => `Dekati ${m} untuk mendaftar masuk.`],
  [/^Checked in at (.+)$/, (m) => `Daftar masuk di ${m}`],
  [/^Use the map to find (.+)\.$/, (m) => `Guna peta untuk mencari ${m}.`],
  [/^Open Check in while you’re at the shop\. You get (\d+) points, once every (\d+) hours here\.$/, (a, b) => `Buka Daftar masuk semasa anda di kedai. Anda dapat ${a} mata, sekali setiap ${b} jam di sini.`],
  [/^(.+) accepts DuitNow QR\. Check the name and amount in your banking app before you pay\.$/, (m) => `${m} menerima DuitNow QR. Semak nama dan jumlah dalam aplikasi perbankan anda sebelum membayar.`],
  [/^Check in (\d{1,2}:\d{2})–(\d{1,2}:\d{2}) while it’s quiet$/, (a, b) => `Daftar masuk ${a}–${b} semasa lengang`],
  [/^One-minute lessons on spotting scams and budgeting, (\d+) points each\.$/, (n) => `Pelajaran satu minit tentang mengenal pasti penipuan dan bajet, ${n} mata setiap satu.`],
  [/^Your check-ins count for (.+)\.$/, (c) => `Daftar masuk anda dikira untuk ${c}.`],
  [/^([\d,]+) check-ins?$/, (n) => `${n} daftar masuk`],
  [/^(\d+) students?$/, (n) => `${n} pelajar`],
  [/^When a friend signs up with your code and checks in for the first time, you get (\d+) points and they get (\d+)\.$/, (a, b) => `Apabila rakan mendaftar dengan kod anda dan mendaftar masuk buat kali pertama, anda dapat ${a} mata dan mereka dapat ${b}.`],
  [/^You joined with code (.+)\.$/, (c) => `Anda menyertai dengan kod ${c}.`],
  [/^Find (.+) on \+Onz, check in when you arrive, and pay cashless with DuitNow QR\.$/, (m) => `Cari ${m} di +Onz, daftar masuk apabila tiba, dan bayar tanpa tunai dengan DuitNow QR.`],
  [/^(\d{1,2}:\d{2}) is your quietest hour\. A quiet-hour bonus could bring students in then\.$/, (h) => `${h} ialah waktu paling lengang anda. Bonus waktu lengang boleh menarik pelajar pada waktu itu.`],
  [/^Sent (.+)\. HEP will check that your QR name matches your business\.$/, (d) => `Dihantar ${dates(d)}. HEP akan menyemak nama QR anda sepadan dengan perniagaan anda.`],
  [/^PayNet merchant list is due on the 20th\. (\d+) days left this month\.$/, (n) => `Senarai peniaga PayNet perlu dihantar pada 20hb. Baki ${n} hari bulan ini.`],
  [/^Check-ins vs PayNet, (.+)$/, (m) => `Daftar masuk lwn PayNet, ${dates(m)}`],
  [/^([\d.]+) km from the last shop in (\d+) min$/, (k, m) => `${k} km dari kedai sebelumnya dalam ${m} minit`],
  [/^Rough location \(±(\d+) m\)$/, (n) => `Lokasi kurang tepat (±${n} m)`],
  [/^DuitNow QR transactions PayNet counted at listed merchants in (.+) \(import on Activity check\)$/, (m) => `Transaksi DuitNow QR yang dikira PayNet di peniaga tersenarai pada ${dates(m)} (import di Semakan aktiviti)`],
  [/^Student check-ins at merchants in (.+)$/, (m) => `Daftar masuk pelajar di peniaga pada ${dates(m)}`],
  [/^Students who checked in this month \(of (\d+) signed up\)$/, (n) => `Pelajar yang mendaftar masuk bulan ini (daripada ${n} yang mendaftar)`],
  [/^(\d+) students? checked in on 2 or more days$/, (n) => `${n} pelajar mendaftar masuk pada 2 hari atau lebih`],
  [/^(\d+) checked in for the first time$/, (n) => `${n} mendaftar masuk buat kali pertama`],
  [/^(Outfit colour|Hat and bag colour|Background) (\d+)$/, (a, n) => `${t(a)} ${n}`],
  [/^(.+) \(reach (.+)\)$/, (h, l) => `${t(h)} (capai tahap ${t(l)})`],
  [/^Reach (.+) level to unlock the (.+)\.$/, (l, h) => `Capai tahap ${t(l)} untuk membuka kunci ${t(h.charAt(0).toUpperCase() + h.slice(1)).toLowerCase()}.`],
  [/^\+(\d+) quiet-hour bonus included$/, (n) => `Termasuk bonus waktu lengang +${n}`],
  [/^\+(\d+) welcome bonus from your referral$/, (n) => `Bonus alu-aluan +${n} daripada rujukan anda`],
  [/^Map showing (.+)$/, (x) => `Peta menunjukkan ${x}`],
  [/^Reversed check-in at (.+) after review$/, (m) => `Daftar masuk di ${m} dibatalkan selepas semakan`],
  [/^(.+) loses (\d+) points from the check-in at (.+)\. This is recorded in their history\.$/, (a, n, m) => `${a} kehilangan ${n} mata daripada daftar masuk di ${m}. Ini direkodkan dalam sejarah mereka.`],
  [/^in ((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4})$/, (m) => `pada ${dates(m)}`],
  [/^(.+) \((\d+)\)$/, (a, n) => `${t(a)} (${n})`],
];

function t(src) {
  const s = src.trim(); if (!s) return src;
  if (DICT.has(s)) return DICT.get(s);
  for (const [re, fn] of PATTERNS) { const m = s.match(re); if (m) return fn(...m.slice(1)); }
  for (const sep of [' · ', ' / ', ' – ']) {
    if (s.includes(sep)) { const parts = s.split(sep); const out = parts.map((p) => t(p)); if (out.some((o, i) => o !== parts[i])) return out.join(sep); }
  }
  if (isDateish(s)) return dates(s);
  return s;
}
function translate(text) {
  const s = text.trim(); if (!s || !/[A-Za-z]/.test(s)) return text;
  const out = t(s); if (out === s) return text;
  const lead = text.match(/^\s*/)[0]; const trail = text.match(/\s*$/)[0];
  return lead + out + trail;
}

// ------------------------------------------------------------------ DOM
let lang = 'en';
try { lang = localStorage.getItem(KEY) || (/^ms\b/i.test(navigator.language || '') ? 'ms' : 'en'); } catch { /* storage blocked */ }
const ATTRS = ['placeholder', 'aria-label', 'title'];
const origText = new WeakMap(); const wroteText = new WeakMap();
const origAttr = new WeakMap();
const SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'NOSCRIPT']);
const skipped = (el) => !el || SKIP.has(el.nodeName) || (el.closest && el.closest('[data-no-i18n]'));
let busy = false;

function doText(node) {
  const p = node.parentElement; if (skipped(p)) return;
  if (wroteText.get(node) !== node.data) origText.set(node, node.data); // the app changed it: new original
  const orig = origText.get(node);
  if (p.nodeName === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', p.value); // keep form values in English
  const next = lang === 'ms' ? translate(orig) : orig;
  if (next !== node.data) node.data = next;
  wroteText.set(node, node.data);
}
function doEl(el) {
  if (skipped(el)) return;
  let o = origAttr.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a);
    if (!o) { o = {}; origAttr.set(el, o); }
    if (!(a in o) || (o['_' + a] !== cur)) o[a] = cur;
    const next = lang === 'ms' ? translate(o[a]) : o[a];
    if (next !== cur) el.setAttribute(a, next);
    o['_' + a] = next;
  }
}
function walk(root) {
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1 || skipped(root)) return;
  doEl(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === 1 && skipped(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
}
function run(fn) { busy = true; try { fn(); } finally { obs.takeRecords(); busy = false; } }
const obs = new MutationObserver((muts) => {
  if (busy) return;
  run(() => {
    for (const m of muts) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doEl(m.target);
      else m.addedNodes.forEach(walk);
    }
  });
});
let titleOrig = '';
function doTitle() { if (document.title !== titleWrote) titleOrig = document.title; const n = lang === 'ms' ? translate(titleOrig) : titleOrig; if (n !== document.title) document.title = n; titleWrote = document.title; }
let titleWrote = null;

export function getLang() { return lang; }
export function setLang(l) {
  lang = l === 'ms' ? 'ms' : 'en';
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  run(() => walk(document.body)); doTitle(); syncToggles();
}
export function tr(s) { return lang === 'ms' ? translate(String(s)) : String(s); }
export function langToggleHTML(extra = '') {
  return `<div class="lang-toggle ${extra}" role="group" aria-label="Language" data-no-i18n>
    <button type="button" data-lang-set="en" aria-pressed="${lang === 'en'}">EN</button><button type="button" data-lang-set="ms" aria-pressed="${lang === 'ms'}">BM</button></div>`;
}
function syncToggles() { document.querySelectorAll('[data-lang-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langSet === lang))); }

export function initI18n() {
  document.documentElement.lang = lang;
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  new MutationObserver(() => doTitle()).observe(document.querySelector('title') || document.head, { childList: true, characterData: true, subtree: true });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-lang-set]');
    if (b) { e.preventDefault(); e.stopPropagation(); setLang(b.dataset.langSet); }
  }, true);
  if (lang === 'ms') { run(() => walk(document.body)); doTitle(); }
}
export const _test = { translate: (s) => translate(s) };
