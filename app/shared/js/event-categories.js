// Shared with the HEP campaign editor so newly published events can be filtered consistently.
export const EVENT_CATEGORIES=[['talks','Talks','megaphone'],['seminars','Seminars','book-open'],['competitions','Competitions','trophy'],['bazaars','Bazaars','store'],['summits','Summits','users'],['festivals','Festivals','sparkles'],['music','Music','ticket'],['sports','Sports','flame'],['other','Other','calendar']];
export function eventCategory(event={}){
  if(EVENT_CATEGORIES.some(([id])=>id===event.category))return event.category;
  const name=String(event.name||event.title||'').toLowerCase();
  return /summit|sidang kemuncak/.test(name)?'summits':/seminar|symposium|simposium/.test(name)?'seminars':/talk|forum|ceramah/.test(name)?'talks':/competition|pertandingan|battle|pencarian/.test(name)?'competitions':/bazaar|bazar|gerai|jualan/.test(name)?'bazaars':/run|sukan|sport/.test(name)?'sports':/music|melody|band|stage|konsert/.test(name)?'music':/fest|pelancaran/.test(name)?'festivals':'other';
}
export const categoryLabel=id=>EVENT_CATEGORIES.find(([key])=>key===id)?.[1]||'Other';
