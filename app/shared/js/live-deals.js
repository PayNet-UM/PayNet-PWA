// Verified merchant QR scans create a discount claim and its one-time points credit atomically.
import * as D from './data.js';
const fail = (message) => { const error = new Error(message); error.code = 'permission-denied'; throw error; };
const get = async (ctx, path) => { const s = await ctx.sdk.getDoc(ctx.sdk.doc(ctx.db, ...path.split('/'))); return s.exists() ? { id: s.id, ...s.data() } : null; };
const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
const query = (ctx, key, value) => ctx.sdk.query(ctx.sdk.collection(ctx.db, 'liveDealClaims'), ctx.sdk.where(key, '==', value));
export const QR_LIFETIME_MS = 90_000;
export const CLAIM_LIFETIME_MS = 15 * 60_000;
export const claimId = (deal, uid, day) => `${deal}_${uid}_${day}`;
export const claimExpired = (claim, now = Date.now()) => now >= (D.toMs(claim.createdAt) || 0) + CLAIM_LIFETIME_MS;
export function parseDealQR(raw) {
  const match = /^ONZDEAL1:([a-f0-9]{32})$/.exec(String(raw || '').trim());
  if (!match) fail('Scan the merchant’s live-deal QR. This is not a live-deal code.');
  return match[1];
}
async function activeDeal(ctx, id) {
  const rules = await D.getRules(ctx);
  if (!['overview', 'merchantTools', 'dealsAndPay'].every((key) => D.featureOn(rules, key))) fail('Live deals are currently unavailable.');
  const deal = await get(ctx, 'deals/' + id);
  if (!deal) fail('This live deal is unavailable.');
  const merchant = await D.getMerchant(ctx, deal.merchantId);
  if (D.dealStatus(deal, merchant, null, D.clock(ctx)) !== 'Available') fail('This live deal is not available right now.');
  return { deal, merchant };
}
export async function issueDealQR(ctx, dealId) {
  const { deal } = await activeDeal(ctx, dealId);
  if (deal.merchantId !== ctx.uid) fail('Only this deal’s merchant can show its QR.');
  const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
  const id = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expires = D.clock(ctx) + QR_LIFETIME_MS;
  await ctx.sdk.setDoc(ctx.sdk.doc(ctx.db, 'liveDealQRs', id), {
    merchantId: ctx.uid, dealId, createdAt: ctx.sdk.serverTimestamp(), expiresAt: ctx.sdk.Timestamp.fromMillis(expires),
  });
  return { id, code: 'ONZDEAL1:' + id, expiresAt: expires };
}
export async function claimDealQR(ctx, raw, expectedDealId) {
  const sessionId = parseDealQR(raw), session = await get(ctx, 'liveDealQRs/' + sessionId);
  if (!session || D.toMs(session.expiresAt) <= D.clock(ctx)) fail('This QR has expired. Ask the merchant for a fresh QR.');
  if (expectedDealId && session.dealId !== expectedDealId) fail('That QR belongs to a different live deal.');
  const { deal, merchant } = await activeDeal(ctx, session.dealId);
  const profile = await D.getProfile(ctx);
  if (profile?.role !== 'student') fail('Only students can claim a live deal.');
  const day = D.dayKey(D.clock(ctx)), id = claimId(deal.id, ctx.uid, day);
  const ref = ctx.sdk.doc(ctx.db, 'liveDealClaims', id);
  if ((await ctx.sdk.getDoc(ref)).exists()) fail('You’ve already claimed this deal today.');
  const rules = await D.getRules(ctx), rewardPoints = rules.liveDealPoints;
  if (!Number.isSafeInteger(rewardPoints) || rewardPoints < 1 || rewardPoints > 1000) fail('The live-deal points setting is unavailable. Please try again later.');
  // Rules permit creation only for students. The fixed ID and denied student
  // updates prevent concurrent scans from overwriting or reusing a claim.
  const ledgerId = 'liveDeal_' + id, batch = ctx.sdk.writeBatch(ctx.db);
  batch.set(ref, { studentUid: ctx.uid, studentName: profile.name, merchantId: merchant.id,
    dealId: deal.id, title: deal.title, benefit: deal.benefit || deal.title, rewardPoints, sessionId, day, status: 'claimed', createdAt: ctx.sdk.serverTimestamp() });
  batch.set(ctx.sdk.doc(ctx.db, 'users', ctx.uid, 'ledger', ledgerId), {
    type: 'liveDeal', delta: rewardPoints, claimId: id, dealId: deal.id, note: deal.title,
    by: ctx.uid, createdAt: ctx.sdk.serverTimestamp(),
  });
  batch.update(ctx.sdk.doc(ctx.db, 'users', ctx.uid), { points: ctx.sdk.increment(rewardPoints), lastTx: ledgerId });
  await batch.commit();
  return id;
}
export async function applyDealClaim(ctx, id) {
  await ctx.sdk.updateDoc(ctx.sdk.doc(ctx.db, 'liveDealClaims', id), { status: 'applied', appliedAt: ctx.sdk.serverTimestamp(), appliedBy: ctx.uid });
}
export async function myDealClaim(ctx, dealId) { return get(ctx, 'liveDealClaims/' + claimId(dealId, ctx.uid, D.dayKey(D.clock(ctx)))); }
export function watchMerchantClaims(ctx, cb, error) { return ctx.sdk.onSnapshot(query(ctx, 'merchantId', ctx.uid), (s) => cb(rows(s)), error); }
export function watchMyClaim(ctx, id, cb, error) { return ctx.sdk.onSnapshot(ctx.sdk.doc(ctx.db, 'liveDealClaims', id), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), error); }
export async function listDealClaims(ctx) { return rows(await ctx.sdk.getDocs(ctx.sdk.collection(ctx.db, 'liveDealClaims'))); }
