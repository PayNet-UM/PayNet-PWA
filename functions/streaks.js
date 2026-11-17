// Trusted app-use rewards. Client rules allow one server-dated app-day record,
// but never allow clients to write streak counters or appStreak ledger credits.
const DAY=86400000;
export const previousDay=day=>new Date(Date.parse(day+'T00:00:00Z')-DAY).toISOString().slice(0,10);
export const streakBonus=rules=>Number.isSafeInteger(rules?.streakBonus)&&rules.streakBonus>=1&&rules.streakBonus<=1000?rules.streakBonus:5;
export function streakRun(days,day){
  const recorded=new Set(days.map(d=>d.day));let count=0,cursor=day;
  while(recorded.has(cursor)){count++;cursor=previousDay(cursor);}
  return {count,start:count?new Date(Date.parse(day+'T00:00:00Z')-(count-1)*DAY).toISOString().slice(0,10):day};
}
export async function awardAppStreak(db,uid,day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day)))return 0;
  return db.runTransaction(async tx=>{
    const user=db.doc(`users/${uid}`),record=user.collection('appDays').doc(day),previous=user.collection('appDays').doc(previousDay(day));
    const [profile,current,prior,config]=await Promise.all([tx.get(user),tx.get(record),tx.get(previous),tx.get(db.doc('config/rules'))]);
    if(!profile.exists||profile.data().role!=='student'||profile.data().disabled||!current.exists)return 0;
    const entry=current.data(),openedAt=entry.openedAt?.toMillis?.();
    if(entry.day!==day||!Number.isFinite(openedAt)||new Date(openedAt+8*3600000).toISOString().slice(0,10)!==day)return 0;
    let run={count:1,start:day};
    if(prior.exists){
      const p=prior.data();
      if(Number.isSafeInteger(p.streakCount)&&p.streakCount>0&&typeof p.streakStart==='string')run={count:p.streakCount+1,start:p.streakStart};
      else{
        // Old records and out-of-order deliveries have no trusted counter yet.
        const history=await tx.get(user.collection('appDays').where('day','<=',day));
        run=streakRun(history.docs.map(d=>d.data()),day);
      }
    }
    const id='appStreak_'+day,ledger=user.collection('ledger').doc(id),reward=run.count%7===0;
    const existing=reward?await tx.get(ledger):null;
    tx.update(record,{streakCount:run.count,streakStart:run.start});
    if(!reward||existing.exists)return 0;
    const delta=streakBonus(config.exists?config.data():{});
    tx.create(ledger,{type:'appStreak',delta,day,milestone:run.count,by:'system',createdAt:new Date()});
    tx.update(user,{points:(profile.data().points||0)+delta,lastTx:id});
    return delta;
  });
}
