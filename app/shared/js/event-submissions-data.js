import {EVENT_CATEGORIES} from './event-categories.js';

const limits={name:120,description:1500,location:160,organiser:120,contactEmail:254,time:80};
export function eventDraft(input){
  const draft={};
  for(const [key,max] of Object.entries(limits)){
    draft[key]=String(input[key]||'').trim();
    if(draft[key].length>max)throw new Error('An event field is too long.');
  }
  if(!['name','description','location','organiser','contactEmail'].every(k=>draft[k]))throw new Error('Complete the required event details.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contactEmail))throw new Error('Enter a valid contact email.');
  draft.category=String(input.category||'');
  if(!EVENT_CATEGORIES.some(([id])=>id===draft.category))throw new Error('Choose an event category.');
  for(const key of ['start','end']){
    draft[key]=String(input[key]||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(draft[key])||!Number.isFinite(Date.parse(draft[key]))||new Date(draft[key]).toISOString().slice(0,10)!==draft[key])throw new Error('Choose valid event dates.');
  }
  if(draft.end<draft.start)throw new Error('End date must be after the start date.');
  draft.posterImage=String(input.posterImage||'');
  if(draft.posterImage.length>600000||(draft.posterImage&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(draft.posterImage)))throw new Error('Choose a smaller JPG, PNG or WebP poster.');
  return draft;
}
export function publishedEvent(submission,id){
  // Contact email and student identity stay in the private review record.
  const {name,description,category,start,end,time,location,organiser,posterImage}=submission;
  return {name,description,category,start,end,time,location,organiser,posterImage,budgetCents:0,submissionId:id};
}
const rows=s=>s.docs.map(d=>({id:d.id,...d.data()}));
const submissions=(ctx,own)=>own?ctx.sdk.query(ctx.sdk.collection(ctx.db,'eventSubmissions'),ctx.sdk.where('uid','==',ctx.uid)):ctx.sdk.query(ctx.sdk.collection(ctx.db,'eventSubmissions'),ctx.sdk.where('status','==','pending'));
export async function submitEvent(ctx,input){
  const ref=ctx.sdk.doc(ctx.sdk.collection(ctx.db,'eventSubmissions'));
  await ctx.sdk.setDoc(ref,{...eventDraft(input),uid:ctx.uid,status:'pending',submittedAt:ctx.sdk.serverTimestamp()});
  return ref.id;
}
export async function listEventSubmissions(ctx,own=false){return rows(await ctx.sdk.getDocs(submissions(ctx,own)));}
export function watchEventSubmissions(ctx,own,cb,err){return ctx.sdk.onSnapshot(submissions(ctx,own),s=>cb(rows(s)),err);}
export function watchCampaigns(ctx,cb,err){return ctx.sdk.onSnapshot(ctx.sdk.collection(ctx.db,'campaigns'),s=>cb(rows(s)),err);}
export async function reviewEvent(ctx,id,approve,response=''){
  response=String(response).trim();
  if(response.length>500||(!approve&&!response))throw new Error('Add a short reason for the student.');
  const ref=ctx.sdk.doc(ctx.db,'eventSubmissions',id),snap=await ctx.sdk.getDoc(ref);
  if(!snap.exists()||snap.data().status!=='pending')throw new Error('This event has already been reviewed.');
  // The rules require the stored review to still be pending at commit time.
  // A competing reviewer therefore cannot overwrite an accepted decision.
  const batch=ctx.sdk.writeBatch(ctx.db);
  if(approve)batch.set(ctx.sdk.doc(ctx.db,'campaigns','student-'+id),publishedEvent(snap.data(),id));
  batch.update(ref,{status:approve?'approved':'rejected',response,reviewedBy:ctx.email,reviewedAt:ctx.sdk.serverTimestamp()});
  await batch.commit();
}
