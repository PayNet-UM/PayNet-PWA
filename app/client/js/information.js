import { pointsGuideHTML, pointsPageRender, pointsGuideMount } from './points-guide.js';
// Public programme information. Team details are transcribed from the supplied November core-team slide.
import { $, esc, icon, toast } from './ui.js';

export const CONTACT_EMAIL = 'partnerships@addonz.my';
export const SOCIALS = [
  {name:'Instagram',url:'https://www.instagram.com/addonz.my?dlrf=NWc0dGRjaWV4cWV2&utm_source=qr',asset:'instagram.svg'},
  {name:'TikTok',url:'https://www.tiktok.com/@addonz.my?_r=1&_t=ZS-9BGMo2xXDXQ',asset:'tiktok.svg'},
];
export const TEAM = [
  {group:'PMO',people:[
    {name:'Ida Shahira',study:'BSc Economics · Year 4',role:'Team Lead & Campaign Director',cx:200,cy:258},
    {name:'Poh Yee',study:'BAcc Accounting · Year 4',role:'Finance & Impact Measurement',cx:575,cy:258},
  ]},
  {group:'Financial Ecosystem Solutions',people:[
    {name:'Aneesa',study:'Business Administration · Year 3',cx:1340,cy:274},
    {name:'An Xuan',study:'BSc Economics · Year 3',cx:1708,cy:274},
  ]},
  {group:'University & Student Relations',people:[
    {name:'Aqmar Safuan',study:'BSc Economics · Year 3',cx:206,cy:757},
    {name:'Luqman Amin',study:'BSc Economics · Year 3',cx:583,cy:757},
    {name:'Henri',study:'BSc Arts, Anthropology & Sociology · Year 3',cx:925,cy:757},
  ]},
  {group:'Digital Ecosystem Solutions',people:[
    {name:'Yi Xian Phi',study:'BSc Electrical Engineering · Year 3',cx:1331,cy:742},
    {name:'Raja Khadeejah',study:'BSc Computer Science · Year 2',cx:1703,cy:742},
  ]},
];
const TOPICS = [ ['merchant','Merchant / business partnership'],['events','KK / event collaboration'],['student','Student participation'],['support','App support'],['general','General enquiry'] ];
const sectionHead=(label,title,copy='')=>`<div class="info-section-head"><span class="info-eyebrow">${label}</span><h2>${title}</h2>${copy?`<p>${copy}</p>`:''}</div>`;
export const informationLinks=()=>`<nav class="info-links" aria-label="About and contact"><a href="#/about">${icon('info')}<span>About us</span>${icon('chevron-right')}</a><a href="#/contact">${icon('mail')}<span>Contact us</span>${icon('chevron-right')}</a></nav>`;
const topNav=(page)=>`<nav class="info-page-nav" aria-label="Information pages"><a href="#/home" class="info-home-link">${icon('arrow-left')}<span>Back to app</span></a><div><a href="#/about" ${page==='about'?'aria-current="page"':''}>About us</a><a href="#/contact" ${page==='contact'?'aria-current="page"':''}>Contact us</a></div></nav>`;

