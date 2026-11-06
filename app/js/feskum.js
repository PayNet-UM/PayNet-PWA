// Public-area reference: UM Convocation 2025 directory. Booth allocations are illustrative.
import { $, $$, esc, icon, rm } from './ui.js';
export const FESKUM_SOURCE = 'https://umconvo.um.edu.my/CONVO%202025/PPOG/Directory%20Map%20low.pdf';
export const FESKUM_ZONES = [
  { id:'food', name:'Food Fest', area:'FESKUM Bazaar · Area 10', color:'peach', symbol:'🍜', desc:'Meals, sweet treats & refreshing drinks', landmark:'Dining tent', entry:'Bazaar entrance' },
  { id:'flowers', name:'Flower stalls', area:'FESKUM Bazaar · Area 10', color:'lilac', symbol:'💐', desc:'Bouquets, graduation gifts & keepsakes', landmark:'Collection point', entry:'Bazaar walkway' },
  { id:'creative', name:'Photography & gifts', area:'Timeline Park · Area 12', color:'mint', symbol:'📸', desc:'Photo sessions, prints & creative finds', landmark:'Photo backdrop', entry:'Timeline Park entrance' },
];
const booth = (id, zone, name, category, emoji, description, items, tags) => ({ id, zone, name, category, emoji, description, items:items.map(([name,cents])=>({name,cents})), tags });
export const FESKUM_BOOTHS = [
  booth('F01','food','Dapur Kampus','Meals','🍛','Comfort food for your festival day.',[['Nasi lemak ayam',1000],['Nasi lemak biasa',500],['Mee goreng',700]],['Vegetarian option']),
  booth('F02','food','Satay & Co.','Meals','🍢','Grilled skewers with peanut sauce.',[['Chicken satay · 5 sticks',800],['Beef satay · 5 sticks',1000],['Ketupat',200]],['Contains peanuts']),
  booth('F03','food','Sip Society','Drinks','🧋','Iced drinks and freshly brewed favourites.',[['Iced matcha latte',1000],['Iced latte',900],['Lemon tea',500]],['Dairy-free option']),
  booth('F04','food','Manis Studio','Desserts','🧁','Small-batch bakes and sweet treats.',[['Chocolate brownie',600],['Mini cupcakes · 3 pcs',1000],['Cookies',500]],['Contains dairy & gluten']),
  booth('F05','food','Roti & Roll','Meals','🌯','Handheld bites for exploring the bazaar.',[['Chicken wrap',900],['Veggie wrap',800],['Loaded fries',700]],['Vegetarian option']),
  booth('F06','food','Buah Break','Drinks','🍉','Fruit cups and cooling juices.',[['Watermelon juice',500],['Mixed fruit cup',600],['Mango smoothie',800]],['Plant-based option']),
  booth('B01','flowers','Bloom for You','Flowers','💐','Graduation bouquets in bright campus colours.',[['Mini fresh bouquet',2500],['Classic bouquet',4500],['Sunflower bouquet',3500]],['Made to order']),
  booth('B02','flowers','Petal Parcel','Flowers','🌷','Flowers that last beyond graduation day.',[['Crochet tulip',1800],['Crochet bouquet',5500],['Single wrapped rose',1200]],['Handmade']),
  booth('B03','flowers','Grad Gifts','Gifts','🧸','Little congratulations with a personal touch.',[['Graduation bear',2500],['Message card',500],['Bear & bouquet set',6000]],['Personalisation']),
  booth('B04','flowers','Ribbon & Wishes','Gifts','🎁','Gift wrapping and celebration essentials.',[['Gift wrapping',800],['Congratulation balloon',1500],['Gift box',1200]],['Custom colours']),
  booth('B05','flowers','Sweet Bouquet','Flowers','🍫','Edible bouquets for a sweet celebration.',[['Chocolate bouquet',3000],['Snack bouquet',2500],['Premium gift bouquet',5500]],['Contains dairy']),
  booth('B06','flowers','Little Keepsakes','Gifts','🔑','Pocket-sized memories to take home.',[['Name keychain',1200],['Enamel pin',1000],['Photo locket',1800]],['Personalisation']),
  booth('C01','creative','Memory Lane','Photography','📸','Portraits with a graduation backdrop.',[['Solo portrait · digital',1500],['Friends session · digital',3000],['Photo print',800]],['Digital delivery']),
  booth('C02','creative','Instant Memories','Photography','🎞️','Printed snapshots for your festival scrapbook.',[['Instant photo',1000],['Photo strip',1500],['Photo sleeve',300]],['Print on site']),
  booth('C03','creative','Campus Canvas','Crafts','🎨','Small creative pieces with a campus spirit.',[['Mini portrait',2000],['Art postcard',500],['Sticker sheet',600]],['Handmade']),
  booth('C04','creative','Thread Stories','Crafts','🧶','Handcrafted accessories and thoughtful gifts.',[['Crochet charm',1500],['Beaded bracelet',1000],['Tote bag',2500]],['Handmade']),
];
export function matchingBooths(query='', category='All') {
  const q=query.trim().toLowerCase();
  return FESKUM_BOOTHS.filter(b=>(category==='All'||b.category===category) && [b.id,b.name,b.category,...b.items.map(i=>i.name)].join(' ').toLowerCase().includes(q));
}
const zoneFor = id => FESKUM_ZONES.find(z=>z.id===id);
const range = b => `${rm(Math.min(...b.items.map(i=>i.cents)))}–${rm(Math.max(...b.items.map(i=>i.cents)))}`;
export function feskumCard() {
  return `<a class="festival-entry" href="#/feskum"><div><span class="festival-eyebrow">CAMPUS SPOTLIGHT · 2026 PREVIEW</span><h2>FESKUM <em>2026</em></h2><p>Find your booth. Discover your next favourite.</p><div class="festival-entry-meta"><span>${icon('store')} 16 sample vendors</span><span>${icon('map-pin')} 3 event areas</span></div><span class="festival-entry-cta">Explore the festival ${icon('arrow-right')}</span></div><span class="festival-entry-art" aria-hidden="true">${icon('store')}<span>FOOD / FLOWERS / FINDS</span></span></a>`;
}
export function feskumRender() {
  return `<div class="festival-page festival-simple festival-canvas-page"><a class="back" href="#/events">${icon('arrow-left')} Events</a>
    <header class="festival-page-header festival-identity"><img class="festival-identity-art" src="assets/feskum-2026/identity-01.jpg" width="1600" height="710" alt="FESKUM 2026 butterfly identity with colourful bunting and paper artwork"><div class="festival-identity-caption"><h1>FESKUM <em>2026</em></h1><p>Tap a booth.</p></div></header>
    <section class="festival-map-column" aria-label="Interactive booth map"><div id="festival-map"></div><div id="festival-vendor-dropdown" class="festival-vendor-dropdown" role="dialog" aria-modal="false" aria-label="Vendor details" tabindex="-1" hidden></div><p id="festival-selection-status" class="sr" role="status"></p></section>
    <p class="festival-simple-note">Sample vendors, items & prices. 2026 layout pending. <a href="${FESKUM_SOURCE}" target="_blank" rel="noopener">2025 map reference ${icon('external-link')}</a></p></div>`;
}
export function feskumMount(root) {
  let selected=null;
  function overview() {
    const positions = [
      [70,190],[170,190],[270,190],[70,345],[170,345],[270,345],
      [445,190],[545,190],[645,190],[445,345],[545,345],[645,345],
      [70,640],[180,640],[290,640],[400,640],
    ];
    return `<div class="event-plan-shell"><div class="event-plan-toolbar"><div><b>Booth map</b><span>16 booths</span></div><span class="event-plan-preview">SAMPLE LAYOUT</span></div>
      <div class="event-plan-scroll" role="region" aria-label="FESKUM booth map. Select a booth for vendor details."><div class="event-site-plan">
      <svg class="event-plan-drawing" viewBox="0 0 800 840" aria-hidden="true">
        <defs><pattern id="plan-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#202e55" stroke-opacity=".045"/></pattern><pattern id="plan-service" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="#202e55" stroke-opacity=".08" stroke-width="3"/></pattern></defs>
        <rect width="800" height="840" fill="#f8f9f6"/><rect width="800" height="840" fill="url(#plan-grid)"/>
        <rect x="24" y="110" width="752" height="662" rx="10" fill="none" stroke="#202e55" stroke-opacity=".35" stroke-dasharray="7 5"/>
        <rect x="45" y="125" width="335" height="340" rx="8" fill="#fff0c9" stroke="#d7b24f"/>
        <rect x="420" y="125" width="335" height="340" rx="8" fill="#ffe6dd" stroke="#dba494"/>
        <rect x="45" y="580" width="480" height="180" rx="8" fill="#e1f2eb" stroke="#79b4a5"/>
        <path d="M30 485H770V550H565V805H525V550H30Z" fill="#ebe6d8" stroke="#d6cdb9"/>
        <path d="M65 517H735M545 573V779" fill="none" stroke="#b8aa83" stroke-width="2" stroke-dasharray="8 8"/>
        <path d="M45 282H380V320H45ZM420 282H755V320H420Z" fill="#fffdf7"/>
        <path d="M365 485V465M435 485V465" stroke="#202e55" stroke-width="3"/>
        <rect x="280" y="28" width="240" height="58" rx="4" fill="#202e55"/><path d="M295 23H505" stroke="#d6ad47" stroke-width="5"/>
        <text x="400" y="51" text-anchor="middle" class="plan-building">DEWAN TUNKU CANSELOR</text><text x="400" y="70" text-anchor="middle" class="plan-building-sub">Area 1 · Campus landmark</text>
        <path d="M400 86V110" stroke="#202e55" stroke-dasharray="4 4"/>
        <text x="60" y="153" class="plan-zone-title">A / FOOD FEST</text><text x="60" y="172" class="plan-zone-sub">FESKUM Bazaar · Area 10</text>
        <text x="435" y="153" class="plan-zone-title">B / FLOWERS &amp; GIFTS</text><text x="435" y="172" class="plan-zone-sub">FESKUM Bazaar · Area 10</text>
        <text x="60" y="607" class="plan-zone-title">C / PHOTOGRAPHY &amp; CRAFTS</text><text x="60" y="625" class="plan-zone-sub">Timeline Park · Area 12</text>
        <text x="212" y="306" text-anchor="middle" class="plan-path-label">AISLE A</text><text x="588" y="306" text-anchor="middle" class="plan-path-label">AISLE B</text>
        <text x="220" y="441" text-anchor="middle" class="plan-zone-sub">↓ Open to main walkway</text><text x="590" y="441" text-anchor="middle" class="plan-zone-sub">↓ Open to main walkway</text>
        <rect x="300" y="498" width="200" height="36" rx="18" fill="#ebe6d8"/><text x="400" y="520" text-anchor="middle" class="plan-path-label">MAIN WALKWAY</text>
        <rect x="565" y="585" width="190" height="90" rx="5" fill="#202e55"/><path d="M575 665H745" stroke="#d6ad47" stroke-width="4"/>
        <text x="660" y="617" text-anchor="middle" class="plan-building">CENTRE STAGE</text><text x="660" y="638" text-anchor="middle" class="plan-building-sub">Graduate Journey Park · 11</text>
        <rect x="565" y="695" width="190" height="65" rx="5" fill="#fff" stroke="#b8c4d3"/>
        <text x="660" y="719" text-anchor="middle" class="plan-zone-title">REST &amp; RELAX · 13</text><text x="660" y="742" text-anchor="middle" class="plan-zone-sub">Dining · WC · Surau</text>
        <path d="M35 770H510M580 770H765" stroke="#202e55" stroke-width="3"/>
        <path d="M545 797V776m-7 8 7-8 7 8" fill="none" stroke="#202e55" stroke-width="3"/><text x="545" y="826" text-anchor="middle" class="plan-zone-title">MAIN ENTRANCE</text>
        <text x="52" y="815" class="plan-zone-sub">FESKUM / PREVIEW PLAN</text><path d="M732 72V30m-7 10 7-10 7 10" fill="none" stroke="#202e55" stroke-width="2"/><text x="732" y="91" text-anchor="middle" class="plan-zone-sub">N*</text>
      </svg>
      ${FESKUM_BOOTHS.map((b,i)=>`<button class="event-plan-booth event-plan-${b.zone}" style="left:${positions[i][0]/8}%;top:${positions[i][1]/8.4}%" data-booth="${b.id}" aria-expanded="false" aria-haspopup="dialog" aria-controls="festival-vendor-dropdown" aria-label="Booth ${b.id}, ${esc(b.name)}, ${esc(b.category)}" title="${esc(b.name)}"><b>${b.id}</b><span>${esc(b.name)}</span><small>${esc(b.category)}</small></button>`).join('')}
      </div></div><div class="event-plan-foot"><span>Tap a booth</span><span>Not to scale</span></div></div>`;
  }
  function details() {
    const b=FESKUM_BOOTHS.find(b=>b.id===selected);
    if(!b) return '';
    const z=zoneFor(b.zone);
    const index=FESKUM_BOOTHS.filter(x=>x.zone===b.zone).findIndex(x=>x.id===b.id);
    const row=b.zone==='creative'?1:Math.floor(index/3)+1;
    const aisle=b.zone==='food'?'A':b.zone==='flowers'?'B':'C';
    const position=b.zone==='creative'?index+1:index%3+1;
    return `<button class="festival-dropdown-close" data-close-vendor aria-label="Close vendor details">${icon('x')}</button><div class="festival-detail-heading ${z.color}"><span class="festival-vendor-emoji" aria-hidden="true">${b.emoji}</span><span class="badge">Booth ${b.id}</span><h3>${esc(b.name)}</h3><p>${esc(b.category)}</p></div><div class="festival-detail-body"><ul class="festival-menu">${b.items.map(i=>`<li><span>${esc(i.name)}</span><b>${rm(i.cents)}</b></li>`).join('')}</ul><div class="festival-vendor-tags">${b.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="festival-vendor-location">${icon('map-pin')}<div><b>${esc(z.name)} · Row ${row}</b><span>Position ${position} · Aisle ${aisle}</span></div></div></div>`;
  }
  $('#festival-map',root).innerHTML=overview();
  const dropdown=$('#festival-vendor-dropdown',root);
  const column=$('.festival-map-column',root);
  const booths=$$('[data-booth]',root);
  function closeVendor(restore=false) {
    const previous=selected;selected=null;dropdown.hidden=true;
    booths.forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-expanded','false');});
    $('#festival-selection-status',root).textContent='';
    if(restore&&previous)$(`[data-booth="${previous}"]`,root)?.focus({preventScroll:true});
  }
  function positionVendor() {
    if(!selected)return;
    const booth=$(`[data-booth="${selected}"]`,root).getBoundingClientRect();
    const area=column.getBoundingClientRect();
    const width=dropdown.offsetWidth,height=dropdown.offsetHeight;
    const left=Math.max(8,Math.min(booth.left-area.left+booth.width/2-width/2,area.width-width-8));
    let top=booth.bottom-area.top+10;
    if(booth.bottom+height+10>innerHeight&&booth.top-height-10>80)top=booth.top-area.top-height-10;
    dropdown.style.left=`${left}px`;dropdown.style.top=`${Math.max(8,top)}px`;
  }
  function openVendor(id) {
    if(selected===id){closeVendor(true);return;}
    selected=id;
    booths.forEach(b=>{const on=b.dataset.booth===id;b.classList.toggle('selected',on);b.setAttribute('aria-expanded',String(on));});
    dropdown.innerHTML=details();dropdown.hidden=false;
    dropdown.setAttribute('aria-label',`${FESKUM_BOOTHS.find(b=>b.id===id).name}, booth ${id}`);
    $('[data-close-vendor]',dropdown).onclick=()=>closeVendor(true);
    positionVendor();dropdown.focus({preventScroll:true});
    dropdown.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'nearest'});
    $('#festival-selection-status',root).textContent=`Booth ${id} details opened.`;
  }
  booths.forEach(b=>{b.onclick=()=>openVendor(b.dataset.booth);});
  const outside=e=>{if(!dropdown.hidden&&!dropdown.contains(e.target)&&!e.target.closest('[data-booth]'))closeVendor();};
  const escape=e=>{if(e.key==='Escape'&&!dropdown.hidden){e.preventDefault();closeVendor(true);}};
  document.addEventListener('click',outside);dropdown.addEventListener('keydown',escape);
  window.addEventListener('resize',positionVendor);
  return ()=>{document.removeEventListener('click',outside);window.removeEventListener('resize',positionVendor);};
}
