import * as D from './data.js';
import {$,$$,esc,icon,sheet,n,toast,errText} from './ui.js';
import {openEventSubmission,openMyEventSubmissions,eventDetailsHTML} from './event-submissions-ui.js';
import {openEventPoster} from './event-carousel.js';
import {EVENT_CATEGORIES,categoryLabel} from './event-categories.js';
import {EVENT_REACTIONS,reactionKey,watchEventReactions,setEventReaction} from './event-reactions.js';
import {eventCalendarHTML,eventsInMonth,eventsOnDate,eventArchiveEvents,shiftEventMonth,shiftEventDay,calendarDateLabel} from './event-calendar.js';
import {galleryEvents,eventCover,eventToday,eventExpired,feskumFloorMapAvailable} from './event-catalog.js';
import {EASE,rubber,springBack} from './oz-motion.js';
const calReduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
// Month/week change like iOS Calendar: the old page and the new one slide together on the push curve while the grid's
// height glides between 5 and 6 rows. No fade from nothing, no overshoot. `from` is where a swipe left the old page.
function slideCalendarPage(calendar,ghost,direction,from=0){
  const days=$('.event-calendar-days',calendar);if(!days||!ghost||calReduced()||!days.animate)return;
  const oldH=+ghost.dataset.h,newH=days.offsetHeight,w=days.offsetWidth,opts={duration:340,easing:EASE.push};
  Object.assign(ghost.style,{position:'absolute',left:days.offsetLeft+'px',top:days.offsetTop+'px',width:w+'px',margin:'0',pointerEvents:'none'});
  ghost.setAttribute('aria-hidden','true');ghost.inert=true;calendar.append(ghost);calendar.classList.add('is-sliding');
  ghost.animate([{translate:from+'px 0',opacity:1},{translate:(-direction*w+from*.2)+'px 0',opacity:.3}],opts);
  days.animate([{translate:(direction*w+from)+'px 0'},{translate:'0 0'}],opts);
  if(oldH&&oldH!==newH)days.animate([{height:oldH+'px',overflow:'hidden'},{height:newH+'px',overflow:'hidden'}],opts);
  setTimeout(()=>{ghost.remove();calendar.classList.remove('is-sliding');},opts.duration);
}
export {galleryEvents};
function reactionsHTML(event){return `<div class="event-reactions" role="group" aria-label="React to event">${EVENT_REACTIONS.map(([emoji,label])=>`<button type="button" data-event-react="${esc(emoji)}" data-reaction-key="${esc(reactionKey(event))}" aria-label="${label}" aria-pressed="false"><span data-no-i18n>${emoji}</span><span data-reaction-count>0</span></button>`).join('')}</div>`;}
// Date poster for events without artwork (Figma "Event Poster Card · Date poster" 977:6340).
export function datePosterHTML(c){
  const d=/^\d{4}-\d{2}-\d{2}$/.test(c.start||'')?new Date(c.start+'T00:00:00+08:00'):null;
  if(!d)return '<span class="event-gallery-generated oz-date-poster is-tba" aria-hidden="true"><small>Date</small><b>TBA</b></span>';
  const day=k=>Number(String(k).slice(8,10)),month=d.toLocaleDateString('en-MY',{month:'short',timeZone:'Asia/Kuala_Lumpur'});
  const range=c.end&&c.end!==c.start&&c.end.slice(0,7)===c.start.slice(0,7)?`${day(c.start)}–${day(c.end)}`:String(day(c.start));
  return `<span class="event-gallery-generated oz-date-poster" aria-hidden="true"><small>${month}</small><b data-no-i18n>${range}</b></span>`;
}
const stateOf=c=>c.status==='Past event'||c.archive?'past':c.status==='Happening now'?'now':c.status==='Date to be announced'||!c.start?'tba':'up';
const statusText=c=>c.status==='Past event'?'Ended':c.archive?'Poster archive':c.status;
export function eventCardsHTML(events){return events.map(c=>{const st=stateOf(c);return `<article class="event-gallery-card oz-evcard is-${st}" data-event-open="${esc(c.id)}" data-event-category="${c.category}"><button type="button" class="event-gallery-hit" aria-label="${esc(c.name)}"></button>
  <span class="event-gallery-art oz-evcard-art">${eventCover(c)?`<img src="${esc(eventCover(c))}" alt="${esc(c.name)}" loading="lazy" draggable="false">`:datePosterHTML(c)}</span>
  <div class="event-gallery-copy oz-evcard-body"><span class="event-gallery-status oz-evcard-tag ${st==='past'?'is-past':''}">${statusText(c)}</span><h3 data-no-i18n>${esc(c.name)}</h3>
    <span class="event-gallery-meta oz-evcard-meta">${icon('calendar')}<span ${c.when==='Date to be announced'?'':'data-no-i18n'}>${esc(c.when)}</span></span>
    <span class="event-gallery-meta oz-evcard-meta">${icon('map-pin')}<span ${c.location?'data-no-i18n':''}>${esc(c.location||'Venue to be announced')}</span></span></div>${reactionsHTML(c)}</article>`;}).join('');}
