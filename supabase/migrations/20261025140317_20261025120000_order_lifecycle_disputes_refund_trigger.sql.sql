/*
# Order Lifecycle, Disputes Table, and Refund Restock Trigger

## Purpose
Back the full order delivery, escrow release, and dispute workflow with Supabase.
Adds lifecycle timestamps, dispute fields, and escrow status tracking to `orders`,
creates a `disputes` table for dispute audit records, and adds a trigger that
automatically restocks inventory and adjusts sales metrics when an order is refunded.

## Changes

### 1. New columns on `orders`:
- `shipped_at` (timestamptz) — when the brand marked the order shipped.
- `delivered_at` (timestamptz) — when the consumer confirmed delivery.
- `disputed_at` (timestamptz) — when the consumer raised a dispute.
- `resolved_at` (timestamptz) — when the brand resolved the dispute.
- `buyer_confirmed_delivery` (boolean, default false) — consumer delivery confirmation flag.
- `is_disputed` (boolean, default false) — quick-filter flag for disputed orders.
- `is_delivered` (boolean, default false) — quick-filter flag for delivered orders.
- `dispute_reason` (text) — reason selected by the consumer.
- `dispute_description` (text) — free-text details from the consumer.
- `dispute_status` (text, default 'none') — none / open / resolved_refunded / resolved_completed.
- `escrow_status` (text, default 'locked') — locked / released / frozen / cancelled.
- `bounty_status` (text, default 'locked') — locked / released / frozen / cancelled.
- `brand_response` (text) — brand's resolution note.
- `consumer_email` (text) — denormalized buyer email for filtering.

### 2. New table `disputes`:
- `id` uuid PK
- `order_id` text — references the order (not FK since orders.id is uuid but order_id stored as text for compatibility)
- `product_id` text
- `product_name` text
- `brand_name` text
- `consumer_email` text
- `quantity` integer default 1
- `amount` numeric(12,2) — order total
- `bounty_amount` numeric(12,2) — bounty held in escrow
- `reason` text — dispute reason
- `description` text — consumer's description
- `status` text — open / resolved_refunded / resolved_completed
- `resolution` text — brand's resolution note
- `created_at` / `updated_at` timestamptz

### 3. Refund restock trigger:
- `handle_order_refund()` SECURITY DEFINER function that fires AFTER UPDATE on `orders`
  when status changes to 'refunded'. It adds `quantity` back to the product's
  `stock_quantity`, decrements `sold_count`, and recalculates `gross_sales`,
  `bounties_paid`, and `net_revenue`.

### 4. Security:
- RLS enabled on `disputes` with anon+authenticated CRUD (single-tenant app, no sign-in screen for orders).
- Grants on `disputes` for anon + authenticated.
- `handle_order_refund` is SECURITY DEFINER (needs to update products table regardless of caller role);
  EXECUTE revoked from PUBLIC/anon, granted to anon + authenticated so the trigger can call it.

## Notes
- All column additions use DO $$ IF NOT EXISTS guards for idempotency.
- No data lost; existing rows get safe defaults.
- The trigger only fires on the actual status transition to 'refunded', not on every update.
*/

-- =========================================================
-- 1. Add lifecycle columns to orders
-- =========================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipped_at') THEN
    ALTER TABLE orders ADD COLUMN shipped_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivered_at') THEN
    ALTER TABLE orders ADD COLUMN delivered_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'disputed_at') THEN
    ALTER TABLE orders ADD COLUMN disputed_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'resolved_at') THEN
    ALTER TABLE orders ADD COLUMN resolved_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'buyer_confirmed_delivery') THEN
    ALTER TABLE orders ADD COLUMN buyer_confirmed_delivery boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'is_disputed') THEN
    ALTER TABLE orders ADD COLUMN is_disputed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'is_delivered') THEN
    ALTER TABLE orders ADD COLUMN is_delivered boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'dispute_reason') THEN
    ALTER TABLE orders ADD COLUMN dispute_reason text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'dispute_description') THEN
    ALTER TABLE orders ADD COLUMN dispute_description text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'dispute_status') THEN
    ALTER TABLE orders ADD COLUMN dispute_status text NOT NULL DEFAULT 'none';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'escrow_status') THEN
    ALTER TABLE orders ADD COLUMN escrow_status text NOT NULL DEFAULT 'locked';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'bounty_status') THEN
    ALTER TABLE orders ADD COLUMN bounty_status text NOT NULL DEFAULT 'locked';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'brand_response') THEN
    ALTER TABLE orders ADD COLUMN brand_response text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'consumer_email') THEN
    ALTER TABLE orders ADD COLUMN consumer_email text;
  END IF;
END $$;

-- =========================================================
-- 2. Create disputes table
-- =========================================================

CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  product_id text,
  product_name text,
  brand_name text,
  consumer_email text,
  quantity integer DEFAULT 1,
  amount numeric(12,2) DEFAULT 0,
  bounty_amount numeric(12,2) DEFAULT 0,
  reason text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved_refunded', 'resolved_completed')),
  resolution text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON disputes TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_disputes" ON disputes;
CREATE POLICY "anon_select_disputes" ON disputes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_disputes" ON disputes;
CREATE POLICY "anon_insert_disputes" ON disputes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_disputes" ON disputes;
CREATE POLICY "anon_update_disputes" ON disputes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_disputes" ON disputes;
CREATE POLICY "anon_delete_disputes" ON disputes FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- =========================================================
-- 3. Refund restock trigger function
-- =========================================================

CREATE OR REPLACE FUNCTION handle_order_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty integer;
  v_product_id text;
  v_current_stock integer;
  v_current_sold integer;
  v_unit_price numeric;
  v_unit_bounty numeric;
BEGIN
  -- Only fire when status transitions TO 'refunded' (and wasn't already refunded)
  IF (NEW.status = 'refunded' AND (OLD.status IS DISTINCT FROM 'refunded')) THEN
    v_qty := COALESCE(NEW.quantity, 1);
    v_product_id := NEW.product_id;

    -- Fetch current product state
    SELECT stock_quantity, sold_count, price, auto_bounty
      INTO v_current_stock, v_current_sold, v_unit_price, v_unit_bounty
      FROM products
      WHERE id = v_product_id;

    IF FOUND THEN
      -- Restock: add qty back, decrement sold count
      v_current_stock := COALESCE(v_current_stock, 0) + v_qty;
      v_current_sold := GREATEST(0, COALESCE(v_current_sold, 0) - v_qty);

      UPDATE products
        SET stock_quantity = v_current_stock,
            sold_count = v_current_sold,
            gross_sales = v_current_sold * COALESCE(v_unit_price, 0),
            bounties_paid = v_current_sold * COALESCE(v_unit_bounty, 0),
            net_revenue = (v_current_sold * COALESCE(v_unit_price, 0)) - (v_current_sold * COALESCE(v_unit_bounty, 0)),
            updated_at = now()
        WHERE id = v_product_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION handle_order_refund() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION handle_order_refund() TO anon, authenticated;

DROP TRIGGER IF EXISTS trg_order_refund_restock ON orders;
CREATE TRIGGER trg_order_refund_restock
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_refund();
