import * as D from './data.js';
import {$,$$,esc,icon,sheet,n,toast,errText} from './ui.js';
import {openEventSubmission,openMyEventSubmissions,eventDetailsHTML} from './event-submissions-ui.js';
import {openEventPoster} from './event-carousel.js';
import {EVENT_CATEGORIES,categoryLabel} from './event-categories.js';
import {EVENT_REACTIONS,reactionKey,watchEventReactions,setEventReaction} from './event-reactions.js';
import {eventCalendarHTML,eventsInMonth,eventsOnDate,eventArchiveEvents,shiftEventMonth,calendarDateLabel} from './event-calendar.js';
import {galleryEvents,eventCover,eventToday,eventExpired,feskumFloorMapAvailable} from './event-catalog.js';
export {galleryEvents};
function reactionsHTML(event){return `<div class="event-reactions" role="group" aria-label="React to event">${EVENT_REACTIONS.map(([emoji,label])=>`<button type="button" data-event-react="${esc(emoji)}" data-reaction-key="${esc(reactionKey(event))}" aria-label="${label}" aria-pressed="false"><span data-no-i18n>${emoji}</span><span data-reaction-count>0</span></button>`).join('')}</div>`;}
export function eventCardsHTML(events){return events.map((c,i)=>`<article class="event-gallery-card tone-${i%4}" data-event-open="${esc(c.id)}" data-event-category="${c.category}"><button type="button" class="event-gallery-hit" aria-label="${esc(c.name)}"></button><span class="event-gallery-art">${eventCover(c)?`<img src="${esc(eventCover(c))}" alt="${esc(c.name)}" loading="lazy" draggable="false">`:`<span class="event-gallery-generated" aria-hidden="true">${icon(EVENT_CATEGORIES.find(([id])=>id===c.category)?.[2]||'calendar')}</span>`}<span class="event-gallery-status ${c.status==='Past event'||c.archive?'is-past':''}">${c.status==='Past event'?'Ended':c.status}</span></span><div class="event-gallery-copy"><span class="event-gallery-category">${categoryLabel(c.category)}</span><h3 data-no-i18n>${esc(c.name)}</h3><span class="event-gallery-meta">${icon('calendar')}<span ${c.when==='Date to be announced'?'':'data-no-i18n'}>${esc(c.when)}</span></span><span class="event-gallery-meta">${icon('map-pin')}<span ${c.location?'data-no-i18n':''}>${esc(c.location||'Venue to be announced')}</span></span><span class="event-gallery-open">Explore event ${icon('arrow-right')}</span></div>${reactionsHTML(c)}</article>`).join('');}
export async function eventGalleryRender(app){
  const campaigns=await D.listCampaigns(app.ctx).catch(()=>[]);
  const all=galleryEvents(campaigns,eventToday(),{includeExpired:true}),events=all.filter(e=>!e.archive&&!eventExpired(e));app._galleryEvents=all;app._galleryCampaigns=campaigns;
  return `<div class="event-gallery-page"><header class="event-gallery-hero"><div><span class="info-eyebrow">Your campus, happening.</span><h1>Happening Now</h1><p>Find your next campus experience.</p></div><span class="event-gallery-emblem" aria-hidden="true">${icon('calendar')}<i>${icon('sparkles')}</i></span></header>
    <div class="event-gallery-actions"><button type="button" class="event-submit" data-event-submit><span>${icon('megaphone')}</span><div><b>Have an event to promote?</b><small>Submit it here.</small></div>${icon('arrow-right')}</button><button class="btn" type="button" data-my-events>${icon('calendar')} My submissions</button></div>
    <section aria-label="Browse campus events"><div class="event-view-switch" role="group" aria-label="Event views"><button type="button" data-event-view="upcoming" aria-pressed="true">${icon('sparkles')}Upcoming<span data-view-count="upcoming">${n(events.length)}</span></button><button type="button" data-event-view="past" aria-pressed="false">${icon('clock')}Past events<span data-view-count="past">${n(eventArchiveEvents(all).length)}</span></button><button type="button" data-event-view="calendar" aria-pressed="false">${icon('calendar')}Calendar</button></div><div class="event-filter-heading"><h2 id="event-view-title">Upcoming & ongoing</h2><span id="event-gallery-count" role="status" aria-live="polite">${n(events.length)} <span>${events.length===1?'event':'events'}</span></span></div>
    <div class="event-gallery-filters" role="group" aria-label="Filter events"><button type="button" data-event-filter="all" aria-pressed="true">${icon('layout-dashboard')} All</button>${EVENT_CATEGORIES.map(([id,label,glyph])=>`<button type="button" data-event-filter="${id}" aria-pressed="false">${icon(glyph)}${label}</button>`).join('')}</div>
    <div class="event-calendar" hidden></div><h3 class="sr" data-calendar-agenda-title hidden></h3><div class="event-gallery-grid">${eventCardsHTML(events)}</div>
    <div class="event-gallery-empty" hidden>${icon('calendar')}<h3 data-event-empty-title>No events in this category yet.</h3><p data-event-empty-copy>Try another category or tell us about your event.</p><button type="button" class="btn primary" data-event-filter="all">See all events</button></div></section>
    <a class="event-gallery-map" hidden data-explore-stalls href="#/feskum">${icon('map')}<span><b>FESKUM 2026</b><small data-feskum-map-copy>Archived stalls and floor map.</small></span>${icon('arrow-right')}</a></div>`;
}
export function eventGalleryMount(root,app){
  let selected='all',disposed=false,campaigns=app._galleryCampaigns||[],busy=new Set(),renderedDay=eventToday(),view='upcoming',month=renderedDay.slice(0,7),selectedDay=renderedDay,shown=[];
  const reactionStops=new Map(),reactionState=new Map();
  const paintReactions=()=>$$('[data-event-react]',root).forEach(button=>{
    const state=reactionState.get(button.dataset.reactionKey),emoji=button.dataset.eventReact;
    button.setAttribute('aria-pressed',String(state?.mine===emoji));
    button.disabled=busy.has(button.dataset.reactionKey)||!state;
    $('[data-reaction-count]',button).textContent=n(state?.counts[emoji]||0);
  });
  const syncReactions=()=>{
    const keys=new Set(shown.map(reactionKey));
    for(const [key,stop]of reactionStops)if(!keys.has(key)){stop();reactionStops.delete(key);}
    for(const key of keys)if(!reactionStops.has(key))reactionStops.set(key,watchEventReactions(app.ctx,key,state=>{if(disposed)return;reactionState.set(key,state);paintReactions();},error=>{if(!disposed)toast(errText(error),true);}));
    paintReactions();
  };
  const render=()=>{
    if(disposed)return;
    const all=app._galleryEvents||[],active=all.filter(e=>!e.archive&&!eventExpired(e,renderedDay)),past=eventArchiveEvents(all,renderedDay);
    const inCategory=events=>events.filter(e=>selected==='all'||e.category===selected);
    const matching=inCategory(view==='past'?past:view==='calendar'?all:active);
    const calendar=$('.event-calendar',root);
    calendar.hidden=$('[data-calendar-agenda-title]',root).hidden=view!=='calendar';
    if(view==='calendar'){
      const oldMonth=calendar.dataset.month,monthChanged=oldMonth!==month;calendar.dataset.month=month;
      calendar.innerHTML=eventCalendarHTML(matching,month,selectedDay,renderedDay);
      if(monthChanged&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
        const direction=oldMonth&&month<oldMonth?-1:1;
        $('.event-calendar-days',calendar).animate?.([{opacity:.35,transform:`translateX(${direction*16}px)`},{opacity:1,transform:'translateX(0)'}],{duration:300,easing:'cubic-bezier(.2,.8,.2,1)'});
      }
      $('[data-calendar-agenda-title]',root).textContent=calendarDateLabel(selectedDay);
      $('[data-calendar-agenda-title]',root).setAttribute('data-no-i18n','');
    }
    shown=view==='calendar'?eventsOnDate(matching,selectedDay):matching;
    $('.event-gallery-grid',root).innerHTML=eventCardsHTML(shown);
    $('.event-gallery-grid',root).classList.toggle('is-calendar-agenda',view==='calendar');
    const feskum=shown.filter(event=>event.sourcePosterPage);
    $('.event-gallery-map',root).hidden=feskum.length===0||!feskumFloorMapAvailable(renderedDay);
    $('[data-feskum-map-copy]',root).textContent=feskum.some(event=>!event.archive&&!eventExpired(event,renderedDay))?'Explore the stalls and floor map.':'Archived stalls and floor map.';
    $$('[data-event-view]',root).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventView===view)));
    $('[data-view-count="upcoming"]',root).textContent=n(active.length);$('[data-view-count="past"]',root).textContent=n(past.length);
    $('#event-view-title',root).textContent=view==='past'?'Past events':view==='calendar'?'Event calendar':'Upcoming & ongoing';
    $$('[data-event-filter]',root).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventFilter===selected)));
    const count=view==='calendar'?eventsInMonth(matching,month).length:shown.length;
    $('#event-gallery-count',root).innerHTML=`${n(count)} <span>${count===1?'event':'events'}</span>`;
    $('.event-gallery-empty',root).hidden=shown.length>0;
    $('[data-event-empty-title]',root).textContent=view==='calendar'?'Nothing listed for this day.':view==='past'?'No past events in this category yet.':'No events in this category yet.';
    $('[data-event-empty-copy]',root).textContent=view==='calendar'?'Choose a highlighted day to explore its events.':'Try another category or tell us about your event.';
    $('.event-gallery-empty [data-event-filter]',root).hidden=view==='calendar';
    syncReactions();
  };
  const refresh=()=>{
    if(disposed)return;renderedDay=eventToday();app._galleryEvents=galleryEvents(campaigns,renderedDay,{includeExpired:true});render();
  };
  const stop=D.watchCampaigns(app.ctx,records=>{campaigns=records;refresh();},err=>{if(!disposed)toast(errText(err),true);});
  // Re-evaluate dates when a tab stays open overnight or returns from the background.
  const checkDate=()=>{if(eventToday()!==renderedDay)refresh();};
  const timer=setInterval(checkDate,1000),resume=()=>{if(!document.hidden)checkDate();};
  document.addEventListener('visibilitychange',resume);
  const handler=async e=>{
    const switcher=e.target.closest('[data-event-view]');
    if(switcher){view=switcher.dataset.eventView;render();return;}
    const monthControl=e.target.closest('[data-calendar-month]');
    if(monthControl){month=shiftEventMonth(month,Number(monthControl.dataset.calendarMonth));selectedDay=month+'-01';render();return;}
    if(e.target.closest('[data-calendar-today]')){selectedDay=renderedDay;month=renderedDay.slice(0,7);render();return;}
    const day=e.target.closest('[data-calendar-day]');
    if(day){
      selectedDay=day.dataset.calendarDay;render();const button=$('[data-calendar-day="'+selectedDay+'"]',root);button?.focus({preventScroll:true});
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
        button?.animate?.([{transform:'scale(.92)'},{transform:'scale(1.04)'},{transform:'scale(1)'}],{duration:290,easing:'ease-out'});
        $('.event-gallery-grid',root).animate?.([{opacity:.4,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'ease-out'});
      }return;
    }
    const reaction=e.target.closest('[data-event-react]');
    if(reaction){
      const key=reaction.dataset.reactionKey;if(busy.has(key))return;
      busy.add(key);paintReactions();
      try{await setEventReaction(app.ctx,key,reactionState.get(key)?.mine===reaction.dataset.eventReact?null:reaction.dataset.eventReact);}
      catch(error){toast(errText(error),true);}finally{busy.delete(key);if(!disposed)paintReactions();}
      return;
    }
    if(e.target.closest('[data-event-submit]'))return openEventSubmission(app);
    if(e.target.closest('[data-my-events]'))return openMyEventSubmissions(app);
    const filter=e.target.closest('[data-event-filter]');
    if(filter){
      selected=filter.dataset.eventFilter;render();
      $('.event-gallery-filters [data-event-filter="'+selected+'"]',root)?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});return;
    }
    const button=e.target.closest('[data-event-open]');if(!button)return;
    const event=app._galleryEvents.find(c=>c.id===button.dataset.eventOpen);if(!event)return;
    if(event.poster&&!event.edited)return openEventPoster(event.poster,{status:eventExpired(event,renderedDay)?'Ended':event.archive?'Archived':''});
    return sheet(eventDetailsHTML(event,{actions:true}));

  };
  const languageObserver=new MutationObserver(()=>{if(view==='calendar')render();});languageObserver.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  render();root.addEventListener('click',handler);return()=>{disposed=true;stop();languageObserver.disconnect();clearInterval(timer);document.removeEventListener('visibilitychange',resume);for(const stopReaction of reactionStops.values())stopReaction();root.removeEventListener('click',handler);};
}
