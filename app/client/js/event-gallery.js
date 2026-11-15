import * as D from './data.js';
import {$,$$,esc,icon,sheet,n} from './ui.js';
import {EVENT_SLIDES,openEventPoster} from './event-carousel.js';
import {EVENT_CATEGORIES,eventCategory,categoryLabel} from './event-categories.js';
// Dates are transcribed from the original FESKUM posters. Recruitment posters stay labelled as archives.
const DATES={3:['2026-11-11','2026-11-11'],4:['2026-11-04','2026-11-14'],6:['2026-11-14','2026-11-14'],7:['2026-11-15','2026-11-16'],8:['2026-11-13','2026-11-14'],9:['2026-11-07','2026-11-07'],10:['2026-11-04','2026-11-14'],11:['2026-10-07','2026-10-07'],13:['2026-10-15','2026-10-15']};
const TYPES={3:'festivals',4:'bazaars',5:'festivals',6:'sports',7:'festivals',8:'other',9:'competitions',10:'music',11:'other',12:'festivals',13:'competitions'};
export function galleryEvents(campaigns=[],today=D.dayKey()){
  const posters=EVENT_SLIDES.map(s=>({id:'poster-'+s.page,name:s.title,category:TYPES[s.page],when:s.when,location:s.where,poster:s,page:s.page,start:DATES[s.page]?.[0],end:DATES[s.page]?.[1],archive:[5,9,11,12,13].includes(s.page),description:s.note}));
  return [...campaigns.map(c=>({...c,id:'campaign-'+c.id,category:eventCategory(c),when:c.start?c.start+(c.end&&c.end!==c.start?' – '+c.end:''):'Date to be announced'})),...posters].map(c=>({...c,status:c.archive?'Poster archive':c.end&&c.end<today?'Past event':c.start&&c.start>today?'Upcoming':!c.start&&!c.end?'Date to be announced':'Happening now'})).sort((a,b)=>['Happening now','Upcoming','Past event','Poster archive','Date to be announced'].indexOf(a.status)-['Happening now','Upcoming','Past event','Poster archive','Date to be announced'].indexOf(b.status));
}
export async function eventGalleryRender(app){
  const campaigns=await D.listCampaigns(app.ctx).catch(()=>[]);
  const events=galleryEvents(campaigns);app._galleryEvents=events;
  return `<div class="event-gallery-page"><header class="event-gallery-hero"><div><span class="info-eyebrow">Your campus, happening.</span><h1>Happening Now</h1><p>Find your next campus experience.</p></div><span class="event-gallery-emblem" aria-hidden="true">${icon('calendar')}<i>${icon('sparkles')}</i></span></header>
    <a class="event-submit" href="#/contact/events"><span>${icon('megaphone')}</span><div><b>Have an event to promote?</b><small>Submit it here.</small></div>${icon('arrow-right')}</a>
    <section aria-label="Browse campus events"><div class="event-filter-heading"><h2>Explore events</h2><span id="event-gallery-count" role="status" aria-live="polite">${n(events.length)} <span>events</span></span></div>
    <div class="event-gallery-filters" role="group" aria-label="Filter events"><button type="button" data-event-filter="all" aria-pressed="true">${icon('layout-dashboard')} All</button>${EVENT_CATEGORIES.map(([id,label,glyph])=>`<button type="button" data-event-filter="${id}" aria-pressed="false">${icon(glyph)}${label}</button>`).join('')}</div>
    <div class="event-gallery-grid">${events.map((c,i)=>`<article class="event-gallery-card tone-${i%4}" data-event-open="${esc(c.id)}" data-event-category="${c.category}"><button type="button" class="event-gallery-hit" aria-label="${esc(c.name)}"></button><span class="event-gallery-art">${c.poster?`<img src="assets/feskum-2026/feed-${String(c.page).padStart(2,'0')}.jpg" alt="${esc(c.name)} — original FESKUM event poster" width="1600" height="710" loading="lazy" draggable="false">`:`<span class="event-gallery-generated" aria-hidden="true">${icon(EVENT_CATEGORIES.find(([id])=>id===c.category)?.[2]||'calendar')}</span>`}<span class="event-gallery-status ${c.status==='Past event'||c.archive?'is-past':''}">${c.status}</span></span><div class="event-gallery-copy"><span class="event-gallery-category">${categoryLabel(c.category)}</span><h3>${esc(c.name)}</h3><span class="event-gallery-meta">${icon('calendar')}<span>${esc(c.when)}</span></span><span class="event-gallery-meta">${icon('map-pin')}<span>${esc(c.location||'Venue to be announced')}</span></span><span class="event-gallery-open">Explore event ${icon('arrow-right')}</span></div></article>`).join('')}</div>
    <div class="event-gallery-empty" hidden>${icon('calendar')}<h3>No events in this category yet.</h3><p>Try another category or tell us about your event.</p><button type="button" class="btn primary" data-event-filter="all">See all events</button></div></section>
    <a class="event-gallery-map" data-explore-stalls href="#/feskum">${icon('map')}<span><b>FESKUM 2026</b><small>Explore the stalls and floor map.</small></span>${icon('arrow-right')}</a></div>`;
}
export function eventGalleryMount(root,app){
  const handler=e=>{
    const filter=e.target.closest('[data-event-filter]');
    if(filter){
      const selected=filter.dataset.eventFilter;
      $$('[data-event-filter]',root).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventFilter===selected)));
      let count=0;$$('[data-event-category]',root).forEach(card=>{card.hidden=selected!=='all'&&card.dataset.eventCategory!==selected;if(!card.hidden)count++;});
      $('.event-gallery-filters [data-event-filter="'+selected+'"]',root)?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
      $('#event-gallery-count',root).innerHTML=`${n(count)} <span>events</span>`;$('.event-gallery-empty',root).hidden=count>0;return;
    }
    const button=e.target.closest('[data-event-open]');if(!button)return;
    const event=app._galleryEvents.find(c=>c.id===button.dataset.eventOpen);if(!event)return;
    if(event.poster)return openEventPoster(event.poster);
    sheet(`<div class="event-detail"><span class="event-gallery-category">${categoryLabel(event.category)}</span><h2>${esc(event.name)}</h2><p>${icon('calendar')} ${esc(event.when)}</p><p>${icon('map-pin')} ${esc(event.location||'Venue to be announced')}</p><p>${esc(event.description||'More details soon.')}</p><a class="btn" href="#/contact/events" data-close>${icon('mail')} Ask about this event</a></div>`);
  };
  root.addEventListener('click',handler);return()=>root.removeEventListener('click',handler);
}
