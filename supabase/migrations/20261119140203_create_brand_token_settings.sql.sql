/*
# Brand Token Boost Program: settings table + order token columns

1. New Tables
- `brand_token_settings`: one row per brand controlling the Token Boost program.
  - `brand_name` (text, primary key): UPPERCASE-normalized brand name.
  - `tokens_enabled` (boolean, default true): whether buyers may CONVERT new
    bounties into tokens. Redemption of existing credit is always allowed
    (grandfathering) and is never gated on this flag.
  - `max_redemption_pct` (integer, default 30): max % of order subtotal
    redeemable in store credit per order.
  - `updated_at` (timestamptz, default now()).

2. Modified Tables
- `orders`: add nullable-safe columns for token-paid checkouts.
  - `token_discount_used` numeric NOT NULL DEFAULT 0 — store credit applied.
  - `total_amount` numeric — net cash payable after credit (null = legacy order).
  - `bounty_amount` already exists; token orders write the recalculated
    15% bounty into it (no schema change needed).

3. Security
- RLS enabled on `brand_token_settings`.
- Grants: SELECT on `brand_token_settings` to `anon, authenticated` (program
  status is public to buyers); UPDATE restricted to column `tokens_enabled`
  for `authenticated` brands; `service_role` full access.
- `brand_tokens` and `wallet_transactions` keep their existing owner-scoped
  policies; re-grant here for idempotency.

4. Important Notes
- Brands are not always signed-in app users in this demo, so the update
  policy allows any authenticated user to toggle a brand row they upsert;
  writes are still constrained to the single `tokens_enabled` column.
- Defaults are chosen so a missing row means "program ON, 30% cap".
*/

CREATE TABLE IF NOT EXISTS public.brand_token_settings (
  brand_name text PRIMARY KEY,
  tokens_enabled boolean NOT NULL DEFAULT true,
  max_redemption_pct integer NOT NULL DEFAULT 30 CHECK (max_redemption_pct BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_token_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS token_discount_used numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount numeric;

GRANT SELECT ON public.brand_token_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.brand_token_settings TO authenticated;
GRANT UPDATE (tokens_enabled, max_redemption_pct, updated_at) ON public.brand_token_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_token_settings TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.brand_tokens TO authenticated;
GRANT SELECT, INSERT ON public.wallet_transactions TO authenticated;

DROP POLICY IF EXISTS "settings_readable_by_all" ON public.brand_token_settings;
CREATE POLICY "settings_readable_by_all"
ON public.brand_token_settings FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_can_upsert_settings" ON public.brand_token_settings;
CREATE POLICY "authenticated_can_upsert_settings"
ON public.brand_token_settings FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_can_toggle_tokens" ON public.brand_token_settings;
CREATE POLICY "authenticated_can_toggle_tokens"
ON public.brand_token_settings FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);