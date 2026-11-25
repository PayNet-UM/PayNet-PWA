// One reaction per student per event. Updating the same document prevents duplicate votes.
export const EVENT_REACTIONS=[['❤️','Love'],['🔥','Excited'],['🙌','Interested']];
export const reactionKey=event=>event.recordId||event.id;
export function watchEventReactions(ctx,eventId,cb,err){
  return ctx.sdk.onSnapshot(ctx.sdk.collection(ctx.db,'eventReactions',eventId,'votes'),snap=>{
    const counts=Object.fromEntries(EVENT_REACTIONS.map(([emoji])=>[emoji,0]));let mine='';
    for(const vote of snap.docs){const emoji=vote.data().emoji;if(emoji in counts)counts[emoji]++;if(vote.id===ctx.uid)mine=emoji;}
    cb({counts,mine});
  },err);
}
export async function setEventReaction(ctx,eventId,emoji){
  if(emoji!==null&&!EVENT_REACTIONS.some(([value])=>value===emoji))throw new Error('Choose an event reaction.');
  const ref=ctx.sdk.doc(ctx.db,'eventReactions',eventId,'votes',ctx.uid);
  if(emoji===null)return ctx.sdk.deleteDoc(ref);
  return ctx.sdk.setDoc(ref,{emoji});
}
