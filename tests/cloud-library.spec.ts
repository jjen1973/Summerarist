import { test, expect, type BrowserContext } from '@playwright/test';

// Mock only the Firebase network boundary: never create accounts or write to the real project.
const mockAuth = `
export const getAuth = () => ({});
export const onAuthStateChanged = (_auth, callback) => { let active = true; queueMicrotask(() => active && callback({ uid: 'reader', email: 'reader@example.com', isAnonymous: false })); return () => { active = false; }; };
export const signOut = async () => {};
export const signInAnonymously = async () => {};
export const createUserWithEmailAndPassword = async () => {};
export const signInWithEmailAndPassword = async () => {};
export const sendPasswordResetEmail = async () => {};
export const signInWithPopup = async () => {};
export class GoogleAuthProvider {}
`;
const mockFirestore = `
export const getFirestore = () => ({});
export const doc = (_db, ...parts) => parts.join('/');
export const collection = doc;
export const query = value => value;
export const where = () => ({});
export const serverTimestamp = () => 'server-time';
export const arrayUnion = (...values) => ({ operation: 'union', values });
export const arrayRemove = (...values) => ({ operation: 'remove', values });
export const addDoc = async () => { throw new Error('Checkout is outside this test.'); };
const listeners = new Map();
export function onSnapshot(path, options, callback, failure) {
  if (typeof options === 'function') { failure = callback; callback = options; }
  let active = true;
  async function emit() {
    try {
      const response = await fetch('/__test_cloud?path=' + encodeURIComponent(path));
      if (!response.ok) throw new Error('permission-denied');
      const data = await response.json();
      if (active) callback({ docs: [], exists: () => data !== null, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } });
    } catch (error) { if (active) failure?.(error); }
  }
  const entries = listeners.get(path) || new Set(); entries.add(emit); listeners.set(path, entries); void emit();
  return () => { active = false; entries.delete(emit); };
}
export async function setDoc(path, data) {
  const response = await fetch('/__test_cloud?path=' + encodeURIComponent(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error('permission-denied');
  await Promise.all([...(listeners.get(path) || [])].map(emit => emit()));
}
`;
const book = { id: 'cloud-book', title: 'Cloud Book', author: 'Example Author', subTitle: 'Keep your ideas', imageLink: '/assets/landing.png', audioLink: '', totalRating: 10, averageRating: 4.8, keyIdeas: 5, type: 'Audio & Text', status: 'recommended', subscriptionRequired: false, summary: 'Keep learning.', tags: [], bookDescription: 'A book.', authorDescription: 'An author.' };

function cloudFixture() {
  const records = new Map<string, Record<string, unknown>>();
  let rejectWrites = false;
  return {
    records,
    rejectWrites: (value: boolean) => { rejectWrites = value; },
    async connect(context: BrowserContext) {
      await context.route('**/firebase_auth.js*', route => route.fulfill({ contentType: 'text/javascript', body: mockAuth }));
      await context.route('**/firebase_firestore.js*', route => route.fulfill({ contentType: 'text/javascript', body: mockFirestore }));
      await context.route('**/us-central1-summaristt.cloudfunctions.net/**', route => route.fulfill({ json: route.request().url().includes('/getBook?') ? book : [book] }));
      await context.route('**/__test_cloud?*', async route => {
        const path = new URL(route.request().url()).searchParams.get('path')!;
        if (route.request().method() === 'POST') {
          if (rejectWrites) { await route.fulfill({ status: 403, json: { error: 'permission-denied' } }); return; }
          const data = route.request().postDataJSON();
          const next = { ...records.get(path) };
          for (const [field, value] of Object.entries(data)) {
            const transform = value as { operation?: string; values?: unknown[] };
            if (transform?.operation) {
              const previous = (next[field] || []) as unknown[];
              next[field] = transform.operation === 'union' ? [...new Set([...previous, ...transform.values!])] : previous.filter(item => !transform.values!.includes(item));
            } else next[field] = value;
          }
          records.set(path, next);
        }
        await route.fulfill({ json: records.get(path) || null });
      });
    },
  };
}

test('account library restores on another browser and preserves removal', async ({ browser, context, page }) => {
  const cloud = cloudFixture(); await cloud.connect(context);
  cloud.records.set('users/reader/library/shelf', { saved: [], finished: ['cloud-book'] });
  await page.goto('/book/cloud-book');
  await page.getByRole('button', { name: 'Add title to My Library' }).click();
  await expect.poll(() => cloud.records.get('users/reader/library/shelf')?.saved).toEqual(['cloud-book']);
  await expect.poll(() => cloud.records.get('users/reader')?.email).toBe('reader@example.com');
  const otherContext = await browser.newContext();
  try {
    await cloud.connect(otherContext);
    const otherPage = await otherContext.newPage();
    await otherPage.goto('http://127.0.0.1:5173/library');
    await expect(otherPage.getByRole('heading', { name: 'Saved books (1)' })).toBeVisible();
    await expect(otherPage.getByRole('heading', { name: 'Finished books (1)' })).toBeVisible();
    await expect(otherPage.getByRole('status')).toHaveText('Your library is saved to your account.');
    await otherPage.goto('http://127.0.0.1:5173/book/cloud-book');
    await otherPage.getByRole('button', { name: 'Saved to My Library' }).click();
    await expect.poll(() => cloud.records.get('users/reader/library/shelf')?.saved).toEqual([]);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Add title to My Library' })).toBeVisible();
  } finally { await otherContext.close(); }
});

test('existing browser library migrates when the account has no cloud shelf', async ({ context, page }) => {
  const cloud = cloudFixture(); await cloud.connect(context);
  await context.addInitScript(() => localStorage.setItem('summarist-shelf:reader', JSON.stringify({ saved: ['cloud-book'], finished: ['cloud-book'] })));
  await page.goto('/library');
  await expect.poll(() => cloud.records.get('users/reader/library/shelf')).toEqual({ saved: ['cloud-book'], finished: ['cloud-book'] });
  await expect(page.getByRole('heading', { name: 'Saved books (1)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Finished books (1)' })).toBeVisible();
});

test('denied writes keep the book locally and retry after a reload', async ({ context, page }) => {
  const cloud = cloudFixture(); await cloud.connect(context);
  await page.goto('/library');
  await expect(page.getByRole('status')).toHaveText('Your library is saved to your account.');
  cloud.rejectWrites(true);
  await page.goto('/book/cloud-book');
  await page.getByRole('button', { name: 'Add title to My Library' }).click();
  await page.goto('/library');
  await expect(page.getByRole('alert')).toContainText('could not sync with Firebase');
  await expect(page.getByRole('heading', { name: 'Saved books (1)' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Saved books (1)' })).toBeVisible();
  cloud.rejectWrites(false);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect.poll(() => cloud.records.get('users/reader/library/shelf')?.saved).toEqual(['cloud-book']);
  await expect(page.getByRole('status')).toHaveText('Your library is saved to your account.');
});
