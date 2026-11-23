/*
# Add cashback and dispute_resolved columns to orders

1. Modified Tables
- `orders`
  - `cashback` (numeric, default 0) — the escrow-locked cash-back bounty amount at checkout (15% of net payable).
  - `dispute_resolved` (boolean, default false) — set true when a dispute reaches any resolved outcome.

2. Notes
- Both are additive with defaults; no existing data is touched.
- NOTIFY refreshes the Data API schema cache so the new columns are immediately writable.
*/

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cashback NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_resolved BOOLEAN DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
