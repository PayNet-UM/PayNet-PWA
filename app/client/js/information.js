import { pointsGuideHTML, pointsGuideMount } from './points-guide.js';
import { POINT_LEVELS, learningPlan, livePointEarningOn, earnedPoints, DEFAULT_POINT_RULES, pointsRules, SELF_LESSON_COUNT } from './points-policy.js';
import { HATS } from './avatar.js';
import { ozIcon } from './oz-icons.js';
import { ozListRow, ozTag } from './oz-ui.js';
import { feedbackFormHTML, mountFeedbackForm } from './feedback.js';
// Public programme information. Team details are transcribed from the supplied November core-team slide.
import { $, esc, icon, toast, n } from './ui.js';

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

// About +Onz hub (Figma phone 747:16162, web 938:53363 / full content 1210:67284). Same production copy and team data,
// laid out as the Figma hub: in-page tabs, blue hero, four tiles, story + why, how it works + FAQ, points summary,
// ways in, team, closing call to action. The long points guide lives on #/points ("How points work").
const ABOUT_TABS = [['', 'Story'], ['join', 'Take part'], ['points', 'Points'], ['team', 'Team']];
export function aboutRender(app = {}, [section] = []) {
  const r = pointsRules(app.rules || {});
  const tile = ([glyph, title, copy, tone]) => `<article class="oz-about-tile is-${tone}"><span class="oz-about-tile-ic">${ozIcon(glyph)}</span><h3>${title}</h3><p>${copy}</p></article>`;
  const eyebrow = (t) => `<p class="oz-about-eyebrow">${t}</p>`;
  const faq = [
    ['What counts for my KK score?', 'Only points you earn. Spending or donating never lowers it.'],
    ['How do I earn points?', `Finish Learn &amp; Earn lessons (+${n(r.lessonBonus)} pts each), complete the Money Check (+${n(r.surveyBonus)} pts) and keep your daily streak (+${n(r.streakBonus)} pts every 7 days).`],
    ['Who gives me my voucher?', 'Show your voucher to the Admin team, who mark it redeemed.'],
  ];
  return `<div class="oz-about">
    <h1 class="oz-about-title">About <span data-no-i18n>+Onz</span></h1>
    <nav class="oz-about-tabs" aria-label="About sections">${ABOUT_TABS.map(([k, label]) => `<button type="button" data-about-tab="${k}" aria-pressed="${(section || '') === k}">${label}</button>`).join('')}</nav>
    <header class="oz-about-hero" id="about-story" tabindex="-1"><div class="oz-about-hero-copy">${eyebrow('Student-led. Campus-connected.')}<h2>Campus life, <span class="oz-about-nowrap">with a little extra.</span></h2>
      <p>Discover campus businesses and events, build money confidence, and make everyday participation more rewarding.</p>
      <button type="button" class="oz-btn oz-btn-primary oz-btn-md" data-about-tab="join"><span>Be part of the journey</span></button></div>
      <span class="oz-about-halo" aria-hidden="true"><img src="assets/onz/about/wave.svg" alt="" width="125" height="150"></span></header>
    <div class="oz-about-tiles">${[['map-pin', 'Discover', 'Find your campus favourites.', 'lilac'], ['learn', 'Learn', 'Build confidence with money.', 'mint'],
      ['coin', 'Earn', 'Turn eligible actions into rewards.', 'sky'], ['heart', 'Give back', 'Support your campus community.', 'peach']].map(tile).join('')}</div>
    <div class="oz-about-pair">
      <section class="oz-about-card" aria-label="Our story">${eyebrow('Our story')}<h2>What is <span data-no-i18n>+Onz</span>?</h2>
        <p>+Onz is a student-led platform connecting Universiti Malaya’s students, campus businesses and events. We bring discovery, financial learning and rewards together in one campus experience.</p>
        <p>We are a UM student team building this initiative as part of our PayNet Digital Campus campaign. Our focus is practical: help local businesses get noticed, encourage confident digital-payment habits, and bring the campus community closer.</p>
        <aside class="oz-about-note"><h3>Built with you, for campus.</h3><p>Your participation, ideas and feedback help shape what +Onz becomes.</p><a class="oz-btn oz-btn-ghost oz-btn-sm" href="#/contact"><span>Talk to the team</span></a></aside></section>
      <section class="oz-about-card" aria-label="Why we are doing this">${eyebrow('Why we are doing this')}<h2>Small actions. Shared impact.</h2>
        <dl class="oz-about-why">${[['More visibility', 'Help campus businesses and student ventures reach the people around them.'], ['More confidence', 'Make financial learning useful, approachable and part of student life.'],
          ['More connection', 'Bring students, businesses, colleges and event organisers into the same journey.']].map(([t, c]) => `<div><dt>${t}</dt><dd>${c}</dd></div>`).join('')}</dl></section>
    </div>
    <div class="oz-about-pair" id="about-points" tabindex="-1">
      <section class="oz-about-card" aria-label="How it works">${eyebrow('How it works')}<h2>One app to learn, earn and redeem on campus.</h2>
        <ol class="oz-about-steps">${[['Learn', 'Finish a short lesson in Learn & Earn.'], ['Earn', `+${n(r.lessonBonus)} pts for your first correct answer.`], ['Redeem', 'Show your voucher to the Admin team.']]
          .map(([t, c], i) => `<li><span class="oz-about-num" aria-hidden="true">${i + 1}</span><div><b>${t}</b><small>${esc(c)}</small></div></li>`).join('')}</ol></section>
      <section class="oz-about-card" aria-label="Frequently asked questions">${eyebrow('FAQ')}
        <div class="oz-about-faq">${faq.map(([q, a], i) => `<details${i ? '' : ' open'}><summary>${q}<span class="oz-about-faq-sign" aria-hidden="true"></span></summary><p>${a}</p></details>`).join('')}</div></section>
    </div>
    <section class="oz-about-card oz-about-points" aria-label="How points work"><h2>How points work</h2><p class="oz-about-lede">Earn points from eligible activities around campus.</p>
      <div class="oz-about-grid3">${[['Earn points', 'Complete eligible lessons, surveys and streaks.'], ['Use your balance', 'Redeem available vouchers or donate points to student welfare.'], ['Levels and leagues', 'Spending or donating points doesn’t lower your earned total.']]
        .map(([t, c], i) => `<a class="oz-about-mini${i === 2 ? ' is-filled' : ''}" href="#/points"><b>${t}</b><small>${c}</small></a>`).join('')}</div>
      <ul class="oz-about-values" aria-label="Current point values"><li><b>${n(SELF_LESSON_COUNT * r.lessonBonus + r.surveyBonus)}</b><span>one-time learning points</span><span data-no-i18n>${SELF_LESSON_COUNT} × ${n(r.lessonBonus)} + ${n(r.surveyBonus)}</span></li>
        <li><b>+${n(r.surveyBonus)}</b><span>Money Check survey</span></li><li><b>+${n(r.liveDealPoints)}</b><span>per eligible live deal</span></li><li><b>+${n(r.streakBonus)}</b><span>every 7-day streak</span></li></ul>
      <p class="oz-about-fine">Points are an in-app balance with no cash value. They are used for programme vouchers or donated to student welfare. Programme prizes and KK League prize details will be announced here once confirmed.</p></section>
    <section class="oz-about-card" id="about-join" tabindex="-1" aria-label="Choose your way in">${eyebrow('You are part of it')}<h2>Choose your way in.</h2><p class="oz-about-lede">There is more than one way to add something to campus life.</p>
      <div class="oz-about-grid3">${[['Merchant / business owner', 'Put your business on the campus radar. Connect with students and explore live-deal collaborations.', 'merchant', 'Partner with us'],
        ['KK / event organiser', 'Bring your college, club or event into the picture. Share your plans, activities and stall layouts with us.', 'events', 'Plan a collaboration'],
        ['Student', 'Discover, learn, earn and refer friends. Share your ideas or ask how to help with the campaign.', 'student', 'Join the journey']]
        .map(([t, c, topic, cta]) => `<article class="oz-about-way"><h3>${t}</h3><p>${c}</p><a class="oz-btn oz-btn-ghost oz-btn-sm" href="#/contact/${topic}"><span>${cta}</span></a></article>`).join('')}</div></section>
    <section class="oz-about-team" id="about-team" tabindex="-1" aria-label="Meet the team"><h2>Meet the team</h2><p class="oz-about-lede">UM students adding the extra.</p>
      <div class="oz-about-team-grid">${TEAM.map((g, gi) => `<article class="oz-about-card oz-about-group">${ozTag(g.group, ['lilac', 'mint', 'sky', 'peach'][gi % 4])}
        <div class="oz-about-people">${g.people.map((p) => `<div class="oz-about-person"><span class="oz-about-portrait" role="img" aria-label="${esc(p.name)}" style="background-position:${(p.cx - 118) / 1684 * 100}% ${(p.cy - 118) / 844 * 100}%"></span><b data-no-i18n>${esc(p.name)}</b><small>${esc(p.role || p.study)}</small></div>`).join('')}</div></article>`).join('')}</div></section>
    <section class="oz-about-cta">${eyebrow('Your campus. Your contribution.')}<h2>Let’s add something good.</h2><p>A business, an event, an idea or a question — we would love to hear from you.</p>
      <a class="oz-btn oz-btn-primary oz-btn-md" href="#/contact"><span>Contact us</span></a></section>
    <nav class="oz-about-more" aria-label="More about +Onz">${[['coin', 'How points work', '#/points'], ['megaphone', 'Get involved', '#/contact/student'], ['mail', 'Contact us', '#/contact']]
      .map(([g, t, h]) => `<a class="oz-row" href="${h}"><span class="oz-about-more-ic">${ozIcon(g)}</span><span>${t}</span>${ozIcon('s:chevron-right')}</a>`).join('')}</nav>
  </div>`;
}

