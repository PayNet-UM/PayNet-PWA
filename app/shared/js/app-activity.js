import { dayKey, recordAppDay } from './data.js';

// Count opening/resuming/using the signed-in app, never an idle background tab.
export function startDailyAppActivity(ctx, { doc = document, host = window, now = Date.now, record = recordAppDay, onError = () => {} } = {}) {
  let savedDay = '', errorDay = '', busy = false, stopped = false;
  const recordToday = async () => {
    if (stopped || busy || doc.visibilityState === 'hidden') return;
    const day = dayKey(now());
    if (savedDay === day) return;
    busy = true;
    try { await record(ctx); if (!stopped) { savedDay = day; errorDay = ''; } }
    catch (error) { if (!stopped && errorDay !== day) { errorDay = day; onError(error); } }
    finally { busy = false; }
  };
  const events = [[doc, 'visibilitychange'], [host, 'pageshow'], [host, 'focus'], [doc, 'pointerdown'], [doc, 'keydown']];
  for (const [target, name] of events) target.addEventListener(name, recordToday);
  recordToday();
  return () => { stopped = true; for (const [target, name] of events) target.removeEventListener(name, recordToday); };
}
