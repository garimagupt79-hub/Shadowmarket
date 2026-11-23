/*
# Create addresses table for persisting user shipping addresses

1. New Tables
- `addresses`
  - `id` (uuid, primary key, auto-generated)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `label` (text, e.g. "Home", "Office")
  - `full_name` (text, recipient name)
  - `phone` (text, mobile number)
  - `address_line` (text, full street address)
  - `city` (text)
  - `state` (text)
  - `pincode` (text)
  - `is_default` (boolean, default false)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `addresses`.
- Owner-scoped CRUD: each authenticated user can only access their own addresses.
- `user_id` defaults to `auth.uid()` so inserts that omit it still succeed.
*/

CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  full_name text NOT NULL,
  phone text NOT NULL,
  address_line text NOT NULL,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  pincode text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_addresses" ON addresses;
CREATE POLICY "select_own_addresses" ON addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_addresses" ON addresses;
CREATE POLICY "insert_own_addresses" ON addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_addresses" ON addresses;
CREATE POLICY "update_own_addresses" ON addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_addresses" ON addresses;
CREATE POLICY "delete_own_addresses" ON addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
