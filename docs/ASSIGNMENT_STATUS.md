# Summarist assignment status

Reviewed all 12 pages of `Virtual Internship v2.pdf` on October 19, 2026.

| PDF requirement | Implementation and verification |
| --- | --- |
| Home and shared authentication modal | Implemented; desktop and mobile browser checks pass. |
| Email registration, login, logout | Verified against live Firebase using temporary accounts, then removed. |
| Guest login | Anonymous Firebase provider enabled and live-verified. Guest libraries stay in the browser. |
| Optional password reset and Google | UI implemented; Google provider enabled and both local hostnames authorized. Interactive Google account choice and password-reset email delivery need manual checks. |
| Selected, recommended, suggested books and premium pills | Implemented using the supplied API; real API checks pass. |
| Book details and free/premium access checks | Implemented; signed-out and unsubscribed route checks pass. |
| Reader and audio player | Implemented; seek, play/pause, completion and actual API audio checks pass. |
| Monthly/yearly plans, yearly seven-day trial, accordion | UI and checkout request adapter implemented. Actual Stripe checkout is pending. |
| Settings email and subscription status | Implemented; subscription data is read only from backend-owned Firestore records. Requires the payment backend for real paid subscriptions. |
| Debounced title/author search | Implemented; desktop/mobile tests verify request debounce and correct book navigation. |
| Sidebar and loading states | Implemented. Search is enabled at the user's request; the PDF allowed it to be disabled. Highlights and Help remain disabled as specified. |
| Optional saved/finished library | Implemented with account Firestore sync, browser backup, initial migration, failed-write retry and completion tracking. Live server round trips and account isolation verified. |

## Firebase work completed

- Project: `fir-practice-e7875`; reused its existing web app.
- `.env.local` contains public web configuration and stays out of Git.
- Published `firestore.rules` after a successful Firebase compilation dry run.
- Preserved existing `titles`, `/users/{userId}`, and `myList` rules.
- Added private `/users/{userId}/library/shelf` access and owner-only subscription reads.
- Enabled email/password, anonymous guests and Google. Added `127.0.0.1` while retaining all existing authorized domains.
- Live checks verified account registration/login, guest login, saved and finished book writes, removals, restore after login, denied cross-account access, and denied client subscription writes.
- Every temporary verification account and its test documents were removed. No existing user account or library was modified by these checks.
- Local rule backup and verification evidence are in ignored `.tools/firebase/`.

## Payment requirement still pending

The user does not yet have a Stripe account. The app's adapter expects the Firebase Stripe extension contract: a checkout request in `customers/{uid}/checkout_sessions`, and backend-written `customers/{uid}/subscriptions` records. No checkout write permission is enabled until real test price IDs and a backend exist.

To complete this portion:

1. Create a Stripe account and use its sandbox/test environment.
2. Create a monthly $9.99 price and an annual $99.99 price. Set roles `premium` and `premium-plus`; the annual checkout requests a seven-day trial.
3. Choose and configure the payment backend. The extension linked below requires Firebase Blaze billing and is affected by the announced Firebase Extensions shutdown on March 31, 2027. A maintained server-side Stripe integration is another option. Billing and backend deployment need a separate decision; neither was enabled here.
4. Add only the public Stripe price IDs to `.env.local`. Keep secret keys in the backend's secret store, never in browser variables or chat.
5. Add rules allowing only the authenticated owner's approved checkout request fields and exact approved test prices. Keep subscription writes restricted to the backend.
6. Verify monthly checkout, annual trial, webhook-confirmed access, cancellation and settings changes with test transactions. A checkout return URL must never grant premium by itself.

Source: [Run Payments with Stripe](https://extensions.dev/extensions/invertase/firestore-stripe-payments).

## Release boundary

Source files are saved locally. This task updated only the scoped Firebase backend rules and authentication settings. It did not commit, push, deploy the website, enable billing, install a payment backend, or collect a payment. The application retains the existing approved design. The supplied book API is public; frontend premium routing is an assignment feature, not protected paid-content delivery.
