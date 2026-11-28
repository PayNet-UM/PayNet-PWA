// Contact drafts must preserve the message without adding recipients or claiming delivery.
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {copySite} from '../scripts/lib/sites.mjs';
const site=fs.mkdtempSync(path.join(os.tmpdir(),'onz-information-'));process.on('exit',()=>fs.rmSync(site,{recursive:true,force:true}));copySite('client',site);
globalThis.window=globalThis;globalThis.addEventListener=()=>{};
const {TEAM,SOCIALS,CONTACT_EMAIL,aboutRender,contactRender,buildInquiry,INFORMATION_ROUTES}=await import(pathToFileURL(path.join(site,'js/information.js')));
assert.equal(CONTACT_EMAIL,'partnerships@addonz.my');
assert.deepEqual(TEAM.map(g=>g.people.length),[2,2,3,2]);
assert.equal(new Set(TEAM.flatMap(g=>g.people.map(p=>p.name))).size,9);
for(const group of TEAM)for(const p of group.people){assert.ok(p.cx>118&&p.cx<1802&&p.cy>118&&p.cy<962);}
const message='A stall idea: tea & cake?\nPlease contact me.\n&bcc=someone@example.test';
const draft=buildInquiry({name:'Aina\r\nBcc: injected',email:'aina@example.test\r\nCc: other',topic:'events',message});
const url=new URL(draft.url);assert.equal(url.protocol,'mailto:');assert.equal(url.pathname,CONTACT_EMAIL);assert.deepEqual([...url.searchParams.keys()],['subject','body']);assert.equal(url.searchParams.get('subject'),'+Onz — KK / event collaboration');assert.ok(url.searchParams.get('body').endsWith(message));assert.ok(!draft.body.includes('Aina\r\nBcc:'));assert.ok(!draft.body.includes('aina@example.test\r\nCc:'));
assert.ok(buildInquiry({topic:'<unsafe>',message:'Hi'}).subject.endsWith('General enquiry'));
const publicAbout=aboutRender();assert.ok(!publicAbout.includes('RM5 café voucher')&&!publicAbout.includes('RM3 cashback'));assert.ok(publicAbout.includes('once confirmed')&&publicAbout.includes('no cash value'));assert.ok(!publicAbout.includes('info-point-value'));
const signedIn=aboutRender({profile:{},rules:{lessonBonus:75,surveyBonus:40,liveDealPoints:15}});for(const value of ['3 × 75','+40','+15'])assert.ok(signedIn.includes(value));
// Signed-in students write to the team in the app (one composer); their replies live on Questions and feedback.
const studentContact=contactRender({profile:{name:'Aina'},user:{email:'a@example.test'},role:'student'},['events']);assert.ok(studentContact.includes('id="fb-form"'));assert.ok(!studentContact.includes('id="info-contact-form"'));assert.ok(studentContact.includes('href="#/feedback"'));assert.ok(!studentContact.includes('name="email"'));
// Everyone else prepares an email: user text is escaped, the topic link preselects its chip, and the draft step is explicit.
const contact=contactRender({profile:{name:'<img src=x onerror=alert(1)>'},user:{email:'a"@example.test'},role:'merchant'},['events']);assert.ok(!contact.includes('value="<img'));assert.ok(contact.includes('&lt;img'));assert.ok(contact.includes('value="events" checked'));assert.ok(!contact.includes('type="tel"'));assert.ok(contact.includes('Open email draft')&&contact.includes('Write email'));
for(const s of SOCIALS){assert.ok(new URL(s.url).protocol==='https:');assert.ok(fs.existsSync(path.join(site,'assets/about',s.asset)));assert.ok(contact.includes('assets/about/'+s.asset));}
for(const route of ['about','contact'])assert.ok(INFORMATION_ROUTES[route]?.render);
console.log('Information pages: supplied team, active point values, safe email drafts, correct social assets and honest delivery status passed.');

// Delayed points-history snapshots update the guide without replacing the page.
const {pointsGuideMount}=await import(pathToFileURL(path.join(site,'js/points-guide.js')));
const earnedSlot={textContent:'—'},remainingSlot={textContent:'—'};
const root={querySelector:s=>s==='[data-policy-earned]'?earnedSlot:s==='[data-policy-remaining]'?remainingSlot:null};
let listener;
const app={rules:{lessonBonus:50,surveyBonus:50},ledger:[],ledgerLoaded:false,on:f=>{listener=f;return()=>{listener=null;};}};
const cleanup=pointsGuideMount(root,app);assert.equal(earnedSlot.textContent,'—');
app.ledgerLoaded=true;app.ledger=[{id:'lesson0',type:'lesson',delta:50},{id:'grant',type:'welfare',delta:1000},{id:'donation',type:'donate',delta:-20}];listener('ledger');
assert.equal(earnedSlot.textContent,'50');assert.equal(remainingSlot.textContent,'150');cleanup();assert.equal(listener,null);
console.log('Points guide: late ledger snapshots refresh earned totals without counting welfare grants.');
