/*
# Add quantity, product_name, brand_name, and total bounty columns to orders table

## Purpose
The orders table was missing columns needed to store the purchased quantity,
product title, brand name, and total bounty amount (product bounty + image review bounty).
Without these, Supabase fell back to defaults (quantity = 1, bounty_amount = 0),
causing multi-unit bag/cart orders to be recorded incorrectly.

## Changes
1. New columns on `orders`:
   - `quantity` (integer, NOT NULL, default 1) — number of units purchased in this order line.
   - `product_name` (text) — denormalized product title at time of purchase for display/history.
   - `brand_name` (text) — denormalized brand name at time of purchase for display/history.
   - `bounty_amount` (numeric(12,2), default 0) — total bounty for this order (product_bounty * qty + image_review_bounty * qty).
2. Backfill: existing rows get quantity = 1, bounty_amount = product_bounty + image_review_bounty.
3. Security: no policy changes — the table already has anon + authenticated CRUD policies.

## Notes
- All columns use IF NOT EXISTS / DO $$ guards for idempotency.
- No data is lost or transformed destructively.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE orders ADD COLUMN quantity integer NOT NULL DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'product_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN product_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'brand_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN brand_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'bounty_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN bounty_amount numeric(12,2) NOT NULL DEFAULT 0.00;
  END IF;
END $$;

-- Backfill bounty_amount for existing rows
UPDATE orders
SET bounty_amount = COALESCE(product_bounty, 0) + COALESCE(image_review_bounty, 0)
WHERE bounty_amount = 0;
