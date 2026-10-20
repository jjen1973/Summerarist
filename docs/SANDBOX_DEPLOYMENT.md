# Public Stripe Sandbox deployment

Target Firebase project: `fir-practice-e7875`. Public URL: https://fir-practice-e7875.web.app.

The user approved preparing and publishing the public internship test application. Firebase billing was read back as enabled on October 19, 2026. Stripe must remain in test mode; no bank connection or live payment is required. Existing accounts, libraries and Firestore rules are preserved.

## Components prepared

- Firebase Hosting serves the existing Vite application and rewrites `/api/stripe-sandbox/**` to the `summaristSandbox` HTTP function in `us-central1`.
- The Node 22 function verifies registered Firebase ID tokens, accepts only the two project Hosting origins, and creates hosted test Checkout with approved monthly/yearly prices. Yearly Checkout requests a seven-day trial. Test customer details are fabricated; Firebase UID hashes associate Stripe objects with the server-owned customer mapping.
- Stripe webhook signatures are verified against the raw request body. Current Stripe subscription state is retrieved before updating access, so event delivery order and checkout return query parameters cannot grant access. Processed event IDs are stored for deduplication. An authenticated status refresh also reconciles against Stripe.
- Subscription records are written only by Admin SDK to `customers/{uid}/subscriptions/{subscriptionId}`. They contain `environment: test`, status, premium role, trial/period end, and entitlement expiry. Existing owner-only read rules and client-write denial remain unchanged. Server-only customer mappings, locks, and event receipts use `stripeSandboxAccounts`, `stripeSandboxCustomers`, and `stripeSandboxEvents`; existing default-deny rules protect them.
- Settings provides status refresh and immediate test cancellation. This is explicitly a Sandbox demonstration; reviewers can end one plan before trying the other. Trials may be repeated for testing. The app watches Firebase records for access on another device, rejects expired entitlements, and rechecks after returning to the tab.
- Function scaling is limited to zero minimum instances and two maximum instances. This limits capacity, not total cost. No schedules or recurring jobs are created. Artifact cleanup should retain deployment images for only one day.

## Private configuration requiring cloud storage

Only the deployed backend may read these Secret Manager values:

- `SUMMARIST_STRIPE_TEST_KEY`: existing `sk_test_…` key from the ignored local test configuration.
- `SUMMARIST_STRIPE_TEST_WEBHOOK`: signing secret for the new Stripe test webhook at https://fir-practice-e7875.web.app/api/stripe-sandbox/webhook.

Neither value belongs in frontend environment variables, source control, documentation, chat, command-line arguments, or logs. The hosted endpoint requires a separate signing secret from Stripe CLI. The prepared ignored bootstrap script transfers these directly through authenticated APIs with request/response body logging suppressed. It retains an ignored local backup for recovery and emits configuration status only.

## Verification completed

The frontend production build, 24 desktop/mobile regression tests, and 11 backend unit tests passed. Backend unit tests use mocks and synthetic identities. The backend dependency audit reports zero vulnerabilities. Actual secrets were absent from the public build and backend source.

Actual public integration checks used the deployed app, real Firebase Authentication and Firestore, Stripe-hosted checkout forms, genuine signed Stripe test webhooks, fabricated customers and the official test card. Both monthly and yearly forms completed; monthly became active, yearly became trialing with the configured seven-day trial. Firebase stored the correct premium/premium-plus roles. A separate browser restored each subscription after login. An actual premium book opened for each plan, and cancellation returned Basic and redirected the canceled account away from the premium reader. Only temporary verification accounts, customers, subscriptions and account documents were removed; existing user data was preserved. Non-sensitive webhook receipts remain for idempotency.

## Deployment and reviewer instructions

The two secrets are configured, the hosted TEST webhook is registered, and the `summarist-sandbox` function codebase and Hosting are deployed. Runtime read-back confirmed ACTIVE, Node 22, zero minimum instances, two maximum instances, the two backend secret bindings, and a one-day (86400-second) image cleanup policy. Live Firestore rules match the reviewed local file; no rules deployment was required. Unauthenticated checkout, foreign origins, invalid signatures, client premium grants and cross-account subscription reads were rejected.

Open https://fir-practice-e7875.web.app on any computer and create an account or use an existing Firebase email/password login. Choose either plan. Use test card `4242 4242 4242 4242`, a future expiry, any three-digit CVC and fabricated billing details. Uncheck Save my information with Link to skip optional phone/signup details. Never connect a bank or enter a real card. Settings shows the Firebase-saved plan. End the current test subscription immediately in Settings before testing the other plan.

No local server or Stripe CLI listener is needed for the public website. The earlier local proof of concept remains separate: its local subscription ledger is not migrated. Existing Firebase logins work, but a local-only subscription must be tested again through the public checkout to create its Firebase record.

Initial tests exposed login restoration and concurrent refresh timing issues. Checkout now waits for authentication readiness and retries a brief update collision; the login fix has a desktop/mobile regression test. Successful genuine hosted checkouts followed the earlier separate Stripe API fixtures. Reports in ignored `.tools/firebase` distinguish them.

Interactive Google selection, password-reset email receipt, actual seven-day passage and annual renewal remain unverified. The deployed Sandbox source is maintained in this repository. The unrelated artwork remains untouched. For later releases, build the app and deploy only `functions:summarist-sandbox,hosting` to `fir-practice-e7875`.

The assignment book API is public. Premium routing is the required internship UI behavior; it is not a commercial paid-content backend protection system.
