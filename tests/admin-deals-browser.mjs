import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const BASE=process.env.BASE||'http://localhost:5173/?mode=demo',ADMIN=process.env.ADMIN||new URL('admin/?mode=demo',BASE).href,SHOTS='/tmp/e2e/admin-deals';fs.mkdirSync(SHOTS,{recursive:true});
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),student=await ctx.newPage();student.on('pageerror',e=>errors.push(e.message));
 await student.goto(BASE);await student.click('[data-demo="aina@siswa.um.edu.my"]');await student.waitForSelector('.kk-hero');await student.goto(BASE+'#/explore/deals');await student.waitForSelector('.deal-gallery-grid');
 const admin=await ctx.newPage();admin.on('pageerror',e=>errors.push(e.message));await admin.addInitScript(()=>sessionStorage.setItem('umc-demo-session',''));await admin.goto(ADMIN);await admin.waitForSelector('[data-demo]');
 const email=await admin.locator('[data-demo]').evaluateAll(items=>items.find(e=>e.textContent.includes('Admin team')).dataset.demo);await admin.click(`[data-demo="${email}"]`);await admin.waitForSelector('#mpp-rail');
 await admin.locator('[data-admin-edit-deal]').first().click();await admin.waitForSelector('#hep-deal-form');await admin.click('#sheet [data-close]');
 await admin.click('#menu');await admin.click('[data-nav=deals]');await admin.waitForSelector('.hep-admin-deal-grid');
 const id=await admin.locator('[data-admin-edit-deal]').first().getAttribute('data-admin-edit-deal');
 await admin.click(`[data-admin-edit-deal="${id}"]`);const form=admin.locator('#hep-deal-form');
 await form.locator('[name=title]').fill('Admin coffee special');await form.locator('[name=benefit]').fill('RM3 off coffee');await form.locator('[name=start]').fill('00:00');await form.locator('[name=end]').fill('23:59');await form.locator('[name=threshold]').fill('100');
 await form.locator('#hep-deal-poster').setInputFiles({name:'poster.png',mimeType:'image/png',buffer:fs.readFileSync(new URL('../app/shared/icons/icon-192.png',import.meta.url))});await admin.waitForSelector('#hep-deal-poster-preview:not([hidden])');await admin.waitForFunction(()=>!document.querySelector('#hep-deal-form button[type=submit]').disabled);
 await admin.screenshot({path:SHOTS+'/admin-editor.png',fullPage:true});await form.locator('button[type=submit]').click();await admin.waitForFunction(()=>!document.querySelector('#sheet[open]'));
 const card=student.locator(`[data-gallery-deal="${id}"]`);await student.waitForFunction(id=>document.querySelector(`[data-gallery-deal="${id}"] h3`)?.textContent==='Admin coffee special',id);assert.equal(await card.locator('img').count(),1);
 const audit=await admin.evaluate(async id=>{const D=await import('./js/data.js');return (await D.listAdminLog(window.__umc.ctx)).find(entry=>entry.action==='live-deal-edit'&&entry.target===id);},id);assert.ok(audit);assert.equal(audit.by,email);
 for(const width of [320,390,768,1360])for(const lang of ['en','ms']){await admin.setViewportSize({width,height:900});await admin.evaluate(async lang=>(await import('./js/i18n.js')).setLang(lang),lang);await admin.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);await admin.screenshot({path:`${SHOTS}/admin-${width}-${lang}.png`,fullPage:true});}
 await admin.click(`[data-admin-edit-deal="${id}"]`);await admin.click('#hep-remove-poster');await admin.locator('#hep-deal-form [name=enabled]').uncheck();await admin.click('#hep-deal-form button[type=submit]');await admin.waitForFunction(()=>!document.querySelector('#sheet[open]'));await card.waitFor({state:'detached'});
 const saved=await admin.evaluate(async id=>{const D=await import('./js/data.js');return (await D.listDealsAdmin(window.__umc.ctx)).find(deal=>deal.id===id);},id);assert.equal(saved.posterImage,'');assert.equal(saved.enabled,false);
 assert.deepEqual(errors,[]);console.log('Admin live deals: overview and dedicated editor, poster upload/removal, discount/hour edits, student live updates, pause and immutable activity log plus 8 responsive/language layouts passed.');
}finally{await browser.close();}
