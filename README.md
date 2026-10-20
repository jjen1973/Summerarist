# Summarist

React + TypeScript implementation of **Virtual Internship v2.pdf**. Built locally from the assignment brief and its supplied artwork. Firebase Authentication and library sync are connected to `fir-practice-e7875` and live-verified. Firestore rules and authentication settings were updated on October 19, 2026. The website has not been deployed.

Registered accounts now sync saved and finished book IDs to `users/{uid}/library/shelf`, and write email and a server timestamp to `users/{uid}`. Guests keep their library in the current browser. Existing browser libraries migrate when no cloud shelf exists; failed edits stay cached and can be retried in My Library. The cloud-library browser tests mock Firebase and never write to the real project.

The deployed rules allow each account to read/write its own library and read its own subscription records. Existing `titles`, user-document, and `myList` rules were preserved. Clients cannot grant themselves a subscription. Email/password, Google, and anonymous guest providers are enabled. Both `localhost` and `127.0.0.1` are authorized. Those hostnames have separate browser storage and sign-in sessions; use the original hostname to recover existing browser saves. Interactive Google account selection still needs a manual check.

## Run locally

Requires Node.js 22.12+ (developed with Node 24).

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the printed local address, normally http://127.0.0.1:5173. Choose **Start learning → Login as a Guest**. No Firebase configuration is needed to explore free books.

```powershell
npm.cmd run build
npm.cmd run preview
npm.cmd test
```

Browser tests use installed Microsoft Edge. `tests/app.spec.ts` uses deterministic API/audio fixtures to exercise interactions. `tests/live.spec.ts` checks the real supplied API and audio and requires internet access. To run only deterministic tests: `npm.cmd test -- tests/app.spec.ts`.

## Implemented

- Responsive landing page with the assignment's supplied branding and illustrations.
- Global authentication modal with login/register/reset/Google flows, validation, and guest login.
- Selected, recommended, and suggested shelves using the supplied API.
- Dynamic book details, premium badges, descriptions, tags, author details, audio durations.
- Search by title or author, debounced by 300 ms, with request cancellation and empty/error states.
- Reader and audio player: play/pause, skip ±10 seconds, seek, elapsed/total time, volume, speed, text size.
- Login and subscription route checks, including direct player URLs.
- Saved/finished library with Firestore account sync, browser backup, visible sync errors and retry. Listening to the end marks a book finished.
- Settings with guest/email identity and subscription status.
- Monthly/yearly plan selection, FAQ accordions, and Firebase Stripe-extension checkout integration. Yearly checkout requests a 7-day trial.
- Loading skeletons, error/retry states, keyboard-accessible modal, focus indicators, responsive navigation.
- Vercel SPA routing configuration and a Firestore rules template.

## Firebase and payment status

Firebase is connected and verified for local development. Published rules preserve the old project's rules and add owner-only library access. Email/password, Google and anonymous providers are enabled. Both local development hostnames are authorized. Google account selection and password-reset email delivery still need a manual check.

The remaining required PDF feature is real Stripe test checkout. The user does not yet have a Stripe account. The monthly/yearly sales UI, seven-day annual trial request and checkout adapter are implemented, but no test price IDs, checkout backend, or webhooks are configured. No payments were collected and Firebase billing was not enabled.

Create a Stripe account and use its sandbox/test environment. The configured display prices are $9.99 monthly and $99.99 annually; use matching test prices and subscription roles `premium` / `premium-plus`. Store only public price IDs in `.env.local`; keep private keys in the payment backend's secret store. After choosing and configuring the backend, allow only approved checkout fields/prices in Firestore and test checkout, the annual trial, webhook-confirmed access, cancellation, and Settings updates. Never grant access based only on a checkout success URL.

The [Run Payments with Stripe extension](https://extensions.dev/extensions/invertase/firestore-stripe-payments) still documents the contract used by `src/firebase.ts`, but it requires the Blaze billing plan and is affected by Firebase Extensions' announced March 31, 2027 shutdown. Backend selection and billing need a separate decision. Current rules intentionally deny client subscription writes and do not enable checkout writes before a backend and real test prices exist.

See [the PDF requirement checklist](docs/ASSIGNMENT_STATUS.md) for completed features and remaining manual/payment checks. The supplied public book API is suitable for the assignment; frontend premium checks do not protect commercial paid content at the backend.

## Verification completed

- Production TypeScript/Vite build passed.
- Desktop/mobile browser checks cover guest login, account UI, logout, saved sign-in restoration, library persistence, finish tracking, premium/direct-route checks, plan switching, FAQs, debounced sidebar search, responsive navigation and API retry.
- Cloud-library tests mock Firebase to verify cross-browser restore, removals, migration and failed-write retry without creating production accounts.
- Real supplied API checks verify book rendering, cover images and free-book audio playback.
- Live Firebase verification passed registration/login, guest login, saved and finished book writes, removals, restore after logout/login, signed-out and cross-account denial, and prevention of client subscription grants.
- A separate actual-app browser check passed real registration, saving a book, reload, logout/login and restored My Library. All temporary accounts and test documents were removed.
- Interactive Google account selection, password-reset email receipt, Stripe checkout/webhooks and public website hosting remain manual or pending checks.

## Repository and deployment

Repository: https://github.com/jjen1973/Summerarist. The initial source is prepared for this repository. `.tools/`, `node_modules/`, builds, local environment files, browser-test artifacts, editor settings, and the original assignment PDF are ignored. The PDF remains in the local project folder.

For a later Vercel deployment: use Vite, build command `npm run build`, output `dist`, and configure the same public environment variables in the dashboard. `vercel.json` supports direct navigation to application routes. Deployment has not been performed.

## Sources

- Assignment: `Virtual Internship v2.pdf` (12 pages).
- [Starter homepage and assets](https://github.com/hannamitri/summarist-home-page). Artwork in `public/assets/` originates here; check upstream usage terms before publishing beyond the assignment.
- [Reference solution](https://summarist.vercel.app/).
- [Firebase password authentication](https://firebase.google.com/docs/auth/web/password-auth).
- [Stripe extension setup and checkout contract](https://github.com/invertase/stripe-firebase-extensions/blob/next/firestore-stripe-payments/POSTINSTALL.md).

The book API base is `https://us-central1-summaristt.cloudfunctions.net`. No third-party credentials are copied from the reference application.

## Dependency note

`@grpc/grpc-js` is overridden to patched version 1.13.6 because Firebase's Node dependency range otherwise selects a release with published advisories. The app uses the Firebase browser SDK; recheck this override when upgrading Firebase.
