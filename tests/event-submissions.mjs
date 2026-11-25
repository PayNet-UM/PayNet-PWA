import {fileURLToPath} from 'node:url';
// Student -> HEP -> student gallery, through the real Demo UI and rules.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const BASE=process.env.BASE||'http://localhost:5173/?mode=demo',ADMIN=process.env.ADMIN||new URL('admin/?mode=demo',BASE).href;
const SHOTS=process.env.SHOTS||'/tmp/e2e/event-submissions';fs.mkdirSync(SHOTS,{recursive:true});
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),errors=[];
try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),student=await ctx.newPage();
  student.on('pageerror',e=>errors.push(e.message));
  await student.goto(BASE);await student.click('[data-demo="aina@siswa.um.edu.my"]');await student.waitForSelector('.kk-hero');
  await student.goto(BASE+'#/events');await student.waitForSelector('.event-gallery-grid');await student.click('[data-event-submit]');
  const form=student.locator('#event-submission-form'),title='Student Robotics Showcase (demo)';
  await form.locator('[name=name]').fill(title);await form.locator('[name=category]').selectOption('competitions');
  await form.locator('[name=start]').fill('2026-12-12');await form.locator('[name=end]').fill('2026-12-12');
  await form.locator('[name=time]').fill('10 am – 4 pm');await form.locator('[name=location]').fill('Dewan Tunku Canselor');
  await form.locator('[name=organiser]').fill('UM Robotics Society');await form.locator('[name=description]').fill('Meet student builders and explore their robotics projects.');
  await form.locator('[name=poster]').setInputFiles(fileURLToPath(new URL('../app/client/assets/feskum-2026/feed-03.jpg',import.meta.url)));
  await student.waitForSelector('#event-poster-preview:not([hidden])');
  await student.screenshot({path:SHOTS+'/student-form.png',fullPage:true});
  await form.locator('button[type=submit]').click();await student.waitForSelector('#view-my-events');await student.click('#view-my-events');
  await student.waitForFunction(()=>document.querySelector('#my-event-submissions')?.textContent.includes('Pending review'));
  await student.screenshot({path:SHOTS+'/student-pending.png',fullPage:true});await student.click('#sheet [data-close]');
  assert.equal(await student.locator('.event-gallery-card').filter({hasText:title}).count(),0);
  await student.click('[data-event-filter=competitions]');
  const admin=await ctx.newPage();admin.on('pageerror',e=>errors.push(e.message));
  await admin.addInitScript(()=>sessionStorage.setItem('umc-demo-session',''));await admin.goto(ADMIN);await admin.waitForSelector('[data-demo]');
  const adminEmail=await admin.locator('[data-demo]').evaluateAll(items=>items.find(e=>e.textContent.includes('Admin team')).dataset.demo);
  await admin.click(`[data-demo="${adminEmail}"]`);await admin.waitForSelector('#mpp-rail');await admin.goto(ADMIN+'#/campaigns');
  const pending=admin.locator('.event-submission-item').filter({hasText:title});await pending.locator('[data-review-event]').click();
  await admin.waitForSelector('#event-review-form');assert.ok((await admin.locator('.event-private-contact').textContent()).includes('aina@siswa.um.edu.my'));
  await admin.screenshot({path:SHOTS+'/hep-review.png',fullPage:true});await admin.click('#event-review-form button[value=approve]');
  await admin.waitForFunction(()=>!document.querySelector('#sheet[open]'));
  const published=student.locator('.event-gallery-card:visible').filter({hasText:title});await published.waitFor();
  assert.equal(await student.locator('[data-event-filter=competitions]').first().getAttribute('aria-pressed'),'true');
  assert.ok((await published.locator('img').getAttribute('src')).startsWith('data:image/jpeg;base64,'));
  const publicEvent=await student.evaluate(async()=>{const app=window.__umc;return (await (await import('./js/data.js')).listCampaigns(app.ctx)).find(c=>c.name==='Student Robotics Showcase (demo)');});
  assert.equal('contactEmail' in publicEvent,false);assert.equal('uid' in publicEvent,false);
  await published.locator('.event-gallery-hit').click();await student.waitForSelector('.event-proposal-details');
  assert.ok((await student.locator('.event-proposal-details').textContent()).includes('UM Robotics Society'));
  await student.screenshot({path:SHOTS+'/student-published.png',fullPage:true});await student.click('#sheet [data-close]');
  await student.click('[data-my-events]');await student.waitForFunction(()=>document.querySelector('#my-event-submissions')?.textContent.includes('Approved'));
  await student.click('#sheet [data-close]');
  // Declining returns useful feedback without exposing the event publicly.
  await student.click('[data-event-submit]');const second=student.locator('#event-submission-form');
  for(const [key,value] of Object.entries({name:'Venue pending (demo)',start:'2026-12-13',end:'2026-12-13',location:'TBC',organiser:'UM Robotics Society',description:'A second student event.'}))await second.locator(`[name=${key}]`).fill(value);
  await second.locator('[name=category]').selectOption('talks');await second.locator('button[type=submit]').click();await student.waitForSelector('#view-my-events');await student.click('#sheet [data-close]');
  await admin.locator('.event-submission-item').filter({hasText:'Venue pending (demo)'}).locator('[data-review-event]').click();
  await admin.click('#event-review-form button[value=reject]');await admin.waitForSelector('#event-review-form .event-form-error:not([hidden])');
  assert.equal(await admin.locator('#event-review-form button[value=reject]').isEnabled(),true);
  await admin.fill('#event-review-form [name=response]','Please confirm the venue.');await admin.click('#event-review-form button[value=reject]');await admin.waitForFunction(()=>!document.querySelector('#sheet[open]'));
  await student.click('[data-my-events]');await student.waitForFunction(()=>document.querySelector('#my-event-submissions')?.textContent.includes('Please confirm the venue.'));
  assert.equal(await student.locator('.event-gallery-card').filter({hasText:'Venue pending (demo)'}).count(),0);
  await student.click('#sheet [data-close]');
  for(const width of [320,390,1360]){
    await student.setViewportSize({width,height:844});
    for(const lang of ['en','ms']){
      await student.evaluate(async lang=>(await import('./js/i18n.js')).setLang(lang),lang);
      await student.click('[data-event-submit]');await student.waitForSelector('#event-submission-form');
      assert.ok(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.ok((await student.locator('#event-submission-form button[type=submit]').textContent()).includes(lang==='ms'?'Hantar untuk kelulusan':'Submit for approval'));
      await student.click('#sheet [data-close]');
    }
  }
  assert.deepEqual(errors,[]);console.log('Event submissions: form/poster, private pending status, HEP approval, live filtered gallery, rejection feedback and 6 responsive/language checks passed.');
}finally{await browser.close();}
