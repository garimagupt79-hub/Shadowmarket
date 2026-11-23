/*
# Phase 1.1: Automated Profile Creation Trigger

When a new user signs up via Supabase Auth, this trigger automatically
creates their matching row in the public `profiles` table — so the
frontend never has to manually insert a profile after signup.

## What it does

1. Creates a `handle_new_user()` SECURITY DEFINER function that runs on
   every new row inserted into `auth.users`.
2. Inserts a `profiles` row with:
   - id = the new auth user's id
   - display_name = the display_name from signup metadata, or the
     email prefix as a fallback
   - role = the role from signup metadata, or 'buyer' as default
   - wallet_balance = initial_balance from metadata, or 25000.00
     (starting balance for real testing)
   - pending_escrow_bounty = 0.00
   - brand_bounty_pool = empty JSON object
3. Creates an AFTER INSERT trigger on auth.users that fires the function.

## Security

- Function is SECURITY DEFINER so it can write to profiles even though
  the anon role cannot normally INSERT into profiles (the trigger runs
  with the function owner's privileges, not the caller's).
- The trigger fires automatically — no client-side code needed.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    display_name,
    role,
    wallet_balance,
    pending_escrow_bounty,
    brand_bounty_pool
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'buyer'),
    COALESCE((new.raw_user_meta_data->>'initial_balance')::numeric, 25000.00),
    0.00,
    '{}'::jsonb
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();