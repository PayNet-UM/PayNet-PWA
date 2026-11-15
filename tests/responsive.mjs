// Read-only UI regression coverage against Demo mode. Run with a demo server already listening.
// CI runs this after the end-to-end journeys; each role gets isolated demo storage.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BASE=process.env.BASE||'http://localhost:5173/?mode=demo';
const ADMIN=process.env.ADMIN||new URL('admin/?mode=demo',BASE).href;
const SHOTS=process.env.SHOTS||'/tmp/e2e/responsive';
fs.mkdirSync(SHOTS,{recursive:true});
const TILE=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64');
const ROLES=[
  ['student','aina@siswa.um.edu.my',['home','community','leagues','events','feskum','rewards','me','avatar','learn','survey','explore','explore/deals','feedback','about','contact','points']],
  ['merchant','kopikolej@demo.my',['home','scan','shop','promote','insights','poster','survey','about','contact','points']],
  ['admin',null,['overview','merchants','approvals','rewards','campaigns','kpis','people','paynet','recon','feedback','closures','activity','settings','points']],
];
const VIEWPORTS=[{width:320,height:740},{width:390,height:844},{width:768,height:1024},{width:844,height:390},{width:1360,height:960}];
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{});
const errors=[];let checked=0;
try {
  for(const [role,email,routes] of ROLES){
    const context=await browser.newContext({viewport:VIEWPORTS[1],reducedMotion:'reduce'});
    await context.route(/tile\.openstreetmap\.org/,r=>r.fulfill({status:200,contentType:'image/png',body:TILE}));
    const page=await context.newPage();page.on('pageerror',e=>errors.push(`${role}: ${e.message}`));
    const base=role==='admin'?ADMIN:BASE;
    await page.goto(base);
    await page.waitForFunction(()=>document.documentElement.dataset.backend,null,{timeout:60000});
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.backend),'demo','Responsive tests must never write against a live project');
    await page.waitForSelector('[data-demo]');
    const login=email||await page.locator('[data-demo]').evaluateAll(es=>es.find(e=>e.textContent.includes('Admin team')).dataset.demo);
    await page.click(`[data-demo="${login}"]`);
    await page.waitForSelector(role==='admin'?'#mpp-rail':'#avatar');
    for(const language of ['en','ms']){
      for(const viewport of VIEWPORTS){
        await page.setViewportSize(viewport);
        for(const route of routes){
          await page.goto(base+'#/'+route);
          await page.waitForFunction(()=>document.querySelector('#view')?.children.length&&!document.querySelector('#view > .skeleton'),null,{timeout:30000});
          await page.evaluate(async lang=>(await import('./js/i18n.js')).setLang(lang),language);
          await page.waitForTimeout(100);
          if(await page.locator('.guide [data-skip]').count())await page.locator('.guide [data-skip]').click();
          const label=`${role} ${route} ${language} ${viewport.width}×${viewport.height}`;
          try {
            assert.equal(await page.locator('#view [onclick="location.reload()"]').count(),0,`${label}: error view`);
            const sizes=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));
            assert.ok(sizes.content<=sizes.width+2,`${label}: page overflows by ${sizes.content-sizes.width}px`);
            // Device rotation must not leave a sheet or navigation overlay blocking the page.
            assert.equal(await page.locator('dialog[open]').count(),0,`${label}: unexpected modal`);
            if(role==='student'&&route==='home'){
              assert.equal(await page.locator('#view .info-links,#view .points-summary').count(),0,`${label}: redundant homepage links`);
              const about=page.locator('.tabbar [data-tab="about"]'),home=page.locator('.tabbar [data-tab="home"]');
              assert.ok(await about.isVisible(),`${label}: About tab missing`);
              if(viewport.width<1024){
                const a=await about.boundingBox(),h=await home.boundingBox(),l=await page.locator('.tabbar [data-tab="leagues"]').boundingBox();
                assert.ok(l.x<a.x&&a.x<h.x,`${label}: About belongs between Leagues and Home`);
              }
              assert.equal(await home.getAttribute('aria-current'),'page');
            }
            if(role==='student'&&route==='rewards')assert.equal(await page.locator('.rewards-page .points-summary[href="#/points"]').count(),1,`${label}: points guide missing from Rewards`);
            if(role==='student'&&route==='avatar'){
              const preview=await page.locator('.av-stage').evaluate(el=>({background:getComputedStyle(el).backgroundImage,foreground:getComputedStyle(el.querySelector('#av-reset')).color}));
              assert.ok(preview.background.includes('gradient'),`${label}: avatar stage lost its high-contrast background`);
            }
            if(viewport.width<1024){
              const inputSizes=await page.locator('#view input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),#view select,#view textarea').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width>0).map(e=>parseFloat(getComputedStyle(e).fontSize)));
              assert.ok(inputSizes.every(size=>size>=16),`${label}: small input text triggers phone zoom`);
            }
          }catch(error){
            const file=`${role}-${route.replaceAll('/','-')}-${language}-${viewport.width}.png`;
            await page.screenshot({path:`${SHOTS}/${file}`,fullPage:true});throw error;
          }
          checked++;
        }
        console.log(`  ✓ ${role} ${language} ${viewport.width}×${viewport.height}: ${routes.length} screens`);
      }
    }
    await context.close();
  }
  assert.deepEqual(errors,[],'Browser page errors');
  console.log(`\n${checked} responsive role/route/language/device checks passed; no browser errors.`);
}finally{await browser.close();}
