/*
# Add Reverse Logistics Fields and Resolution Proposed Status

## Changes
1. `public.disputes`: Add `return_status text DEFAULT NULL` and `return_tracking_number text DEFAULT NULL`
   - return_status tracks the reverse pickup lifecycle: pickup_scheduled, qc_passed_refunded, qc_failed
   - return_tracking_number stores the auto-generated reverse logistics AWB
2. `public.orders`: Add `return_status text DEFAULT NULL` and `return_tracking_number text DEFAULT NULL`
   - Denormalized mirrors of the dispute fields for quick order-card display
3. `disputes_status_check`: Expand to allow 'pickup_scheduled' and 'resolution_proposed' statuses
   - 'pickup_scheduled' = brand scheduled doorstep QC pickup, awaiting courier
   - 'resolution_proposed' = brand proposed resolution, awaiting buyer confirmation (two-key rule)
4. Security: No new tables, no RLS policy changes needed
*/

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS return_status text DEFAULT NULL;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS return_tracking_number text DEFAULT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_status text DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_tracking_number text DEFAULT NULL;

ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_status_check;
ALTER TABLE disputes ADD CONSTRAINT disputes_status_check CHECK (
  status IN (
    'open',
    'resolved_refunded',
    'resolved_completed',
    'resolved_reshipped',
    'resolved_released',
    'pickup_scheduled',
    'resolution_proposed'
  )
);