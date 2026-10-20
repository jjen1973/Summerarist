import crypto from 'node:crypto';

export const PROJECT = 'fir-practice-e7875';
export const APP = 'summarist-hosted-sandbox-v1';
export const ORIGINS = [`https://${PROJECT}.web.app`, `https://${PROJECT}.firebaseapp.com`];
export const PRICES = {
  monthly: 'price_1USSEfPPfHxZ39uoF8LdNpP5',
  yearly: 'price_1USSHfPPfHxZ39uonR7apzYV',
};
export const EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed'];
export const ownerHash = uid => crypto.createHash('sha256').update(`${PROJECT}:${APP}:${uid}`).digest('hex');
export const metadata = uid => ({ app: APP, owner_hash: ownerHash(uid), environment: 'test' });

export function testKey(key) {
  if (!/^sk_test_[a-zA-Z0-9]+$/.test(key || '')) throw new Error('Only a Stripe test secret key is allowed.');
  return key;
}
export function validOrigin(origin) { return ORIGINS.includes(origin); }
export function registeredUser(claims) {
  if (!claims?.uid || !claims.firebase?.sign_in_provider || claims.firebase.sign_in_provider === 'anonymous') throw new Error('Sign in with a registered account.');
  return claims.uid;
}
export function planFor(sub) {
  if (sub.items?.data?.length !== 1) return null;
  const item = sub.items.data[0];
  if (item.quantity !== 1) return null;
  return Object.keys(PRICES).find(plan => PRICES[plan] === item.price?.id) || null;
}
export function assertOwned(object, uid, customerId) {
  const customer = typeof object.customer === 'string' ? object.customer : object.customer?.id;
  if (object.livemode !== false || customer !== customerId || object.metadata?.app !== APP || object.metadata?.owner_hash !== ownerHash(uid) || object.metadata?.environment !== 'test') throw new Error('Test subscription ownership validation failed.');
}
export function normalize(sub, now = Math.floor(Date.now() / 1000)) {
  const plan = planFor(sub);
  const periodEnd = sub.items?.data?.[0]?.current_period_end || sub.current_period_end || 0;
  const trial = sub.status === 'trialing' && sub.trial_end > now;
  const paid = sub.status === 'active' && sub.latest_invoice?.status === 'paid' && periodEnd > now;
  const role = plan && (trial || paid) ? (plan === 'yearly' ? 'premium-plus' : 'premium') : null;
  return { provider: 'stripe', environment: 'test', status: sub.status, role, premium: role, plan, subscriptionId: sub.id, trialEnd: sub.trial_end || null, periodEnd: periodEnd || null, entitlementUntil: role ? (trial ? sub.trial_end : periodEnd) : null, cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end), localOnly: false };
}
export function chooseStatus(records) {
  return records.find(record => record.premium) || records[0] || { provider: 'stripe', environment: 'test', premium: null, status: 'basic', localOnly: false };
}

export function billingService({ stripe, repository, now = () => Date.now() }) {
  async function customer(uid) {
    const account = await repository.account(uid);
    if (account?.customerId) return account.customerId;
    const created = await stripe.customers.create({ name: 'Summarist Sandbox Tester', email: `sandbox-${ownerHash(uid).slice(0,16)}@example.com`, metadata: metadata(uid) }, { idempotencyKey: `${APP}:customer:${ownerHash(uid)}` });
    if (created.livemode !== false) throw new Error('Non-test customer rejected.');
    await repository.bindCustomer(uid, created.id);
    return created.id;
  }
  async function reconcile(uid) {
    const account = await repository.account(uid);
    if (!account?.customerId) return chooseStatus([]);
    const records = [];
    // Retrieve current Stripe state instead of trusting webhook order or redirect parameters.
    for await (const sub of stripe.subscriptions.list({ customer: account.customerId, status: 'all', limit: 20, expand: ['data.latest_invoice'] })) {
      if (sub.metadata?.app !== APP) continue;
      assertOwned(sub, uid, account.customerId);
      const record = normalize(sub, Math.floor(now()/1000));
      await repository.subscription(uid, sub.id, record);
      records.push(record);
    }
    return chooseStatus(records);
  }
  async function validatePrice(plan) {
    const price = await stripe.prices.retrieve(PRICES[plan]);
    if (price.livemode !== false || !price.active || price.currency !== 'usd' || price.unit_amount !== (plan === 'monthly' ? 999 : 9999) || price.recurring?.interval !== (plan === 'monthly' ? 'month' : 'year') || price.recurring?.interval_count !== 1 || price.recurring?.usage_type !== 'licensed') throw new Error('Configured test price is invalid.');
  }
  async function checkout(uid, plan, origin) {
    if (!Object.hasOwn(PRICES, plan) || !validOrigin(origin)) throw new Error('Invalid plan or return address.');
    await validatePrice(plan);
    const current = await reconcile(uid);
    if (current.premium) throw new Error('You already have a test subscription. End it in Settings before testing another plan.');
    const customerId = await customer(uid);
    let account = await repository.account(uid);
    if (account.pendingSessionId) {
      const pending = await stripe.checkout.sessions.retrieve(account.pendingSessionId);
      assertOwned(pending, uid, customerId);
      if (pending.status === 'open' && account.pendingPlan === plan && account.pendingOrigin === origin) return { url: pending.url, sessionId: pending.id };
      if (pending.status === 'open') await stripe.checkout.sessions.expire(pending.id);
      if (pending.status === 'complete' && (await reconcile(uid)).premium) throw new Error('Your test subscription is already confirmed. Open Settings.');
    }
    const key = account.checkoutKey || crypto.randomUUID();
    await repository.updateAccount(uid, { checkoutKey: key });
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: customerId, client_reference_id: ownerHash(uid),
      line_items: [{ price: PRICES[plan], quantity: 1 }], payment_method_types: ['card'], payment_method_collection: 'always',
      success_url: `${origin}/settings?checkout=success`, cancel_url: `${origin}/choose-plan?checkout=cancelled`, metadata: metadata(uid),
      subscription_data: { metadata: metadata(uid), ...(plan === 'yearly' ? { trial_period_days: 7, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } } : {}) },
    }, { idempotencyKey: key });
    if (session.livemode !== false || !session.id.startsWith('cs_test_') || new URL(session.url).hostname !== 'checkout.stripe.com') throw new Error('Non-test checkout rejected.');
    await repository.updateAccount(uid, { pendingSessionId: session.id, pendingPlan: plan, pendingOrigin: origin, checkoutKey: null });
    return { url: session.url, sessionId: session.id };
  }
  async function cancel(uid) {
    const account = await repository.account(uid);
    const current = await reconcile(uid);
    if (!account?.customerId || !current.subscriptionId || !current.premium) throw new Error('No active test subscription to end.');
    const sub = await stripe.subscriptions.retrieve(current.subscriptionId);
    assertOwned(sub, uid, account.customerId);
    await stripe.subscriptions.cancel(sub.id);
    return reconcile(uid);
  }
  async function event(event) {
    if (event.livemode !== false) throw new Error('Live events are forbidden.');
    if (!EVENTS.includes(event.type)) return { ignored: true };
    if (await repository.processed(event.id)) return { duplicate: true };
    const object = event.data.object;
    const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
    const uid = customerId && await repository.owner(customerId);
    if (uid) await repository.withLock(uid, () => reconcile(uid));
    await repository.markProcessed(event.id, event.type);
    return { received: true };
  }
  return { checkout, reconcile, cancel, event };
}
