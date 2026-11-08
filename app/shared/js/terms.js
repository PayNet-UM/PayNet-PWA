// +Onz Terms of Use and Privacy Notice (English and Bahasa Melayu).
// Every user accepts once: new users at sign-up, existing users the next time they open the app.
// Acceptance is saved on the user's profile as termsVersion + termsAcceptedAt (firestore.rules checks both).
// TERMS_VERSION lives in data.js; change it only for an important change: everyone is then asked to accept again.
import { $$, esc, sheet } from './ui.js';
import { TERMS_VERSION } from './data.js';

export { TERMS_VERSION };
export const TERMS_EFFECTIVE = { en: '8 November 2026', ms: '8 November 2026' };
// Who to contact about the programme and your data.
export const TERMS_CONTACT = {
  en: 'the +Onz team at admin@addonz.my',
  ms: 'pasukan +Onz di admin@addonz.my',
};

const T = {
  en: {
    title: 'Terms of Use and Privacy Notice',
    lead: 'Please read this before you use +Onz. It explains what we collect, why, who can see it and what you can do about it.',
    sections: [
      ['About +Onz', [
        '+Onz is Universiti Malaya’s campus app for students and campus businesses, run by Hal Ehwal Pelajar (HEP) with the student team, as part of PayNet Digital Campus 5.0.',
        'By creating an account or continuing to use +Onz, you agree to these terms and to us handling your data as described here, in line with Malaysia’s Personal Data Protection Act 2010 (PDPA).',
        '+Onz is for use in Malaysia only.',
      ]],
      ['Who can use +Onz', [
        ['Students of Universiti Malaya, signing in with their UM email or an email HEP allows. One account per matric number.',
          'Campus businesses and student ventures, after HEP approves their application.',
          'Use your real name and your own matric number. Don’t share your account.'],
      ]],
      ['What we collect', [
        ['Your account: name, email address and the Google account you sign in with. Students also give their matric number, residential college and faculty.',
          'Your activity in the app: your points history, lessons and quiz answers, your Money Check survey answers and score, the days you open the app, vouchers you redeem and points you donate.',
          'Welfare requests: the amount you ask for and the reason you write. Only you and HEP can see them.',
          'Optional social features: your username, avatar, friends and friend requests, and who invited you to +Onz.',
          'Campus map (optional, off unless you switch it on): when on, your friends can see that you’re at a campus shop for 2 hours.',
          'Businesses: business name, type, location pin, logo, contact phone number, account name and DuitNow QR image, plus offers and deals you submit.'],
        'Your phone’s location is used on your phone only, to show where you are on the map. It isn’t saved to your account. (The first pilot version saved your location at each check-in; those records are kept for HEP’s programme records only.)',
        'We never ask for your passwords, bank logins or card details. Google handles your sign-in.',
      ]],
      ['How we use it', [
        ['To run +Onz: your account, points, rewards, vouchers, welfare requests and friends.',
          'To show the college leaderboard, which uses college totals only, never individual students.',
          'To keep the programme fair: one account per matric number, and spotting misuse.',
          'To report how the programme is doing to Universiti Malaya and PayNet, as totals and summaries.',
          'To improve the app.'],
        'We don’t sell your data and we don’t use it for advertising.',
      ]],
      ['Who can see your data', [
        ['You can see your own profile, points, vouchers and requests.',
          'HEP admins can see profiles, points, vouchers and welfare requests to run and support the programme.',
          'A business sees your name on a voucher when you redeem it with them.',
          'Friends you accept see your username and avatar, and your campus map status if you switched it on.',
          'Everyone sees college totals on the leaderboard, not individual students.',
          'PayNet receives the list of participating businesses and their DuitNow QR details (Lampiran 1), and programme totals. They don’t get students’ personal details.',
          'Service providers that run the app for us: Google Firebase (sign-in, database and hosting) and map providers (Google Maps or OpenStreetMap) when you open the map. Their servers may be outside Malaysia, but your data is used only to run +Onz in Malaysia.'],
      ]],
      ['How we protect it', [
        ['Sign-in is handled by Google or by Firebase email sign-in, and admin accounts must verify their email.',
          'Data is encrypted between your phone and our servers.',
          'Database rules decide who can read and change each record, so the app can’t be used to see other people’s data.',
          'Only HEP admins can use the admin dashboard.'],
        'No system is perfectly secure. If you think someone else has used your account, tell HEP straight away.',
      ]],
      ['How long we keep it', [
        'We keep your data while the +Onz programme runs, then delete it or make it anonymous within 6 months after the programme ends, unless Universiti Malaya’s rules require us to keep records longer. Some data is temporary: campus map status disappears after 2 hours, and iPhone sign-in codes after a few minutes.',
      ]],
      ['Your choices and rights', [
        ['Correct your details: edit your profile in the app, or ask HEP.',
          'Switch off the campus map, remove friends, or change your avatar and username at any time.',
          'Ask HEP for a copy of your data, or to correct it.',
          'Withdraw your consent and delete your account at any time: go to Me, then “Delete my account”. Your account and personal details are deleted, or made anonymous in programme records, straight away, and HEP is told. Your points and unused vouchers are lost. Businesses send a closing request from the account menu, and HEP closes the account after settling any vouchers.'],
      ]],
      ['Points, rewards and vouchers', [
        ['Points have no cash value. They can’t be sold, swapped for money or moved to another person, except by donating to the welfare fund in the app.',
          'Rewards depend on stock and on each business’s own terms. Vouchers expire after the date shown.',
          'HEP may correct points that were given by mistake or gained by misuse.',
          'HEP may change or end the programme, its rewards or features. We’ll tell you in the app.'],
      ]],
      ['Fair use', [
        ['Don’t create fake accounts or use someone else’s matric number.',
          'Don’t try to cheat the points system or get around the app’s rules.',
          'Be respectful: no offensive names, usernames or avatars, and no harassing others through friend requests or waves.',
          'HEP may block accounts that break these terms.'],
      ]],
      ['For businesses', [
        ['Give accurate business, location and payment details.',
          'You’re responsible for your offers and deals, and for honouring vouchers students redeem with you.',
          'Use students’ names on vouchers only to redeem them.'],
      ]],
      ['Changes and contact', [
        'If we make an important change to these terms, we’ll show it in the app and ask you to agree again.',
        'Questions, requests about your data, or concerns: contact {contact}.',
      ]],
    ],
    agree: 'I agree', read: 'Read the Terms of Use and Privacy Notice', effective: 'Effective', version: 'Version',
  },
  ms: {
    title: 'Terma Penggunaan dan Notis Privasi',
    lead: 'Sila baca sebelum menggunakan +Onz. Ia menerangkan data yang kami kumpul, sebabnya, siapa yang boleh melihatnya dan apa yang boleh anda lakukan.',
    sections: [
      ['Tentang +Onz', [
        '+Onz ialah aplikasi kampus Universiti Malaya untuk pelajar dan perniagaan kampus, dikendalikan oleh Hal Ehwal Pelajar (HEP) bersama pasukan pelajar, sebagai sebahagian daripada PayNet Digital Campus 5.0.',
        'Dengan membuat akaun atau terus menggunakan +Onz, anda bersetuju dengan terma ini dan dengan cara kami mengendalikan data anda seperti yang diterangkan di sini, selaras dengan Akta Perlindungan Data Peribadi 2010 (PDPA).',
        '+Onz untuk kegunaan di Malaysia sahaja.',
      ]],
      ['Siapa boleh menggunakan +Onz', [
        ['Pelajar Universiti Malaya, log masuk dengan e-mel UM atau e-mel yang dibenarkan HEP. Satu akaun bagi setiap nombor matrik.',
          'Perniagaan kampus dan usaha niaga pelajar, selepas HEP meluluskan permohonan mereka.',
          'Gunakan nama sebenar dan nombor matrik anda sendiri. Jangan kongsi akaun anda.'],
      ]],
      ['Data yang kami kumpul', [
        ['Akaun anda: nama, alamat e-mel dan akaun Google yang anda gunakan untuk log masuk. Pelajar juga memberikan nombor matrik, kolej kediaman dan fakulti.',
          'Aktiviti anda dalam aplikasi: sejarah mata, pelajaran dan jawapan kuiz, jawapan dan skor tinjauan Semakan Wang, hari anda membuka aplikasi, baucar yang anda tebus dan mata yang anda dermakan.',
          'Permohonan kebajikan: jumlah yang anda mohon dan sebab yang anda tulis. Hanya anda dan HEP boleh melihatnya.',
          'Ciri sosial pilihan: nama pengguna, avatar, rakan dan permintaan rakan, serta siapa yang menjemput anda ke +Onz.',
          'Peta kampus (pilihan, tidak aktif melainkan anda menghidupkannya): apabila hidup, rakan anda boleh melihat anda berada di kedai kampus selama 2 jam.',
          'Perniagaan: nama perniagaan, jenis, pin lokasi, logo, nombor telefon, nama akaun dan imej QR DuitNow, serta tawaran dan promosi yang dihantar.'],
        'Lokasi telefon anda digunakan pada telefon anda sahaja, untuk menunjukkan kedudukan anda pada peta. Ia tidak disimpan dalam akaun anda. (Versi perintis pertama menyimpan lokasi anda pada setiap daftar masuk; rekod itu disimpan untuk rekod program HEP sahaja.)',
        'Kami tidak sekali-kali meminta kata laluan, log masuk bank atau butiran kad anda. Google mengendalikan log masuk anda.',
      ]],
      ['Cara kami menggunakannya', [
        ['Untuk menjalankan +Onz: akaun, mata, ganjaran, baucar, permohonan kebajikan dan rakan anda.',
          'Untuk memaparkan papan pendahulu kolej, yang menggunakan jumlah kolej sahaja, bukan pelajar individu.',
          'Untuk memastikan program adil: satu akaun bagi setiap nombor matrik, dan mengesan penyalahgunaan.',
          'Untuk melaporkan prestasi program kepada Universiti Malaya dan PayNet, dalam bentuk jumlah dan ringkasan.',
          'Untuk menambah baik aplikasi.'],
        'Kami tidak menjual data anda dan tidak menggunakannya untuk pengiklanan.',
      ]],
      ['Siapa boleh melihat data anda', [
        ['Anda boleh melihat profil, mata, baucar dan permohonan anda sendiri.',
          'Pentadbir HEP boleh melihat profil, mata, baucar dan permohonan kebajikan untuk menjalankan dan menyokong program.',
          'Perniagaan melihat nama anda pada baucar apabila anda menebusnya di sana.',
          'Rakan yang anda terima melihat nama pengguna dan avatar anda, serta status peta kampus jika anda menghidupkannya.',
          'Semua orang melihat jumlah kolej pada papan pendahulu, bukan pelajar individu.',
          'PayNet menerima senarai perniagaan yang menyertai serta butiran QR DuitNow mereka (Lampiran 1), dan jumlah program. Mereka tidak mendapat butiran peribadi pelajar.',
          'Penyedia perkhidmatan yang menjalankan aplikasi untuk kami: Google Firebase (log masuk, pangkalan data dan pengehosan) dan penyedia peta (Google Maps atau OpenStreetMap) apabila anda membuka peta. Pelayan mereka mungkin berada di luar Malaysia, tetapi data anda hanya digunakan untuk menjalankan +Onz di Malaysia.'],
      ]],
      ['Cara kami melindunginya', [
        ['Log masuk dikendalikan oleh Google atau log masuk e-mel Firebase, dan akaun pentadbir mesti mengesahkan e-mel mereka.',
          'Data disulitkan antara telefon anda dan pelayan kami.',
          'Peraturan pangkalan data menentukan siapa boleh membaca dan mengubah setiap rekod, jadi aplikasi tidak boleh digunakan untuk melihat data orang lain.',
          'Hanya pentadbir HEP boleh menggunakan papan pemuka pentadbir.'],
        'Tiada sistem yang selamat sepenuhnya. Jika anda rasa orang lain telah menggunakan akaun anda, maklumkan kepada HEP dengan segera.',
      ]],
      ['Tempoh kami menyimpannya', [
        'Kami menyimpan data anda sepanjang program +Onz berjalan, kemudian memadam atau menjadikannya tanpa nama dalam tempoh 6 bulan selepas program tamat, melainkan peraturan Universiti Malaya memerlukan rekod disimpan lebih lama. Sesetengah data adalah sementara: status peta kampus hilang selepas 2 jam, dan kod log masuk iPhone selepas beberapa minit.',
      ]],
      ['Pilihan dan hak anda', [
        ['Betulkan butiran anda: sunting profil dalam aplikasi, atau minta HEP.',
          'Matikan peta kampus, buang rakan, atau tukar avatar dan nama pengguna pada bila-bila masa.',
          'Minta salinan data anda daripada HEP, atau minta ia dibetulkan.',
          'Tarik balik persetujuan dan padam akaun anda pada bila-bila masa: pergi ke Saya, kemudian “Padam akaun saya”. Akaun dan butiran peribadi anda dipadam, atau dijadikan tanpa nama dalam rekod program, serta-merta, dan HEP dimaklumkan. Mata dan baucar yang belum digunakan akan hilang. Perniagaan menghantar permintaan penutupan dari menu akaun, dan HEP menutup akaun selepas menyelesaikan baucar yang ada.'],
      ]],
      ['Mata, ganjaran dan baucar', [
        ['Mata tidak mempunyai nilai tunai. Ia tidak boleh dijual, ditukar dengan wang atau dipindahkan kepada orang lain, kecuali dengan menderma kepada tabung kebajikan dalam aplikasi.',
          'Ganjaran bergantung pada stok dan terma setiap perniagaan. Baucar tamat tempoh selepas tarikh yang ditunjukkan.',
          'HEP boleh membetulkan mata yang diberi secara silap atau diperoleh melalui penyalahgunaan.',
          'HEP boleh mengubah atau menamatkan program, ganjaran atau cirinya. Kami akan memaklumkan anda dalam aplikasi.'],
      ]],
      ['Penggunaan yang adil', [
        ['Jangan buat akaun palsu atau guna nombor matrik orang lain.',
          'Jangan cuba menipu sistem mata atau mengelak peraturan aplikasi.',
          'Hormati orang lain: tiada nama, nama pengguna atau avatar yang menyinggung, dan jangan ganggu orang lain melalui permintaan rakan atau lambaian.',
          'HEP boleh menyekat akaun yang melanggar terma ini.'],
      ]],
      ['Untuk perniagaan', [
        ['Berikan butiran perniagaan, lokasi dan pembayaran yang tepat.',
          'Anda bertanggungjawab atas tawaran dan promosi anda, dan menunaikan baucar yang ditebus pelajar di tempat anda.',
          'Gunakan nama pelajar pada baucar hanya untuk menebusnya.'],
      ]],
      ['Perubahan dan hubungi kami', [
        'Jika kami membuat perubahan penting pada terma ini, kami akan memaparkannya dalam aplikasi dan meminta persetujuan anda semula.',
        'Soalan, permintaan tentang data anda, atau kebimbangan: hubungi {contact}.',
      ]],
    ],
    agree: 'Saya bersetuju', read: 'Baca Terma Penggunaan dan Notis Privasi', effective: 'Berkuat kuasa', version: 'Versi',
  },
};

