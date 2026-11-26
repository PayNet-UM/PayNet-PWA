import * as D from './data.js';
import {$,$$,esc,icon,n,sheet,errText} from './ui.js';
const art=(deal,full=false)=>D.dealPosterImage(deal)?`<img class="deal-gallery-image${full?' is-full':''}" src="${esc(D.dealPosterImage(deal))}" alt="${esc(deal.title)}" loading="lazy">`:`<span class="deal-gallery-generated" aria-hidden="true">${icon('coffee')}<strong data-no-i18n>${esc(deal.benefit||deal.title)}</strong><span>Campus perks</span></span>`;
export function dealGalleryCardsHTML(rows,app){return rows.map(({deal,merchant,status},index)=>{
 const live=status==='Available';
 return `<article class="deal-gallery-card checkout-deal ${live?'is-live':''} tone-${index%3}" data-gallery-deal="${esc(deal.id)}"><button type="button" class="deal-gallery-art" data-deal-details="${esc(deal.id)}" aria-label="${esc(deal.title)}">${art(deal)}<span class="deal-gallery-status">${icon(live?'zap':'clock')}<span>${esc(live?'Live now':status)}</span></span></button><div class="deal-gallery-copy"><span class="deal-gallery-shop" data-no-i18n>${esc(merchant.name)}</span><h3 data-no-i18n>${esc(deal.title)}</h3>${deal.benefit&&deal.benefit!==deal.title?`<p class="deal-gallery-benefit" data-no-i18n>${esc(deal.benefit)}</p>`:''}<p class="deal-gallery-meta">${icon('clock')}<span>${D.hhmm(deal.startMin)}–${D.hhmm(deal.endMin)} MYT</span></p><p class="deal-gallery-meta">${icon('map-pin')}<span data-no-i18n>${esc(merchant.location||merchant.name)}</span></p><div class="deal-gallery-foot"><span class="deal-gallery-points">${icon('sparkles')} +${n(app.rules.liveDealPoints??10)} <span>pts</span></span>${live?`<a class="btn primary deal-gallery-claim" href="#/claim-deal/${esc(deal.id)}">${icon('qr-code')} Scan to claim</a>`:`<span class="deal-gallery-wait">Not live right now</span>`}</div></div></article>`;
 }).join('');}
export function liveDealGalleryRender(app){
 if(!['overview','merchantTools','dealsAndPay'].every(key=>D.featureOn(app.rules,key)))return `<div class="card empty"><h1>Live deals</h1><p>Live deals are currently unavailable.</p><a class="btn" href="#/explore">Overview</a></div>`;
 return `<div class="live-deal-gallery-page"><a class="back" href="#/explore">${icon('arrow-left')} Overview</a><header class="deal-gallery-hero"><div><span class="deal-gallery-kicker">Campus perks</span><h1>Live deals</h1><p>Scan the merchant’s QR to claim.</p></div><span class="deal-gallery-emblem" aria-hidden="true">${icon('qr-code')}<i>${icon('sparkles')}</i></span></header><section id="directory-deals" aria-label="Browse live deals"><div class="deal-gallery-heading"><div role="group" aria-label="Filter live deals"><button type="button" data-deal-filter="all" aria-pressed="true">All deals</button><button type="button" data-deal-filter="live" aria-pressed="false">${icon('zap')} Live now</button></div><span id="deal-gallery-count" role="status" aria-live="polite"></span></div><div id="checkout-deals" class="deal-gallery-grid"><p role="status">Finding café deals…</p></div></section></div>`;
}
export function liveDealGalleryMount(root,app){
 const grid=$('#checkout-deals',root);if(!grid)return null;document.title='Live deals · +Onz Student';
 let deals=[],shops=[],selected='all',rows=[],disposed=false,loadedDeals=false,loadedShops=false,rendered='',lastCount=null;
 const draw=()=>{
  if(disposed||!loadedDeals||!loadedShops)return;
  const byId=new Map(shops.map(shop=>[shop.id,shop]));
  rows=deals.filter(deal=>!deal.removed&&deal.enabled&&byId.has(deal.merchantId)).map(deal=>({deal,merchant:byId.get(deal.merchantId),status:D.dealStatus(deal,byId.get(deal.merchantId),null,D.clock(app.ctx))})).sort((a,b)=>Number(b.status==='Available')-Number(a.status==='Available')||a.deal.title.localeCompare(b.deal.title));
  const shown=rows.filter(row=>selected!=='live'||row.status==='Available');
  const html=dealGalleryCardsHTML(shown,app)||`<div class="deal-gallery-empty">${icon('coffee')}<h2>No live deals right now.</h2><p>Check back for your next campus perk.</p></div>`;
  if(html!==rendered){rendered=html;grid.innerHTML=html;}
  if(lastCount!==shown.length){lastCount=shown.length;$('#deal-gallery-count',root).innerHTML=`${n(shown.length)} <span>${shown.length===1?'deal':'deals'}</span>`;}
  $$('[data-deal-filter]',root).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.dealFilter===selected)));
 };
 const error=err=>{if(!disposed){grid.innerHTML=`<div class="deal-gallery-empty" role="alert">${icon('info')}<p>${esc(errText(err))}</p></div>`;}};
 const {sdk,db}=app.ctx;
 const stopDeals=sdk.onSnapshot(sdk.query(sdk.collection(db,'deals'),sdk.where('status','in',['approved','published'])),snapshot=>{deals=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));loadedDeals=true;draw();},error);
 const stopShops=sdk.onSnapshot(sdk.query(sdk.collection(db,'merchants'),sdk.where('status','==','verified')),snapshot=>{shops=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));loadedShops=true;draw();},error);
 const timer=setInterval(draw,15000);
 const click=event=>{
  const filter=event.target.closest('[data-deal-filter]');if(filter){selected=filter.dataset.dealFilter;draw();return;}
  const poster=event.target.closest('[data-deal-details]');if(!poster)return;
  const row=rows.find(row=>row.deal.id===poster.dataset.dealDetails);if(!row)return;
  const {deal,merchant,status}=row;
  sheet(`<div class="deal-gallery-details">${art(deal,true)}<span class="badge">${esc(status==='Available'?'Live now':status)}</span><h2 data-no-i18n>${esc(deal.title)}</h2><p data-no-i18n>${esc(deal.benefit||deal.title)}</p><p data-no-i18n>${esc(merchant.name)} · ${esc(merchant.location)}</p><p>${icon('clock')} ${D.hhmm(deal.startMin)}–${D.hhmm(deal.endMin)} MYT</p><p>Scan the merchant’s QR to claim.</p><div class="deal-detail-actions">${status==='Available'?`<a class="btn primary" href="#/claim-deal/${esc(deal.id)}" data-close>${icon('qr-code')} Scan to claim</a>`:''}<a class="btn" href="#/merchant/${esc(merchant.id)}" data-close>View shop</a></div></div>`,{wide:true});
 };
 root.addEventListener('click',click);
 return()=>{disposed=true;clearInterval(timer);stopDeals();stopShops();root.removeEventListener('click',click);};
}
