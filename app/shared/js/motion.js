// Small, once-per-view entrances. Content remains visible if motion or observers are unavailable.
const TARGETS = [
  '.page-title','.kk-hero','.student-welcome','.kk-pillar','.section > .head',
  '.campus-event-showcase','.festival-entry','.reward-prize','.reward-extra','.community-invite',
  '.info-hero','.contact-heading','.info-story','.info-impact-card','.info-join-card',
  '.info-team-group','.info-final-cta','.info-contact-options > *','.info-query-card',
  '.points-policy-hero','.points-default-note','.points-wallet-facts > *',
  '.points-policy-section > h3','.points-sources > article','.points-use-grid > article',
  '.points-value-card','.points-levels','.points-no-awards','.points-records',
  '.mer-page-head','.mer-action','.mer-metric','.hep-page-head','.hep-metric','.hep-shortcut',
].join(',');

export function mountPageMotion(root) {
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  if(preference.matches||typeof IntersectionObserver==='undefined'||typeof Element.prototype.animate!=='function')return ()=>{};
  const active=new Set();let stopped=false;
  const candidates=[...root.querySelectorAll(TARGETS)].slice(0,80);
  // Avoid animating both an enclosing feature and its contents.
  const targets=candidates.filter(el=>!candidates.some(parent=>parent!==el&&parent.contains(el)));
  const observer=new IntersectionObserver(entries=>{
    let order=0;
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      observer.unobserve(entry.target);
      if(stopped||preference.matches||document.hidden||!entry.target.isConnected)continue;
      const animation=entry.target.animate(
        [{opacity:.8,translate:'0 10px'},{opacity:1,translate:'0 0'}],
        {duration:420,delay:Math.min(order++,3)*55,easing:'cubic-bezier(.22,.7,.3,1)'},
      );
      active.add(animation);
      animation.finished.then(()=>active.delete(animation),()=>active.delete(animation));
    }
  },{threshold:.06});
  targets.forEach(el=>observer.observe(el));
  const cancelActive=()=>{active.forEach(a=>a.cancel());active.clear();};
  const visibility=()=>{
    root.classList.toggle('onz-motion-paused',document.hidden);
    if(document.hidden)cancelActive();
  };
  const change=()=>{if(preference.matches){observer.disconnect();cancelActive();}};
  preference.addEventListener?.('change',change);
  document.addEventListener('visibilitychange',visibility);visibility();
  return ()=>{
    stopped=true;observer.disconnect();cancelActive();root.classList.remove('onz-motion-paused');
    preference.removeEventListener?.('change',change);document.removeEventListener('visibilitychange',visibility);
  };
}
