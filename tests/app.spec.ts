import { test, expect, type Page } from '@playwright/test';
import { mockAuth } from './helpers/mock-auth';
const free = { id: 'free-book', title: 'A Good Idea', author: 'Example Author', subTitle: 'Ideas for a better day', imageLink: '/assets/landing.png', audioLink: '/test-audio.wav', totalRating: 120, averageRating: 4.8, keyIdeas: 5, type: 'Audio & Text', status: 'recommended', subscriptionRequired: false, summary: 'An idea can change your day.\n\nKeep learning, one page at a time.', tags: ['Learning'], bookDescription: 'A book about learning.', authorDescription: 'An author who loves ideas.' };
const premium = { ...free, id: 'premium-book', title: 'Premium Ideas', subscriptionRequired: true };
test.beforeEach(async ({ page, context }) => {
  await mockAuth(context);
  await page.route('**/us-central1-summaristt.cloudfunctions.net/**', async route => {
    const url = new URL(route.request().url());
    const data = url.pathname.endsWith('/getBook') ? (url.searchParams.get('id') === premium.id ? premium : free) : url.pathname.endsWith('getBooksByAuthorOrTitle') ? [free] : url.searchParams.get('status') === 'selected' ? [premium] : [free, premium];
    await route.fulfill({ json: data });
  });
  await page.route('**/test-audio.wav', route => {
    const rate = 8000, samples = rate * 3, buffer = Buffer.alloc(44 + samples * 2);
    buffer.write('RIFF'); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
    return route.fulfill({ contentType: 'audio/wav', body: buffer });
  });
});
async function login(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Start learning', exact: true }).click(); await page.getByRole('button', { name: 'Login as a Guest' }).click(); await expect(page).toHaveURL(/for-you/);
}
test('guest can browse, save, read, and finish a free book', async ({ page }) => {
  await login(page); await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'A Good Idea', exact: true }) }).first().click();
  await page.getByRole('button', { name: 'Add title to My Library' }).click(); await expect(page.getByRole('button', { name: 'Saved to My Library' })).toBeVisible();
  await page.goto('/library'); await expect(page.getByRole('heading', { name: 'Saved books (1)' })).toBeVisible(); await page.reload(); await expect(page.getByRole('heading', { name: 'Saved books (1)' })).toBeVisible();
  await page.goto('/player/free-book'); await expect(page.getByText('An idea can change your day.', { exact: false })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Audio position' })).toBeEnabled(); await page.getByRole('button', { name: 'Play', exact: true }).click(); await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip forward 10 seconds' }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await page.goto('/library'); await expect(page.getByRole('heading', { name: 'Finished books (1)' })).toBeVisible();
});
test('access checks protect premium and signed-out player routes', async ({ page }) => {
  await page.goto('/book/free-book'); await page.getByRole('button', { name: 'Read', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button', { name: 'Close login' }).click();
  await page.goto('/player/free-book'); await expect(page.getByRole('main').getByRole('button', { name: 'Login', exact: true })).toBeVisible();
  await login(page); await page.goto('/player/premium-book'); await expect(page).toHaveURL(/choose-plan/); await expect(page.getByRole('radio', { name: /Yearly/ })).toBeChecked();
  await page.getByRole('radio', { name: /Monthly/ }).check(); await expect(page.getByRole('button', { name: 'Continue with monthly' })).toBeVisible();
  await page.getByText('What is included?', { exact: true }).click(); await expect(page.getByText('Premium membership gives', { exact: false })).toBeVisible();
});
test('sidebar search focuses the field, debounces and opens the correct book', async ({ page, isMobile }) => {
  await page.goto('/for-you'); const requests: string[] = []; page.on('request', r => { if (r.url().includes('getBooksByAuthorOrTitle')) requests.push(r.url()); });
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Search', exact: true }).click();
  const search = page.getByRole('textbox', { name: 'Search for books' });
  await expect(search).toBeFocused();
  if (isMobile) await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  await search.fill('A'); await page.waitForTimeout(80); await search.fill('A Good'); await page.waitForTimeout(80); await search.fill('A Good Idea');
  await expect(page.locator('.search-results').getByRole('link', { name: /A Good Idea/ })).toBeVisible(); expect(requests).toHaveLength(1);
  await page.locator('.search-results').getByRole('link').click(); await expect(page).toHaveURL(/book\/free-book/);
});
test('logged-out settings, responsive navigation, and error recovery', async ({ page, isMobile }) => {
  await page.goto('/settings'); await expect(page.getByRole('heading', { name: 'Log in to your account' })).toBeVisible();
  if (isMobile) { await page.getByRole('button', { name: 'Open navigation' }).click(); await page.getByRole('link', { name: 'For you', exact: true }).click(); await expect(page).toHaveURL(/for-you/); }
  await page.route('**/getBooks?status=*', route => route.fulfill({ status: 503 })); await page.goto('/for-you'); await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/getBooks?status=*'); await page.getByRole('button', { name: 'Try again' }).click(); await expect(page.getByRole('heading', { name: 'Recommended for you' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('email auth reports incorrect credentials without claiming an account exists', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Start learning', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('reader@example.com'); await page.getByLabel('Password', { exact: true }).fill('example123'); await page.getByRole('dialog').getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect'); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('registration opens the account and logout restores signed-out settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start learning', exact: true }).click();
  await page.getByRole('button', { name: "Don't have an account? Sign up" }).click();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('reader@example.com');
  await page.getByLabel('Password', { exact: true }).fill('correct-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/for-you/);
  await page.goto('/settings');
  await expect(page.getByText('reader@example.com', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('reader@example.com', { exact: true })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Log in to your account' })).toBeVisible();
});

test('book actions wait for the saved sign-in session before saving', async ({ context, page }) => {
  await context.addInitScript(() => {
    sessionStorage.setItem('test-auth-user', JSON.stringify({ uid: 'test-reader', email: 'reader@example.com', isAnonymous: false }));
    sessionStorage.setItem('test-auth-delay', '1500');
  });
  await page.goto('/book/free-book');
  await expect(page.getByRole('status', { name: 'Loading books' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add title to My Library' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Add title to My Library' }).click();
  await expect(page.getByRole('button', { name: 'Saved to My Library' })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Saved books (1)' })).toBeVisible();
});
