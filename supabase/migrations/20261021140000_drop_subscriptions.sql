-- D-05b (DECIDED, Hatem, 2026-10-20): the report is a one-off payment per report (report_purchases), not a
-- subscription. The subscription table and its two functions from 20261020230000_subscriptions.sql have no
-- caller left in the app. They only ever held Stripe test-mode data. parents.stripe_customer_id (init
-- schema) is kept: dropping a column of the parents table is not needed for this change.

drop function if exists public.record_subscription(text, text, text, timestamptz);
drop function if exists public.set_stripe_customer(uuid, text);
drop table if exists public.subscriptions;
