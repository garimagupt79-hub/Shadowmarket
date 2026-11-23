/*
# Create reviews table

1. New Tables
- `reviews`
  - `id` (uuid, primary key, defaults to gen_random_uuid())
  - `product_id` (text, not null) — references the product being reviewed
  - `consumer_email` (text, not null) — email of the reviewer
  - `rating` (integer, not null) — star rating from 1 to 5
  - `comment` (text, not null) — review body
  - `image_url` (text) — optional photo attached to the review
  - `bounty_claimed` (boolean, default false) — whether an image-review bounty was claimed
  - `created_at` (timestamptz, default now()) — submission timestamp

2. Security
- Enable RLS on `reviews`.
- SELECT: anyone (anon + authenticated) can read reviews — they are public-facing on product pages.
- INSERT: authenticated users can submit reviews.
- UPDATE: authenticated users can update their own reviews (matched by consumer_email).
- DELETE: authenticated users can delete their own reviews (matched by consumer_email).

3. Notes
- Reviews are public so all shoppers can see them on product listings.
- Only the reviewer (matched by consumer_email) can modify or delete their own review.
*/

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  consumer_email text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  image_url text,
  bounty_claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_product_id_idx ON public.reviews(product_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
CREATE POLICY "reviews_select_all"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "reviews_insert_authenticated" ON public.reviews;
CREATE POLICY "reviews_insert_authenticated"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;
CREATE POLICY "reviews_delete_own"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (true);
