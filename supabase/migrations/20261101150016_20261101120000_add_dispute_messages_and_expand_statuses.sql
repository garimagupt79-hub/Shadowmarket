/*
# Expand Dispute System: Messages JSONB + New Resolution Statuses

## Purpose
Support the full dispute lifecycle end-to-end: buyer/brand chat threads,
reship replacements, buyer-confirmed delivery on reshipped orders, and
audit-grade persistence so disputes survive page refreshes.

## Changes

### 1. New column on `disputes`:
- `messages` (jsonb, default '[]') — array of
  { id, sender, text, timestamp, images?, senderName? } entries forming the
  dispute chat thread between buyer and brand.

### 2. New columns on `orders`:
- `dispute_messages` (jsonb, default '[]') — mirror of the dispute thread so
  the orders query already carries the chat without a join.
- `order_status` (text) — denormalized lifecycle label for quick filtering.
- `delivery_status` (text) — denormalized delivery state for quick filtering.
- `bounty_status` already exists; no change.

### 3. Expanded `disputes.status` CHECK constraint:
Drop the old CHECK that only allowed ('open','resolved_refunded','resolved_completed')
and replace with one that also allows:
- 'resolved_reshipped' — brand shipped a replacement; awaiting buyer confirmation.
- 'resolved_released' — buyer confirmed delivery of replacement; escrow released.

### 4. Unique index on `disputes(order_id)`:
So the upsert `onConflict: 'order_id'` works (one dispute row per order).

### 5. Security
No new tables. Existing RLS policies on `disputes` (anon+authenticated CRUD)
remain in force and continue to cover the new column.

## Notes
- All additions are additive — no data is lost.
- The migration is idempotent (IF NOT EXISTS guards + drop-before-recreate
  for the constraint and unique index).
*/

-- 1. Add messages jsonb to disputes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disputes' AND column_name = 'messages') THEN
    ALTER TABLE disputes ADD COLUMN messages jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 2. Add dispute_messages jsonb to orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'dispute_messages') THEN
    ALTER TABLE orders ADD COLUMN dispute_messages jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 3. Add order_status + delivery_status denormalized columns to orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_status') THEN
    ALTER TABLE orders ADD COLUMN order_status text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_status') THEN
    ALTER TABLE orders ADD COLUMN delivery_status text;
  END IF;
END $$;

-- 4. Expand the disputes.status CHECK constraint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'disputes_status_check'
      AND conrelid = 'disputes'::regclass
  ) THEN
    ALTER TABLE disputes DROP CONSTRAINT disputes_status_check;
  END IF;
END $$;

ALTER TABLE disputes
  ADD CONSTRAINT disputes_status_check
  CHECK (status IN ('open', 'resolved_refunded', 'resolved_completed', 'resolved_reshipped', 'resolved_released'));

-- 5. Unique index on order_id so upsert onConflict works
DROP INDEX IF EXISTS idx_disputes_order_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_order_id_unique ON disputes(order_id);

-- Keep the non-unique index too for non-upsert lookups (idempotent).
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
