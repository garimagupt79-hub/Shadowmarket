/*
# Add size, color, and tracking_number columns to orders table

1. Modified Tables
- `orders`
  - `size` (text, nullable) — chosen variant size at checkout (e.g. "M", "L")
  - `color` (text, nullable) — chosen variant color at checkout (e.g. "Black")
  - `tracking_number` (text, nullable) — shipping tracking number, generated at order creation and updated when the brand ships the order
2. Security
- No RLS or policy changes. Existing grants on `orders` already cover the new columns (column-level grants are not in use on this table).
3. Notes
- All three columns are nullable so existing rows are unaffected.
- The frontend now writes these at checkout and reads them back on reload, eliminating blank size/color and regenerated tracking numbers.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'size') THEN
    ALTER TABLE public.orders ADD COLUMN size text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'color') THEN
    ALTER TABLE public.orders ADD COLUMN color text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tracking_number') THEN
    ALTER TABLE public.orders ADD COLUMN tracking_number text;
  END IF;
END $$;