const pickLang = () => (document.documentElement.lang === 'ms' ? 'ms' : 'en');
export const termsText = (lang) => T[lang === 'ms' ? 'ms' : 'en'];

// The full text as HTML. data-no-i18n: each language is written out in full, not machine-swapped.
export function termsHTML(lang = pickLang()) {
  const t = termsText(lang); const contact = TERMS_CONTACT[lang === 'ms' ? 'ms' : 'en'];
  const para = (x) => (Array.isArray(x) ? `<ul>${x.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>` : `<p>${esc(x).replace('{contact}', esc(contact))}</p>`);
  return `<div class="terms" data-no-i18n lang="${lang}">
    <p class="lede">${esc(t.lead)}</p>
    ${t.sections.map(([h, body], i) => `<section><h3>${i + 1}. ${esc(h)}</h3>${body.map(para).join('')}</section>`).join('')}
    <p class="faint">${esc(t.effective)}: ${esc(TERMS_EFFECTIVE[lang === 'ms' ? 'ms' : 'en'])} · ${esc(t.version)} ${esc(TERMS_VERSION)}</p>
  </div>`;
}

// Language switch inside the terms (they're kept out of the app's automatic translation).
export function termsLangSwitch(lang) {
  return `<div class="terms-lang" role="group" aria-label="Language" data-no-i18n>
    <button type="button" class="${lang === 'en' ? 'on' : ''}" data-terms-lang="en">English</button>
    <button type="button" class="${lang === 'ms' ? 'on' : ''}" data-terms-lang="ms">Bahasa Melayu</button></div>`;
}
export function bindTermsLang(root, render) {
  $$('[data-terms-lang]', root).forEach((b) => { b.onclick = () => render(b.dataset.termsLang); });
}

// Read-only view (sign-in screen, onboarding link, Me page).
export function termsSheet() {
  const show = (lang) => {
    const el = sheet(`<h2 data-no-i18n>${esc(termsText(lang).title)}</h2>${termsLangSwitch(lang)}<div class="terms-scroll">${termsHTML(lang)}</div>`);
    bindTermsLang(el, show);
  };
  show(pickLang());
}
export { pickLang as termsLang };
