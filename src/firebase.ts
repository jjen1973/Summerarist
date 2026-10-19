import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot } from 'firebase/firestore';
const env = import.meta.env;
export const configured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_AUTH_DOMAIN && env.VITE_FIREBASE_APP_ID);
const app = configured ? initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID }) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export async function checkout(uid: string, plan: 'monthly' | 'yearly') {
  const price = plan === 'yearly' ? env.VITE_STRIPE_YEARLY_PRICE_ID : env.VITE_STRIPE_MONTHLY_PRICE_ID;
  if (!db || !price) throw new Error('Checkout is not connected yet. Firebase and Stripe setup is still needed.');
  const session = await addDoc(collection(db, 'customers', uid, 'checkout_sessions'), {
    price, mode: 'subscription', success_url: `${location.origin}/settings?checkout=success`,
    cancel_url: `${location.origin}/choose-plan?checkout=cancelled`,
    ...(plan === 'yearly' ? { trial_period_days: 7 } : {}),
  });
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Checkout took too long. Please try again.')); }, 45000);
    const unsubscribe = onSnapshot(session, snapshot => {
      const data = snapshot.data();
      if (data?.error) { clearTimeout(timeout); unsubscribe(); reject(new Error(data.error.message || 'Checkout failed.')); }
      if (data?.url) {
        clearTimeout(timeout); unsubscribe();
        const url = new URL(data.url);
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') { reject(new Error('Invalid checkout destination.')); return; }
        location.assign(url.href); resolve();
      }
    }, error => { clearTimeout(timeout); unsubscribe(); reject(error); });
  });
}
