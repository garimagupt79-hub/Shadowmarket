/*
# Add user_id columns for dual-key buyer matching

1. Modified Tables
- `orders`: adds `user_id` (text) mirroring the buyer key used by the app.
- `brand_tokens`: adds `user_id` (text) mirroring the buyer key.
- `wallet_transactions`: adds `user_id` (text) mirroring the buyer key.

2. Why
- The app matches buyer rows with `.or(consumer_email.eq.X, user_id.eq.X)`.
  Those tables had no `user_id` column, so every such query failed and token
  balances / wallet syncs silently returned nothing.

3. Data backfill
- Existing rows get `user_id = lower(consumer_email)` where available.

4. Notes
- Purely additive: no existing columns are changed or dropped.
- No new grants needed: table-level grants already cover new columns.
- Adds lookup indexes for buyer-scoped token and ledger reads.
*/

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.brand_tokens ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS user_id text;

UPDATE public.orders SET user_id = lower(consumer_email) WHERE user_id IS NULL AND consumer_email IS NOT NULL AND consumer_email <> '';
UPDATE public.brand_tokens SET user_id = lower(consumer_email) WHERE user_id IS NULL AND consumer_email IS NOT NULL AND consumer_email <> '';
UPDATE public.wallet_transactions SET user_id = lower(consumer_email) WHERE user_id IS NULL AND consumer_email IS NOT NULL AND consumer_email <> '';

CREATE INDEX IF NOT EXISTS idx_brand_tokens_buyer_brand ON public.brand_tokens (brand_name, consumer_email);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_buyer ON public.wallet_transactions (consumer_email);
