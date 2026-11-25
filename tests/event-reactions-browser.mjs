import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const BASE=process.env.BASE||'http://localhost:5173/?mode=demo';
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),errors=[];
const SHOTS=process.env.SHOTS||'/tmp/onz-event-reactions';fs.mkdirSync(SHOTS,{recursive:true});
try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const admin=await ctx.newPage();admin.on('pageerror',e=>errors.push(e.message));
  await admin.goto(new URL('admin/?mode=demo',BASE).href);
  await admin.waitForSelector('[data-demo]');
  const email=await admin.locator('[data-demo]').evaluateAll(items=>items.find(e=>e.textContent.includes('Admin team')).dataset.demo);
  await admin.click(`[data-demo="${email}"]`);await admin.waitForSelector('#mpp-rail');
  await admin.evaluate(async()=>{
    const D=await import('./js/data.js'),ctx=window.__umc.ctx,day=n=>D.dayKey(Date.now()+n*86400000);
    for(const [id,name,end,published]of [['reaction-demo','Campus Showcase',day(1),true],['expired-demo','Expired Showcase',day(-1),true],['hidden-demo','Hidden Showcase',day(2),false]])
      await D.saveGalleryEvent(ctx,id,{name,category:'talks',start:day(-2),end,location:'Dewan Tunku Canselor',published});
  });
  const student=await ctx.newPage();student.on('pageerror',e=>errors.push(e.message));
  await student.addInitScript(()=>{if(!sessionStorage.getItem('reaction-test-started')){sessionStorage.setItem('umc-demo-session','');sessionStorage.setItem('reaction-test-started','1');}});
  await student.goto(BASE);await student.click('[data-demo="aina@siswa.um.edu.my"]');await student.waitForSelector('.kk-hero');
  await student.goto(BASE+'#/events');await student.waitForSelector('[data-reaction-key="reaction-demo"]');
  const card=student.locator('[data-event-open="campaign-reaction-demo"]'),love=card.locator('[data-event-react="❤️"]'),fire=card.locator('[data-event-react="🔥"]');
  assert.equal(await student.locator('[data-event-open="campaign-expired-demo"]').count(),0);
  assert.equal(await student.locator('[data-event-open="campaign-hidden-demo"]').count(),0);
  await love.click();await student.waitForFunction(()=>document.querySelector('[data-reaction-key="reaction-demo"][data-event-react="❤️"]')?.getAttribute('aria-pressed')==='true');
  assert.equal(await love.locator('[data-reaction-count]').textContent(),'1');
  assert.equal(await student.locator('#sheet[open]').count(),0,'Reacting must not open the event');
  await student.reload();await love.waitFor();await student.waitForFunction(()=>document.querySelector('[data-reaction-key="reaction-demo"][data-event-react="❤️"]')?.getAttribute('aria-pressed')==='true');
  await fire.click();await student.waitForFunction(()=>document.querySelector('[data-reaction-key="reaction-demo"][data-event-react="🔥"]')?.getAttribute('aria-pressed')==='true');
  assert.equal(await love.locator('[data-reaction-count]').textContent(),'0');assert.equal(await fire.locator('[data-reaction-count]').textContent(),'1');
  await student.screenshot({path:SHOTS+'/mobile.png',fullPage:true});
  await student.setViewportSize({width:1440,height:1000});await student.screenshot({path:SHOTS+'/desktop.png',fullPage:true});
  assert.ok(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await fire.click();await student.waitForFunction(()=>document.querySelector('[data-reaction-key="reaction-demo"][data-event-react="🔥"]')?.getAttribute('aria-pressed')==='false');
  assert.equal(await fire.locator('[data-reaction-count]').textContent(),'0');
  await card.locator('.event-gallery-hit').click();await student.waitForSelector('#sheet[open]');
  await student.click('#sheet [data-close]');
  await student.evaluate(()=>{const original=Date.now;Date.now=()=>original()+3*86400000;});
  await student.waitForFunction(()=>!document.querySelector('[data-event-open="campaign-reaction-demo"]'));
  assert.deepEqual(errors,[]);
  console.log('Event browser: expired/hidden exclusion, reaction persistence, change/remove, independent event opening and responsive layouts passed.');
}finally{await browser.close();}