export function aboutRender(app={}) {
  return `<div class="info-page about-page">${topNav('about')}
    <header class="info-hero"><div class="info-hero-copy"><span class="info-eyebrow">Student-led. Campus-connected.</span><h1>About <span data-no-i18n>+Onz</span></h1><p class="info-hero-line">Campus life, with a little extra.</p><p>Discover campus businesses and events, build money confidence, and make everyday participation more rewarding.</p><a class="info-button info-button-lime" href="#/about/join">Be part of the journey ${icon('arrow-right')}</a></div>
      <div class="info-hero-actions" aria-label="The +Onz journey">${[['store','Discover','Find your campus favourites.'],['book-open','Learn','Build confidence with money.'],['gift','Earn','Turn eligible actions into rewards.'],['hand-heart','Give back','Support your campus community.']].map(([glyph,title,copy],i)=>`<div><span>${icon(glyph)}</span><i class="info-card-number" aria-hidden="true">0${i+1}</i><b>${title}</b><small>${copy}</small></div>`).join('')}</div></header>
    <section class="info-section info-story" aria-label="Our story"><div>${sectionHead('Our story','What is +Onz?')}<p>+Onz is a student-led platform connecting Universiti Malaya’s students, campus businesses and events. We bring discovery, financial learning and rewards together in one campus experience.</p><p>We are a UM student team building this initiative as part of our PayNet Digital Campus campaign. Our focus is practical: help local businesses get noticed, encourage confident digital-payment habits, and bring the campus community closer.</p></div><aside class="info-story-note">${icon('users')}<h3>Built with you, for campus.</h3><p>Your participation, ideas and feedback help shape what +Onz becomes.</p><a href="#/contact">Talk to the team ${icon('arrow-right')}</a></aside></section>
    <section class="info-section">${sectionHead('Why we are doing this','Small actions. Shared impact.')}<div class="info-impact-grid">${[
      ['store','More visibility','Help campus businesses and student ventures reach the people around them.'],
      ['lightbulb','More confidence','Make financial learning useful, approachable and part of student life.'],
      ['handshake','More connection','Bring students, businesses, colleges and event organisers into the same journey.'],
    ].map(([glyph,title,copy])=>`<article class="info-impact-card"><span class="info-tile-icon">${icon(glyph)}</span><h3>${title}</h3><p>${copy}</p></article>`).join('')}</div></section>
    <section class="info-section" id="about-join" tabindex="-1">${sectionHead('You are part of it','Choose your way in.','There is more than one way to add something to campus life.')}<div class="info-join-grid">${[
      ['store','Merchant / business owner','Put your business on the campus radar. Connect with students and explore live-deal collaborations.','merchant','Partner with us'],
      ['calendar','KK / event organiser','Bring your college, club or event into the picture. Share your plans, activities and stall layouts with us.','events','Plan a collaboration'],
      ['graduation-cap','Student','Discover, learn, earn and refer friends. Share your ideas or ask how to help with the campaign.','student','Join the journey'],
    ].map(([glyph,title,copy,topic,cta])=>`<article class="info-join-card"><span class="info-tile-icon">${icon(glyph)}</span><h3>${title}</h3><p>${copy}</p><a href="#/contact/${topic}">${cta} ${icon('arrow-right')}</a></article>`).join('')}</div></section>
    <section class="info-section" id="about-points" tabindex="-1">${sectionHead('Participation that counts','How the points work.','Earn through eligible activities, then choose how to use your points.')}${pointsGuideHTML(app)}
      <aside class="info-prize-note">${icon('gift')}<div><b>Something to work towards.</b><p>Programme prizes and KK League prize details will be announced here once confirmed.</p></div><span>Coming soon</span></aside>
    </section>
    <section class="info-section" id="about-team" tabindex="-1">${sectionHead('Who is behind the app','Meet the people adding the extra.','A team of UM students bringing different skills to one campus initiative.')}<div class="info-team-grid">${TEAM.map((group,i)=>`<article class="info-team-group"><h3><span>${String(i+1).padStart(2,'0')}</span>${group.group}</h3><div class="info-people ${group.people.length===3?'info-people-three':''}">${group.people.map(p=>`<div class="info-person"><span class="info-portrait" role="img" aria-label="${esc(p.name)}" style="background-position:${(p.cx-118)/1684*100}% ${(p.cy-118)/844*100}%"></span><h4 data-no-i18n>${esc(p.name)}</h4><p>${p.study}</p>${p.role?`<span class="info-person-role">${p.role}</span>`:''}</div>`).join('')}</div></article>`).join('')}</div></section>
    <section class="info-final-cta"><div><span class="info-eyebrow">Your campus. Your contribution.</span><h2>Let’s add something good.</h2><p>A business, an event, an idea or a question — we would love to hear from you.</p></div><a class="info-button info-button-lime" href="#/contact">Contact us ${icon('arrow-right')}</a></section>
    ${informationLinks()}</div>`;
}

export function aboutMount(root,app,[section]=[]) {
  const targets={join:'#about-join',points:'#about-points',team:'#about-team'};
  const target=Object.hasOwn(targets,section)?targets[section]:null;
  if(target)$(target,root)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  return pointsGuideMount(root,app);
}

