// The supplied KPS plan must stay aligned with its real allocations and must
// never show a sample business as a confirmed vendor at an official booth.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { copySite } from '../scripts/lib/sites.mjs';
// Match the real site's shared/client layering without relying on a stale dist.
const site = fs.mkdtempSync(path.join(os.tmpdir(), 'onz-kps-test-'));
process.on('exit', () => fs.rmSync(site, { recursive: true, force: true }));
copySite('client', site);
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
const { KPS_BOOTHS, KPS_PLAN, KPS_VENDORS, KPS_VIEW, KPS_AREAS, kpsAreaContains, kpsDisplayBooth, kpsBooth, kpsMapHTML, kpsDetailsHTML } = await import(pathToFileURL(path.join(site, 'js/feskum-kps.js')));
const { feskumRender, matchingBooths } = await import(pathToFileURL(path.join(site, 'js/feskum.js')));
const { eventCarousel } = await import(pathToFileURL(path.join(site, 'js/event-carousel.js')));

assert.deepEqual(KPS_BOOTHS.filter((b) => b.number).map((b) => b.number), Array.from({ length: 70 }, (_, i) => i + 1));
assert.equal(KPS_BOOTHS.filter((b) => b.kind === 'student').length, 5);
assert.equal(KPS_BOOTHS.filter((b) => b.kind === 'merch').length, 1);
assert.equal(new Set(KPS_BOOTHS.map((b) => b.id)).size, KPS_BOOTHS.length);
assert.equal(KPS_AREAS.length,4);
assert.deepEqual(KPS_AREAS.map(a=>KPS_BOOTHS.filter(b=>kpsAreaContains(a,b)).length),[22,14,30,10]);
for(const b of KPS_BOOTHS) assert.equal(KPS_AREAS.filter(a=>kpsAreaContains(a,b)).length,1,b.id+' must have exactly one entry point in the overview');
for(const b of KPS_BOOTHS) {
  assert.ok(b.outline?.length >= 4, b.id+' must use a PDF-derived booth outline');
  const displayed=kpsDisplayBooth(b),angle=displayed.angle*Math.PI/180;
  assert.deepEqual(displayed.outline,b.outline,b.id+' was squeezed while closing the gaps');
  assert.equal(displayed.angle,b.angle,b.id+' lost its source orientation');
  for(const [x,y] of displayed.outline){
    const px=displayed.x+x*Math.cos(angle)-y*Math.sin(angle),py=displayed.y+x*Math.sin(angle)+y*Math.cos(angle);
    assert.ok(px>=KPS_VIEW.x&&px<=KPS_VIEW.x+KPS_VIEW.width&&py>=KPS_VIEW.y&&py<=KPS_VIEW.y+KPS_VIEW.height,b.id+' was clipped by the tighter framing');
  }
}
for (const b of KPS_BOOTHS) {
  assert.ok(b.x > KPS_PLAN.x && b.x < KPS_PLAN.x + KPS_PLAN.width, `${b.id} lies outside the plan`);
  assert.ok(b.y > KPS_PLAN.y && b.y < KPS_PLAN.y + KPS_PLAN.height, `${b.id} lies outside the plan`);
  if (!KPS_VENDORS[b.id]) {
    assert.ok(kpsDetailsHTML(b.id).includes('Stall info coming soon'));
    assert.ok(!/RM\d/.test(kpsDetailsHTML(b.id)), `${b.id} invents a menu price`);
  }
}
assert.equal(kpsBooth('KPS-70').category, 'Food & drinks');
assert.equal(kpsBooth('KPS-SV1').number, null, 'The source does not number student spaces');
assert.equal(kpsBooth('missing'), null);
const map = kpsMapHTML();
assert.ok(map.includes('data-layout="adapted" viewBox="258 240 196 226"'));
assert.ok(map.includes('Adapted layout · Not to scale'));
assert.ok(KPS_VIEW.width*KPS_VIEW.height < 248*273*.7,'The edited footprint must remove internal gaps, not just outer padding');
for(const source of KPS_BOOTHS) {
  const b=kpsDisplayBooth(source);
  assert.ok(map.includes(`transform="translate(${b.x} ${b.y}) rotate(${b.angle})"`),b.id+' click target differs from the edited drawing');
}
// Keep the same neighbouring rows and numbering directions after spacing edits.
for(const [from,to] of [[1,3],[4,9],[10,23],[24,27],[30,41],[42,51],[54,65],[66,70]]) {
  const a=KPS_BOOTHS.find(b=>b.number===from),b=KPS_BOOTHS.find(b=>b.number===to);
  const da=kpsDisplayBooth(a),db=kpsDisplayBooth(b);
  assert.equal(Math.sign(db.x-da.x),Math.sign(b.x-a.x));
  assert.equal(Math.sign(db.y-da.y),Math.sign(b.y-a.y));
}
assert.equal((map.match(/data-kps-booth/g) || []).length, 76);
assert.equal((map.match(/role="button" tabindex="0"/g) || []).length, 76);
assert.ok(map.includes('Choose a stall group')&&map.includes('id="kps-guide-hint"'));
assert.equal((map.match(/data-kps-area=/g)||[]).length,4);
assert.ok(map.includes('id="kps-zoom-in"') && map.includes('id="kps-zoom-out"') && map.includes('id="kps-zoom-fit"'));
const page = feskumRender();
assert.ok(page.indexOf('id="kps-title"') < page.indexOf('festival-other-areas'), 'Tapak KPS must be the first section');
assert.ok(page.includes('festival-vendor-dropdown') && page.includes('Other areas (demo)'));
assert.equal(matchingBooths('', 'All').length, 16, 'Keep the other demo areas available');
const event = eventCarousel({ page: true });
assert.ok(event.includes('data-explore-stalls href="#/feskum">Explore stalls'), 'Explore stalls must open the map directly');
assert.ok(!event.includes('>Details '));
assert.ok(event.includes('data-poster') && event.includes('data-play'), 'Keep poster previews and slideshow controls');
for (const path of [KPS_PLAN.background, KPS_PLAN.source]) assert.ok(fs.existsSync(new URL('../app/client/' + path, import.meta.url)));
// Confirm that future confirmed data is rendered safely, without HTML injection.
KPS_VENDORS['KPS-01'] = { name: '<Vendor>', photos: ['https://outside.test/tracker.jpg'], items: [{ name: '<Menu item>', cents: 850 }] };
const details = kpsDetailsHTML('KPS-01');
assert.ok(details.includes('&lt;Vendor&gt;') && details.includes('&lt;Menu item&gt;') && details.includes('RM8.50'));
assert.ok(!details.includes('<img'), 'Only supplied local event photos can be embedded');
delete KPS_VENDORS['KPS-01'];
console.log('FESKUM KPS: allocations, adapted spacing and row order, pending details, accessible booth controls and safe vendor content passed.');
