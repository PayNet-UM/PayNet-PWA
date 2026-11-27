import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const BASE=process.env.BASE||'http://localhost:5173/?mode=demo',SHOTS=process.env.SHOTS||'/tmp/e2e/event-archive';fs.mkdirSync(SHOTS,{recursive:true});
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await ctx.addInitScript(()=>{Date.now=()=>Date.UTC(2026,10,26,4);});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(BASE);await p.click('[data-demo="aina@siswa.um.edu.my"]');await p.waitForSelector('.kk-hero');
 await p.goto(BASE+'#/events');await p.waitForSelector('.event-gallery-grid');
 assert.equal(await p.locator('[data-event-open="poster-4"]').count(),0,'Past FESKUM events stay out of Upcoming');
 assert.equal(await p.locator('.event-gallery-map').isVisible(),false,'Expired FESKUM shortcut stays out of Upcoming / All');
 await p.click('[data-event-view=past]');await p.waitForSelector('[data-event-open="poster-4"]');
 assert.equal(await p.locator('.event-gallery-map').isVisible(),false,'Expired maps are also removed from the archive');
 assert.equal(await p.locator('[data-feskum-map-copy]').textContent(),'Archived stalls and floor map.');
 assert.equal(await p.locator('[data-event-open="poster-4"] .event-gallery-status').textContent(),'Ended');
 await p.locator('[data-event-open="poster-4"] .event-gallery-hit').click();await p.waitForSelector('.event-poster-dialog');await p.click('#sheet [data-close]');
 const vote=p.locator('[data-reaction-key="poster-11"][data-event-react="🙌"]');await vote.click();
 await p.waitForFunction(()=>document.querySelector('[data-reaction-key="poster-11"][data-event-react="🙌"]')?.getAttribute('aria-pressed')==='true');
 await p.screenshot({path:SHOTS+'/past-mobile.png',fullPage:true});
 await p.click('[data-event-view=calendar]');await p.waitForSelector('.event-calendar:not([hidden])');
 assert.equal(await p.locator('.event-gallery-map').isVisible(),false,'Today does not promote expired FESKUM');
 assert.equal(await p.locator('[data-calendar-day]').count(),30);assert.ok(Number(await p.locator('[data-calendar-day="2026-11-14"] .event-calendar-count').textContent())>=3);
 await p.click('[data-calendar-day="2026-11-14"]');await p.waitForSelector('[data-event-open="poster-6"]');
 assert.equal(await p.locator('[data-event-open="poster-4"]').count(),1,'Day agenda includes multi-day bazaar');
 assert.equal(await p.locator('.event-gallery-map').isVisible(),false,'Historical calendar dates do not reopen expired maps');
 await p.locator('[data-event-open="poster-6"] .event-gallery-hit').click();await p.waitForSelector('.event-poster-dialog');assert.ok((await p.locator('#sheet h2').textContent()).includes('Melody Run'));assert.equal(await p.locator('#sheet a[href="#/feskum"]').count(),0);await p.click('#sheet [data-close]');
 await p.click('[data-calendar-month="-1"]');await p.click('[data-calendar-day="2026-10-07"]');await p.waitForSelector('[data-event-open="poster-11"]');
 await p.waitForFunction(()=>document.querySelector('[data-reaction-key="poster-11"][data-event-react="🙌"]')?.getAttribute('aria-pressed')==='true');
 await p.click('[data-calendar-month="1"]');await p.click('[data-calendar-day="2026-11-14"]');
 for(const width of [320,390,768,1024,1360])for(const lang of ['en','ms']){
  await p.setViewportSize({width,height:900});await p.evaluate(async lang=>(await import('./js/i18n.js')).setLang(lang),lang);
  await p.evaluate(()=>document.fonts.ready);
  await p.click('[data-calendar-month="-1"]');
  const toolbar=p.locator('.event-calendar-toolbar');
  const octoberHeight=(await toolbar.boundingBox()).height;
  for(const [step,month] of [[-1,'2026-09'],[1,'2026-10'],[1,'2026-11']]){
   await p.click(`[data-calendar-month="${step}"]`);
   assert.equal(await p.locator('.event-calendar').getAttribute('data-month'),month);
   assert.equal((await toolbar.boundingBox()).height,octoberHeight,
    `Calendar controls should stay on the same row when showing ${month} at ${width}px (${lang})`);
  }
  await p.click('[data-calendar-day="2026-11-14"]');
  await p.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
  assert.ok(await p.locator('.event-calendar').isVisible());
  assert.ok((await p.locator('.event-calendar-toolbar h3').textContent()).includes('November'));
  if(lang==='ms')assert.ok((await p.locator('[data-calendar-day="2026-11-14"]').getAttribute('aria-label')).includes('acara'));
  await p.screenshot({path:`${SHOTS}/calendar-${width}-${lang}.png`,fullPage:true});
 }
 await p.click('[data-calendar-today]');assert.equal(await p.locator('[data-calendar-day="2026-11-26"]').getAttribute('aria-pressed'),'true');
 await p.click('[data-event-view=upcoming]');assert.equal(await p.locator('[data-event-open="poster-4"]').count(),0);
 await p.goto(BASE+'#/feskum');await p.waitForSelector('.floor-map-ended');assert.equal(await p.locator('[data-kps-booth]').count(),0,'Direct URLs cannot reopen expired floor maps');
 // An already-open map also closes as soon as its event's final date passes.
 await p.goto(BASE+'#/events');await p.waitForSelector('.event-gallery-grid');
 await p.evaluate(()=>{Date.now=()=>Date.UTC(2026,10,10,4);});
 await p.goto(BASE+'#/feskum');await p.waitForSelector('[data-kps-booth]');
 assert.equal(await p.locator('[data-kps-booth]').count(),76);
 await p.click('[data-kps-area="lower"]');await p.click('[data-booth="KPS-01"]');await p.waitForSelector('#festival-vendor-dropdown:not([hidden])');
 await p.evaluate(()=>{Date.now=()=>Date.UTC(2026,10,17,4);});
 await p.waitForSelector('.floor-map-ended');assert.equal(await p.locator('[data-kps-booth]').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Event archive/calendar browser: ended posters, reactions across views, multi-day agenda, stable month navigation, Today and 10 responsive/language layouts passed.');
}finally{await browser.close();}
