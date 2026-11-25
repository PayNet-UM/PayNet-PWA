// Initiatives and KOL tracking: tracking links (addonz.my/?src=<code>), the "How did you hear about +Onz?" answer,
// and before/after impact from the daily summaries. No imports, so it can be tested on its own.

export const SOURCE_RE = /^[a-z0-9-]{2,30}$/;
export const SOURCE_DAYS = 30; // a tracking link counts if the student signs up within 30 days of opening it
const SOURCE_KEY = 'onz-src';

export const INITIATIVE_TYPES = [['kol', 'KOL or influencer'], ['event', 'Event or booth'], ['roundtable', 'Roundtable or talk'],
  ['poster', 'Poster or flyer'], ['social', 'Social media post'], ['other', 'Other']];
export const HEARD_FROM = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['friend', 'A friend'], ['event', 'An event or booth'],
  ['kol', 'An influencer (KOL)'], ['hep', 'HEP, a lecturer or my college'], ['other', 'Somewhere else']];
export const HEARD_OTHER_MAX = 60;

// Turns any text into a tracking code: lower case, letters, numbers and dashes.
export const toCode = (text) => String(text || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

// First touch: keep the first valid ?src= code seen, for 30 days. storage is localStorage (or a stand-in).
export function captureSource(search, storage, now = Date.now()) {
  try {
    const code = new URLSearchParams(search || '').get('src');
    if (!code || !SOURCE_RE.test(code)) return getSource(storage, now);
    if (getSource(storage, now)) return getSource(storage, now);
    storage.setItem(SOURCE_KEY, JSON.stringify({ code, at: now }));
    return code;
  } catch { return ''; }
}
// A link to this app that keeps the tracking code. Used when a student has to leave Instagram or TikTok for
// Chrome or Safari to sign in: the code saved inside those apps can't be seen there, so it travels in the link.
export const linkWithSource = (base, src) => base + (src && SOURCE_RE.test(src) ? '?src=' + src : '');
export function getSource(storage, now = Date.now()) {
  try {
    const saved = JSON.parse(storage.getItem(SOURCE_KEY) || 'null');
    return saved && SOURCE_RE.test(saved.code) && now - saved.at < SOURCE_DAYS * 86400000 ? saved.code : '';
  } catch { return ''; }
}

// rows: daily summaries, oldest first ({ day, students: { new }, sources: { bySource, activatedBySource } }).
// initiative: { code, start, end }. Compares average daily sign-ups for `window` days before the start with the
// days after it (up to the end date, the window, or the latest summary), and counts sign-ups through its link.
export function initiativeImpact(rows, initiative, window = 14) {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const latest = rows[rows.length - 1];
  const viaLink = latest?.sources?.bySource?.[initiative.code] || 0;
  const activatedViaLink = latest?.sources?.activatedBySource?.[initiative.code] || 0;
  const shift = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const series = (from, to) => { const out = []; for (let d = from; d <= to; d = shift(d, 1)) if (byDay.has(d)) out.push(byDay.get(d).students?.new || 0); return out; };
  const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const start = initiative.start;
  if (!start || !latest || latest.day < start) return { viaLink, activatedViaLink, before: null, after: null, extra: null, days: 0 };
  const afterEnd = [initiative.end || shift(start, window - 1), shift(start, window - 1), latest.day].sort()[0];
  const before = series(shift(start, -window), shift(start, -1)), after = series(start, afterEnd);
  const b = avg(before), a = avg(after);
  const extra = b == null || a == null ? null : Math.round(after.reduce((sum, x) => sum + (x - b), 0));
  return { viaLink, activatedViaLink, before: b, after: a, extra, days: after.length };
}
