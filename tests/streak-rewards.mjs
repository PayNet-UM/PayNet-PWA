import assert from 'node:assert/strict';
import fs from 'node:fs';
import {awardAppStreak,previousDay,streakRun,streakBonus} from '../functions/streaks.js';
import * as sdk from '../app/shared/js/fake/fakefb.js';
import * as D from '../app/shared/js/data.js';
import {earnedPoints} from '../app/shared/js/points-policy.js';

let passed=0;const check=async(name,fn)=>{await fn();passed++;console.log('  ✓ '+name);};
const docs=new Map(),snap=path=>({exists:docs.has(path),data:()=>docs.get(path)});
const ref=path=>({path,collection:name=>({...ref(path+'/'+name),doc:id=>ref(path+'/'+name+'/'+id),where:(_field,_op,day)=>({prefix:path+'/'+name+'/',through:day})})});
const db={doc:ref,runTransaction:async fn=>{
  const writes=[];
  const result=await fn({get:async r=>r.prefix?{docs:[...docs].filter(([p,d])=>p.startsWith(r.prefix)&&d.day<=r.through).map(([p])=>snap(p))}:snap(r.path),
    update:(r,d)=>writes.push([r.path,{...docs.get(r.path),...d}]),create:(r,d)=>{assert.ok(!docs.has(r.path));writes.push([r.path,d]);}});
  for(const [p,d]of writes)docs.set(p,d);return result;
}};
const dayAt=i=>D.dayKey(Date.UTC(2026,10,1+i,3));
const seed=(uid,day)=>docs.set(`users/${uid}/appDays/${day}`,{day,openedAt:{toMillis:()=>Date.parse(day+'T03:00:00Z')}});
docs.set('users/a',{role:'student',points:0});docs.set('config/rules',{});
await check('only each seventh consecutive day earns the default 5 points, once',async()=>{
  for(let i=0;i<21;i++){
    const day=dayAt(i);seed('a',day);assert.equal(await awardAppStreak(db,'a',day),(i+1)%7===0?5:0);
    assert.equal(await awardAppStreak(db,'a',day),0);
  }
  assert.equal(docs.get('users/a').points,15);
  assert.deepEqual([...docs].filter(([p])=>p.startsWith('users/a/ledger/')).map(([,d])=>d.milestone),[7,14,21]);
});
await check('a missed day resets the run, but preserves points already earned',async()=>{
  for(let i=22;i<29;i++){seed('a',dayAt(i));await awardAppStreak(db,'a',dayAt(i));}
  assert.equal(docs.get('users/a').points,20);assert.equal(docs.get('users/a/appDays/'+dayAt(28)).streakCount,7);
});
await check('HEP can change future bonuses without changing earlier rewards',async()=>{
  docs.set('config/rules',{streakBonus:3});
  for(let i=29;i<36;i++){seed('a',dayAt(i));await awardAppStreak(db,'a',dayAt(i));}
  assert.equal(docs.get('users/a').points,23);assert.equal(docs.get('users/a/ledger/appStreak_'+dayAt(6)).delta,5);
  for(const value of [-1,0,1.5,1001,'5'])assert.equal(streakBonus({streakBonus:value}),5);
});
await check('old records and out-of-order deliveries retain the correct 7/14/21 milestones',async()=>{
  docs.set('users/b',{role:'student',points:0});docs.set('config/rules',{streakBonus:5});
  for(let i=0;i<21;i++)seed('b',dayAt(i));
  for(const i of [20,6,13,20,13,6])await awardAppStreak(db,'b',dayAt(i));
  assert.equal(docs.get('users/b').points,15);
  assert.equal(docs.get('users/b/appDays/'+dayAt(20)).streakCount,21);
});
await check('non-students, blocked/deleted accounts and mismatched server dates earn nothing',async()=>{
  for(const [uid,profile]of [['merchant',{role:'merchant',points:0}],['blocked',{role:'student',disabled:true,points:0}],['gone',null]]){
    if(profile)docs.set('users/'+uid,profile);for(let i=0;i<7;i++)seed(uid,dayAt(i));
    assert.equal(await awardAppStreak(db,uid,dayAt(6)),0);
  }
  docs.set('users/c',{role:'student',points:0});seed('c',dayAt(0));docs.get('users/c/appDays/'+dayAt(0)).openedAt={toMillis:()=>Date.parse(dayAt(1)+'T03:00:00Z')};
  assert.equal(await awardAppStreak(db,'c',dayAt(0)),0);
  assert.equal(previousDay('2027-01-01'),'2026-12-31');assert.equal(previousDay('2028-03-01'),'2028-02-29');
  assert.equal(streakRun([{day:'2026-12-31'},{day:'2027-01-01'}],'2027-01-01').count,2);
});

let now=Date.UTC(2026,10,25,3);
sdk.configureFake({rulesSource:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8'),storage:null,session:null,now:()=>now});sdk.resetDemoData();
const context=(uid,email)=>({sdk,db:sdk._testDb(sdk._testAuth({uid,email,emailVerified:true})),uid,email,now:()=>now});
const admin=context('admin',/function bootstrapAdmins\(\) \{ return \['([^']+)'/.exec(fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8'))[1]),student=context('student','student@siswa.um.edu.my');
await D.initProgramme(admin);await D.createProfile(student,{role:'student',name:'Test Student',matric:'STREAK01',college:'KK3'});
await check('demo app opens award 7/14/21-day bonuses and add earned points to the league',async()=>{
  for(let i=0;i<21;i++){if(i)now+=86400000;await Promise.all([D.recordAppDay(student),D.recordAppDay(student)]);}
  assert.equal((await D.getProfile(student)).points,15);
  const entries=(await sdk.getDocs(sdk.collection(student.db,'users',student.uid,'ledger'))).docs.map(d=>d.data());
  assert.equal(entries.length,3);assert.equal(earnedPoints(entries),15);assert.equal(sdk._rawDocs().get('stats/league').colleges.KK3,15);
  await D.recordAppDay(student);assert.equal((await D.getProfile(student)).points,15);
});
await check('client counter forgery, direct streak credits and backdating are denied',async()=>{
  const day=D.dayKey(now),record=sdk.doc(student.db,'users',student.uid,'appDays',day);
  await assert.rejects(sdk.updateDoc(record,{streakCount:999}),{code:'permission-denied'});
  await assert.rejects(sdk.setDoc(sdk.doc(student.db,'users',student.uid,'appDays',previousDay(day)),{day:previousDay(day),openedAt:sdk.serverTimestamp()}),{code:'permission-denied'});
  const batch=sdk.writeBatch(student.db),id='fake-streak';
  batch.set(sdk.doc(student.db,'users',student.uid,'ledger',id),{type:'appStreak',delta:100,by:student.uid,createdAt:sdk.serverTimestamp()});
  batch.update(sdk.doc(student.db,'users',student.uid),{points:sdk.increment(100),lastTx:id});
  await assert.rejects(batch.commit(),{code:'permission-denied'});assert.equal((await D.getProfile(student)).points,15);
});
console.log(`\n${passed} streak reward checks passed.`);
