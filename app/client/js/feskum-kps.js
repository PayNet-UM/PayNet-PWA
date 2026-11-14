import { esc, icon, rm } from './ui.js';
import { KPS_BOOTHS, KPS_PLAN, KPS_VENDORS } from './feskum-kps-data.js';
export { KPS_BOOTHS, KPS_PLAN, KPS_VENDORS };
// Keep each source booth's shape, orientation and neighbours while closing the
// large empty corridors between groups. This is an adapted, non-scale plan.
export const KPS_VIEW = {x:258,y:240,width:196,height:226};
// These are navigation groups, not official event zones or vendor names.
export const KPS_AREAS = [
  {id:'upper',range:'54–70',hint:'Food & student vendors',x:305,y:309,bounds:{x:268,y:262,width:81,height:87}},
  {id:'left',range:'10–23',hint:'14 stalls',x:288,y:393,bounds:{x:270,y:355,width:50,height:87}},
  {id:'court',range:'24–53',hint:'30 stalls',x:390,y:392,bounds:{x:312,y:337,width:122,height:102}},
  {id:'lower',range:'1–9',hint:'UM merchandise too',x:384,y:445,bounds:{x:323,y:414,width:126,height:50}},
];
export function kpsAreaContains(area,booth) {
  const [first,last]=area.range.split('–').map(Number);
  return (booth.number>=first&&booth.number<=last)||(area.id==='upper'&&booth.kind==='student')||(area.id==='lower'&&booth.kind==='merch');
}
const GROUPS = [
  {from:1,to:3,dx:-64,dy:-99},
  {from:4,to:9,dx:-53,dy:-112},
  {from:10,to:23,dx:-40,dy:-102},
  {from:24,to:29,dx:-50,dy:-94,patch:[409,502,46,31]},
  {from:30,to:51,dx:-46,dy:-90,patch:[358,431,55,87]},
  {from:52,to:53,dx:-49,dy:-90,patch:[424,433,57,58]},
  {from:54,to:65,dx:-10,dy:-40},
  {from:66,to:70,dx:-19,dy:-34,patch:[314,296,49,83]},
];
function boothGroup(b) {
  return b.kind==='student' ? GROUPS[7] : b.kind==='merch' ? GROUPS[0] : GROUPS.find(g=>b.number>=g.from&&b.number<=g.to);
}
export function kpsDisplayBooth(b) {
  const {dx,dy}=boothGroup(b);
  return {...b,x:b.x+dx,y:b.y+dy};
}
// One vector style for the whole map; source artwork is available via Source plan.
function kpsBackgroundHTML() {
  return `<g class="kps-map-landmarks" aria-hidden="true">
    <path class="kps-walkway" d="M261 357L304 345Q316 341 328 345L366 355Q374 357 378 347"/>
    <g transform="rotate(-12 292 254)"><rect class="kps-stage-area" x="266" y="248" width="36" height="12" rx="2"/><rect class="kps-dining-area" x="304" y="248" width="14" height="12" rx="2"/></g>
    <g transform="rotate(-14 317 307)"><rect class="kps-green-area" x="307" y="267" width="25" height="76" rx="11"/><rect class="kps-parking-area" x="320" y="278" width="9" height="49" rx="1.5"/></g>
    <g transform="rotate(-19.65 337 385)"><rect class="kps-green-area" x="328" y="346" width="23" height="80" rx="11"/></g>
    <path class="kps-building-area" d="M375 267L407 269L405 284L436 289L428 346L426 361L383 354L384 340L376 338L382 282L372 281Z"/>
    <path class="kps-parking-area" d="M349 281L357 278L371 328L363 331Z"/>
    <path class="kps-green-area" d="M377 345Q373 342 376 354L386 389Q389 397 399 395L404 390H430V354Z"/>
    <path class="kps-dining-area" d="M378 354L386 351L397 376L388 381Z"/>
    <ellipse class="kps-green-area" cx="397" cy="429" rx="7" ry="10" transform="rotate(11 397 429)"/>
  </g>`;
}
function landmark(x,y,label) {
  return `<text class="kps-landmark-label" x="${x}" y="${y}" text-anchor="middle" aria-hidden="true">${label}</text>`;
}

