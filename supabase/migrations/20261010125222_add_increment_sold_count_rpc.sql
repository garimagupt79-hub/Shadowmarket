/*
# Add atomic increment_sold_count RPC

1. New Functions
- `increment_sold_count(p_product_id uuid, p_qty integer)`: atomically increments
  the sold_count column on the products table by p_qty, returning the new value.
  Uses a row-level UPDATE ... RETURNING which is atomic in Postgres.
2. Security
- Callable by anon and authenticated roles (the app uses the anon key client).
- No RLS changes needed; this is a SECURITY INVOKER function that respects existing policies.
3. Notes
- Idempotent safe: each call adds exactly p_qty, no stale-read-then-write race.
- Replaces the previous client-side absolute-value update that caused double counting.
*/

CREATE OR REPLACE FUNCTION increment_sold_count(p_product_id uuid, p_qty integer)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE products SET sold_count = COALESCE(sold_count, 0) + p_qty
  WHERE id = p_product_id
  RETURNING sold_count;
$$;

GRANT EXECUTE ON FUNCTION increment_sold_count(uuid, integer) TO anon, authenticated;