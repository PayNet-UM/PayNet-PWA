import * as D from './data.js';
import {galleryEvents,eventCover} from './event-catalog.js';
import {EVENT_CATEGORIES} from './event-categories.js';
import {eventReviewQueueHTML,mountEventReviewQueue} from './event-submissions-ui.js';
import {hepHeading,hepEmblem} from './hep-ui.js';
import {siteUrls} from './firebase-config.js';
import {$,$$,esc,icon,n,rm,safeImg,sheet,closeSheet,confirmSheet,busy,errText,toast,compressImage} from './ui.js';

const assetBase=()=>siteUrls.client.replace(/\/?$/,'/');
export async function eventAdminRender(app){
  const records=await D.listCampaigns(app.ctx);
  app._adminEvents=galleryEvents(records,D.dayKey(),{includeHidden:true});
  return `${hepHeading('Campus events','Review, edit and publish events.','calendar',`<button class="btn primary" id="new">${icon('plus')} New event</button>`)}
    ${eventReviewQueueHTML()}<div class="event-admin-heading"><h2>Event gallery</h2><span class="badge">${n(app._adminEvents.length)}</span></div>
    <div class="hep-campaign-grid event-admin-grid">${app._adminEvents.map(event=>{
      const cover=eventCover(event,assetBase());
      return `<article class="card hep-campaign event-admin-card ${event.published===false?'event-is-hidden':''}">${cover?`<img class="event-admin-cover" src="${esc(cover)}" alt="${esc(event.name)}" loading="lazy">`:''}<div class="hep-campaign-top">${hepEmblem('calendar',true)}<button type="button" class="btn small" data-c="${esc(event.id)}">${icon('pencil')} Edit event</button></div><span class="badge">${event.status}</span><h2 data-no-i18n>${esc(event.name)}</h2>${event.description?`<p class="event-admin-description" data-no-i18n>${esc(event.description)}</p>`:''}<div class="hep-campaign-details"><span>${icon('calendar')}<span ${event.when==='Date to be announced'?'':'data-no-i18n'}>${esc(event.when)}</span></span><span>${icon('map-pin')}<span data-no-i18n>${esc(event.location||'—')}</span></span></div>${event.budgetCents?`<div class="hep-campaign-bottom"><span>Campaign budget<strong class="num">${rm(event.budgetCents)}</strong></span></div>`:''}</article>`;
    }).join('')}</div>`;
}
async function photoData(file,maxLength,maxSide){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Choose a JPG, PNG or WebP photo under 10 MB.');
  try{
    for(let side=maxSide;side>=200;side=Math.floor(side*.75)){
      const image=await compressImage(file,side,.82);if(image.length<=maxLength)return image;
    }
  }catch{throw new Error('We couldn’t read this photo. Try a JPG, PNG or WebP image.');}
  throw new Error('Choose smaller event photos.');
}
export function openEventEditor(app,event=null){
  let cover=safeImg(event?.posterImage),photos=(Array.isArray(event?.photos)?event.photos:[]).filter(image=>safeImg(image)),original=event?.useOriginalPoster!==false,closed=false,loading=false,saving=false;
  const source=event?.sourcePosterPage;
  const el=sheet(`<h2>${event?'Edit event':'New event'}</h2><form id="cf" class="stack event-admin-form">
    <label class="field">Event name<input name="name" required maxlength="120" value="${esc(event?.name||'')}"></label>
    <label class="field">About the event<textarea name="description" rows="3" maxlength="1500">${esc(event?.description||'')}</textarea></label>
    <label class="field">Event category<select name="category">${EVENT_CATEGORIES.map(([id,label])=>`<option value="${id}" ${id===(event?.category||'other')?'selected':''}>${label}</option>`).join('')}</select></label>
    <div class="grid-2"><label class="field">Starts<input name="start" type="date" ${event?'':'required'} value="${esc(event?.start||'')}"></label><label class="field">Ends<input name="end" type="date" ${event?'':'required'} value="${esc(event?.end||'')}"></label></div>
    <div class="grid-2"><label class="field">Venue<input name="location" maxlength="160" value="${esc(event?.location||'')}"></label><label class="field">Time (optional)<input name="time" maxlength="80" value="${esc(event?.time||'')}"></label></div>
    <div class="grid-2"><label class="field">Organiser<input name="organiser" maxlength="120" value="${esc(event?.organiser||'')}"></label><label class="field">Budget (RM)<input name="budget" type="number" min="0" max="10000000000" step="0.01" value="${(event?.budgetCents||0)/100}"></label></div>
    <section class="event-editor-media"><h3>Cover photo</h3><p class="faint">Shown on the event card.</p><div id="event-cover-preview"></div><label class="field">Upload cover<input id="event-cover-input" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="row wrap"><button class="btn small" type="button" id="remove-event-cover">Remove cover</button>${source?'<button class="btn small" type="button" id="original-event-cover">Use original poster</button>':''}</div></section>
    <section class="event-editor-media"><h3>More photos</h3><p class="faint">Up to 3 photos inside the event.</p><div id="event-extra-previews" class="event-editor-thumbnails"></div><label class="field">Add photos<input id="event-photos-input" type="file" multiple accept="image/jpeg,image/png,image/webp"></label><small>JPG, PNG or WebP. Up to 10 MB each.</small></section>
    <label class="check"><input name="published" type="checkbox" ${event?.published===false?'':'checked'}><span>Show in event gallery</span></label>
    <label class="check"><input name="archive" type="checkbox" ${event?.archive?'checked':''}><span>Poster archive</span></label>
    <p id="event-media-status" role="status" hidden>Preparing photos…</p><p id="event-editor-error" class="event-form-error" role="alert" hidden></p>
    <div class="event-review-actions">${event?.recordId?`<button type="button" class="btn warn" id="del">${source?'Restore original event':'Delete event'}</button>`:''}<button class="btn primary" type="submit">${icon('circle-check')} Save event</button></div></form>`,{wide:true,onClose:()=>{closed=true;}});
  const form=$('#cf',el),error=$('#event-editor-error',el),save=$('button.primary',form),inputs=[$('#event-cover-input',el),$('#event-photos-input',el)];
  const fail=err=>{if(!closed){error.textContent=errText(err);error.hidden=false;}};
  const paint=()=>{
    const image=eventCover({posterImage:cover,sourcePosterPage:source,useOriginalPoster:original},assetBase());
    $('#event-cover-preview',el).innerHTML=image?`<img class="event-proposal-poster" src="${esc(image)}" alt="Cover preview">`:'';
    $('#remove-event-cover',el).disabled=!image;
    $('#event-extra-previews',el).innerHTML=photos.map((image,i)=>`<div><img src="${safeImg(image)}" alt="Event photo ${i+1}"><button class="btn small warn" type="button" data-remove-event-photo="${i}">${icon('trash-2')} Remove</button></div>`).join('');
  };
  const working=value=>{loading=value;save.disabled=value;inputs.forEach(input=>input.disabled=value);$('#event-media-status',el).hidden=!value;};
  inputs[0].onchange=async()=>{
    const file=inputs[0].files[0];if(!file)return;working(true);error.hidden=true;
    try{const image=await photoData(file,600000,1400);if(!closed){cover=image;paint();}}catch(err){fail(err);}finally{if(!closed){inputs[0].value='';working(false);}}
  };
  inputs[1].onchange=async()=>{
    const files=Array.from(inputs[1].files);if(!files.length)return;
    if(photos.length+files.length>3){inputs[1].value='';return fail(new Error('Add up to 3 extra photos.'));}
    working(true);error.hidden=true;
    try{const added=[];for(const file of files)added.push(await photoData(file,120000,1000));if(!closed){photos.push(...added);paint();}}catch(err){fail(err);}finally{if(!closed){inputs[1].value='';working(false);}}
  };
  $('#event-extra-previews',el).onclick=e=>{const button=e.target.closest('[data-remove-event-photo]');if(button){photos.splice(Number(button.dataset.removeEventPhoto),1);paint();}};
  $('#remove-event-cover',el).onclick=()=>{cover='';original=false;paint();};
  if(source)$('#original-event-cover',el).onclick=()=>{cover='';original=true;paint();};
  form.elements.start.onchange=()=>{form.elements.end.min=form.elements.start.value;if(!form.elements.end.value)form.elements.end.value=form.elements.start.value;};
  form.onsubmit=e=>{e.preventDefault();if(saving||loading)return;saving=true;error.hidden=true;
    busy(save,async()=>{
      try{
        const f=form.elements;
        await D.saveGalleryEvent(app.ctx,event?.recordId|| (source?'poster-'+source:null),{name:f.name.value,description:f.description.value,category:f.category.value,start:f.start.value,end:f.end.value,time:f.time.value,location:f.location.value,organiser:f.organiser.value,budgetCents:Math.round(Number(f.budget.value)*100),published:f.published.checked,archive:f.archive.checked,posterImage:cover,photos,useOriginalPoster:original,...(source?{sourcePosterPage:source}:{})});
        if(!closed){closeSheet();toast('Event saved.');app.render();}
      }catch(err){fail(err);}finally{saving=false;}
    });
  };
  if($('#del',el))$('#del',el).onclick=async()=>{
    if(loading||saving)return;
    const yes=await confirmSheet(source?'Restore original event?':'Delete event?',source?'Restore the supplied poster and original event details?':'This deletes the event and its photos.',source?'Restore':'Delete',true);
    if(!yes)return openEventEditor(app,event);
    try{await D.deleteCampaign(app.ctx,event.recordId);toast(source?'Original event restored.':'Event deleted.');app.render();}catch(err){toast(errText(err),true);openEventEditor(app,event);}
  };
  paint();
}
export function eventAdminMount(root,app){
  $('#new',root).onclick=()=>openEventEditor(app);
  $$('[data-c]',root).forEach(button=>button.onclick=()=>openEventEditor(app,app._adminEvents.find(e=>e.id===button.dataset.c)));
  return mountEventReviewQueue(root,app);
}
