import {esc,icon,n} from './ui.js';
import {eventToday,eventExpired} from './event-catalog.js';
import {ozIcon} from './oz-icons.js';
const locale=()=>typeof document!=='undefined'&&document.documentElement.lang==='ms'?'ms-MY':'en-MY';
const utc=day=>new Date(day+'T12:00:00Z');
const iso=date=>date.toISOString().slice(0,10);
export function shiftEventMonth(month,offset){const d=utc(month+'-01');d.setUTCMonth(d.getUTCMonth()+offset);return iso(d).slice(0,7);}
export function shiftEventDay(day,offset){const d=utc(day);d.setUTCDate(d.getUTCDate()+offset);return iso(d);}
export function eventsOnDate(events,day){return events.filter(e=>e.start&&e.start<=day&&(e.end||e.start)>=day);}
export function eventsInMonth(events,month){const last=iso(new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0,12)));return events.filter(e=>e.start&&e.start<=last&&(e.end||e.start)>=month+'-01');}
export function calendarDays(events,month){
  const first=utc(month+'-01'),offset=(first.getUTCDay()+6)%7,total=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return Array.from({length:Math.ceil((offset+total)/7)*7},(_,index)=>{
    const number=index-offset+1;if(number<1||number>total)return null;
    const day=month+'-'+String(number).padStart(2,'0');return {day,number,events:eventsOnDate(events,day)};
  });
}
/** Monday-first week containing `day`. */
export function calendarWeek(events,day){const d=utc(day),monday=shiftEventDay(day,-((d.getUTCDay()+6)%7));return Array.from({length:7},(_,i)=>{const k=shiftEventDay(monday,i);return {day:k,number:Number(k.slice(8,10)),events:eventsOnDate(events,k)};});}
export function calendarDateLabel(day,monthOnly=false){return new Intl.DateTimeFormat(locale(),{...(monthOnly?{}:{day:'numeric',weekday:'long'}),month:'long',year:'numeric',timeZone:'UTC'}).format(utc(day));}
const weekdays=()=>Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(locale(),{weekday:'narrow',timeZone:'UTC'}).format(utc(shiftEventDay('2026-11-02',i))));
/**
 * Event calendar (no Figma frame; modelled on Partiful, Slack and How We Feel on Mobbin). Month grid or a 7-day week
 * strip; each day shows its number, up to three category dots and, for screen readers / tests, its event count.
 * Today = ring, selected = filled circle, past days muted. The day's agenda renders below (event-gallery.js).
 */
export function eventCalendarHTML(events,month,selected,today=eventToday(),mode='month'){
  const count=eventsInMonth(events,month).length;
  const cells=mode==='week'?calendarWeek(events,selected):calendarDays(events,month);
  const title=mode==='week'?(()=>{const w=calendarWeek(events,selected);return new Intl.DateTimeFormat(locale(),{day:'numeric',month:'short',timeZone:'UTC'}).formatRange?.(utc(w[0].day),utc(w[6].day))||calendarDateLabel(month+'-01',true);})():calendarDateLabel(month+'-01',true);
  return `<div class="event-calendar-toolbar oz-cal2-bar"><div class="oz-cal2-title"><h3 data-no-i18n>${esc(title)}</h3><span class="event-calendar-month-total"><b data-no-i18n>${n(count)}</b> <span>${count===1?'event this month':'events this month'}</span></span></div>
    <div class="oz-cal2-controls"><button type="button" class="oz-cal2-nav" data-calendar-month="-1" aria-label="${mode==='week'?'Previous week':'Previous month'}">${ozIcon('s:chevron-left')}</button><button type="button" class="oz-cal2-today event-calendar-today" data-calendar-today>Today</button><button type="button" class="oz-cal2-nav" data-calendar-month="1" aria-label="${mode==='week'?'Next week':'Next month'}">${ozIcon('s:chevron-right')}</button></div></div>
  <div class="oz-cal2-modes" role="group" aria-label="Calendar view"><button type="button" data-calendar-mode="month" aria-pressed="${mode==='month'}">Month</button><button type="button" data-calendar-mode="week" aria-pressed="${mode==='week'}">Week</button></div>
  <div class="event-calendar-weekdays oz-cal2-dow" aria-hidden="true">${weekdays().map(d=>`<span>${esc(d)}</span>`).join('')}</div>
  <div class="event-calendar-days oz-cal2-days${mode==='week'?' is-week':''}" role="group" aria-label="Choose an event date">${cells.map(cell=>{
    if(!cell)return '<span class="event-calendar-blank" aria-hidden="true"></span>';
    const {day,number,events:items}=cell,past=day<today;
    const cats=[...new Set(items.map(i=>i.category||'other'))].slice(0,3);
    return `<button type="button" class="event-calendar-day oz-cal2-day${items.length?' has-events':''}${past?' is-past':''}" data-calendar-day="${day}" aria-pressed="${day===selected}" ${day===today?'aria-current="date"':''} aria-label="${esc(calendarDateLabel(day)+', '+n(items.length)+' '+(locale()==='ms-MY'?'acara':items.length===1?'event':'events'))}"><span class="event-calendar-number oz-cal2-num" data-no-i18n>${number}</span><span class="oz-cal2-dots" aria-hidden="true">${cats.map(c=>`<i class="is-${esc(c)}"></i>`).join('')}</span><span class="event-calendar-count sr" data-no-i18n>${n(items.length)}</span></button>`;
  }).join('')}</div>`;
}
export function eventArchiveEvents(events,today=eventToday()){
  return events.filter(e=>e.archive||eventExpired(e,today)).sort((a,b)=>(b.end||b.start||'').localeCompare(a.end||a.start||''));
}
