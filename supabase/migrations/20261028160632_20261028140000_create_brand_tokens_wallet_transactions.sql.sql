/*
# Create brand_tokens and wallet_transactions tables, add store_credit columns to orders

1. New Tables
- `brand_tokens`: tracks per-brand store credit minted from bounty reinvestment (+25% bonus)
  - Unique on (consumer_email, brand_name)
- `wallet_transactions`: audit ledger for bounty boosts, UPI withdrawals, and token spends
2. Modified Tables
- `orders`: added `store_credit_used` and `net_cash_paid` columns
3. Security
- Owner-scoped RLS on both new tables using consumer_email matching auth.jwt() email
- Grants to authenticated only (app has sign-in)
*/

CREATE TABLE IF NOT EXISTS public.brand_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_email text NOT NULL,
  brand_name text NOT NULL,
  principal_boosted numeric NOT NULL DEFAULT 0,
  bonus_earned numeric NOT NULL DEFAULT 0,
  total_credit_minted numeric NOT NULL DEFAULT 0,
  credit_spent numeric NOT NULL DEFAULT 0,
  available_credit numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(consumer_email, brand_name)
);

ALTER TABLE public.brand_tokens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_tokens TO authenticated;

DROP POLICY IF EXISTS "select_own_brand_tokens" ON public.brand_tokens;
CREATE POLICY "select_own_brand_tokens" ON public.brand_tokens FOR SELECT
  TO authenticated USING (consumer_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "insert_own_brand_tokens" ON public.brand_tokens;
CREATE POLICY "insert_own_brand_tokens" ON public.brand_tokens FOR INSERT
  TO authenticated WITH CHECK (consumer_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "update_own_brand_tokens" ON public.brand_tokens;
CREATE POLICY "update_own_brand_tokens" ON public.brand_tokens FOR UPDATE
  TO authenticated USING (consumer_email = (auth.jwt() ->> 'email'))
  WITH CHECK (consumer_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "delete_own_brand_tokens" ON public.brand_tokens;
CREATE POLICY "delete_own_brand_tokens" ON public.brand_tokens FOR DELETE
  TO authenticated USING (consumer_email = (auth.jwt() ->> 'email'));

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_email text NOT NULL,
  tx_type text NOT NULL DEFAULT 'upi_withdrawal',
  brand_name text,
  cash_amount numeric NOT NULL DEFAULT 0,
  bonus_amount numeric NOT NULL DEFAULT 0,
  credit_amount numeric NOT NULL DEFAULT 0,
  upi_id text,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_transactions TO authenticated;

DROP POLICY IF EXISTS "select_own_wallet_tx" ON public.wallet_transactions;
CREATE POLICY "select_own_wallet_tx" ON public.wallet_transactions FOR SELECT
  TO authenticated USING (consumer_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "insert_own_wallet_tx" ON public.wallet_transactions;
CREATE POLICY "insert_own_wallet_tx" ON public.wallet_transactions FOR INSERT
  TO authenticated WITH CHECK (consumer_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "update_own_wallet_tx" ON public.wallet_transactions;
CREATE POLICY "update_own_wallet_tx" ON public.wallet_transactions FOR UPDATE
  TO authenticated USING (consumer_email = (auth.jwt() ->> 'email'))
  WITH CHECK (consumer_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "delete_own_wallet_tx" ON public.wallet_transactions;
CREATE POLICY "delete_own_wallet_tx" ON public.wallet_transactions FOR DELETE
  TO authenticated USING (consumer_email = (auth.jwt() ->> 'email'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'store_credit_used') THEN
    ALTER TABLE public.orders ADD COLUMN store_credit_used numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'net_cash_paid') THEN
    ALTER TABLE public.orders ADD COLUMN net_cash_paid numeric;
  END IF;
END $$;
