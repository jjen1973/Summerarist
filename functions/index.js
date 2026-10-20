import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import crypto from 'node:crypto';
import Stripe from 'stripe';
import { billingService, validOrigin, registeredUser, testKey } from './billing.js';

initializeApp();
const secretKey = defineSecret('SUMMARIST_STRIPE_TEST_KEY');
const webhookSecret = defineSecret('SUMMARIST_STRIPE_TEST_WEBHOOK');
const db = getFirestore();
const accountRef = uid => db.doc(`stripeSandboxAccounts/${uid}`);
const repository = {
  account: async uid => (await accountRef(uid).get()).data(),
  updateAccount: (uid, values) => accountRef(uid).set({ ...values, updatedAt: FieldValue.serverTimestamp(), environment: 'test' }, { merge: true }),
  bindCustomer: async (uid, id) => {
    const batch = db.batch();
    batch.set(accountRef(uid), { customerId: id, environment: 'test', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    batch.create(db.doc(`stripeSandboxCustomers/${id}`), { uid, environment: 'test' });
    await batch.commit();
  },
  owner: async id => (await db.doc(`stripeSandboxCustomers/${id}`).get()).data()?.uid,
  subscription: (uid, id, value) => db.doc(`customers/${uid}/subscriptions/${id}`).set({ ...value, updatedAt: FieldValue.serverTimestamp() }),
  processed: async id => (await db.doc(`stripeSandboxEvents/${id}`).get()).exists,
  markProcessed: (id, type) => db.doc(`stripeSandboxEvents/${id}`).set({ type, environment: 'test', processedAt: FieldValue.serverTimestamp() }),
  async withLock(uid, callback) {
    const ref = accountRef(uid), token = crypto.randomUUID();
    await db.runTransaction(async tx => {
      const data = (await tx.get(ref)).data();
      if (data?.lockUntil > Date.now()) throw new Error('Subscription update in progress. Please retry shortly.');
      tx.set(ref, { lockToken: token, lockUntil: Date.now()+120000, environment: 'test' }, { merge: true });
    });
    try { return await callback(); }
    finally { await db.runTransaction(async tx => { const data=(await tx.get(ref)).data(); if(data?.lockToken===token)tx.update(ref,{lockToken:FieldValue.delete(),lockUntil:FieldValue.delete()}); }); }
  },
};

export const summaristSandbox = onRequest({ region: 'us-central1', minInstances: 0, maxInstances: 2, concurrency: 20, timeoutSeconds: 60, memory: '256MiB', secrets: [secretKey, webhookSecret], invoker: 'public' }, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options','nosniff');
  const route = req.path.replace(/^\/api\/stripe-sandbox/, '');
  let webhook = false;
  try {
    if (req.rawBody?.length > (route === '/webhook' ? 1048576 : 16384)) return res.status(413).json({ error: 'Request too large.' });
    const stripe = new Stripe(testKey(secretKey.value()), { apiVersion: '2025-06-30.basil', maxNetworkRetries: 1, timeout: 15000 });
    const service = billingService({ stripe, repository });
    if (req.method === 'GET' && route === '/health') return res.json({ environment: 'test', localOnly: false });
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
    if (route === '/webhook') {
      webhook = true;
      let event;
      try { event = stripe.webhooks.constructEvent(req.rawBody, req.get('stripe-signature'), webhookSecret.value()); }
      catch { return res.status(400).json({ error: 'Invalid Stripe signature.' }); }
      return res.json(await service.event(event));
    }
    if (!validOrigin(req.get('origin'))) return res.status(403).json({ error: 'Open the Summarist Sandbox website to continue.' });
    const token = /^Bearer (.+)$/.exec(req.get('authorization')||'')?.[1];
    if (!token) return res.status(401).json({ error: 'Sign in first.' });
    let uid;
    try { uid = registeredUser(await getAuth().verifyIdToken(token, true)); }
    catch { return res.status(401).json({ error: 'Sign in with a registered account to continue.' }); }
    if (!['/checkout','/status','/cancel'].includes(route)) return res.status(404).json({ error: 'Unknown operation.' });
    const result = await repository.withLock(uid, () => route === '/checkout' ? service.checkout(uid, req.body?.plan, req.get('origin')) : route === '/cancel' ? service.cancel(uid) : service.reconcile(uid));
    return res.json(result);
  } catch (error) {
    // Never log tokens, webhook payloads, Stripe errors, or customer information.
    const allowed = ['Invalid plan or return address.', 'You already have a test subscription. End it in Settings before testing another plan.', 'Your test subscription is already confirmed. Open Settings.', 'No active test subscription to end.', 'Subscription update in progress. Please retry shortly.'];
    const message = allowed.includes(error.message) ? error.message : 'Sandbox subscription service could not complete this request. Please retry.';
    return res.status(webhook ? 503 : 400).json({ error: message });
  }
});
