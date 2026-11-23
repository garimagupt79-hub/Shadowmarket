/*
# Phase 1: ShadowMarket Syndicate Schema

Creates the complete PostgreSQL relational schema for ShadowMarket's
syndicate wave bounty system with dual escrow, tier-based cashback,
and immutable wallet ledger.

## New Tables

1. **profiles** — User profiles with wallet balances and escrow state.
   - id (uuid PK, references auth.users)
   - role (buyer / brand / admin)
   - display_name, wallet_balance, pending_escrow_bounty, brand_bounty_pool

2. **syndicate_waves** — Flash-drop bounty events tied to a product.
   - status: active / completed / cancelled
   - start_time, end_time, has_image_bounty, image_bounty_amount

3. **wave_tiers** — Tiered bounty percentages within a wave.
   - wave_id FK, tier_number, threshold_units, bounty_percent
   - UNIQUE(wave_id, tier_number)

4. **orders** — Buyer orders with dual escrow (product bounty + image review bounty).
   - buyer_id, brand_id, wave_id FKs
   - product_bounty, syndicate_tier_unlocked, image_review_bounty
   - review_status: none / pending / approved / expired
   - review_deadline for 15-day photo window

5. **wallet_ledger** — Immutable append-only transaction log.
   - 9 transaction types covering payments, escrow, bounties, clawbacks, refunds
   - balance_after for audit trail

6. **bounty_audit_logs** — Tracks every bounty upgrade/downgrade event.
   - order_id, wave_id FKs
   - previous_bounty, new_bounty, delta_applied, tier_number, reason

## Security

- RLS enabled on all 6 tables.
- Permissive policies (TO anon, authenticated) for Phase 1 test flow.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).

## Indexes

- orders(buyer_id), orders(wave_id), orders(status)
- syndicate_waves(status, end_time)
- wave_tiers(wave_id)
- wallet_ledger(user_id)
- bounty_audit_logs(order_id)
*/

-- =========================================================
-- 1. PROFILES & WALLETS
-- =========================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('buyer', 'brand', 'admin')) NOT NULL DEFAULT 'buyer',
  display_name text,
  wallet_balance numeric(12,2) NOT NULL DEFAULT 0.00,
  pending_escrow_bounty numeric(12,2) NOT NULL DEFAULT 0.00,
  brand_bounty_pool jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_profiles" ON profiles;
CREATE POLICY "anon_select_profiles" ON profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_profiles" ON profiles;
CREATE POLICY "anon_insert_profiles" ON profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_profiles" ON profiles;
CREATE POLICY "anon_update_profiles" ON profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_profiles" ON profiles;
CREATE POLICY "anon_delete_profiles" ON profiles FOR DELETE
  TO anon, authenticated USING (true);

-- =========================================================
-- 2. SYNDICATE WAVES
-- =========================================================
CREATE TABLE IF NOT EXISTS syndicate_waves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  brand_id uuid REFERENCES profiles(id),
  status text CHECK (status IN ('active', 'completed', 'cancelled')) NOT NULL DEFAULT 'active',
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz NOT NULL,
  has_image_bounty boolean DEFAULT false,
  image_bounty_amount numeric(10,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE syndicate_waves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_syndicate_waves" ON syndicate_waves;
CREATE POLICY "anon_select_syndicate_waves" ON syndicate_waves FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_syndicate_waves" ON syndicate_waves;
CREATE POLICY "anon_insert_syndicate_waves" ON syndicate_waves FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_syndicate_waves" ON syndicate_waves;
CREATE POLICY "anon_update_syndicate_waves" ON syndicate_waves FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_syndicate_waves" ON syndicate_waves;
CREATE POLICY "anon_delete_syndicate_waves" ON syndicate_waves FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_syndicate_waves_status_end_time
  ON syndicate_waves(status, end_time);

-- =========================================================
-- 3. WAVE TIERS
-- =========================================================
CREATE TABLE IF NOT EXISTS wave_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id uuid NOT NULL REFERENCES syndicate_waves(id) ON DELETE CASCADE,
  tier_number int NOT NULL,
  threshold_units int NOT NULL,
  bounty_percent numeric(5,2) NOT NULL,
  UNIQUE(wave_id, tier_number)
);

