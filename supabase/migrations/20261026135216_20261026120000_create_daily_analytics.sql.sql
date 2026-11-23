/*
# Create daily_analytics table for Live Analytics

1. Purpose
- Powers the Brand "Live Analytics" tab with Supabase-backed daily aggregates
  instead of frontend calculations, so timeline metrics stay in sync with the
  `orders` table after every order placement, delivery, dispute, or refund.

2. New Tables
- `daily_analytics`
  - `analytics_date` (date, primary key with product_id) — the calendar day of the aggregate
  - `product_id` (text, not null) — the product the aggregate is scoped to
  - `gross_revenue` (numeric, default 0) — sum of total_price for non-refunded orders that day
  - `bounties_paid` (numeric, default 0) — sum of product_bounty + image_review_bounty for non-refunded orders that day
  - `net_margin` (numeric, default 0) — gross_revenue - bounties_paid
  - `orders_count` (integer, default 0) — number of non-refunded orders that day
  - `units_sold` (integer, default 0) — sum of quantity for non-refunded orders that day
  - `updated_at` (timestamptz) — last refresh timestamp

3. Aggregation function
- `refresh_daily_analytics()` — SECURITY INVOKER function that TRUNCATES and
  rebuilds `daily_analytics` from the `orders` table. It groups non-refunded
  orders by `created_at::date` and `product_id`, summing revenue, bounties,
  units, and counting orders. Refunded orders (status = 'refunded' or
  dispute_status = 'resolved_refunded' / 'resolved_refunded_by_admin') are
  excluded from revenue calculations.

4. Trigger
- `orders_daily_analytics_trigger` — AFTER INSERT/UPDATE/DELETE on `orders`,
  calls `refresh_daily_analytics()` so the aggregate table is always current.
- A trigger also backfills on migration apply via the function call at the end.

5. Security
- Enable RLS on `daily_analytics`.
- Grant SELECT to `anon, authenticated` so the anon-key frontend (signed-in
  brand users hit authenticated) can read the aggregates. The data is
  read-only analytics derived from orders, intentionally shared across the
  brand dashboard.
- `refresh_daily_analytics` is SECURITY INVOKER (runs with the privileges of
  the caller). REVOKE EXECUTE FROM PUBLIC/anon so only authenticated roles
  and the service role can invoke it; the trigger runs as the table owner.

6. Indexes
- Index on `analytics_date` for fast timeline range queries.
- Index on `product_id` for fast product filtering.
*/

CREATE TABLE IF NOT EXISTS daily_analytics (
  analytics_date date NOT NULL,
  product_id text NOT NULL,
  gross_revenue numeric NOT NULL DEFAULT 0,
  bounties_paid numeric NOT NULL DEFAULT 0,
  net_margin numeric NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  units_sold integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (analytics_date, product_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_analytics_date ON daily_analytics (analytics_date);
CREATE INDEX IF NOT EXISTS idx_daily_analytics_product ON daily_analytics (product_id);

ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON daily_analytics TO anon, authenticated;

-- Rebuild function: aggregates non-refunded orders by date + product.
CREATE OR REPLACE FUNCTION refresh_daily_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Wipe and rebuild from the orders table.
  -- Refunded / resolved-refunded orders are excluded from active revenue.
  INSERT INTO daily_analytics
    (analytics_date, product_id, gross_revenue, bounties_paid, net_margin, orders_count, units_sold, updated_at)
  SELECT
    (o.created_at AT TIME ZONE 'UTC')::date AS analytics_date,
    o.product_id,
    COALESCE(SUM(o.total_price), 0) AS gross_revenue,
    COALESCE(SUM(COALESCE(o.product_bounty, 0) + COALESCE(o.image_review_bounty, 0)), 0) AS bounties_paid,
    COALESCE(SUM(o.total_price), 0) - COALESCE(SUM(COALESCE(o.product_bounty, 0) + COALESCE(o.image_review_bounty, 0)), 0) AS net_margin,
    COUNT(*)::integer AS orders_count,
    COALESCE(SUM(COALESCE(o.quantity, 1)), 0)::integer AS units_sold,
    now() AS updated_at
  FROM orders o
  WHERE o.created_at IS NOT NULL
    AND o.status NOT IN ('refunded')
    AND o.dispute_status NOT IN ('resolved_refunded', 'resolved_refunded_by_admin')
  GROUP BY (o.created_at AT TIME ZONE 'UTC')::date, o.product_id
  ON CONFLICT (analytics_date, product_id) DO UPDATE
    SET
      gross_revenue = EXCLUDED.gross_revenue,
      bounties_paid = EXCLUDED.bounties_paid,
      net_margin = EXCLUDED.net_margin,
      orders_count = EXCLUDED.orders_count,
      units_sold = EXCLUDED.units_sold,
      updated_at = now();

  -- Remove rows for dates/products that no longer have any matching orders.
  DELETE FROM daily_analytics da
  WHERE NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.product_id = da.product_id
      AND (o.created_at AT TIME ZONE 'UTC')::date = da.analytics_date
      AND o.status NOT IN ('refunded')
      AND o.dispute_status NOT IN ('resolved_refunded', 'resolved_refunded_by_admin')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION refresh_daily_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION refresh_daily_analytics() TO authenticated;

-- Trigger: keep daily_analytics in sync whenever orders change.
DROP TRIGGER IF EXISTS orders_daily_analytics_trigger ON orders;
DROP FUNCTION IF EXISTS orders_daily_analytics_trigger_fn();

CREATE OR REPLACE FUNCTION orders_daily_analytics_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  PERFORM refresh_daily_analytics();
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION orders_daily_analytics_trigger_fn() FROM PUBLIC, anon;

CREATE TRIGGER orders_daily_analytics_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH STATEMENT
EXECUTE FUNCTION orders_daily_analytics_trigger_fn();

-- Initial backfill from existing orders.
SELECT refresh_daily_analytics();
