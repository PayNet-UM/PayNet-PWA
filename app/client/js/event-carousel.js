// Original event artwork: user-supplied Feskum Intsa Feed.pdf, pages 3–13.
// Artwork and programme descriptions are kept separate from reward and check-in rules.
import { $, $$, esc, icon, sheet } from './ui.js';
export const EVENT_SLIDES = [
  {page:3,title:'Majlis Pelancaran FESKUM',tag:'Festival launch',when:'11 November 2026 · 7:30–10:00 pm',where:'Marquee Tent, beside HIR',note:'Dress code: gold & cream.'},
  {page:4,title:'Gerai Jualan · Fasa 1',tag:'Food & shopping',when:'4–14 November 2026 · 10:00 am–11:00 pm',where:'HIR & KPS parking areas',note:'Booth positions on the map are samples.'},
  {page:5,title:'Pre-FESKUM calendar',tag:'Tentative programme',when:'November 2026',where:'Universiti Malaya',note:'Dates may change.'},
  {page:6,title:'Melody Run',tag:'Run to the rhythm',when:'14 November 2026 · 8:00 pm',where:'Marquee Tent HIR & around UM',note:''},
  {page:7,title:'Unity Fest · Atelier Social',tag:'Connect & celebrate',when:'15–16 November',where:'Varsity Lake, Universiti Malaya',note:'Art, community and celebration.'},
  {page:8,title:'Mind Swap',tag:'Discover something new',when:'13–14 November 2026 · 9:00 am–5:00 pm',where:'Marquee Tent',note:''},
  {page:9,title:'Battle of the Bands',tag:'Registration poster',when:'Registration until 7 November 2026 · 11:59 pm',where:'FESKUM 2026',note:'NusaRock band registration. Scan the original poster’s QR or check with the organiser for current availability.'},
  {page:10,title:'Open Stage',tag:'Registration poster',when:'Registration: 1–6 November 2026',where:'Performances: 4–6 & 11–14 November 2026',note:'Performance and registration details are reproduced from the supplied poster.'},
  {page:11,title:'Join the secretariat',tag:'Poster archive',when:'Poster deadline: 7 October 2026 · 11:59 pm',where:'FESKUM organising team',note:'Recruitment has closed.'},
  {page:12,title:'What is FESKUM?',tag:'Meet the festival',when:'Festival Konvokesyen Universiti Malaya',where:'Universiti Malaya',note:'Get to know the celebration behind the campus festival.'},
  {page:13,title:'Pencarian Pengacara',tag:'Poster archive',when:'Poster deadline: 15 October 2026 · 11:59 pm',where:'FESKUM 2026',note:'Recruitment has closed.'},
];
const controlPaths = {
  pause:'<path d="M9 5v14M15 5v14"/>',
  play:'<path d="m8 5 11 7-11 7Z"/>',
  'chevron-left':'<path d="m15 18-6-6 6-6"/>',
  'arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>',
};
const eventIcon = name => controlPaths[name]?`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${controlPaths[name]}</svg>`:icon(name);
const imageFor = s => `assets/feskum-2026/feed-${String(s.page).padStart(2,'0')}.jpg`;
export function eventCarousel({page=false}={}) {
  const s=EVENT_SLIDES[0];
  return `<section class="campus-event-showcase${page?'':' campus-event-showcase-home'}" id="campus-event-carousel" role="region" aria-roledescription="carousel" aria-label="Campus Events slideshow">
    ${page?'<div class="event-bunting" aria-hidden="true"></div>':''}
    <header class="event-showcase-heading">${page
      ? `<h1>Happening Now<span aria-hidden="true">✦</span></h1>`
      : `<h2><a href="#/events" aria-label="Upcoming campus events">Upcoming ${icon('arrow-right')}</a></h2>`}</header>
    <div class="event-showcase-body">
      <button class="event-poster" data-poster aria-label="View full poster: ${esc(s.title)}"><img data-slide-image src="${imageFor(s)}" width="1600" height="710" alt="${esc(s.title)} — original FESKUM event poster" fetchpriority="high" draggable="false">${page?`<span class="event-poster-hint">${icon('image')}</span>`:''}</button>
      ${page?`<div class="event-slide-caption"><div><span class="event-slide-tag" data-slide-tag>${esc(s.tag)}</span><h3 data-slide-title>${esc(s.title)}</h3><p data-slide-date>${icon('calendar')}<span>${esc(s.when)}</span></p><p data-slide-place>${icon('map-pin')}<span>${esc(s.where)}</span></p></div><button class="btn" data-details>Details ${eventIcon('arrow-up-right')}</button></div>`:''}
      ${page?`<div class="event-slide-controls"><div class="event-slide-buttons"><button data-prev aria-label="Previous event">${eventIcon('chevron-left')}</button><button data-play aria-label="Pause slideshow">${eventIcon('pause')}</button><button data-next aria-label="Next event">${icon('chevron-right')}</button></div><div class="event-slide-dots" aria-label="Choose event poster">${EVENT_SLIDES.map((slide,i)=>`<button data-slide="${i}" aria-label="Show poster ${i+1}: ${esc(slide.title)}" aria-pressed="${i===0}"></button>`).join('')}</div><span class="event-slide-count" data-slide-count>01 / 11</span></div>`
        : `<button class="event-home-play" data-play aria-label="Pause slideshow">${eventIcon('pause')}</button>`}
    </div>
    ${page?`<footer class="event-showcase-footer"><span>${icon('info')} Includes archived posters</span><a href="#/feskum">Booth map ${icon('map-pin')}</a></footer>`:''}
    <span class="sr" data-slide-status role="status" aria-live="polite"></span>
  </section>`;
}
export function mountEventCarousel(root) {
  const box=$('#campus-event-carousel',root);if(!box)return null;
  const slideDelayMs = box.classList.contains('campus-event-showcase-home') ? 3000 : 6000;
  let index=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,visible=true,timer=null,start=null,ignoreUntil=0;
  const image=$('[data-slide-image]',box),play=$('[data-play]',box);
  function draw(manual=false) {
    const s=EVENT_SLIDES[index];
    const changed=image.getAttribute('src')!==imageFor(s);
    image.src=imageFor(s);
    if(changed&&!matchMedia('(prefers-reduced-motion: reduce)').matches)image.animate([{opacity:.4,transform:'translateX(10px)'},{opacity:1,transform:'translateX(0)'}],{duration:350,easing:'ease-out'});
    const preload=new Image();preload.src=imageFor(EVENT_SLIDES[(index+1)%EVENT_SLIDES.length]);
    image.alt=`${s.title} — original FESKUM event poster`;
    $('[data-poster]',box).setAttribute('aria-label',`View full poster: ${s.title}`);
    const title=$('[data-slide-title]',box);
    if(title){
    title.textContent=s.title;
    $('[data-slide-tag]',box).textContent=s.tag;
    $('[data-slide-date] span',box).textContent=s.when;
    $('[data-slide-place] span',box).textContent=s.where;
    }
    const count=$('[data-slide-count]',box);
    if(count)count.textContent=`${String(index+1).padStart(2,'0')} / ${EVENT_SLIDES.length}`;
    $$('[data-slide]',box).forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.slide===index)));
    if(manual)$('[data-slide-status]',box).textContent=`Poster ${index+1} of ${EVENT_SLIDES.length}: ${s.title}`;
  }
  function syncPlay() {play.setAttribute('aria-label',paused?'Play slideshow':'Pause slideshow');play.innerHTML=eventIcon(paused?'play':'pause');}
  function arm() {
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if(!paused&&visible&&!document.hidden&&!document.querySelector('#sheet[open]')){index=(index+1)%EVENT_SLIDES.length;draw();}
      arm();
    },slideDelayMs);
  }
  function change(to) {index=(to+EVENT_SLIDES.length)%EVENT_SLIDES.length;draw(true);arm();}
  const prev=$('[data-prev]',box),next=$('[data-next]',box);
  if(prev)prev.onclick=()=>change(index-1);
  if(next)next.onclick=()=>change(index+1);
  play.onclick=()=>{paused=!paused;syncPlay();arm();};
  $$('[data-slide]',box).forEach(b=>b.onclick=()=>change(+b.dataset.slide));
  function details() {
    const s=EVENT_SLIDES[index];
    sheet(`<div class="event-poster-dialog"><span class="event-slide-tag">${esc(s.tag)}</span><h2>${esc(s.title)}</h2><p>${esc(s.when)}</p><p class="muted">${esc(s.where)}</p><a href="${imageFor(s)}" target="_blank" rel="noopener" aria-label="Open full-size poster: ${esc(s.title)}"><img src="${imageFor(s)}" alt="${esc(s.title)} — full event poster"></a>${s.note?`<p>${esc(s.note)}</p>`:''}<p class="faint">Confirm current details with the organiser.</p><a class="btn primary" href="#/feskum" data-close>${icon('map-pin')} Explore booth map</a></div>`,{wide:true});
  }
  $('[data-poster]',box).onclick=()=>{if(performance.now()>ignoreUntil)details();};
  const detailsButton=$('[data-details]',box);
  if(detailsButton)detailsButton.onclick=details;
  $('[data-poster]',box).onpointerdown=e=>{start={x:e.clientX,y:e.clientY};};
  $('[data-poster]',box).onpointerup=e=>{if(!start)return;const x=e.clientX-start.x,y=e.clientY-start.y;start=null;if(Math.abs(x)>45&&Math.abs(x)>Math.abs(y)){ignoreUntil=performance.now()+400;change(index+(x<0?1:-1));}};
  box.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();change(index+(e.key==='ArrowRight'?1:-1));}};
  const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;},{threshold:.25}):null;
  observer?.observe(box);syncPlay();draw();arm();
  return ()=>{clearTimeout(timer);observer?.disconnect();};
}
