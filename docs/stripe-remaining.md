# Stripe: what is left to do

Status on 2026-10-20 (FR-45 to FR-48, test mode only). Keys never go in this repo, a commit, or a chat: they live in `apps/web/.env.local` (gitignored) and in Vercel.

## Done

- Code: Checkout (subscription), Customer Portal, webhook with signature check, `subscriptions` table with RLS. Tests in `apps/web/app/api/stripe/handlers.test.ts`.
- Branch `fix/FR-45-checkout-guards`: checkout also asks Stripe for an active or trialing subscription before creating a session (no second subscription right after the first); return URLs use `SITE_URL` when set (review ledger S9).
- Stripe sandbox: recurring monthly price `price_1USdRGRUQ3ES1GWSd7Fct3Jc` (USD 10.00, placeholder until D-05), set as the product default. The earlier price was one-time, which subscription Checkout refuses.
- Stripe sandbox: default Customer Portal configuration (invoice history, payment method update, cancel immediately, pause off).
- Local `.env.local` has `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` and `STRIPE_WEBHOOK_SECRET`.

## To do

### Code

- [ ] Open the pull request for `fix/FR-45-checkout-guards`, get one review, merge.

### Local test

- [ ] Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to `apps/web/.env.local` (Supabase, Project Settings, API). Without them a parent cannot log in.
- [ ] Run `stripe login`, then `stripe listen --forward-to localhost:3000/api/stripe/webhook`. `STRIPE_WEBHOOK_SECRET` must be the `whsec_...` this command prints.
- [ ] Restart `npm run dev` (`.env.local` is read only at start).
- [ ] Test: log in as a parent, subscribe with card `4242 4242 4242 4242` (any future date, any CVC). Expect a return to `/dashboard?paid=1` and status `active`. Open the portal, cancel, expect `canceled`.

### Production (Vercel)

- [ ] Stripe dashboard, Developers, Webhooks: add `https://adhdcheck-xi.vercel.app/api/stripe/webhook` with `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. It has its own `whsec_...`, different from the local one.
- [ ] Vercel, Environment Variables: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (the recurring price), `STRIPE_WEBHOOK_SECRET` (from the step above), `SITE_URL=https://adhdcheck-xi.vercel.app`. Redeploy.
- [ ] Repeat the local test on the live URL.

### Decisions (D-05)

- [ ] Product name (now `testadhd`, shown on Checkout and receipts), price, monthly or yearly.
- [ ] What the subscription unlocks (FR-48). The result card, next step and data deletion stay free in every case.
- [ ] Distribution: in the App Store or Google Play, digital subscriptions generally have to use Apple or Google in-app purchase (rules vary by region). Stripe on the web app is fine.

### Known limit

- Two Checkout pages opened before either is paid can both complete. The guard only stops a new checkout once Stripe holds a live subscription.
