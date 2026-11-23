/*
# Add image_urls JSONB column to reviews

1. Modified Tables
- `reviews`
  - Add `image_urls` (jsonb, nullable) — stores an array of review photo URLs for multi-image support.
  - The existing `image_url` text column is kept for backward compatibility (first image / legacy single-image reviews).

2. Notes
- No data is lost; existing rows keep their `image_url` value.
- New inserts will use `image_urls` (array) going forward; `image_url` is still populated with the first image for backward compat.
*/

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS image_urls jsonb;
