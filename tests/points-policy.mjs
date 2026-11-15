// End-to-end point accounting against the app's real data API and rules engine.
import assert from 'node:assert/strict';import fs from 'node:fs';
import * as D from '../app/shared/js/data.js';import * as sdk from '../app/shared/js/fake/fakefb.js';
import * as P from '../app/shared/js/points-policy.js';import {leagueContribution} from '../functions/league.js';
import {issueDealQR} from '../app/shared/js/live-deals.js';
const rulesSource=fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');sdk.configureFake({rulesSource,storage:null,session:null});sdk.resetDemoData();
const context=(uid,email)=>({uid,email,sdk,db:sdk._testDb(sdk._testAuth({uid,email,emailVerified:true}))});
const admin=context('admin',/function bootstrapAdmins\(\) \{ return \['([^']+)'/.exec(rulesSource)[1]);await D.initProgramme(admin);
const a=context('points-a','points-a@siswa.um.edu.my'),b=context('points-b','points-b@siswa.um.edu.my'),c=context('points-c','points-c@siswa.um.edu.my');
for(const user of [a,b,c]){await D.createProfile(user,{role:'student',name:user.uid,matric:'POINTS'+user.uid.toUpperCase(),college:'KK3',faculty:'Faculty of Science'});user.profile=await D.getProfile(user);}
const ledger=async(ctx)=>(await sdk.getDocs(sdk.collection(ctx.db,'users',ctx.uid,'ledger'))).docs.map(s=>({id:s.id,...s.data()}));
const balance=async(ctx)=>(await D.getProfile(ctx)).points;
const exposure=async()=>P.unspentPointExposure(await D.listUsers(admin),(await D.getWelfareFund(admin)).points);
const survey=D.scoreSurvey('student',{k0:1,k1:0,k2:1,k3:1,d0:2,d1:2,d2:2});
let passed=0;async function check(label,fn){await fn();console.log('  ✓ '+label);passed++;}
await check('default self-directed learning is exactly 200 points, with live deals off',async()=>{
 assert.equal(D.LESSONS.length,3);assert.deepEqual(P.pointsRules(D.DEFAULT_RULES),P.DEFAULT_POINT_RULES);assert.equal(P.learningPlan(D.DEFAULT_RULES).total,200);assert.equal(P.livePointEarningOn(await D.getRules(a)),false);
 for(let i=0;i<3;i++)assert.equal(await D.answerLesson(a,i,D.LESSON_KEYS['lesson'+i],D.DEFAULT_RULES),'correct');
 assert.equal(await D.submitSurvey(a,survey,D.DEFAULT_RULES),50);assert.equal(await balance(a),200);assert.equal(P.earnedPoints(await ledger(a)),200);assert.equal(P.learningPlan(D.DEFAULT_RULES,await ledger(a)).remaining,0);
});
await check('repeated lessons, surveys, app streaks and referrals give no extra points',async()=>{
 for(let i=0;i<3;i++)assert.equal(await D.practiceLesson(a,i,D.LESSON_KEYS['lesson'+i],D.DEFAULT_RULES),'practised');
 assert.equal(await D.submitSurvey(a,survey,D.DEFAULT_RULES),0);await D.recordAppDay(a);await D.applyInviterCode(a,b.profile.referralCode);
 assert.equal(await balance(a),200);assert.equal((await ledger(a)).length,4);await assert.rejects(issueDealQR(a,'disabled-deal'),/currently unavailable/);
});
await check('200 points buy the default RM2 voucher; swapping and fulfilment are separate',async()=>{
 const reward=(await D.listRewards(a)).find(r=>r.id==='print-rm2');assert.equal(reward.cost,200);assert.equal(reward.valueCents,200);
 const id=await D.redeemReward(a,reward);const voucher=(await D.listVouchers(admin)).find(v=>v.id===id);assert.equal(voucher.status,'issued');assert.equal(voucher.code.length,8);assert.equal(await balance(a),0);assert.equal(P.earnedPoints(await ledger(a)),200);
 await assert.rejects(D.useVoucher(a,id),{code:'permission-denied'});await D.useVoucher(admin,id);assert.equal((await D.listVouchers(admin)).find(v=>v.id===id).status,'used');await assert.rejects(D.useVoucher(admin,id),{code:'permission-denied'});
});
await check('welfare grants move pooled points without changing earned totals or reference exposure',async()=>{
 await D.adjustPoints(admin,b.uid,250,'Provide points for welfare test');await D.donatePoints(b,100);const before=await exposure();
 const id=await D.submitWelfareRequest(a,100,'Support with study materials.');await D.reviewWelfareRequest(admin,id,true);
 assert.equal(await balance(a),100);assert.equal(P.earnedPoints(await ledger(a)),200);assert.equal((await exposure()).totalPoints,before.totalPoints);assert.equal((await exposure()).referenceCents,before.referenceCents);
 assert.equal(leagueContribution(await D.getProfile(a),await ledger(a)).earned,200);
 await assert.rejects(D.submitWelfareRequest(a,1001,'A request over the allowed amount.'));
});
await check('Admin awards can take a student beyond 200; donating preserves earned levels and leagues',async()=>{
 await D.adjustPoints(admin,a.uid,700,'Campus event participation award');await D.donatePoints(a,40);assert.equal(await balance(a),760);assert.equal(P.earnedPoints(await ledger(a)),900);assert.equal(leagueContribution(await D.getProfile(a),await ledger(a)).earned,900);
 const earned=(await ledger(a))[0];await assert.rejects(sdk.updateDoc(sdk.doc(a.db,'users',a.uid,'ledger',earned.id),{delta:9999}),{code:'permission-denied'});
});
await check('new bonuses use current settings even with an old screen; previous entries stay unchanged',async()=>{
 await D.saveConfig(admin,'rules',{lessonBonus:75,surveyBonus:25});assert.equal(await D.answerLesson(c,0,D.LESSON_KEYS.lesson0,D.DEFAULT_RULES),'correct');assert.equal(await D.submitSurvey(c,survey,D.DEFAULT_RULES),25);assert.equal(await balance(c),100);
 assert.equal(P.learningPlan(await D.getRules(c)).total,250);assert.equal((await ledger(a)).find(e=>e.id==='lesson0').delta,50);assert.equal(await D.practiceLesson(c,0,D.LESSON_KEYS.lesson0,D.DEFAULT_RULES),'practised');assert.equal(await balance(c),100);
});
await check('each reward can use a different rate without turning the wallet into cash',async()=>{
 await D.saveReward(admin,'custom',{title:'Custom RM2 reward',merchantId:'',cost:75,valueCents:200,stock:10,validDays:30,active:true,issued:0,lastVoucher:''});
 const reward=(await D.listRewards(c)).find(r=>r.id==='custom');const id=await D.redeemReward(c,reward);assert.equal(await balance(c),25);assert.equal((await D.listVouchers(admin)).find(v=>v.id===id).valueCents,200);assert.equal(P.referenceVoucherCents(200),200);
});
console.log(`\n${passed} points-policy checks passed.`);
