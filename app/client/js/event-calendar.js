import {esc,icon,n} from './ui.js';
import {EVENT_CATEGORIES} from './event-categories.js';
import {eventToday,eventExpired} from './event-catalog.js';
const locale=()=>typeof document!=='undefined'&&document.documentElement.lang==='ms'?'ms-MY':'en-MY';
const utc=day=>new Date(day+'T12:00:00Z');
const iso=date=>date.toISOString().slice(0,10);
export function shiftEventMonth(month,offset){const d=utc(month+'-01');d.setUTCMonth(d.getUTCMonth()+offset);return iso(d).slice(0,7);}
export function eventsOnDate(events,day){return events.filter(e=>e.start&&e.start<=day&&(e.end||e.start)>=day);}
export function eventsInMonth(events,month){const last=iso(new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0,12)));return events.filter(e=>e.start&&e.start<=last&&(e.end||e.start)>=month+'-01');}
export function calendarDays(events,month){
  const first=utc(month+'-01'),offset=(first.getUTCDay()+6)%7,total=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return Array.from({length:Math.ceil((offset+total)/7)*7},(_,index)=>{
    const number=index-offset+1;if(number<1||number>total)return null;
    const day=month+'-'+String(number).padStart(2,'0');return {day,number,events:eventsOnDate(events,day)};
  });
}
export function calendarDateLabel(day,monthOnly=false){return new Intl.DateTimeFormat(locale(),{...(monthOnly?{}:{day:'numeric',weekday:'long'}),month:'long',year:'numeric',timeZone:'UTC'}).format(utc(day));}
export function eventCalendarHTML(events,month,selected,today=eventToday()){
  const count=eventsInMonth(events,month).length;
  return `<div class="event-calendar-toolbar"><span class="event-calendar-month-icon" aria-hidden="true">${icon('calendar')}</span><div class="event-calendar-month-title"><h3 data-no-i18n>${esc(calendarDateLabel(month+'-01',true))}</h3><span class="event-calendar-month-total">${icon('sparkles')}<b data-no-i18n>${n(count)}</b><span>events this month</span></span></div><div class="event-calendar-controls"><button type="button" data-calendar-month="-1" aria-label="Previous month">${icon('chevron-right')}</button><button type="button" class="event-calendar-today" data-calendar-today>Today</button><button type="button" data-calendar-month="1" aria-label="Next month">${icon('chevron-right')}</button></div></div>
  <div class="event-calendar-legend"><span><i></i>Upcoming & ongoing</span><span><i class="past"></i>Past events</span></div>
  <div class="event-calendar-weekdays" aria-hidden="true">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>`<span>${day}</span>`).join('')}</div>
  <div class="event-calendar-days" role="group" aria-label="Choose an event date">${calendarDays(events,month).map(cell=>{
    if(!cell)return '<span class="event-calendar-blank" aria-hidden="true"></span>';
    const {day,number,events:items}=cell,past=day<today;
    return `<button type="button" class="event-calendar-day${items.length?' has-events':''}${past?' is-past':''}" data-calendar-day="${day}" aria-pressed="${day===selected}" ${day===today?'aria-current="date"':''} aria-label="${esc(calendarDateLabel(day)+', '+n(items.length)+' '+(locale()==='ms-MY'?'acara':items.length===1?'event':'events'))}"><span class="event-calendar-number" data-no-i18n>${number}</span>${items.length?`<span class="event-calendar-count" data-no-i18n>${n(items.length)}</span><span class="event-calendar-markers" aria-hidden="true">${items.slice(0,3).map(item=>`<i class="calendar-marker-${item.category||'other'}">${icon(EVENT_CATEGORIES.find(([id])=>id===item.category)?.[2]||'calendar')}</i>`).join('')}</span><span class="event-calendar-peek" data-no-i18n>${esc(items[0].name)}</span>`:''}</button>`;
  }).join('')}</div>`;
}
export function eventArchiveEvents(events,today=eventToday()){
  return events.filter(e=>e.archive||eventExpired(e,today)).sort((a,b)=>(b.end||b.start||'').localeCompare(a.end||a.start||''));
}
