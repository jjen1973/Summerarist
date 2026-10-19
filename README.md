# Summarist

React + TypeScript implementation of **Virtual Internship v2.pdf**. Built locally from the assignment brief and its supplied artwork. This is an internship project; no production service has been connected or deployed.

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
- Optional saved/finished library, persisted per user in the current browser. Listening to the end marks a book finished.
- Settings with guest/email identity and subscription status.
- Monthly/yearly plan selection, FAQ accordions, and Firebase Stripe-extension checkout integration. Yearly checkout requests a 7-day trial.
- Loading skeletons, error/retry states, keyboard-accessible modal, focus indicators, responsive navigation.
- Vercel SPA routing configuration and a Firestore rules template.

## What still needs setup

**Guest preview works now. Real accounts and payments are not connected or verified.** The user chose to set up Firebase and Stripe together next.

1. Create a dedicated Firebase project and register a web app. Enable Authentication: Email/Password, Anonymous (guest), and optionally Google. Add localhost and the eventual deployed domain to authorized domains.
2. Copy `.env.example` to `.env.local` and fill the four Firebase web-app config fields. These are browser configuration values, not admin credentials. Never put Stripe secret keys or service-account credentials in `VITE_` variables.
3. Create Firestore. The app listens to `customers/{uid}/subscriptions`, trusting active/trialing records written by the payment backend. Customers must never be allowed to write subscription records.
4. The PDF recommends the **Run Payments with Stripe** Firebase extension. Its upstream repository is now archived, so confirm its current availability/support before installing. This code follows its documented checkout-document contract. If unavailable, replace the adapter in `src/firebase.ts` with a supported server-side Stripe integration.
5. In Stripe **test mode**, create monthly Premium ($9.99/month) and yearly Premium Plus ($99.99/year) products/prices, with product metadata `firebaseRole=premium` and `firebaseRole=premium-plus`. Add the price IDs to `.env.local`. Keep visible prices and Stripe prices identical.
6. Configure the payment backend, webhook events, and `customers` / `products` collection names according to the provider's instructions. The yearly request includes `trial_period_days: 7`; confirm the 7-day trial appears in hosted checkout before accepting any payments.
7. Replace both price placeholders in `firestore.rules`, review the rules, and test with the Firebase Emulator before deploying. The template allows users to create their own approved-price checkout requests but denies all client writes to subscription records. It intentionally does not deploy anything automatically.
8. Test registration, login errors, password reset, Google, anonymous login, logout, monthly/yearly checkout, cancellation, webhook confirmation, trial expiry, and settings updates. A checkout success URL alone does not grant membership.

Library saves are browser-local, not cloud-synced. Premium checks match the assignment's frontend behavior; the assignment API itself exposes book summaries/audio publicly, so this app does not secure paid content. Production paid-content delivery needs authorization at the backend and protected storage.

The landing page is an adapted implementation of the supplied design, not a pixel-perfect comparison against every reference screenshot. Final visual review against the PDF/reference remains useful.

## Verification completed

- Production TypeScript/Vite build passed.
- 12 Playwright checks passed across desktop and mobile, including the real assignment API, cover image loading, and real free-book audio playback.
- Deterministic checks cover guest login, saved-library persistence, completion after audio ends, premium/direct-route checks, plan switching, FAQs, debounced search, mobile navigation, missing account configuration, and API retry.
- Dependency installation reported zero known vulnerabilities after the gRPC override.
- Firebase account operations, deployed Firestore rules, Stripe checkout/webhooks, and live hosting remain untested because no services are configured.

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
