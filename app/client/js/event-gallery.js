import * as D from './data.js';
import {$,$$,esc,icon,sheet,n,toast,errText} from './ui.js';
import {openEventSubmission,openMyEventSubmissions,eventDetailsHTML} from './event-submissions-ui.js';
import {openEventPoster} from './event-carousel.js';
import {EVENT_CATEGORIES,categoryLabel} from './event-categories.js';
import {galleryEvents,eventCover} from './event-catalog.js';
export {galleryEvents};
export function eventCardsHTML(events){return events.map((c,i)=>`<article class="event-gallery-card tone-${i%4}" data-event-open="${esc(c.id)}" data-event-category="${c.category}"><button type="button" class="event-gallery-hit" aria-label="${esc(c.name)}"></button><span class="event-gallery-art">${eventCover(c)?`<img src="${esc(eventCover(c))}" alt="${esc(c.name)}" loading="lazy" draggable="false">`:`<span class="event-gallery-generated" aria-hidden="true">${icon(EVENT_CATEGORIES.find(([id])=>id===c.category)?.[2]||'calendar')}</span>`}<span class="event-gallery-status ${c.status==='Past event'||c.archive?'is-past':''}">${c.status}</span></span><div class="event-gallery-copy"><span class="event-gallery-category">${categoryLabel(c.category)}</span><h3 data-no-i18n>${esc(c.name)}</h3><span class="event-gallery-meta">${icon('calendar')}<span ${c.when==='Date to be announced'?'':'data-no-i18n'}>${esc(c.when)}</span></span><span class="event-gallery-meta">${icon('map-pin')}<span ${c.location?'data-no-i18n':''}>${esc(c.location||'Venue to be announced')}</span></span><span class="event-gallery-open">Explore event ${icon('arrow-right')}</span></div></article>`).join('');}
export async function eventGalleryRender(app){
  const campaigns=await D.listCampaigns(app.ctx).catch(()=>[]);
  const events=galleryEvents(campaigns);app._galleryEvents=events;
  return `<div class="event-gallery-page"><header class="event-gallery-hero"><div><span class="info-eyebrow">Your campus, happening.</span><h1>Happening Now</h1><p>Find your next campus experience.</p></div><span class="event-gallery-emblem" aria-hidden="true">${icon('calendar')}<i>${icon('sparkles')}</i></span></header>
    <div class="event-gallery-actions"><button type="button" class="event-submit" data-event-submit><span>${icon('megaphone')}</span><div><b>Have an event to promote?</b><small>Submit it here.</small></div>${icon('arrow-right')}</button><button class="btn" type="button" data-my-events>${icon('calendar')} My submissions</button></div>
    <section aria-label="Browse campus events"><div class="event-filter-heading"><h2>Explore events</h2><span id="event-gallery-count" role="status" aria-live="polite">${n(events.length)} <span>${events.length===1?'event':'events'}</span></span></div>
    <div class="event-gallery-filters" role="group" aria-label="Filter events"><button type="button" data-event-filter="all" aria-pressed="true">${icon('layout-dashboard')} All</button>${EVENT_CATEGORIES.map(([id,label,glyph])=>`<button type="button" data-event-filter="${id}" aria-pressed="false">${icon(glyph)}${label}</button>`).join('')}</div>
    <div class="event-gallery-grid">${eventCardsHTML(events)}</div>
    <div class="event-gallery-empty" hidden>${icon('calendar')}<h3>No events in this category yet.</h3><p>Try another category or tell us about your event.</p><button type="button" class="btn primary" data-event-filter="all">See all events</button></div></section>
    <a class="event-gallery-map" data-explore-stalls href="#/feskum">${icon('map')}<span><b>FESKUM 2026</b><small>Explore the stalls and floor map.</small></span>${icon('arrow-right')}</a></div>`;
}
export function eventGalleryMount(root,app){
  let selected='all',disposed=false;
  const applyFilter=()=>{
    $$('[data-event-filter]',root).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.eventFilter===selected)));
    let count=0;$$('[data-event-category]',root).forEach(card=>{card.hidden=selected!=='all'&&card.dataset.eventCategory!==selected;if(!card.hidden)count++;});
    $('#event-gallery-count',root).innerHTML=`${n(count)} <span>${count===1?'event':'events'}</span>`;$('.event-gallery-empty',root).hidden=count>0;
  };
  const stop=D.watchCampaigns(app.ctx,campaigns=>{
    if(disposed)return;app._galleryEvents=galleryEvents(campaigns);
    $('.event-gallery-grid',root).innerHTML=eventCardsHTML(app._galleryEvents);applyFilter();
  },err=>{if(!disposed)toast(errText(err),true);});
  const handler=e=>{
    if(e.target.closest('[data-event-submit]'))return openEventSubmission(app);
    if(e.target.closest('[data-my-events]'))return openMyEventSubmissions(app);
    const filter=e.target.closest('[data-event-filter]');
    if(filter){
      selected=filter.dataset.eventFilter;applyFilter();
      $('.event-gallery-filters [data-event-filter="'+selected+'"]',root)?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});return;
    }
    const button=e.target.closest('[data-event-open]');if(!button)return;
    const event=app._galleryEvents.find(c=>c.id===button.dataset.eventOpen);if(!event)return;
    if(event.poster&&!event.edited)return openEventPoster(event.poster);
    return sheet(eventDetailsHTML(event,{actions:true}));

  };
  root.addEventListener('click',handler);return()=>{disposed=true;stop();root.removeEventListener('click',handler);};
}