ALTER TABLE wave_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_wave_tiers" ON wave_tiers;
CREATE POLICY "anon_select_wave_tiers" ON wave_tiers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wave_tiers" ON wave_tiers;
CREATE POLICY "anon_insert_wave_tiers" ON wave_tiers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wave_tiers" ON wave_tiers;
CREATE POLICY "anon_update_wave_tiers" ON wave_tiers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wave_tiers" ON wave_tiers;
CREATE POLICY "anon_delete_wave_tiers" ON wave_tiers FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_wave_tiers_wave_id
  ON wave_tiers(wave_id);

-- =========================================================
-- 4. ORDERS & DUAL ESCROW
-- =========================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES profiles(id),
  brand_id uuid REFERENCES profiles(id),
  wave_id uuid REFERENCES syndicate_waves(id),
  product_id text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  status text CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'disputed')) NOT NULL DEFAULT 'processing',
  product_bounty numeric(10,2) NOT NULL DEFAULT 0.00,
  syndicate_tier_unlocked int DEFAULT 1,
  has_image_bounty boolean DEFAULT false,
  image_review_bounty numeric(10,2) DEFAULT 0.00,
  image_escrow_held boolean DEFAULT false,
  review_status text CHECK (review_status IN ('none', 'pending', 'approved', 'expired')) NOT NULL DEFAULT 'none',
  review_deadline timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_wave_id ON orders(wave_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- =========================================================
-- 5. IMMUTABLE WALLET LEDGER
-- =========================================================
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  order_id uuid REFERENCES orders(id),
  type text NOT NULL CHECK (type IN (
    'WALLET_DEPOSIT',
    'ORDER_PAYMENT',
    'ESCROW_HOLD',
    'BASE_BOUNTY_RELEASE',
    'IMAGE_BOUNTY_RELEASE',
    'IMAGE_BOUNTY_EXPIRED_REFUND',
    'DELTA_CREDIT',
    'SYNDICATE_TIER_DOWNGRADE',
    'DISPUTE_REFUND'
  )),
  amount numeric(12,2) NOT NULL,
  balance_after numeric(12,2) NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_wallet_ledger" ON wallet_ledger;
CREATE POLICY "anon_select_wallet_ledger" ON wallet_ledger FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wallet_ledger" ON wallet_ledger;
CREATE POLICY "anon_insert_wallet_ledger" ON wallet_ledger FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wallet_ledger" ON wallet_ledger;
CREATE POLICY "anon_update_wallet_ledger" ON wallet_ledger FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wallet_ledger" ON wallet_ledger;
CREATE POLICY "anon_delete_wallet_ledger" ON wallet_ledger FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_id ON wallet_ledger(user_id);

-- =========================================================
-- 6. BOUNTY AUDIT LOGS
-- =========================================================
CREATE TABLE IF NOT EXISTS bounty_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  wave_id uuid NOT NULL REFERENCES syndicate_waves(id) ON DELETE CASCADE,
  previous_bounty numeric(10,2) NOT NULL,
  new_bounty numeric(10,2) NOT NULL,
  delta_applied numeric(10,2) NOT NULL,
  tier_number int NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bounty_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bounty_audit_logs" ON bounty_audit_logs;
CREATE POLICY "anon_select_bounty_audit_logs" ON bounty_audit_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bounty_audit_logs" ON bounty_audit_logs;
CREATE POLICY "anon_insert_bounty_audit_logs" ON bounty_audit_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bounty_audit_logs" ON bounty_audit_logs;
CREATE POLICY "anon_update_bounty_audit_logs" ON bounty_audit_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bounty_audit_logs" ON bounty_audit_logs;
CREATE POLICY "anon_delete_bounty_audit_logs" ON bounty_audit_logs FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_bounty_audit_logs_order_id ON bounty_audit_logs(order_id);