const CATEGORIES = { food: 'Food & drinks', student: 'Student vendor', merch: 'UM merchandise' };
const isLocalPhoto = (path) => /^assets\/feskum-2026\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp)$/i.test(path || '') && !path.includes('..');
export function kpsBooth(id) {
  const spot = KPS_BOOTHS.find((b) => b.id === id);
  return spot ? { ...spot, vendor: KPS_VENDORS[id] || null, category: CATEGORIES[spot.kind] } : null;
}

export function kpsMapHTML() {
  return `<section class="kps-section" aria-labelledby="kps-title">
    <header class="kps-section-head"><span class="kps-section-number" aria-hidden="true">01</span><div><h2 id="kps-title">Tapak KPS</h2><p>Tapak Parking KPS</p></div><a class="btn small" href="${KPS_PLAN.source}" target="_blank" rel="noopener">${icon('map')} <span>Source plan</span></a></header>
    <div class="kps-plan-shell"><div class="kps-plan-toolbar"><div class="kps-play-title"><div><h3>Explore stalls</h3><span class="kps-explored" title="Stalls explored this visit">${icon('eye')} <b id="kps-explored-count">0</b><span>/ 76</span><span>explored</span></span></div></div><button type="button" class="kps-map-mode" id="kps-zoom-fit" aria-pressed="false">${icon('map')}<span data-kps-fit-label>Whole map</span></button></div>
      <div class="kps-explore-progress" id="kps-explore-progress" role="progressbar" aria-label="Stalls explored this visit" aria-valuemin="0" aria-valuemax="76" aria-valuenow="0"><i></i></div>
      <div class="kps-map-guide" role="status"><span class="kps-guide-step" aria-hidden="true">1</span><div><b id="kps-guide-title">Choose a stall group</b><span id="kps-guide-hint">Tap a group on the map to get closer.</span></div></div>
      <div class="kps-viewport-wrap" data-mode="overview"><button type="button" id="kps-back-overview" class="kps-map-back" hidden>${icon('arrow-left')}<span>Back to overview</span></button>
      <div class="kps-map-scroll" id="kps-scroll" tabindex="0" role="region" aria-label="Tapak KPS floor plan. Drag to move and select a stall.">
        <div class="kps-map-canvas" id="kps-canvas"><svg class="kps-map-svg" data-layout="adapted" viewBox="258 240 196 226" role="group" aria-label="Interactive Tapak KPS booth map">
          ${kpsBackgroundHTML()}
          ${KPS_BOOTHS.map((source) => {
            const b=kpsDisplayBooth(source);
            const spot = kpsBooth(b.id), vendorName = spot.vendor?.name;
            // Shared group offsets keep the visible booth and its hit area aligned.
            return `<g class="kps-booth kps-${b.kind}" data-kps-booth data-booth="${b.id}" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false" aria-controls="festival-vendor-dropdown" aria-label="${esc(`Tapak KPS, ${b.number ? 'Booth ' + b.label : b.label}, ${spot.category}${vendorName ? ', ' + vendorName : ''}`)}" transform="translate(${b.x} ${b.y}) rotate(${b.angle})"><title>${esc(vendorName || (b.number ? 'Booth ' + b.label : b.label))}</title><rect class="kps-booth-face" x="-4.6" y="-2.05" width="9.2" height="4.1" rx=".55"/><text y=".05" text-anchor="middle" dominant-baseline="central">${b.label}</text><circle class="kps-booth-visited" cx="3.35" cy="1.1" r=".28"/></g>`;
          }).join('')}
          <text class="kps-building-title" x="407" y="317" text-anchor="middle">KPS</text>
          <text class="kps-parking-label" x="329" y="306" text-anchor="middle">P</text><text class="kps-parking-label" x="360" y="306" text-anchor="middle">P</text>
          <text class="kps-road-title" x="265" y="359">Jalan Utama</text>
          ${landmark(291,244,'Mini stage')}
          ${landmark(385,348,'Dining area')}
        </svg><div class="kps-area-shortcuts" aria-label="Stall groups">${KPS_AREAS.map(a=>`<button type="button" class="kps-area-card" data-kps-area="${a.id}" aria-label="Explore stalls ${a.range}" style="--area-x:${(a.x-KPS_VIEW.x)/KPS_VIEW.width*100}%;top:${(a.y-KPS_VIEW.y)/KPS_VIEW.height*100}%"><span class="kps-area-symbol" aria-hidden="true">${icon('store')}</span><span><b><span>Stalls</span> ${a.range}</b><small>${a.hint}</small></span><span class="kps-area-arrow" aria-hidden="true">${icon('plus')}</span></button>`).join('')}</div></div>
      </div>
      <button type="button" id="kps-minimap" class="kps-minimap" aria-label="Whole map"><svg viewBox="258 240 196 226" aria-hidden="true">${kpsBackgroundHTML()}<rect id="kps-minimap-window" x="258" y="240" width="196" height="226" rx="3"/></svg><span>Whole map</span></button>
      <div class="kps-zoom-controls" role="group" aria-label="Map zoom"><button type="button" id="kps-zoom-out" aria-label="Zoom out"><span aria-hidden="true">−</span></button><output id="kps-zoom-value" aria-live="polite">200%</output><button type="button" id="kps-zoom-in" aria-label="Zoom in">${icon('plus')}</button></div>
      </div>
      <div class="kps-legend" aria-label="Map legend">${[['food','Food & drinks'],['student','Student vendor'],['merch','UM merchandise'],['stage','Mini stage'],['dining','Dining area'],['parking','Parking']].map(([key,label]) => `<span><i class="kps-key-${key}" aria-hidden="true"></i><span>${label}</span></span>`).join('')}</div>
    </div>
    <p class="kps-layout-note">Adapted layout · Not to scale</p>
    <p class="kps-source-note">Vendor names, menus and photos will be added as supplied.</p><p class="kps-source-note kps-reference-note">SV1–SV5 and UM are app labels for unnumbered spaces.</p>
  </section>`;
}

export function kpsDetailsHTML(id) {
  const spot = kpsBooth(id);
  if (!spot) return '';
  const vendor = spot.vendor;
  const photo = vendor?.photos?.find(isLocalPhoto);
  return `<button class="festival-dropdown-close" data-close-vendor aria-label="Close stall">${icon('x')}</button>
    ${photo ? `<img class="kps-vendor-photo" src="${esc(photo)}" alt="${esc(vendor.name || spot.category)}">` : ''}
    <div class="festival-detail-heading kps-detail-heading kps-detail-${spot.kind}"><span class="kps-detail-icon" aria-hidden="true">${icon(spot.kind === 'food' ? 'coffee' : spot.kind === 'student' ? 'store' : 'gift')}</span><span class="badge">${spot.number ? `Booth ${spot.label}` : spot.label}</span><h3>${esc(vendor?.name || spot.category)}</h3><p>Tapak KPS${spot.kind === 'food' ? ' · 10 × 20 ft' : ''}</p></div>
    <div class="festival-detail-body kps-detail-body">${vendor?.items?.length ? `<ul class="festival-menu">${vendor.items.map((item) => `<li><span>${esc(item.name)}</span><b>${Number.isSafeInteger(item.cents) ? rm(item.cents) : '<span>Price pending</span>'}</b></li>`).join('')}</ul>` : `<div class="kps-vendor-pending">${icon('store')}<strong>${vendor?.name ? 'Menu & prices coming soon' : 'Stall info coming soon'}</strong><p>Items, prices and photos will appear here.</p></div>`}
    <div class="festival-vendor-location">${icon('map-pin')}<div><b>Tapak Parking KPS</b><span>${spot.number ? `Booth ${spot.label}` : '<span>Unnumbered in source plan</span>'}</span></div></div></div>`;
}

export function mountKpsZoom(root, onZoom = () => {}) {
  const scroll = root.querySelector('#kps-scroll'), canvas = root.querySelector('#kps-canvas');
  if (!scroll || !canvas) return () => {};
  const plan=KPS_VIEW;
  const centre={x:plan.x+plan.width/2,y:plan.y+plan.height/2};
  let zoom=1, activeArea=null, drag=null, suppressClickUntil=0;
  const minimap = root.querySelector('#kps-minimap');
  function updateOverview() {
    const width = canvas.offsetWidth || 1, height = canvas.offsetHeight || 1;
    const margin = Math.max(0, (scroll.clientWidth - width) / 2);
    const box = root.querySelector('#kps-minimap-window');
    const visibleW = Math.min(plan.width, scroll.clientWidth / width * plan.width);
    const visibleH = Math.min(plan.height, scroll.clientHeight / height * plan.height);
    box.setAttribute('x', plan.x + Math.max(0, Math.min(plan.width - visibleW, (scroll.scrollLeft - margin) / width * plan.width)));
    box.setAttribute('y', plan.y + Math.max(0, Math.min(plan.height - visibleH, scroll.scrollTop / height * plan.height)));
    box.setAttribute('width', visibleW);box.setAttribute('height', visibleH);
  }
  function draw(next = zoom, focus = null) {
    const oldWidth = canvas.offsetWidth || 1, oldHeight = canvas.offsetHeight || 1;
    const oldMargin = Math.max(0, (scroll.clientWidth - oldWidth) / 2);
    const cx = focus ? (focus.x - plan.x) / plan.width : (scroll.scrollLeft + scroll.clientWidth / 2 - oldMargin) / oldWidth;
    const cy = focus ? (focus.y - plan.y) / plan.height : (scroll.scrollTop + scroll.clientHeight / 2) / oldHeight;
    zoom = Math.max(1, Math.min(5, next));
    const base = Math.min(scroll.clientWidth, scroll.clientHeight * plan.width / plan.height);
    const width = base * zoom, height = width * plan.height / plan.width;
    canvas.style.width = `${width}px`;canvas.style.height = `${height}px`;
    scroll.scrollLeft = Math.max(0, cx * width + Math.max(0, (scroll.clientWidth - width) / 2) - scroll.clientWidth / 2);
    scroll.scrollTop = Math.max(0, cy * height - scroll.clientHeight / 2);
    root.querySelector('#kps-zoom-value').textContent = `${Math.round(zoom * 100)}%`;
    root.querySelector('#kps-zoom-out').disabled = zoom === 1;
    root.querySelector('#kps-zoom-in').disabled = zoom === 5;
    const whole = zoom === 1;
    root.querySelector('#kps-zoom-fit').setAttribute('aria-pressed', String(whole));
    root.querySelector('[data-kps-fit-label]').textContent = 'Whole map';
    root.querySelector('#kps-zoom-fit').disabled=whole;
    const overview=zoom<=1.15;
    root.querySelector('.kps-viewport-wrap').dataset.mode=overview?'overview':'stalls';
    root.querySelectorAll('[data-kps-booth]').forEach(b=>{const source=kpsBooth(b.dataset.booth);b.setAttribute('tabindex',!overview&&(!activeArea||kpsAreaContains(activeArea,source))?'0':'-1');});
    root.querySelectorAll('[data-kps-area]').forEach(b=>{b.hidden=!overview;});
    root.querySelector('.kps-guide-step').textContent=overview?'1':'2';
    root.querySelector('#kps-guide-title').textContent=overview?'Choose a stall group':'Tap a numbered stall';
    root.querySelector('#kps-guide-hint').textContent=overview?'Tap a group on the map to get closer.':'See its vendor, items and prices.';
    minimap.hidden = whole;
    root.querySelector('#kps-back-overview').hidden=whole;
    updateOverview();onZoom();
  }
  const overview=()=>{activeArea=null;draw(1,centre);};
  function showArea(area) {
    activeArea=area;
    const bounds=area.bounds;
    const baseScale=Math.min(scroll.clientWidth/plan.width,scroll.clientHeight/plan.height);
    const scale=Math.min(scroll.clientWidth/bounds.width,scroll.clientHeight/bounds.height);
    draw(Math.max(1.5,Math.min(5,scale/baseScale)),{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2});
  }
  function highlight(area=null) {
    root.querySelectorAll('[data-kps-booth]').forEach(b=>b.classList.toggle('is-area-highlight',!!area&&kpsAreaContains(area,kpsBooth(b.dataset.booth))));
  }
  root.querySelectorAll('[data-kps-area]').forEach(button=>{
    const area=KPS_AREAS.find(a=>a.id===button.dataset.kpsArea);
    button.onclick=()=>{if(area){highlight();showArea(area);scroll.focus({preventScroll:true});}};
    button.onmouseenter=button.onfocus=()=>highlight(area);
    button.onmouseleave=button.onblur=()=>highlight();
  });
  root.querySelector('#kps-zoom-in').onclick = () => {activeArea=null;draw(zoom+.5);};
  root.querySelector('#kps-zoom-out').onclick = () => {activeArea=null;draw(zoom-.5);};
  root.querySelector('#kps-back-overview').onclick=()=>{
    const previousArea=activeArea;
    overview();
    if(previousArea)root.querySelector(`[data-kps-area="${previousArea.id}"]`)?.focus({preventScroll:true});
    else root.querySelector('#kps-zoom-in').focus({preventScroll:true});
  };
  root.querySelector('#kps-zoom-fit').onclick = overview;
  minimap.onclick = overview;
  function down(e) {
    if(e.pointerType !== 'mouse' || e.button !== 0)return;
    drag = {id:e.pointerId,x:e.clientX,y:e.clientY,left:scroll.scrollLeft,top:scroll.scrollTop,moved:false};
  }
  function move(e) {
    if(!drag || drag.id !== e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.moved && Math.hypot(dx,dy)<6)return;
    if(!drag.moved){drag.moved=true;scroll.setPointerCapture(e.pointerId);scroll.classList.add('is-dragging');}
    e.preventDefault();scroll.scrollLeft=drag.left-dx;scroll.scrollTop=drag.top-dy;
  }
  function up(e) {
    if(!drag || drag.id !== e.pointerId)return;
    if(drag.moved){suppressClickUntil=performance.now()+200;if(scroll.hasPointerCapture(e.pointerId))scroll.releasePointerCapture(e.pointerId);}
    drag=null;scroll.classList.remove('is-dragging');
  }
  function suppress(e) {if(performance.now()<suppressClickUntil){e.preventDefault();e.stopPropagation();}}
  scroll.addEventListener('pointerdown',down);scroll.addEventListener('pointermove',move);
  window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
  scroll.addEventListener('click',suppress,true);scroll.addEventListener('scroll',updateOverview,{passive:true});
  const resize = () => {if(activeArea)showArea(activeArea);else draw(zoom,zoom===1?centre:null);};
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(scroll);
  if (!observer) window.addEventListener('resize', resize);
  draw(1,centre);
  return () => {
    observer?.disconnect();if (!observer) window.removeEventListener('resize', resize);
    scroll.removeEventListener('pointerdown',down);scroll.removeEventListener('pointermove',move);
    window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);
    scroll.removeEventListener('click',suppress,true);scroll.removeEventListener('scroll',updateOverview);
  };
}
