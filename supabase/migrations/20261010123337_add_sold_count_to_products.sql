/*
# Add sold_count column to products table

1. Changes
- Adds `sold_count` integer column to `products` table, defaulting to 0.
- This persists the number of units sold per product, incremented on each checkout.
2. Security
- No RLS policy changes. Existing policies on products remain unchanged.
3. Notes
- Uses DO block to safely add column only if it does not already exist (idempotent).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'sold_count'
  ) THEN
    ALTER TABLE products ADD COLUMN sold_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;