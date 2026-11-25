import {EVENT_CATEGORIES,eventCategory} from './event-categories.js';
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
// Dates are transcribed from the original FESKUM posters; registration deadlines take priority.
const DATES={3:['2026-11-11','2026-11-11'],4:['2026-11-04','2026-11-14'],6:['2026-11-14','2026-11-14'],7:['2026-11-15','2026-11-16'],8:['2026-11-13','2026-11-14'],9:['2026-11-07','2026-11-07'],10:['2026-11-01','2026-11-06'],11:['2026-10-07','2026-10-07'],13:['2026-10-15','2026-10-15']};
const TYPES={3:'festivals',4:'bazaars',5:'festivals',6:'sports',7:'festivals',8:'other',9:'competitions',10:'music',11:'other',12:'festivals',13:'competitions'};
const validPage=page=>EVENT_SLIDES.some(s=>s.page===page);
const validImage=image=>typeof image==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image);
export function eventCover(event,base=''){
  if(validImage(event.posterImage))return event.posterImage;
  return validPage(event.sourcePosterPage)&&event.useOriginalPoster!==false?base+`assets/feskum-2026/feed-${String(event.sourcePosterPage).padStart(2,'0')}.jpg`:'';
}
export const eventToday=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
export function eventExpired(event,today=eventToday()){
  const deadline=event.deadline||event.end||event.start;
  return Boolean(deadline&&deadline<today);
}
export function activeEventSlides(today=eventToday()){
  return EVENT_SLIDES.filter(s=>!eventExpired({end:DATES[s.page]?.[1]},today)&&![5,9,11,12,13].includes(s.page));
}
export function galleryEvents(campaigns=[],today=eventToday(),{includeHidden=false,includeExpired=includeHidden}={}){
  const when=(e,fallback='Date to be announced')=>e.start?e.start+(e.end&&e.end!==e.start?' – '+e.end:'')+(e.time?' · '+e.time:''):fallback;
  const overrides=new Map(campaigns.filter(c=>validPage(c.sourcePosterPage)).map(c=>[c.sourcePosterPage,c]));
  const originals=EVENT_SLIDES.map(s=>{
    const original={id:'poster-'+s.page,recordId:null,name:s.title,category:TYPES[s.page],when:s.when,time:s.when.includes(' · ')?s.when.split(' · ').slice(1).join(' · '):'',location:s.where,poster:s,page:s.page,sourcePosterPage:s.page,start:DATES[s.page]?.[0],end:DATES[s.page]?.[1],archive:[5,9,11,12,13].includes(s.page),description:s.note};
    const update=overrides.get(s.page);
    return update?{...original,...update,id:original.id,recordId:update.id,edited:true,when:when(update,original.when)}:original;
  });
  const added=campaigns.filter(c=>!validPage(c.sourcePosterPage)).map(c=>({...c,id:'campaign-'+c.id,recordId:c.id,when:when(c)}));
  return [...added,...originals].filter(e=>(includeHidden||e.published!==false)&&(includeExpired||(!e.archive&&!eventExpired(e,today)))).map(e=>({...e,category:eventCategory(e),status:e.published===false?'Hidden':e.archive?'Poster archive':e.end&&e.end<today?'Past event':e.start&&e.start>today?'Upcoming':!e.start&&!e.end?'Date to be announced':'Happening now'})).sort((a,b)=>['Happening now','Upcoming','Past event','Poster archive','Date to be announced','Hidden'].indexOf(a.status)-['Happening now','Upcoming','Past event','Poster archive','Date to be announced','Hidden'].indexOf(b.status));
}
export function adminEventDraft(input,{allowUndated=false}={}){
  const fields={name:120,description:1500,time:80,location:160,organiser:120},draft={};
  for(const [key,max]of Object.entries(fields)){
    draft[key]=String(input[key]||'').trim();if(draft[key].length>max)throw new Error('An event field is too long.');
  }
  if(!draft.name)throw new Error('Enter an event name.');
  draft.category=String(input.category||'');if(!EVENT_CATEGORIES.some(([id])=>id===draft.category))throw new Error('Choose an event category.');
  draft.start=String(input.start||'');draft.end=String(input.end||'');
  for(const value of [draft.start,draft.end])if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw new Error('Choose valid event dates.');
  if((!allowUndated||draft.start||draft.end)&&(!draft.start||!draft.end))throw new Error('Choose valid event dates.');
  if(draft.end<draft.start)throw new Error('End date must be after the start date.');
  draft.posterImage=String(input.posterImage||'');draft.photos=Array.isArray(input.photos)?input.photos:[];
  if((draft.posterImage&&(!validImage(draft.posterImage)||draft.posterImage.length>600000))||draft.photos.length>3||draft.photos.some(image=>!validImage(image)||image.length>120000))throw new Error('Choose smaller event photos.');
  if(draft.posterImage.length+draft.photos.reduce((sum,image)=>sum+image.length,0)>980000)throw new Error('Choose smaller event photos.');
  draft.budgetCents=Number(input.budgetCents||0);if(!Number.isSafeInteger(draft.budgetCents)||draft.budgetCents<0||draft.budgetCents>1000000000000)throw new Error('Enter a valid event budget.');
  draft.published=input.published!==false;draft.archive=input.archive===true;draft.useOriginalPoster=input.useOriginalPoster!==false;
  if(input.sourcePosterPage!==undefined){if(!validPage(input.sourcePosterPage))throw new Error('Unknown original poster.');draft.sourcePosterPage=input.sourcePosterPage;}
  return draft;
}
