import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import {copySite} from '../scripts/lib/sites.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'onz-events-'));process.on('exit',()=>fs.rmSync(dir,{recursive:true,force:true}));copySite('client',dir);globalThis.window=globalThis;globalThis.addEventListener=()=>{};
const {EVENT_CATEGORIES,eventCategory}=await import(pathToFileURL(path.join(dir,'js/event-categories.js')));const {galleryEvents}=await import(pathToFileURL(path.join(dir,'js/event-gallery.js')));
for(const [title,category] of [['A campus talk','talks'],['Research seminar','seminars'],['Innovation competition','competitions'],['Student bazaar','bazaars'],['Leadership summit','summits']])assert.equal(eventCategory({name:title}),category);
assert.equal(eventCategory({category:'summits',name:'Unrelated title'}),'summits');assert.equal(eventCategory({name:'Mind Swap'}),'other','Do not invent the format of an ambiguous event');
const rows=galleryEvents([{id:'one',name:'Campus summit',category:'summits',start:'2026-11-18',end:'2026-11-19'}],'2026-11-16');assert.equal(rows.length,2);assert.equal(galleryEvents([{id:'undated',name:'Research seminar'}],'2026-11-16').find(r=>r.id==='campaign-undated').status,'Date to be announced');assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);assert.equal(rows.find(r=>r.id==='campaign-one').status,'Upcoming');assert.equal(rows.some(r=>r.id==='poster-4'),false);assert.equal(rows.some(r=>r.id==='poster-11'),false);assert.ok(EVENT_CATEGORIES.every(([id])=>typeof id==='string'));console.log('Events: categories, legacy classification, explicit HEP category, archived artwork and poster date accuracy passed.');

const {adminEventDraft,eventCover}=await import(pathToFileURL(path.join(dir,'js/event-catalog.js')));
const picture='data:image/jpeg;base64,AAAA',photo='data:image/png;base64,BBBB';
const edited=galleryEvents([{id:'poster-4',sourcePosterPage:4,name:'Updated bazaar',category:'bazaars',start:'2026-12-01',end:'2026-12-02',posterImage:picture,photos:[photo]}],'2026-11-16');
assert.equal(edited.length,2);assert.equal(edited.filter(e=>e.sourcePosterPage===4).length,1);assert.equal(edited.find(e=>e.id==='poster-4').name,'Updated bazaar');assert.equal(eventCover(edited.find(e=>e.id==='poster-4')),picture);
assert.equal(galleryEvents([{id:'poster-4',sourcePosterPage:4,published:false}]).some(e=>e.id==='poster-4'),false);assert.equal(galleryEvents([{id:'poster-4',sourcePosterPage:4,published:false}],undefined,{includeHidden:true}).find(e=>e.id==='poster-4').status,'Hidden');
assert.equal(galleryEvents([],undefined,{includeHidden:true}).find(e=>e.id==='poster-4').name,'Gerai Jualan · Fasa 1');
assert.equal(eventCover({sourcePosterPage:4}),'assets/feskum-2026/feed-04.jpg');assert.equal(eventCover({sourcePosterPage:999,posterImage:'javascript:alert(1)'}),'');assert.equal(eventCover({sourcePosterPage:4,useOriginalPoster:false}),'');
const input={name:'New event',category:'talks',start:'2026-12-01',end:'2026-12-01',posterImage:picture,photos:[photo],contactEmail:'private@example.test',uid:'private-student'};
const cleaned=adminEventDraft(input);assert.equal(cleaned.photos.length,1);assert.equal('contactEmail' in cleaned,false);assert.equal('uid' in cleaned,false);
for(const change of [{photos:Array(4).fill(photo)},{posterImage:'data:image/svg+xml;base64,AAAA'},{photos:['https://tracker.test/photo.png']},{end:'2026-11-30'},{start:'2026-02-31'},{sourcePosterPage:999}])assert.throws(()=>adminEventDraft({...input,...change}));
assert.doesNotThrow(()=>adminEventDraft({...input,start:'',end:'',sourcePosterPage:5},{allowUndated:true}));
console.log('Event management: original poster overrides, hiding/restoring, safe cover/photo limits and private-field exclusion passed.');

