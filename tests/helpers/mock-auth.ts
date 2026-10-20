import type { BrowserContext } from '@playwright/test';

// Keep ordinary UI tests independent of production accounts and Firestore.
const source = `
let user = JSON.parse(sessionStorage.getItem('test-auth-user') || 'null');
const listeners = new Set();
function publish(next) {
  user = next;
  if (next) sessionStorage.setItem('test-auth-user', JSON.stringify(next));
  else sessionStorage.removeItem('test-auth-user');
  for (const callback of listeners) callback(user);
  return { user };
}
export const getAuth = () => ({});
export function onAuthStateChanged(_auth, callback) { listeners.add(callback); let active = true; const delay = Number(sessionStorage.getItem('test-auth-delay') || 0); const timer = setTimeout(() => active && callback(user), delay); return () => { active = false; clearTimeout(timer); listeners.delete(callback); }; }
export const signOut = async () => publish(null);
export const signInAnonymously = async () => publish({ uid: 'test-guest', email: null, isAnonymous: true });
export const createUserWithEmailAndPassword = async (_auth, email) => publish({ uid: 'test-reader', email, isAnonymous: false });
export async function signInWithEmailAndPassword(_auth, email, password) {
  if (password !== 'correct-password') throw Object.assign(new Error('Invalid credentials'), { code: 'auth/invalid-credential' });
  return publish({ uid: 'test-reader', email, isAnonymous: false });
}
export const sendPasswordResetEmail = async () => {};
export const signInWithPopup = async () => publish({ uid: 'test-google', email: 'google@example.com', isAnonymous: false });
export class GoogleAuthProvider {}
`;

export async function mockAuth(context: BrowserContext) {
  await context.route('**/firebase_auth.js*', route => route.fulfill({ contentType: 'text/javascript', body: source }));
  await context.route('**/src/firebase.ts*', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export const configured = true; export const auth = {}; export const db = null; export const localStripeEnabled = false; export const getLocalSubscription = async () => ({premium:null,status:'basic'}); export const cancelLocalSubscription = async () => ({}); export const getSubscription = async () => ({premium:null,status:'basic'}); export const cancelSubscription = async () => ({premium:null,status:'canceled'}); export async function checkout() { throw new Error('Test checkout is not configured.'); }`,
  }));
}
