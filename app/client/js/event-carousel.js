// Original event artwork: user-supplied Feskum Intsa Feed.pdf, pages 3–13.
// Artwork and programme descriptions are kept separate from reward and check-in rules.
import { $, $$, esc, icon, sheet } from './ui.js';
import {EVENT_SLIDES,activeEventSlides,eventToday,feskumFloorMapAvailable} from './event-catalog.js';
export {EVENT_SLIDES};

const controlPaths = {
  pause:'<path d="M9 5v14M15 5v14"/>',
  play:'<path d="m8 5 11 7-11 7Z"/>',
  'chevron-left':'<path d="m15 18-6-6 6-6"/>',
  'arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>',
};
const eventIcon = name => controlPaths[name]?`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${controlPaths[name]}</svg>`:icon(name);
const imageFor = s => `assets/feskum-2026/feed-${String(s.page).padStart(2,'0')}.jpg`;
export const eventPosterImage = imageFor;
export function eventCarousel({page=false,today}={}) {
  const slides=activeEventSlides(today),s=slides[0];
  if(!s)return '';
  return `<section class="campus-event-showcase${page?'':' campus-event-showcase-home'}" id="campus-event-carousel" role="region" aria-roledescription="carousel" aria-label="Campus Events slideshow">
    ${page?'<div class="event-bunting" aria-hidden="true"></div>':''}
    <header class="event-showcase-heading">${page
      ? `<h1>Happening Now<span aria-hidden="true">✦</span></h1>`
      : `<h2><a href="#/events" aria-label="Upcoming campus events">Upcoming ${icon('arrow-right')}</a></h2>`}</header>
    <div class="event-showcase-body">
      <button class="event-poster" data-poster aria-label="View full poster: ${esc(s.title)}"><img data-slide-image src="${imageFor(s)}" width="1600" height="710" alt="${esc(s.title)} — original FESKUM event poster" fetchpriority="high" draggable="false">${page?`<span class="event-poster-hint">${icon('image')}</span>`:''}</button>
      ${page?`<div class="event-slide-caption"><div><span class="event-slide-tag" data-slide-tag>${esc(s.tag)}</span><h3 data-slide-title>${esc(s.title)}</h3><p data-slide-date>${icon('calendar')}<span>${esc(s.when)}</span></p><p data-slide-place>${icon('map-pin')}<span>${esc(s.where)}</span></p></div>${feskumFloorMapAvailable(today)?`<a class="btn event-explore-stalls" data-explore-stalls href="#/feskum">Explore stalls ${eventIcon('arrow-up-right')}</a>`:''}</div>`:''}
      ${page?`<div class="event-slide-controls"><div class="event-slide-buttons"><button data-prev aria-label="Previous event">${eventIcon('chevron-left')}</button><button data-play aria-label="Pause slideshow">${eventIcon('pause')}</button><button data-next aria-label="Next event">${icon('chevron-right')}</button></div><div class="event-slide-dots" aria-label="Choose event poster">${slides.map((slide,i)=>`<button data-slide="${i}" aria-label="Show poster ${i+1}: ${esc(slide.title)}" aria-pressed="${i===0}"></button>`).join('')}</div><span class="event-slide-count" data-slide-count>01 / ${slides.length}</span></div>`
        : `<button class="event-home-play" data-play aria-label="Pause slideshow">${eventIcon('pause')}</button>`}
    </div>
    ${page?`<footer class="event-showcase-footer"><span>${icon('info')} Campus events</span>${feskumFloorMapAvailable(today)?`<a href="#/feskum">Booth map ${icon('map-pin')}</a>`:''}</footer>`:''}
    <span class="sr" data-slide-status role="status" aria-live="polite"></span>
  </section>`;
}
export function mountEventCarousel(root) {
  const slides=activeEventSlides();
  const box=$('#campus-event-carousel',root);if(!box||!slides.length)return null;
  // A full reading interval begins after a transition, or after the reader returns.
  const slideDelayMs=8000,fadeDurationMs=900,motion=matchMedia('(prefers-reduced-motion: reduce)');
  let index=0,requestedIndex=0,paused=motion.matches,visible=true,hovered=false,focused=false;
  let timer=null,start=null,ignoreUntil=0,revision=0,transition=null,disposed=false;
  let image=$('[data-slide-image]',box);
  const play=$('[data-play]',box),poster=$('[data-poster]',box);
  const images=new Map();
  function prepare(i) {
    if(!images.has(i)){
      const job=new Promise((resolve,reject)=>{
        const next=new Image();next.width=1600;next.height=710;next.draggable=false;
        next.onload=async()=>{try{await next.decode?.();resolve(next);}catch(error){reject(error);}};
        next.onerror=()=>reject(new Error('Event poster unavailable'));
        next.src=imageFor(slides[i]);
      });
      images.set(i,job);
      // A failed poster can retry later; leave the current artwork visible.
      job.catch(()=>{if(images.get(i)===job)images.delete(i);});
    }
    return images.get(i);
  }
  function describe(manual=false) {
    const s=slides[index];
    image.alt=`${s.title} — original FESKUM event poster`;
    poster.setAttribute('aria-label',`View full poster: ${s.title}`);
    const title=$('[data-slide-title]',box);
    if(title){
      title.textContent=s.title;
      $('[data-slide-tag]',box).textContent=s.tag;
      $('[data-slide-date] span',box).textContent=s.when;
      $('[data-slide-place] span',box).textContent=s.where;
    }
    const count=$('[data-slide-count]',box);
    if(count)count.textContent=`${String(index+1).padStart(2,'0')} / ${slides.length}`;
    $$('[data-slide]',box).forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.slide===index)));
    if(manual)$('[data-slide-status]',box).textContent=`Poster ${index+1} of ${slides.length}: ${s.title}`;
    prepare((index+1)%slides.length).catch(()=>{});
  }
  function cancelTransition() {
    if(!transition)return;
    const current=transition;transition=null;
    current.animation.cancel();current.node.remove();
  }
  function syncPlay() {play.setAttribute('aria-label',paused?'Play slideshow':'Pause slideshow');play.innerHTML=eventIcon(paused?'play':'pause');}
  function arm() {
    clearTimeout(timer);timer=null;
    if(disposed||paused||!visible||hovered||focused||document.hidden)return;
    timer=setTimeout(()=>{
      timer=null;
      if(document.querySelector('#sheet[open]')){arm();return;}
      change(index+1,false);
    },slideDelayMs);
  }
  async function change(to,manual=true) {
    const target=(to+slides.length)%slides.length,version=++revision;
    requestedIndex=target;clearTimeout(timer);timer=null;cancelTransition();
    if(target===index){arm();return;}
    let next;
    try{next=await prepare(target);}catch{if(version===revision&&!disposed)arm();return;}
    if(disposed||version!==revision)return;
    // Reuse decoded image data, never the same DOM node across transitions.
    const node=next.cloneNode();node.alt='';node.setAttribute('aria-hidden','true');
    const commit=()=>{
      if(disposed||version!==revision)return;
      image.replaceWith(node);node.classList.remove('event-poster-incoming');
      node.removeAttribute('aria-hidden');node.dataset.slideImage='';
      image=node;index=target;transition=null;describe(manual);
    };
    if(!motion.matches&&!document.hidden&&visible&&typeof node.animate==='function'){
      node.classList.add('event-poster-incoming');poster.append(node);
      const animation=node.animate([{opacity:0},{opacity:1}],{duration:fadeDurationMs,easing:'ease-in-out',fill:'both'});
      const current={animation,node,commit};transition=current;
      try{await animation.finished;}catch{return;}
      if(transition!==current||disposed||version!==revision)return;
      commit();animation.cancel();
    }else commit();
    arm();
  }
  const prev=$('[data-prev]',box),next=$('[data-next]',box);
  if(prev)prev.onclick=()=>change(requestedIndex-1);
  if(next)next.onclick=()=>change(requestedIndex+1);
  play.onclick=()=>{paused=!paused;if(!paused){focused=false;hovered=false;}syncPlay();arm();};
  $$('[data-slide]',box).forEach(b=>b.onclick=()=>change(+b.dataset.slide));
  function details() {
    // If a reader opens a poster mid-fade, show that exact incoming poster.
    if(transition){const current=transition;current.commit();current.animation.cancel();}
    openEventPoster(slides[index]);
  }
  poster.onclick=()=>{if(performance.now()>ignoreUntil)details();};
  poster.onpointerdown=e=>{start={x:e.clientX,y:e.clientY};};
  poster.onpointercancel=()=>{start=null;};
  poster.onpointerup=e=>{if(!start)return;const x=e.clientX-start.x,y=e.clientY-start.y;start=null;if(Math.abs(x)>45&&Math.abs(x)>Math.abs(y)){ignoreUntil=performance.now()+400;change(requestedIndex+(x<0?1:-1));}};
  box.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();change(requestedIndex+(e.key==='ArrowRight'?1:-1));}};
  const enter=()=>{hovered=true;arm();},leave=()=>{hovered=false;arm();};
  const focus=()=>{focused=true;arm();},blur=e=>{if(!box.contains(e.relatedTarget)){focused=false;arm();}};
  const visibility=()=>{
    if(document.hidden&&transition){const current=transition;current.commit();current.animation.cancel();}
    arm();
  };
  const preference=()=>{
    if(motion.matches){paused=true;if(transition){const current=transition;current.commit();current.animation.cancel();}}
    syncPlay();arm();
  };
  box.addEventListener('mouseenter',enter);box.addEventListener('mouseleave',leave);
  box.addEventListener('focusin',focus);box.addEventListener('focusout',blur);
  document.addEventListener('visibilitychange',visibility);motion.addEventListener?.('change',preference);
  const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;arm();},{threshold:.25}):null;
  observer?.observe(box);syncPlay();describe();arm();
  function cleanup(){
    clearInterval(expiryTimer);disposed=true;revision++;clearTimeout(timer);cancelTransition();observer?.disconnect();
    box.removeEventListener('mouseenter',enter);box.removeEventListener('mouseleave',leave);
    box.removeEventListener('focusin',focus);box.removeEventListener('focusout',blur);
    document.removeEventListener('visibilitychange',visibility);motion.removeEventListener?.('change',preference);
    poster.onclick=poster.onpointerdown=poster.onpointerup=poster.onpointercancel=box.onkeydown=play.onclick=null;
    if(prev)prev.onclick=null;if(next)next.onclick=null;
    $$('[data-slide]',box).forEach(b=>b.onclick=null);
  }
  const renderedDay=eventToday();let replacementCleanup=null;
  const expiryTimer=setInterval(()=>{
    if(disposed||renderedDay===eventToday())return;
    cleanup();
    const html=eventCarousel({page:!box.classList.contains('campus-event-showcase-home')});
    if(!html){box.remove();return;}
    const holder=document.createElement('div');holder.innerHTML=html;
    box.replaceWith(holder.firstElementChild);replacementCleanup=mountEventCarousel(root);
  },1000);
  return ()=>{cleanup();replacementCleanup?.();};
}

// Gallery and slideshow open the same original artwork and organiser details.
export function openEventPoster(s,{status=''}={}) {
  sheet(`<div class="event-poster-dialog">${status?`<span class="badge">${esc(status)}</span>`:""}<span class="event-slide-tag">${esc(s.tag)}</span><h2>${esc(s.title)}</h2><p>${esc(s.when)}</p><p class="muted">${esc(s.where)}</p><a href="${imageFor(s)}" target="_blank" rel="noopener" aria-label="Open full-size poster: ${esc(s.title)}"><img src="${imageFor(s)}" alt="${esc(s.title)} — full event poster"></a>${s.note?`<p>${esc(s.note)}</p>`:''}<p class="faint">Confirm current details with the organiser.</p>${feskumFloorMapAvailable()?`<a class="btn primary" href="#/feskum" data-close>${icon('map-pin')} Explore stalls</a>`:''}</div>`,{wide:true});
}
