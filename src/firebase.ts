import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
const env = import.meta.env;
export const configured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_AUTH_DOMAIN && env.VITE_FIREBASE_APP_ID);
const app = configured ? initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID }) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const localStripeEnabled = import.meta.env.DEV && env.VITE_LOCAL_STRIPE_CHECKOUT === 'true';
export type LocalSubscription = { premium: string | null; status: string; plan?: string; trialEnd?: number | null; periodEnd?: number | null; localOnly: boolean };
async function subscriptionRequest(path: string, data: object = {}) {
  if (!auth?.currentUser || auth.currentUser.isAnonymous) throw new Error('Sign in with a registered account to test checkout.');
  for (let attempt = 0; attempt < 5; attempt++) {
  let response: Response;
  try { response = await fetch(`/api/${localStripeEnabled ? 'stripe-local' : 'stripe-sandbox'}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }, body: JSON.stringify(data), signal: AbortSignal.timeout(45000) }); }
  catch { throw new Error(localStripeEnabled ? 'Start the local Stripe test service and try again.' : 'The Sandbox subscription service is unavailable. Please try again.'); }
  const result = await response.json().catch(() => null);
  if (!response.ok && result?.error === 'Subscription update in progress. Please retry shortly.' && attempt < 4) {
    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    continue;
  }
  if (!response.ok || !result) throw new Error(result?.error || 'The Sandbox subscription service is unavailable.');
  return result;
  }
}
export async function getLocalSubscription(): Promise<LocalSubscription> { return subscriptionRequest('status'); }
export async function cancelLocalSubscription(): Promise<LocalSubscription> { return subscriptionRequest('cancel'); }
export const getSubscription = getLocalSubscription;
export const cancelSubscription = cancelLocalSubscription;
export async function checkout(uid: string, plan: 'monthly' | 'yearly') {
  if (auth?.currentUser?.uid !== uid) throw new Error('Sign in again before checkout.');
  const result = await subscriptionRequest('checkout', { plan });
  const url = new URL(result.url);
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || !String(result.sessionId).startsWith('cs_test_')) throw new Error('Invalid Stripe test checkout destination.');
  location.assign(url.href);
}
