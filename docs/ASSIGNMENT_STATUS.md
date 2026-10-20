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
| Monthly/yearly plans, yearly seven-day trial, accordion | Both genuine Stripe Sandbox hosted checkouts verified, including the seven-day yearly trial, Firebase persistence and cancellation. |
| Settings email and subscription status | Live verified for Basic, premium and premium-plus, including restored access in an independent browser. |
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

## Payment and public deployment completed

Public URL: https://fir-practice-e7875.web.app. The user enabled Blaze and explicitly authorized the two backend secrets, hosted Stripe TEST webhook, Sandbox function and website deployment. The dedicated backend verifies Firebase identities and Stripe signatures and writes owner-readable subscription records. No Stripe extension is installed; existing Firestore rules are preserved.

Verified on the public deployment:

1. Actual email signup/login and both Stripe-hosted test card checkout forms.
2. Monthly $9.99 active/premium and yearly $99.99 trialing/premium-plus with a seven-day trial.
3. Firebase subscription persistence, genuine hosted webhook receipts and separate-browser restoration.
4. Actual premium reader access and cancellation returning Basic and denying that reader.
5. Invalid signatures, unauthenticated requests, foreign origins, browser premium writes and cross-account reads rejected.
6. Temporary verification resources cleaned up; all 24 app regression tests and 11 backend unit tests passed.

See [deployment and verification details](SANDBOX_DEPLOYMENT.md). Interactive Google selection, password-reset email receipt, actual elapsed seven-day trial and annual renewal remain manual/unverified.

## Release boundary

The public website and scoped Sandbox backend are deployed. Secrets are backend-only. Functions have zero minimum instances, a two-instance maximum and one-day deployment-image cleanup. No real payments, bank connections, schedules or recurring compute jobs were created. Existing accounts/libraries and the approved design were preserved. The deployed Sandbox source is maintained in this repository. The supplied book API is public; frontend premium routing is an assignment feature, not protected paid-content delivery.