// Group headings live inside the grid (Figma "Happening now" / "Coming up"; Past: "Past events" / "Poster archive").
function groupedHTML(events,view){
  const groups=view==='past'?[['Past events',events.filter(e=>!e.archive)],['Poster archive',events.filter(e=>e.archive)]]
    :view==='calendar'?[['',events]]:[['Happening now',events.filter(e=>stateOf(e)==='now')],['Coming up',events.filter(e=>stateOf(e)!=='now')]];
  return groups.filter(([,list])=>list.length).map(([title,list])=>`${title?`<h2 class="oz-ev-group">${title}</h2>`:''}<div class="oz-ev-cards${title==='Happening now'?' is-now':''}">${eventCardsHTML(list)}</div>`).join('');
}
export async function eventGalleryRender(app){
  const campaigns=await D.listCampaigns(app.ctx).catch(()=>[]);
  const all=galleryEvents(campaigns,eventToday(),{includeExpired:true}),events=all.filter(e=>!e.archive&&!eventExpired(e));app._galleryEvents=all;app._galleryCampaigns=campaigns;
  // Campus Events (Figma phone 441:1416, web 918:30845 / Past 918:30965). Upcoming | Past | Calendar, search,
  // categories, "Showing N", grouped cards, then the FESKUM / submit actions. Counts never sit inside the switch
  // (two-digit counts used to break it).
  return `<div class="event-gallery-page oz-events oz-ev">
    <div class="oz-ev-head"><h1 class="oz-page-title">Campus Events</h1>
      <div class="oz-seg oz-ev-views event-view-switch" role="group" aria-label="Event views"><button type="button" class="oz-seg-item" data-event-view="upcoming" aria-pressed="true">Upcoming</button><button type="button" class="oz-seg-item" data-event-view="past" aria-pressed="false">Past</button><button type="button" class="oz-seg-item" data-event-view="calendar" aria-pressed="false">Calendar</button></div></div>
    <section class="oz-ev-browse" aria-label="Browse campus events">
      <div class="oz-ev-tools"><label class="oz-ev-search">${icon('search')}<input type="search" id="event-search" placeholder="Search events" aria-label="Search events" autocomplete="off"></label>
        <div class="event-gallery-filters oz-ev-chips" role="group" aria-label="Filter events"><button type="button" data-event-filter="all" aria-pressed="true">All</button>${EVENT_CATEGORIES.map(([id,label])=>`<button type="button" data-event-filter="${id}" aria-pressed="false">${label}</button>`).join('')}</div></div>
      <div class="oz-ev-status"><h2 id="event-view-title" class="sr">Upcoming events</h2><span id="event-gallery-count" role="status" aria-live="polite">Showing ${n(events.length)} ${events.length===1?'event':'events'}</span><span class="sr" data-view-count="upcoming">${n(events.length)}</span><span class="sr" data-view-count="past">${n(eventArchiveEvents(all).length)}</span></div>
      <div class="event-calendar oz-cal2" hidden></div><h3 class="oz-ev-agenda-title" data-calendar-agenda-title hidden></h3>
      <div class="event-gallery-grid oz-ev-grid">${groupedHTML(events,'upcoming')}</div>
      <div class="event-gallery-empty oz-ev-empty" hidden>${icon('calendar')}<h3 data-event-empty-title>No events in this category yet.</h3><p data-event-empty-copy>Try another category or tell us about your event.</p><button type="button" class="oz-btn oz-btn-ghost oz-btn-sm" data-event-filter="all"><span>See all events</span></button></div>
    </section>
    <div class="oz-ev-actions"><a class="event-gallery-map oz-btn oz-btn-ghost oz-btn-md" hidden data-explore-stalls href="#/feskum"><span>Explore FESKUM booths</span><small class="sr" data-feskum-map-copy>Archived stalls and floor map.</small></a>
      <button type="button" class="event-submit oz-btn oz-btn-ghost oz-btn-md" data-event-submit><span>Have an event to promote? Submit it</span></button>
      <button type="button" class="oz-btn oz-btn-ghost oz-btn-md" data-my-events><span>My submissions</span></button></div></div>`;
}
export function eventGalleryMount(root,app){
  let selected='all',query='',calMode='month',disposed=false,campaigns=app._galleryCampaigns||[],busy=new Set(),renderedDay=eventToday(),view='upcoming',month=renderedDay.slice(0,7),selectedDay=renderedDay,shown=[];
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
    const inCategory=events=>events.filter(e=>(selected==='all'||e.category===selected)&&(!query||`${e.name} ${e.location||''} ${e.when||''}`.toLowerCase().includes(query)));
    const matching=inCategory(view==='past'?past:view==='calendar'?all:active);
    const calendar=$('.event-calendar',root);
    calendar.hidden=$('[data-calendar-agenda-title]',root).hidden=view!=='calendar';
    if(view==='calendar'){
      // Same page, only the selected day moved: update in place so the selection eases instead of the grid redrawing
      // (the redraw used to snap a pressed day from .92 back to full size, the "clunky bounce").
      const page=calMode==='week'?shiftEventDay(selectedDay,-((new Date(selectedDay+'T12:00:00Z').getUTCDay()+6)%7)):month;
      const key=[calMode,page,document.documentElement.lang,renderedDay,matching.map(e=>e.id+':'+(e.category||'')).join(',')].join('|');
      if(calendar.dataset.key===key){
        $$('[data-calendar-day]',calendar).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.calendarDay===selectedDay)));
      }else{
        const oldPage=calendar.dataset.page,oldMode=calendar.dataset.mode,old=$('.event-calendar-days',calendar);
        const ghost=old&&oldPage&&oldPage!==page&&oldMode===calMode?old.cloneNode(true):null;if(ghost)ghost.dataset.h=old.offsetHeight;
        calendar.dataset.key=key;calendar.dataset.page=page;calendar.dataset.mode=calMode;calendar.dataset.month=month;
        calendar.innerHTML=eventCalendarHTML(matching,month,selectedDay,renderedDay,calMode);
        if(ghost)slideCalendarPage(calendar,ghost,page<oldPage?-1:1,swipeFrom);
      }
      swipeFrom=0;
      $('[data-calendar-agenda-title]',root).textContent=calendarDateLabel(selectedDay);
      $('[data-calendar-agenda-title]',root).setAttribute('data-no-i18n','');
    }
    shown=view==='calendar'?eventsOnDate(matching,selectedDay):matching;
    $('.event-gallery-grid',root).innerHTML=groupedHTML(shown,view);
    $('.event-gallery-grid',root).classList.toggle('is-calendar-agenda',view==='calendar');
    const feskum=shown.filter(event=>event.sourcePosterPage);
    $('.event-gallery-map',root).hidden=feskum.length===0||!feskumFloorMapAvailable(renderedDay);
    $('[data-feskum-map-copy]',root).textContent=feskum.some(event=>!event.archive&&!eventExpired(event,renderedDay))?'Explore the stalls and floor map.':'Archived stalls and floor map.';
    $$('[data-event-view]',root).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventView===view)));
    $('[data-view-count="upcoming"]',root).textContent=n(active.length);$('[data-view-count="past"]',root).textContent=n(past.length);$('.oz-ev',root)?.classList.toggle('is-calendar',view==='calendar');
    $('#event-view-title',root).textContent=view==='past'?'Past events':view==='calendar'?'Event calendar':'Upcoming events';
    $$('[data-event-filter]',root).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventFilter===selected)));
    const count=view==='calendar'?eventsInMonth(matching,month).length:shown.length;
    $('#event-gallery-count',root).textContent=view==='calendar'?`${n(count)} ${count===1?'event':'events'} this month`:`Showing ${n(count)} ${count===1?'event':'events'}`;
    $('.event-gallery-empty',root).hidden=shown.length>0;
    $('[data-event-empty-title]',root).textContent=view==='calendar'?'Nothing on this day.':query?'No events match your search.':view==='past'?'No past events in this category yet.':'No events in this category yet.';
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
  // Swipe the month (or week) grid sideways to change it: the grid follows the finger with rubber-band resistance; a
  // flick or a pull past a quarter of the width turns the page, anything less springs back with its release velocity.
  let swipeFrom=0,drag=null,suppressClick=false;
  const turn=step=>{if(calMode==='week'){selectedDay=shiftEventDay(selectedDay,step*7);month=selectedDay.slice(0,7);}else{month=shiftEventMonth(month,step);selectedDay=month+'-01';}render();};
  const down=e=>{const days=e.target.closest?.('.event-calendar-days');if(!days||view!=='calendar'||e.button>0)return;drag={days,x:e.clientX,y:e.clientY,t:performance.now(),dx:0,v:0,on:false,id:e.pointerId};};
  const move=e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.on){if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}if(Math.abs(dx)<8)return;drag.on=true;drag.days.setPointerCapture?.(e.pointerId);}
    const now=performance.now();drag.v=(dx-drag.dx)/Math.max(1,now-drag.t)*1000;drag.t=now;drag.dx=dx;
    drag.days.style.translate=rubber(dx,drag.days.offsetWidth*.6)+'px 0';};
  const up=e=>{if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;if(!d.on)return;suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
    const shown=parseFloat(d.days.style.translate)||0,w=d.days.offsetWidth;
    if(e.type==='pointerup'&&(Math.abs(d.dx)>w*.25||(Math.abs(d.v)>500&&Math.sign(d.v)===Math.sign(d.dx)))){d.days.style.translate='';swipeFrom=shown;turn(d.dx<0?1:-1);}
    else springBack(d.days,shown,calReduced()?0:d.v);};
  root.addEventListener('pointerdown',down);root.addEventListener('pointermove',move);root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
  const handler=async e=>{
    if(suppressClick&&e.target.closest('.event-calendar-days'))return;
    const switcher=e.target.closest('[data-event-view]');
    if(switcher){view=switcher.dataset.eventView;render();return;}
    const modeControl=e.target.closest('[data-calendar-mode]');
    if(modeControl){calMode=modeControl.dataset.calendarMode;render();return;}
    const monthControl=e.target.closest('[data-calendar-month]');
    if(monthControl){turn(Number(monthControl.dataset.calendarMonth));return;}
    if(e.target.closest('[data-calendar-today]')){selectedDay=renderedDay;month=renderedDay.slice(0,7);render();return;}
    const day=e.target.closest('[data-calendar-day]');
    if(day){
      selectedDay=day.dataset.calendarDay;render();const button=$('[data-calendar-day="'+selectedDay+'"]',root);button?.focus({preventScroll:true});
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
        $('.event-gallery-grid',root).animate?.([{opacity:0,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'}); // no bounce on the day
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
  const search=$('#event-search',root);let searchTimer;if(search)search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{query=search.value.trim().toLowerCase();render();},120);};
  render();root.addEventListener('click',handler);return()=>{clearTimeout(searchTimer);disposed=true;stop();languageObserver.disconnect();clearInterval(timer);document.removeEventListener('visibilitychange',resume);for(const stopReaction of reactionStops.values())stopReaction();root.removeEventListener('click',handler);root.removeEventListener('pointerdown',down);root.removeEventListener('pointermove',move);root.removeEventListener('pointerup',up);root.removeEventListener('pointercancel',up);};
}