export function aboutMount(root,app,[section]=[]) {
  const targets={'':'#about-story',join:'#about-join',points:'#about-points',team:'#about-team'};
  const behavior=()=>matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth';
  const tabs=[...root.querySelectorAll('.oz-about-tabs [data-about-tab]')];
  const mark=(k)=>tabs.forEach((t)=>t.setAttribute('aria-pressed',String(t.dataset.aboutTab===k)));
  // In-page tabs scroll within the page; they never change the route (that would play a page push on phones).
  let lockUntil=0;
  root.querySelectorAll('[data-about-tab]').forEach((b)=>{b.onclick=()=>{const k=b.dataset.aboutTab;mark(k);lockUntil=performance.now()+900;
    const el=$(targets[k],root);el?.scrollIntoView({block:'start',behavior:behavior()});el?.focus({preventScroll:true});};});
  const target=Object.hasOwn(targets,section)?targets[section]:null;
  if(target&&section)$(target,root)?.scrollIntoView({block:'start',behavior:behavior()});
  // The pressed tab follows the section being read.
  const io=typeof IntersectionObserver==='function'?new IntersectionObserver((entries)=>{if(performance.now()<lockUntil)return;
    const top=entries.filter((e)=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
    if(top){const k=Object.keys(targets).find((key)=>top.target.matches(targets[key]));if(k!==undefined)mark(k);}},{rootMargin:'-30% 0px -60% 0px'}):null;
  Object.values(targets).forEach((sel)=>{const el=$(sel,root);if(el)io?.observe(el);});
  return ()=>io?.disconnect();
}

export function contactRender(app={},[topic]=[]) {
  const selected=TOPICS.some(([key])=>key===topic)?topic:'general';
  const inApp=app.role==='student'&&!!app.profile;
  // Email row: the address opens the mail app; Copy morphs to "Copied" for a moment (Lightyear account details on Mobbin).
  const email=`<div class="oz-contact-email"><a class="oz-contact-mail" href="mailto:${CONTACT_EMAIL}"><span class="oz-row-lead">${ozIcon('mail')}</span><span class="oz-contact-addr" data-no-i18n>${CONTACT_EMAIL}</span></a>
    <button type="button" class="oz-copy" id="info-copy-email" aria-label="Copy email address"><span class="oz-copy-state oz-copy-idle">${ozIcon('copy')}<span>Copy</span></span><span class="oz-copy-state oz-copy-done" aria-hidden="true">${ozIcon('s:check')}<span>Copied</span></span></button></div>`;
  const socials=`<div class="oz-contact-socials">${SOCIALS.map(s=>`<a class="oz-contact-social" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.name)} (opens in a new tab)"><img src="assets/about/${s.asset}" alt="" width="28" height="28"><span><b>${esc(s.name)}</b><small data-no-i18n>@addonz.my</small></span></a>`).join('')}</div>`;
  // Students write to the team inside the app (one composer, replies come back to Questions and feedback);
  // everyone else gets the same composer shape, which prepares an email.
  const composer=inApp?`${feedbackFormHTML()}<a class="oz-link oz-contact-history" href="#/feedback">Your messages and replies <span aria-hidden="true">→</span></a>`
    :`<form id="info-contact-form" class="oz-help-panel oz-composer"><h2 class="oz-composer-title">What’s on your mind?</h2>
      <fieldset class="oz-chips"><legend class="oz-sr">Topic</legend>${TOPICS.map(([key,label])=>`<label class="oz-chip"><input type="radio" name="topic" value="${key}" ${key===selected?'checked':''}><span>${label}</span></label>`).join('')}</fieldset>
      <div class="oz-help-form-pair"><label class="oz-help-field">Your name<input name="name" autocomplete="name" required maxlength="100" value="${esc(app.profile?.name||'')}"></label><label class="oz-help-field">Your email<input name="email" type="email" autocomplete="email" required maxlength="254" value="${esc(app.user?.email||'')}"></label></div>
      <label class="oz-composer-box"><span class="oz-sr">Your message</span><textarea name="message" rows="5" required minlength="10" maxlength="2000" placeholder="Ask a question or share an idea"></textarea></label>
      <button type="submit" class="oz-btn oz-btn-primary oz-btn-md oz-btn-block">${ozIcon('mail')}<span>Write email</span></button></form>
      <div class="oz-help-draft" id="info-email-draft" hidden tabindex="-1"><p class="info-draft-status" role="status">Your draft is ready.</p><div class="oz-help-draft-actions"><a class="oz-btn oz-btn-primary oz-btn-md" id="info-open-draft">${icon('mail')}Open email draft</a><button class="oz-btn oz-btn-ghost oz-btn-md" type="button" id="info-copy-message">${icon('copy')}Copy message</button></div><details class="oz-smooth"><summary>Preview your email ${icon('chevron-right')}</summary><b id="info-draft-subject" data-no-i18n></b><pre id="info-draft-body" data-no-i18n></pre></details></div>`;
  return `<div class="oz-help oz-contact"><header class="oz-help-heading"><a class="oz-help-back" href="#/about">${icon('chevron-left')} About +Onz</a><h1>Contact us</h1></header>
    <div class="oz-help-grid"><div class="oz-help-options"><section class="oz-help-panel oz-contact-card oz-contact-emailcard"><h2>Email us</h2>${email}</section>
      <section class="oz-help-panel oz-contact-card"><h2>Follow us</h2>${socials}</section></div>
      <section class="oz-help-query">${composer}</section></div></div>`;
}
const line=(value,max=120)=>String(value||'').replace(/[\r\n]+/g,' ').trim().slice(0,max);
export function buildInquiry({name,email,topic,message}) {
  const label=TOPICS.find(([key])=>key===topic)?.[1]||TOPICS.at(-1)[1];
  const subject=`+Onz — ${label}`;
  const body=`Name: ${line(name,100)}\nEmail: ${line(email,254)}\nTopic: ${label}\n\n${String(message||'').trim().slice(0,2000)}`;
  return {subject,body,url:`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`};
}
export function contactMount(root,app={}) {
  let draft=null,copiedTimer=0;
  const form=$('#info-contact-form',root), preview=$('#info-email-draft',root);
  const copy=async(text)=>{try{await navigator.clipboard.writeText(text);toast('Copied to clipboard.');}catch{toast('Copy is unavailable here. Select the email or preview text to copy it.',true);}};
  // The button itself confirms the copy (no toast): icon and label cross-fade to "Copied", then back.
  const copyBtn=$('#info-copy-email',root);
  copyBtn.onclick=async()=>{
    try{await navigator.clipboard.writeText(CONTACT_EMAIL);}catch{toast('Copy is unavailable here. Select the email to copy it.',true);return;}
    copyBtn.classList.add('is-copied');copyBtn.setAttribute('aria-label','Email address copied');
    clearTimeout(copiedTimer);copiedTimer=setTimeout(()=>{copyBtn.classList.remove('is-copied');copyBtn.setAttribute('aria-label','Copy email address');},1600);
  };
  if(!form){mountFeedbackForm(root,app);return()=>clearTimeout(copiedTimer);}
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
  return()=>clearTimeout(copiedTimer);
}
// Points guide for the student app (Figma 16 · Points guide 696:13525, Web · Points guide 929:37412). The Admin dashboard
// keeps the shared long-form guide; the policy details are still here under "How points are protected".
function ozPointsRender(app = {}) {
  const rules = app.rules || DEFAULT_POINT_RULES, plan = learningPlan(rules, app.ledger || []);
  const student = app.role === 'student' && !!app.profile, live = livePointEarningOn(rules), ids = new Set((app.ledger || []).map((e) => e.id));
  const lessonsDone = Array.from({ length: plan.lessonCount }, (_, i) => ids.has('lesson' + i)).every(Boolean);
  const earn = [
    ['Learn & Earn', `+${n(plan.lessonBonus)} pts`, student && lessonsDone, '#/learn'],
    ['Money check', `+${n(plan.surveyBonus)} pts`, student && ids.has('survey'), '#/survey'],
    ['Live deals', live ? `+${n(plan.liveDealPoints)} pts` : 'Off for now', false, live ? '#/explore/deals' : ''],
    ['Welfare grants', 'Up to 1,000 pts', false, '#/community/fund'],
    ['Daily streak', `+${n(plan.streakBonus)} pts / 7 days`, false, '#/rewards/streak'],
  ];
  const row = ([label, tag, done, href]) => {
    const inner = `<span class="oz-pg-dot${done ? ' is-done' : ''}" aria-hidden="true"></span><span class="oz-pg-name">${esc(label)}</span>${ozTag(tag, 'points')}`;
    return `<li>${student && href ? `<a class="oz-pg-row" href="${href}"${done ? ' aria-label="' + esc(label) + ': done"' : ''}>${inner}</a>` : `<span class="oz-pg-row">${inner}</span>`}</li>`;
  };
  const hatFor = (label) => HATS.find((h) => h[2] === label)?.[1];
  const level = ([threshold, label], i) => {
    const hat = i === 0 ? 'No hat' : hatFor(label) || (i >= 3 ? 'Colours and looks' : '');
    const body = `<span class="oz-row-lead">${ozIcon(i >= 3 ? 'leagues' : 'hat')}</span><span class="oz-row-text"><span class="oz-row-title">${esc(label)}</span><span class="oz-row-sub">${n(threshold)} pts${hat ? ' · ' + esc(hat) : ''}</span></span>`;
    return student ? `<a class="oz-row" href="#/avatar">${body}${ozIcon('s:chevron-right', 'oz-row-chev')}</a>` : `<div class="oz-row">${body}</div>`;
  };
  const use = (title, sub, ic, href) => `<a class="oz-row" href="${href}"><span class="oz-row-lead">${ozIcon(ic)}</span><span class="oz-row-text"><span class="oz-row-title">${esc(title)}</span><span class="oz-row-sub">${esc(sub)}</span></span>${ozIcon('s:chevron-right', 'oz-row-chev')}</a>`;
  const back = app.role === 'student' ? '#/rewards' : '#/home';
  return `<div class="oz-pguide">
    <div class="oz-pg-head"><a class="oz-pg-back" href="${back}">${ozIcon('s:chevron-left')}<span>${app.role === 'student' ? 'Rewards' : 'Back to app'}</span></a>
      <h1 class="oz-page-title">Points guide</h1><p class="oz-pg-lede">Learn. Earn. Make them count.</p></div>
    <div class="oz-pg-grid">
      <div class="oz-pg-main">
        <section class="oz-pg-card" aria-labelledby="pg-earn"><h2 id="pg-earn">Ways to earn</h2><ul class="oz-pg-list">${earn.map(row).join('')}</ul>
          <p class="oz-pg-note">Referrals and browsing the campus map don’t award points.</p></section>
        <section class="oz-pg-card" aria-labelledby="pg-levels"><h2 id="pg-levels">Levels, hats and your KK</h2><div class="oz-pg-rows">${POINT_LEVELS.map(level).join('')}</div></section>
      </div>
      <div class="oz-pg-side">
        <section class="oz-pg-value" aria-label="What points are worth"><p class="oz-pg-big">100 pts = RM1</p><p class="oz-pg-fine">Points have no cash value.</p></section>
        ${student ? `<section class="oz-pg-card oz-pg-facts" aria-label="Your points"><div><span>Earned for levels &amp; leagues</span><b><span data-policy-earned>${app.ledgerLoaded === false ? '—' : n(earnedPoints(app.ledger || []))}</span> pts</b></div>
          <div><span>Learning points still available</span><b><span data-policy-remaining>${app.ledgerLoaded === false ? '—' : n(plan.remaining)}</span> pts</b></div></section>` : ''}
        <section class="oz-pg-card" aria-labelledby="pg-use"><h2 id="pg-use">Two ways to use them</h2><div class="oz-pg-rows">
          ${use('Swap for a voucher', 'Collected at the HEP counter', 'voucher', student ? '#/rewards' : '#/home')}${use('Donate to student welfare', 'Every point goes to the fund', 'heart', student ? '#/community/fund' : '#/home')}</div></section>
        <details class="oz-pg-card oz-pg-more oz-smooth"><summary>How points are protected ${ozIcon('s:chevron-right')}</summary>
          <p>Each balance change and its points-history entry are saved together. The history can’t be edited or deleted, and the rules block repeat lesson bonuses, duplicate daily deal claims and negative balances.</p>
          <p>Changing a bonus affects future awards only. The Admin team can correct mistakes with a recorded reason.</p></details>
      </div>
    </div>
  </div>`;
}
export const INFORMATION_ROUTES={
  points:{title:'Points guide',render:ozPointsRender,mount:pointsGuideMount,tab:'rewards'},
  about:{title:'About us',render:aboutRender,mount:aboutMount,wide:true,tab:'me'},
  contact:{title:'Contact us',render:contactRender,mount:contactMount,wide:true,tab:'me'},
};
