// Programme point accounting. Reference voucher value is not cash or a fixed redemption rate.
export const DEFAULT_POINT_RULES = Object.freeze({surveyBonus:50,lessonBonus:50,liveDealPoints:10});
export const SELF_LESSON_COUNT=3;
export const POINT_LEVELS=[[0,'Starter'],[200,'Regular'],[600,'Explorer'],[1500,'Campus champion'],[4000,'Legend']];
export function pointsRules(rules={}) {
  const valid=(key)=>Number.isSafeInteger(rules[key])&&rules[key]>=0?rules[key]:DEFAULT_POINT_RULES[key];
  return {surveyBonus:valid('surveyBonus'),lessonBonus:valid('lessonBonus'),liveDealPoints:Number.isSafeInteger(rules.liveDealPoints)&&rules.liveDealPoints>=1&&rules.liveDealPoints<=1000?rules.liveDealPoints:DEFAULT_POINT_RULES.liveDealPoints};
}
export function earnedPoints(ledger=[]) {
  return ledger.reduce((sum,e)=>sum+(e.type!=='welfare'&&Number.isSafeInteger(e.delta)&&e.delta>0?e.delta:0),0);
}
export function learningPlan(rules={},ledger=[]) {
  const current=pointsRules(rules),claimed=new Set(ledger.map(e=>e.id));
  const remainingLessons=Array.from({length:SELF_LESSON_COUNT},(_,i)=>'lesson'+i).filter(id=>!claimed.has(id)).length;
  return {...current,lessonCount:SELF_LESSON_COUNT,total:SELF_LESSON_COUNT*current.lessonBonus+current.surveyBonus,
    remainingLessons,surveyAvailable:!claimed.has('survey'),remaining:remainingLessons*current.lessonBonus+(claimed.has('survey')?0:current.surveyBonus)};
}
export const livePointEarningOn=(rules={})=>['overview','merchantTools','dealsAndPay'].every(key=>rules.features?.[key]===true);
// At default reward prices only, one point corresponds to one sen of voucher value.
export function referenceVoucherCents(points) { return Number.isSafeInteger(points)&&points>=0?points:0; }
export function unspentPointExposure(users=[],poolPoints=0) {
  const studentPoints=users.filter(u=>u.role==='student').reduce((sum,u)=>sum+(Number.isSafeInteger(u.points)&&u.points>0?u.points:0),0);
  const welfarePoints=Number.isSafeInteger(poolPoints)&&poolPoints>0?poolPoints:0;
  return {studentPoints,welfarePoints,totalPoints:studentPoints+welfarePoints,referenceCents:referenceVoucherCents(studentPoints+welfarePoints)};
}
