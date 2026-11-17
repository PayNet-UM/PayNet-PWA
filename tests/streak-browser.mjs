import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const BASE=process.env.BASE||'http://localhost:5173/?mode=demo',ADMIN=process.env.ADMIN||new URL('admin/?mode=demo',BASE).href;
const SHOTS=process.env.SHOTS||'/tmp/e2e/streaks';fs.mkdirSync(SHOTS,{recursive:true});
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),errors=[];
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE);await page.waitForSelector('[data-demo]');
 // This isolated browser fixture has six real calendar-day records before today.
 const before=await page.evaluate(async()=>{
  const F=await import('./js/fake/fakefb.js'),D=await import('./js/data.js');
  let points;F._rawUpdate((docs,Timestamp)=>{
   const [path,p]=[...docs].find(([key,p])=>/^users\/[^/]+$/.test(key)&&p.email==='aina@siswa.um.edu.my');points=p.points;
   for(let i=1;i<=6;i++){const day=D.dayKey(Date.now()-i*86400000);docs.set(path+'/appDays/'+day,{day,openedAt:Timestamp.fromMillis(Date.parse(day+'T03:00:00Z'))});}
  });return points;
 });
 await page.click('[data-demo="aina@siswa.um.edu.my"]');await page.waitForSelector('.kk-hero');await page.goto(BASE+'#/rewards/streak');await page.waitForSelector('#rewards-streak');
 await page.waitForFunction(()=>document.querySelector('#rewards-streak .badge')?.textContent.includes('pts earned'));
 assert.equal(await page.evaluate(()=>window.__umc.profile.points),before+5);
 assert.ok((await page.locator('#rewards-streak').textContent()).includes('7 days running'));
 assert.ok((await page.locator('.streak-guidance').textContent()).includes('14'));
 assert.equal(await page.locator('#rewards-streak .streak-footer .badge').count(),0);
 assert.ok(!(await page.locator('#rewards-streak').textContent()).includes('Automatic'));
 assert.equal(await page.locator('.streak-bonus-progress').getAttribute('aria-valuenow'),'0');
 await page.locator('#rewards-streak').screenshot({path:SHOTS+'/day-7-reward.png'});
 await page.reload();await page.waitForSelector('#rewards-streak');assert.equal(await page.evaluate(()=>window.__umc.profile.points),before+5);
 const admin=await ctx.newPage();admin.on('pageerror',e=>errors.push(e.message));await admin.addInitScript(()=>sessionStorage.setItem('umc-demo-session',''));await admin.goto(ADMIN);await admin.waitForSelector('[data-demo]');
 const email=await admin.locator('[data-demo]').evaluateAll(items=>items.find(e=>e.textContent.includes('Admin team')).dataset.demo);await admin.click(`[data-demo="${email}"]`);await admin.waitForSelector('#mpp-rail');await admin.goto(ADMIN+'#/settings');await admin.waitForSelector('#rules [name=streakBonus]');
 await admin.fill('#rules [name=streakBonus]','3');await admin.click('#rules button');await admin.waitForFunction(()=>window.__umc?.rules?.streakBonus===3||document.querySelector('#rules [name=streakBonus]')?.value==='3');
 // Wait for the actual save, rather than the input value alone.
 await admin.waitForFunction(async()=>(await (await import('./js/data.js')).getRules(window.__umc.ctx)).streakBonus===3);
 await page.reload();await page.waitForSelector('#rewards-streak');assert.ok((await page.locator('.streak-bonus').textContent()).includes('+3'));
 assert.equal(await page.evaluate(()=>window.__umc.profile.points),before+5);
 for(const width of [320,390,1360]){
  await page.setViewportSize({width,height:844});
  for(const lang of ['en','ms']){
   await page.evaluate(async lang=>(await import('./js/i18n.js')).setLang(lang),lang);await page.waitForTimeout(150);
   const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,x:scrollX,header:[...document.querySelectorAll('.topbar>*')].map(e=>[e.className,e.offsetWidth,e.textContent.slice(0,30)]),overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right+scrollX>innerWidth+1).slice(0,8).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right+scrollX])}));assert.ok(size.scroll<=size.width+1,JSON.stringify({width,lang,...size}));
   assert.ok((await page.locator('.streak-guidance').textContent()).includes(lang==='ms'?'Bonus seterusnya':'Next bonus'));
  }
 }
 assert.deepEqual(errors,[]);console.log('Streak browser: day-7 reward, duplicate reopening, next-bonus progress, HEP settings and 6 responsive/translation checks passed.');
}finally{await browser.close();}
