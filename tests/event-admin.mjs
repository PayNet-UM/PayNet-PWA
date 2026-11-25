import {fileURLToPath} from 'node:url';
// Real Demo UI: admin image editing -> live student gallery. No production writes.
import assert from 'node:assert/strict';import fs from 'node:fs';import {chromium} from 'playwright';
const BASE=process.env.BASE||'http://localhost:5173/?mode=demo',ADMIN=process.env.ADMIN||new URL('admin/?mode=demo',BASE).href;
const SHOTS=process.env.SHOTS||'/tmp/e2e/event-admin';fs.mkdirSync(SHOTS,{recursive:true});
const poster=page=>fileURLToPath(new URL(`../app/client/assets/feskum-2026/feed-${page}.jpg`,import.meta.url));
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:1360,height:960},reducedMotion:'reduce'}),student=await ctx.newPage();student.on('pageerror',e=>errors.push(e.message));
 await student.goto(BASE);await student.click('[data-demo="aina@siswa.um.edu.my"]');await student.waitForSelector('.kk-hero');await student.goto(BASE+'#/events');await student.waitForSelector('.event-gallery-grid');await student.click('[data-event-filter=summits]');
 const admin=await ctx.newPage();admin.on('pageerror',e=>errors.push(e.message));await admin.addInitScript(()=>sessionStorage.setItem('umc-demo-session',''));await admin.goto(ADMIN);await admin.waitForSelector('[data-demo]');
 const email=await admin.locator('[data-demo]').evaluateAll(items=>items.find(e=>e.textContent.includes('Admin team')).dataset.demo);await admin.click(`[data-demo="${email}"]`);await admin.waitForSelector('#mpp-rail');await admin.goto(ADMIN+'#/campaigns');await admin.waitForSelector('.event-admin-grid');
 await admin.waitForFunction(()=>{const img=document.querySelector('.event-admin-cover');return img?.complete&&img.naturalWidth>0;});
 await admin.click('#new');const form=admin.locator('#cf');await form.locator('[name=name]').fill('Campus Photo Summit (demo)');await form.locator('[name=description]').fill('Student talks and campus photography.');await form.locator('[name=category]').selectOption('summits');await form.locator('[name=start]').fill('2026-12-12');await form.locator('[name=end]').fill('2026-12-12');await form.locator('[name=time]').fill('10 am – 4 pm');await form.locator('[name=location]').fill('UM Library');await form.locator('[name=organiser]').fill('UM Student Society');
 await form.locator('#event-cover-input').setInputFiles(poster('03'));await admin.waitForSelector('#event-cover-preview img');await admin.waitForFunction(()=>!document.querySelector('#event-cover-input').disabled);
 await form.locator('#event-photos-input').setInputFiles([poster('04'),poster('07')]);await admin.waitForFunction(()=>document.querySelectorAll('#event-extra-previews img').length===2&&!document.querySelector('#event-photos-input').disabled);
 await admin.screenshot({path:SHOTS+'/admin-editor.png'});await form.locator('button.primary').click();await admin.waitForFunction(()=>!document.querySelector('#sheet[open]'));
 const studentCard=name=>student.locator('.event-gallery-card:visible').filter({hasText:name});
 await studentCard('Campus Photo Summit (demo)').waitFor();assert.equal(await student.locator('[data-event-filter=summits]').first().getAttribute('aria-pressed'),'true');
 await studentCard('Campus Photo Summit (demo)').locator('.event-gallery-hit').click();await student.waitForSelector('.event-photo-grid img');assert.equal(await student.locator('.event-photo-grid img').count(),2);assert.ok((await student.locator('.event-proposal-details').textContent()).includes('UM Student Society'));await student.screenshot({path:SHOTS+'/student-photos.png'});await student.click('#sheet [data-close]');
 const edit=async name=>{await admin.locator('.event-admin-card').filter({hasText:name}).locator('[data-c]').click();await admin.waitForSelector('#cf');};
 await edit('Campus Photo Summit (demo)');assert.equal(await admin.locator('#event-extra-previews img').count(),2);await admin.fill('#cf [name=name]','Campus Photo Summit updated (demo)');await admin.click('#remove-event-cover');await admin.locator('[data-remove-event-photo="0"]').click();await admin.click('#cf button.primary');await admin.waitForFunction(()=>!document.querySelector('#sheet[open]'));await studentCard('Campus Photo Summit updated (demo)').waitFor();assert.equal(await studentCard('Campus Photo Summit updated (demo)').locator('img').count(),0);
 await edit('Campus Photo Summit updated (demo)');assert.equal(await admin.locator('#event-extra-previews img').count(),1);await admin.uncheck('#cf [name=published]');await admin.click('#cf button.primary');await admin.waitForFunction(()=>!document.querySelector('#sheet[open]'));await studentCard('Campus Photo Summit updated (demo)').waitFor({state:'hidden'});
 await edit('Campus Photo Summit updated (demo)');await admin.check('#cf [name=published]');await admin.click('#cf button.primary');await admin.waitForFunction(()=>!document.querySelector('#sheet[open]'));await studentCard('Campus Photo Summit updated (demo)').waitFor();
 // Original supplied posters can also be edited, without creating duplicate cards.
 await admin.locator('[data-c="poster-4"]').click();await admin.fill('#cf [name=name]','FESKUM Bazaar revised (demo)');await admin.fill('#cf [name=start]','2099-11-04');await admin.fill('#cf [name=end]','2099-11-14');await admin.locator('#event-cover-input').setInputFiles(poster('06'));await admin.waitForFunction(()=>!document.querySelector('#event-cover-input').disabled);await admin.click('#cf button.primary');await admin.waitForFunction(()=>!document.querySelector('#sheet[open]'));await student.click('[data-event-filter=bazaars]');await studentCard('FESKUM Bazaar revised (demo)').waitFor();assert.equal(await student.locator('[data-event-open=poster-4]').count(),1);assert.ok((await student.locator('[data-event-open=poster-4] img').getAttribute('src')).startsWith('data:image/jpeg;'));
 await student.locator('[data-event-open=poster-4] .event-gallery-hit').click();await student.waitForSelector('.event-proposal-details');assert.ok((await student.locator('.event-proposal-details').textContent()).includes('FESKUM Bazaar revised'));await student.click('#sheet [data-close]');
 await admin.locator('[data-c="poster-4"]').click();await admin.click('#del');await admin.click('#sheet [data-yes]');await admin.waitForFunction(()=>!document.querySelector('#sheet[open]'));await student.waitForFunction(()=>!document.querySelector('[data-event-open=poster-4]')); // Restoring the expired original must remove it from the student gallery.
 await edit('Campus Photo Summit updated (demo)');await admin.click('#del');await admin.click('#sheet [data-yes]');await admin.waitForFunction(()=>!document.querySelector('#sheet[open]'));await admin.waitForFunction(()=>![...document.querySelectorAll('.event-admin-card h2')].some(h=>h.textContent.includes('Campus Photo Summit updated')));
 for(const width of [320,390,1360]){
  await admin.setViewportSize({width,height:844});
  for(const lang of ['en','ms']){
   await admin.evaluate(async lang=>(await import('./js/i18n.js')).setLang(lang),lang);await admin.click('[data-c="poster-4"]');await admin.waitForSelector('#cf');await admin.waitForTimeout(150);
   assert.ok((await admin.locator('#cf button.primary').textContent()).includes(lang==='ms'?'Simpan acara':'Save event'));
   assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await admin.click('#sheet [data-close]');
  }
 }
 assert.deepEqual(errors,[]);console.log('Admin events: cover/extra photos, edit/remove media, live publishing/hiding, original-poster edit/restore, deletion and 6 responsive/language checks passed.');
}finally{await browser.close();}
