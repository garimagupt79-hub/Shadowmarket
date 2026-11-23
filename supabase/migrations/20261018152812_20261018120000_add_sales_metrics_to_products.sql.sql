-- Add denormalized sales metrics columns to products so Brand Dashboard KPIs
-- can be computed from live database rows without re-deriving from orders.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS gross_sales numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounties_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_revenue numeric NOT NULL DEFAULT 0;

-- Backfill existing rows from sold_count / price / auto_bounty
UPDATE public.products
  SET
    gross_sales = sold_count * COALESCE(price, 0),
    bounties_paid = sold_count * COALESCE(auto_bounty, 0),
    net_revenue = (sold_count * COALESCE(price, 0)) - (sold_count * COALESCE(auto_bounty, 0));
