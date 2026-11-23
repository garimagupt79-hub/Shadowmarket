/*
# Add current_units column to syndicate_waves

1. Modified Tables
- `syndicate_waves`: adds `current_units` integer column defaulting to 0.
  This column tracks how many buyer orders have been placed against an active wave,
  enabling real-time tier progression display on wave cards without recomputing
  from the orders table.

2. Security
- No policy changes. Existing anon/authenticated CRUD policies on syndicate_waves
  already permit reads and updates, so the new column is immediately accessible.

3. Backfill
- Existing active waves get current_units = 0 (the default). New waves start at 0
  and are incremented each time a buyer joins the wave.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'syndicate_waves' AND column_name = 'current_units'
  ) THEN
    ALTER TABLE syndicate_waves ADD COLUMN current_units int NOT NULL DEFAULT 0;
  END IF;
END $$;