const {eventExpired,activeEventSlides}=await import(pathToFileURL(path.join(dir,'js/event-catalog.js')));
assert.equal(eventExpired({end:'2026-11-25'},'2026-11-25'),false,'Keep events through their last MYT date');
assert.equal(eventExpired({end:'2026-11-24'},'2026-11-25'),true);
assert.equal(eventExpired({start:'2026-11-24'},'2026-11-25'),true,'Start-only events expire after that date');
assert.equal(eventExpired({deadline:'2026-11-20',end:'2026-12-01'},'2026-11-25'),true,'Registration deadline takes priority');
assert.equal(activeEventSlides('2026-11-25').length,0);
assert.ok(!activeEventSlides('2026-11-07').some(s=>s.page===10),'Expired registration poster must not appear on home');
assert.equal(galleryEvents([],'2026-11-25').length,0);
assert.equal(galleryEvents([],'2026-11-25',{includeHidden:true}).length,11,'HEP retains past event management');
const ending=[{id:'today',start:'2026-11-24',end:'2026-11-25'},{id:'yesterday',end:'2026-11-24'},{id:'tomorrow',start:'2026-11-26',end:'2026-11-26'}];
assert.deepEqual(galleryEvents(ending,'2026-11-25').map(e=>e.id),['campaign-today','campaign-tomorrow']);
console.log('Event expiry: deadline precedence, inclusive MYT end dates, home posters and HEP archive retention passed.');

const {calendarDays,eventsOnDate,eventsInMonth,eventArchiveEvents,shiftEventMonth}=await import(pathToFileURL(path.join(dir,'js/event-calendar.js')));
const history=galleryEvents([{id:'hidden',name:'Private event',start:'2026-11-10',end:'2026-11-11',published:false}], '2026-11-26',{includeExpired:true});
assert.equal(history.some(e=>e.id==='campaign-hidden'),false,'Student archives never reveal hidden events');
assert.ok(eventArchiveEvents(history,'2026-11-26').some(e=>e.id==='poster-4'));
assert.equal(eventsOnDate(history,'2026-11-14').filter(e=>e.id==='poster-4').length,1,'Multi-day events appear on every inclusive date');
assert.equal(eventsOnDate(history,'2026-11-15').some(e=>e.id==='poster-4'),false);
assert.equal(eventsOnDate(history,'2026-11-14').some(e=>e.id==='poster-5'),false,'Do not invent dates for undated posters');
assert.ok(eventsInMonth(history,'2026-10').some(e=>e.id==='poster-11'));
assert.equal(shiftEventMonth('2026-12',1),'2027-01');assert.equal(shiftEventMonth('2026-01',-1),'2025-12');
assert.equal(calendarDays([],'2028-02').filter(Boolean).length,29,'Leap years');
assert.equal(calendarDays([],'2026-11').findIndex(Boolean),6,'Calendar begins Monday');
assert.equal(calendarDays([],'2026-11').length,42,'Six-week month fits without clipping');
assert.ok(calendarDays(history,'2026-11').find(c=>c?.day==='2026-11-14').events.length>=3);
console.log('Event archive/calendar: hidden-event exclusion, date spans, undated posters, month boundaries and leap years passed.');

const {floorMapAvailable,feskumFloorMapAvailable}=await import(pathToFileURL(path.join(dir,'js/event-catalog.js')));
assert.equal(floorMapAvailable({end:'2026-11-26'},'2026-11-26'),true);
assert.equal(floorMapAvailable({end:'2026-11-26'},'2026-11-27'),false,'Future maps expire after their final MYT date');
assert.equal(floorMapAvailable({},'2026-11-26'),false,'An undated map cannot remain open indefinitely');
assert.equal(feskumFloorMapAvailable('2026-11-26'),false);

assert.equal(floorMapAvailable({end:'2026-11-30',deadline:'2026-11-20'},'2026-11-26'),true,'Maps follow the event end, not its earlier registration deadline');
