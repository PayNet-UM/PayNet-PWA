// Actual server transactions and client security rules against Google's emulator.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import * as sdk from 'firebase/firestore';
import {awardAppStreak} from '../functions/streaks.js';
import * as D from '../app/shared/js/data.js';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore,Timestamp}=require('firebase-admin/firestore');
const projectId='umc-streak-test',testEnv=await initializeTestEnvironment({projectId,firestore:{rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
const app=initializeApp({projectId},'streak-tests'),db=getFirestore(app);
let passed=0;const check=async(name,fn)=>{await fn();passed++;console.log('  ✓ '+name);};
try{
  await testEnv.clearFirestore();
  await db.doc('users/student').set({role:'student',points:0,lastTx:'',college:'KK3'});await db.doc('config/rules').set({streakBonus:5});
  const client=testEnv.authenticatedContext('student',{email:'student@siswa.um.edu.my',email_verified:true}).firestore(),ctx={sdk,db:client,uid:'student'};
  const today=D.dayKey(),dayAt=offset=>D.dayKey(Date.parse(today+'T03:00:00Z')+offset*86400000);
  for(let i=-13;i<0;i++){const day=dayAt(i);await db.doc('users/student/appDays/'+day).set({day,openedAt:Timestamp.fromDate(new Date(day+'T03:00:00Z'))});}
  await D.recordAppDay(ctx);
  await check('concurrent server rewards for days 7 and 14 credit the wallet exactly once each',async()=>{
    const seventh=dayAt(-7);
    await Promise.all([awardAppStreak(db,'student',seventh),awardAppStreak(db,'student',today),awardAppStreak(db,'student',today)]);
    assert.equal((await db.doc('users/student').get()).data().points,10);
    assert.equal((await db.collection('users/student/ledger').get()).size,2);
    assert.equal((await db.doc('users/student/appDays/'+today).get()).data().streakCount,14);
  });
  await check('retrying a completed milestone preserves its original award',async()=>{
    await db.doc('config/rules').update({streakBonus:3});assert.equal(await awardAppStreak(db,'student',today),0);
    assert.equal((await db.doc('users/student').get()).data().points,10);
    assert.equal((await db.doc('users/student/ledger/appStreak_'+today).get()).data().delta,5);
  });
  await check('clients cannot forge milestone counters or overwrite their app days',async()=>{
    await assertFails(sdk.updateDoc(sdk.doc(client,'users/student/appDays/'+today),{streakCount:700}));
    const tomorrow=dayAt(1);await assertFails(sdk.setDoc(sdk.doc(client,'users/student/appDays/'+tomorrow),{day:tomorrow,openedAt:sdk.serverTimestamp(),streakCount:21}));
  });
  await check('clients cannot mint a streak credit even with a paired balance write',async()=>{
    const batch=sdk.writeBatch(client);
    batch.set(sdk.doc(client,'users/student/ledger/forged'),{type:'appStreak',delta:5,day:today,milestone:21,by:'student',createdAt:sdk.serverTimestamp()});
    batch.update(sdk.doc(client,'users/student'),{points:sdk.increment(5),lastTx:'forged'});await assertFails(batch.commit());
    assert.equal((await db.doc('users/student').get()).data().points,10);
  });
  await check('other students cannot read private streak history or claim it',async()=>{
    const other=testEnv.authenticatedContext('other',{email:'other@siswa.um.edu.my',email_verified:true}).firestore();
    await assertFails(sdk.getDocs(sdk.collection(other,'users/student/appDays')));
    await assertFails(sdk.setDoc(sdk.doc(other,'users/student/appDays/'+today),{day:today,openedAt:sdk.serverTimestamp()}));
  });
  console.log(`\n${passed} official-emulator streak checks passed.`);
}finally{await db.terminate();await deleteApp(app);await testEnv.cleanup();}