export function contactRender(app={},[topic]=[]) {
  const selected=TOPICS.some(([key])=>key===topic)?topic:'general';
  return `<div class="info-page contact-page">${topNav('contact')}<header class="contact-heading"><div><span class="info-eyebrow">Let’s connect</span><h1>Contact us</h1><p>A partnership, an event, an idea or a question.<br>Let’s start a conversation.</p></div><div class="info-contact-art" aria-hidden="true"><span>${icon('mail')}</span><i>${icon('sparkles')}</i><i>${icon('handshake')}</i></div></header>
    <div class="info-contact-grid"><div class="info-contact-options"><section class="info-email-card"><span class="info-tile-icon">${icon('mail')}</span><h2>Say hello.</h2><p>For partnerships, collaborations and general enquiries.</p><div class="info-email-address"><a href="mailto:${CONTACT_EMAIL}" data-no-i18n>${CONTACT_EMAIL}</a><button type="button" id="info-copy-email" aria-label="Copy email address">${icon('copy')}</button></div></section>
      <section class="info-social-section"><h2>Follow the journey.</h2><p>Campus updates, new collaborations and what’s next.</p>${SOCIALS.map(s=>`<a class="info-social-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span class="info-social-icon"><img src="assets/about/${s.asset}" alt="" width="23" height="23"></span><span><b data-no-i18n>${s.name}</b><small data-no-i18n>@addonz.my</small></span>${icon('arrow-right')}<span class="sr">Opens in a new tab</span></a>`).join('')}</section>
      ${app.role==='student'&&app.profile?`<a class="info-feedback-link" href="#/feedback">${icon('mail')}<span>Prefer to message inside the app?<b>Questions and feedback</b></span>${icon('arrow-right')}</a>`:''}</div>
      <section class="info-query-card"><h2>What’s on your mind?</h2><p>Prepare your query below, then send it from your email app.</p><form id="info-contact-form"><div class="info-form-pair"><label class="field">Your name<input name="name" autocomplete="name" required maxlength="100" value="${esc(app.profile?.name||'')}"></label><label class="field">Your email<input name="email" type="email" autocomplete="email" required maxlength="254" value="${esc(app.user?.email||'')}"></label></div><label class="field">I’m getting in touch about<select name="topic">${TOPICS.map(([key,label])=>`<option value="${key}" ${key===selected?'selected':''}>${label}</option>`).join('')}</select></label><label class="field">Your message<textarea name="message" rows="6" required minlength="10" maxlength="2000" placeholder="Tell us a little about your question or idea."></textarea></label><p class="info-form-note">This form prepares an email draft. Your message is only sent when you send it in your email app.</p><button type="submit" class="info-button info-button-blue">Prepare email ${icon('arrow-right')}</button></form>
      <div class="info-draft" id="info-email-draft" hidden tabindex="-1"><p class="info-draft-status" role="status">Your draft is ready. Open it in your email app to send.</p><div class="info-draft-actions"><a class="info-button info-button-blue" id="info-open-draft">${icon('mail')}Open email draft</a><button class="info-button info-button-outline" type="button" id="info-copy-message">${icon('copy')}Copy message</button></div><details><summary>Preview your email ${icon('chevron-right')}</summary><b id="info-draft-subject" data-no-i18n></b><pre id="info-draft-body" data-no-i18n></pre></details><p class="info-form-note">No email app? Copy the message and send it to partnerships@addonz.my.</p></div>
      </section></div>${informationLinks()}</div>`;
}
const line=(value,max=120)=>String(value||'').replace(/[\r\n]+/g,' ').trim().slice(0,max);
export function buildInquiry({name,email,topic,message}) {
  const label=TOPICS.find(([key])=>key===topic)?.[1]||TOPICS.at(-1)[1];
  const subject=`+Onz — ${label}`;
  const body=`Name: ${line(name,100)}\nEmail: ${line(email,254)}\nTopic: ${label}\n\n${String(message||'').trim().slice(0,2000)}`;
  return {subject,body,url:`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`};
}
export function contactMount(root) {
  let draft=null;
  const form=$('#info-contact-form',root), preview=$('#info-email-draft',root);
  const copy=async(text)=>{try{await navigator.clipboard.writeText(text);toast('Copied to clipboard.');}catch{toast('Copy is unavailable here. Select the email or preview text to copy it.',true);}};
  $('#info-copy-email',root).onclick=()=>copy(CONTACT_EMAIL);
  form.onsubmit=(event)=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const fields=Object.fromEntries(new FormData(form));
    if(fields.name.trim().length<2||fields.message.trim().length<10){toast('Please add your name and a message of at least 10 characters.',true);return;}
    draft=buildInquiry(fields);
    $('#info-open-draft',root).href=draft.url;
    $('#info-draft-subject',root).textContent=draft.subject;
    $('#info-draft-body',root).textContent=draft.body;
    preview.hidden=false;
    preview.focus({preventScroll:true});
    preview.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  };
  $('#info-copy-message',root).onclick=()=>{if(draft)copy(`${draft.subject}\n\n${draft.body}`);};
  form.oninput=()=>{if(draft){draft=null;preview.hidden=true;}};
}
export const INFORMATION_ROUTES={
  points:{title:'Points guide',render:pointsPageRender,mount:pointsGuideMount,wide:true,tab:'rewards'},
  about:{title:'About us',render:aboutRender,mount:aboutMount,wide:true,tab:'about'},
  contact:{title:'Contact us',render:contactRender,mount:contactMount,wide:true,tab:'me'},
};
