import * as D from './data.js';
import {$,$$,esc,icon,safeImg,sheet,closeSheet,busy,toast,errText,compressImage,onSheetClose} from './ui.js';
import {EVENT_CATEGORIES,categoryLabel} from './event-categories.js';
import {eventCover} from './event-catalog.js';

export function eventDetailsHTML(event,{assetBase='',actions=false}={}){
  const cover=eventCover(event,assetBase),photos=(Array.isArray(event.photos)?event.photos:[]).filter(image=>safeImg(image));
  return `<div class="event-proposal-details">${cover?`<img class="event-proposal-poster" src="${esc(cover)}" alt="${esc(event.name)}">`:''}
    <span class="badge">${categoryLabel(event.category)}</span><h2 data-no-i18n>${esc(event.name)}</h2>
    <dl><div><dt>Dates</dt><dd ${event.start||(event.when&&event.when!=='Date to be announced')?'data-no-i18n':''}>${event.start?esc(event.start)+(event.end&&event.end!==event.start?' – '+esc(event.end):''):esc(event.when||'Date to be announced')}</dd></div>${event.time?`<div><dt>Time</dt><dd data-no-i18n>${esc(event.time)}</dd></div>`:''}<div><dt>Venue</dt><dd ${event.location?'data-no-i18n':''}>${esc(event.location||'Venue to be announced')}</dd></div>${event.organiser?`<div><dt>Organiser</dt><dd data-no-i18n>${esc(event.organiser)}</dd></div>`:''}</dl>
    <p class="event-proposal-description" data-no-i18n>${esc(event.description)}</p>${photos.length?`<div class="event-photo-grid">${photos.map((image,i)=>`<img src="${safeImg(image)}" alt="${esc(event.name)} — ${i+1}" loading="lazy">`).join('')}</div>`:''}${actions?`<div class="event-detail-actions">${event.sourcePosterPage?`<a class="btn primary" href="#/feskum" data-close>${icon('map')} Explore stalls</a>`:''}<a class="btn" href="#/contact/events" data-close>${icon('mail')} Ask about this event</a></div>`:''}</div>`;
}
export function openEventSubmission(app){
  const el=sheet(`<div class="event-form-heading"><span>${icon('megaphone')}</span><div><h2>Submit an event</h2><p>HEP reviews it. Approved events appear in the gallery.</p></div></div>
    <form id="event-submission-form" class="stack">
      <label class="field">Event name<input name="name" required maxlength="120"></label>
      <label class="field">Category<select name="category" required><option value="">Choose a category</option>${EVENT_CATEGORIES.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label>
      <div class="grid-2"><label class="field">Starts<input name="start" type="date" required></label><label class="field">Ends<input name="end" type="date" required></label></div>
      <label class="field">Time (optional)<input name="time" maxlength="80" placeholder="e.g. 10 am – 4 pm"></label>
      <label class="field">Venue<input name="location" required maxlength="160"></label>
      <label class="field">Organiser<input name="organiser" required maxlength="120"></label>
      <label class="field">Contact email<input name="contactEmail" type="email" required maxlength="254" value="${esc(app.user?.email||app.profile?.email||'')}"><small>Only you and HEP can see this.</small></label>
      <label class="field">About the event<textarea name="description" rows="3" required maxlength="1500"></textarea></label>
      <label class="field">Poster (optional)<input name="poster" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP. Up to 10 MB.</small></label>
      <img id="event-poster-preview" class="event-proposal-poster" alt="Poster preview" hidden>
      <p id="event-form-error" role="alert" class="event-form-error" hidden></p>
      <button type="submit" class="btn primary block">${icon('send')} Submit for approval</button>
    </form>`,{wide:true});
  const form=$('#event-submission-form',el),error=$('#event-form-error',el),preview=$('#event-poster-preview',el);
  let previewUrl;
  onSheetClose(()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);});
  form.elements.start.onchange=()=>{form.elements.end.min=form.elements.start.value;if(!form.elements.end.value)form.elements.end.value=form.elements.start.value;};
  form.elements.poster.onchange=()=>{
    if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;preview.hidden=true;
    const file=form.elements.poster.files[0];if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){form.elements.poster.value='';error.textContent='Choose a JPG, PNG or WebP poster under 10 MB.';error.hidden=false;return;}
    error.hidden=true;previewUrl=URL.createObjectURL(file);preview.src=previewUrl;preview.hidden=false;
  };
  let submitted=false,saving=false,closed=false;
  onSheetClose(()=>{closed=true;});
  form.onsubmit=e=>{e.preventDefault();if(submitted||saving)return;saving=true;
    busy($('button[type=submit]',form),async()=>{
      error.hidden=true;
      try{
        const input=Object.fromEntries(new FormData(form)),file=form.elements.poster.files[0];
        try{input.posterImage=file?await compressImage(file,1200,.82):'';}catch{throw new Error('We couldn’t read this poster. Try a JPG, PNG or WebP image.');}
        await D.submitEvent(app.ctx,input);submitted=true;
        if(closed){toast('Event submitted');return;}
        const done=sheet(`<div class="event-submission-success"><span>${icon('circle-check')}</span><h2>Event submitted</h2><p>Waiting for HEP approval. Once approved, it appears in the gallery automatically.</p><button class="btn primary block" type="button" id="view-my-events">My submissions</button><button class="btn block" type="button" data-close>Back to events</button></div>`);
        $('#view-my-events',done).onclick=()=>openMyEventSubmissions(app);
      }catch(err){if(!closed){error.textContent=errText(err);error.hidden=false;}}finally{saving=false;}
    });
  };
}
const statusLabel=s=>s==='approved'?'Approved':s==='rejected'?'Not approved':'Pending review';
export function openMyEventSubmissions(app){
  let stop;
  const el=sheet(`<h2>My submissions</h2><div class="event-submission-list" id="my-event-submissions" aria-live="polite"><p>Loading submissions…</p></div>`,{wide:true,onClose:()=>stop?.()});
  stop=D.watchEventSubmissions(app.ctx,true,items=>{
    if(!el.isConnected)return;
    $('#my-event-submissions',el).innerHTML=items.sort((a,b)=>(D.toMs(b.submittedAt)||0)-(D.toMs(a.submittedAt)||0)).map(item=>`<article class="event-submission-item"><div><h3 data-no-i18n>${esc(item.name)}</h3><span class="event-review-status ${item.status}">${statusLabel(item.status)}</span></div><p data-no-i18n>${esc(item.start)} · ${esc(item.location)}</p>${item.response?`<p class="event-review-response" data-no-i18n>${esc(item.response)}</p>`:''}${item.status==='approved'?`<a class="btn small" href="#/events" data-close>View event gallery ${icon('arrow-right')}</a>`:''}</article>`).join('')||`<p>No submissions yet.</p>`;
  },err=>{$('#my-event-submissions',el).textContent=errText(err);});
}
export function eventReviewQueueHTML(){
  return `<section class="event-review-queue" aria-labelledby="event-review-heading"><div class="event-review-heading"><h2 id="event-review-heading">Student events</h2><span class="badge" id="event-review-count" role="status">Pending review</span></div><div id="event-review-list" class="event-submission-list" aria-live="polite"><p>Loading submissions…</p></div></section>`;
}
export function mountEventReviewQueue(root,app){
  let items=[];
  const list=$('#event-review-list',root),count=$('#event-review-count',root);
  const stop=D.watchEventSubmissions(app.ctx,false,rows=>{
    items=rows.sort((a,b)=>(D.toMs(a.submittedAt)||0)-(D.toMs(b.submittedAt)||0));
    count.textContent=String(items.length);
    list.innerHTML=items.map(item=>`<article class="event-submission-item"><div><h3 data-no-i18n>${esc(item.name)}</h3><span class="event-review-status pending">Pending review</span></div><p data-no-i18n>${esc(item.start)} · ${esc(item.location)}</p><button class="btn small primary" type="button" data-review-event="${esc(item.id)}">Review event ${icon('arrow-right')}</button></article>`).join('')||`<p>No events waiting for review.</p>`;
  },err=>{list.textContent=errText(err);});
  const handler=e=>{
    const button=e.target.closest('[data-review-event]');if(!button)return;
    const item=items.find(v=>v.id===button.dataset.reviewEvent);if(!item)return;
    const el=sheet(`${eventDetailsHTML(item)}<p class="event-private-contact"><b>Contact email</b><span data-no-i18n>${esc(item.contactEmail)}</span></p>
      <form id="event-review-form" class="stack"><label class="field">Response to student<textarea name="response" rows="2" maxlength="500"></textarea><small>Add a reason if you decline.</small></label><p class="event-form-error" role="alert" hidden></p><div class="event-review-actions"><button class="btn warn" type="submit" name="decision" value="reject">Decline</button><button class="btn primary" type="submit" name="decision" value="approve">${icon('circle-check')} Approve & publish</button></div></form>`,{wide:true});
    let saving=false;
    $('#event-review-form',el).onsubmit=e=>{e.preventDefault();if(saving)return;const approve=e.submitter?.value==='approve',form=e.target,error=$('.event-form-error',form);
      saving=true;error.hidden=true;const otherButtons=$$('button',form).filter(b=>b!==e.submitter);otherButtons.forEach(b=>b.disabled=true);
      busy(e.submitter,async()=>{try{await D.reviewEvent(app.ctx,item.id,approve,form.elements.response.value);closeSheet();toast(approve?'Event published.':'Event declined.');app.render();}catch(err){error.textContent=errText(err);error.hidden=false;}finally{saving=false;otherButtons.forEach(b=>b.disabled=false);}});
    };
  };
  list.addEventListener('click',handler);return()=>{stop();list.removeEventListener('click',handler);};
}
