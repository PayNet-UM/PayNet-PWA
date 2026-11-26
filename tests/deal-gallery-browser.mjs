import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const BASE=process.env.BASE||'http://localhost:5173/?mode=demo',SHOTS=process.env.SHOTS||'/tmp/e2e/deal-gallery';fs.mkdirSync(SHOTS,{recursive:true});
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const student=await ctx.newPage();student.on('pageerror',e=>errors.push(e.message));
 await student.goto(BASE);await student.click('[data-demo="aina@siswa.um.edu.my"]');await student.waitForSelector('.kk-hero');
 const merchant=await ctx.newPage();merchant.on('pageerror',e=>errors.push(e.message));await merchant.addInitScript(()=>{if(!sessionStorage.getItem('deal-test-started')){sessionStorage.setItem('umc-demo-session','');sessionStorage.setItem('deal-test-started','1');}});
 await merchant.goto(BASE);await merchant.click('[data-demo="kopikolej@demo.my"]');await merchant.waitForSelector('.merchant-page');
 await merchant.evaluate(async()=>{const D=await import('./js/data.js');await D.setOccupancy(window.__umc.ctx,40,10);});
 await merchant.goto(BASE+'#/promote');await merchant.waitForSelector('#new-deal');await merchant.click('#new-deal');
 const form=merchant.locator('#df');await form.locator('[name=title]').fill('Study break coffee');await form.locator('[name=benefit]').fill('RM2 off your favourite coffee');await form.locator('[name=start]').fill('00:00');await form.locator('[name=end]').fill('23:59');await form.locator('[name=threshold]').fill('90');
 const png=await merchant.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=600;canvas.height=800;const x=canvas.getContext('2d');x.fillStyle='#2420ff';x.fillRect(0,0,600,800);x.fillStyle='#eaff00';x.font='bold 70px sans-serif';x.fillText('STUDY BREAK',35,180);x.fillStyle='#fff';x.font='bold 110px sans-serif';x.fillText('RM2 OFF',40,340);x.font='34px sans-serif';x.fillText('Your favourite coffee',40,430);x.fillStyle='#eaff00';x.font='bold 54px sans-serif';x.fillText('+Onz',40,710);return canvas.toDataURL('image/png').split(',')[1];});
 await form.locator('#deal-poster-input').setInputFiles({name:'study-break.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await merchant.waitForSelector('#deal-preview-poster:not([hidden])');await merchant.waitForFunction(()=>!document.querySelector('#df button[type=submit]').disabled);
 await merchant.screenshot({path:SHOTS+'/merchant-poster.png',fullPage:true});await form.locator('button[type=submit]').click();await merchant.waitForFunction(()=>!document.querySelector('#sheet[open]'));
 const id=await merchant.evaluate(async()=>{const D=await import('./js/data.js');return (await D.myDeals(window.__umc.ctx)).find(d=>d.title==='Study break coffee').id;});
 await student.goto(BASE+'#/explore/deals');const card=student.locator(`[data-gallery-deal="${id}"]`);await card.waitFor();
 assert.ok((await card.locator('img').getAttribute('src')).startsWith('data:image/jpeg;base64,'));
 const points=()=>student.evaluate(async()=>{const D=await import('./js/data.js');return (await D.getProfile(window.__umc.ctx)).points;});const before=await points();
 await card.locator('[data-deal-details]').click();await student.waitForSelector('.deal-gallery-details');assert.ok(await student.locator('.deal-gallery-details img').isVisible());await student.click('#sheet [data-close]');assert.equal(await points(),before);
 for(const width of [320,390,768,1360])for(const lang of ['en','ms']){await student.setViewportSize({width,height:900});await student.evaluate(async lang=>(await import('./js/i18n.js')).setLang(lang),lang);await student.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);await student.screenshot({path:`${SHOTS}/gallery-${width}-${lang}.png`,fullPage:true});}
 await student.evaluate(async()=>(await import('./js/i18n.js')).setLang('en'));
 await card.locator('.deal-gallery-claim').click();await student.waitForSelector('#start-deal-scan');assert.equal(await points(),before);assert.equal(await student.locator('#deal-confirmation h2').count(),0);
 assert.equal(await student.locator('#manual').count(),0,'No manual-code bypass');
 await merchant.goto(BASE+'#/scan/'+id);await merchant.waitForSelector('#live-deal-qr[data-code]');const raw=await merchant.locator('#live-deal-qr').getAttribute('data-code');
 await student.evaluate(raw=>{const holder=document.createElement('div');new QRCode(holder,{text:raw,width:512,height:512,correctLevel:QRCode.CorrectLevel.M});const qr=holder.querySelector('canvas'),frame=document.createElement('canvas');frame.width=640;frame.height=640;const x=frame.getContext('2d'),draw=()=>{x.fillStyle='#fff';x.fillRect(0,0,640,640);x.drawImage(qr,64,64);};draw();navigator.mediaDevices.getUserMedia=async()=>{const stream=frame.captureStream(10),timer=setInterval(draw,100);for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}return stream;};},raw);
 await student.click('#start-deal-scan');await student.waitForSelector('#deal-confirmation h2');await student.waitForFunction(before=>Number(document.querySelector('.pts-chip [data-bind=points]').textContent.replace(/\D/g,''))===before+10,before);assert.equal(await points(),before+10);
 await merchant.waitForSelector('[data-apply-claim]');await merchant.click('[data-apply-claim]');await student.waitForFunction(()=>document.querySelector('#deal-confirmation h2')?.textContent==='Discount applied');await student.reload();await student.waitForSelector('#deal-confirmation h2');assert.equal(await points(),before+10,'Reload cannot award points again');
 await merchant.click('#sheet [data-close]');await merchant.goto(BASE+'#/promote');await merchant.click(`[data-edit-deal="${id}"]`);await merchant.click('#remove-deal-poster');await merchant.click('#df button[type=submit]');await merchant.waitForFunction(()=>!document.querySelector('#sheet[open]'));
 await student.goto(BASE+'#/explore/deals');await card.waitFor();assert.equal(await card.locator('img').count(),0);assert.equal(await card.locator('.deal-gallery-generated').count(),1);
 await merchant.click(`[data-toggle="${id}"]`);await card.waitFor({state:'detached'});
 await student.goto(BASE+'#/claim-deal/'+id);await student.waitForSelector('.student-deal-claim');assert.equal(await student.locator('#start-deal-scan').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Deal gallery: merchant poster publish/edit/removal, live updates, full-size posters, 8 responsive/language views, no points before scan, real QR decoding, one-time points and merchant discount application passed.');
}finally{await browser.close();}
