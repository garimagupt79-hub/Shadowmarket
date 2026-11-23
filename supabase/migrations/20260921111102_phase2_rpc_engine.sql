/*
# Phase 2: Server-Side Atomic Engine

Two SECURITY DEFINER RPC functions that make syndicate checkout and
dispute refund fully atomic on the server side, with row-level locking
to prevent race conditions during concurrent checkouts.

## 1. process_syndicate_order
Atomically:
  - Locks the wave row (FOR UPDATE) to serialize concurrent checkouts
  - Locks and verifies the buyer's wallet balance
  - Counts active orders in the wave and determines the unlocked tier
  - Debits the buyer's wallet and credits pending escrow bounty
  - Inserts the new order record
  - Writes a wallet ledger entry for the payment
  - Retroactively upgrades ALL prior active orders in the wave to the
    new tier, crediting delta bounty to each prior buyer's escrow and
    writing audit log + ledger entries

## 2. process_dispute_refund
Atomically:
  - Locks the order row (FOR UPDATE)
  - Marks the order as refunded
  - Returns the payment to the buyer's liquid balance and deducts
    held bounty from pending escrow
  - If the order was part of a wave, recalculates the remaining active
    count, determines the downgraded tier, and claws back the bounty
    delta from all remaining active orders in the wave

Both functions are SECURITY DEFINER so they can write to profiles,
orders, wallet_ledger, and bounty_audit_logs regardless of the
caller's direct table privileges.
*/

-- ============================================================
-- 1. PROCESS SYNDICATE ORDER (atomic checkout + retroactive deltas)
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_syndicate_order(
  p_wave_id UUID,
  p_product_id TEXT,
  p_unit_price NUMERIC,
  p_has_image_bounty BOOLEAN,
  p_image_bounty_amount NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_buyer_id UUID := auth.uid();
  v_buyer_balance NUMERIC;
  v_wave RECORD;
  v_total_price NUMERIC := p_unit_price;
  v_active_order_count INT;
  v_new_active_count INT;
  v_current_tier RECORD;
  v_bounty_amount NUMERIC;
  v_new_order_id UUID;
  v_prev_order RECORD;
  v_prev_bounty NUMERIC;
  v_delta NUMERIC;
BEGIN
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 1. Row-level lock on the wave to prevent race conditions
  SELECT * INTO v_wave FROM public.syndicate_waves WHERE id = p_wave_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Syndicate wave not found';
  END IF;

  IF v_wave.status != 'active' OR now() > v_wave.end_time THEN
    RAISE EXCEPTION 'This syndicate wave has ended or is inactive';
  END IF;

  -- 2. Lock buyer profile and verify balance
  SELECT wallet_balance INTO v_buyer_balance FROM public.profiles WHERE id = v_buyer_id FOR UPDATE;
  IF v_buyer_balance < v_total_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance (Available: ₹%, Required: ₹%)', v_buyer_balance, v_total_price;
  END IF;

  -- 3. Calculate active order count
  SELECT COUNT(*) INTO v_active_order_count
  FROM public.orders
  WHERE wave_id = p_wave_id AND status NOT IN ('cancelled', 'refunded');

  v_new_active_count := v_active_order_count + 1;

  -- 4. Determine unlocked tier based on new active count
  SELECT * INTO v_current_tier
  FROM public.wave_tiers
  WHERE wave_id = p_wave_id AND v_new_active_count >= threshold_units
  ORDER BY threshold_units DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_current_tier
    FROM public.wave_tiers
    WHERE wave_id = p_wave_id
    ORDER BY threshold_units ASC
    LIMIT 1;
  END IF;

  v_bounty_amount := ROUND((p_unit_price * (v_current_tier.bounty_percent / 100)), 2);

  -- 5. Debit buyer wallet and update pending escrow
  UPDATE public.profiles
  SET
    wallet_balance = wallet_balance - v_total_price,
    pending_escrow_bounty = pending_escrow_bounty + v_bounty_amount + CASE WHEN p_has_image_bounty THEN p_image_bounty_amount ELSE 0 END,
    updated_at = now()
  WHERE id = v_buyer_id;

  -- 6. Insert new order record
  INSERT INTO public.orders (
    buyer_id, brand_id, wave_id, product_id, unit_price, total_price,
    status, product_bounty, syndicate_tier_unlocked, has_image_bounty,
    image_review_bounty, image_escrow_held, review_status
  )
  VALUES (
    v_buyer_id, v_wave.brand_id, p_wave_id, p_product_id, p_unit_price,
    v_total_price, 'processing', v_bounty_amount, v_current_tier.tier_number,
    p_has_image_bounty, COALESCE(p_image_bounty_amount, 0), p_has_image_bounty,
    CASE WHEN p_has_image_bounty THEN 'pending' ELSE 'none' END
  )
  RETURNING id INTO v_new_order_id;

  -- 7. Add wallet ledger entry
  INSERT INTO public.wallet_ledger (user_id, order_id, type, amount, balance_after, description)
  VALUES (
    v_buyer_id, v_new_order_id, 'ORDER_PAYMENT', -v_total_price,
    v_buyer_balance - v_total_price,
    'Payment for order #' || substr(v_new_order_id::text, 1, 8)
  );

  -- 8. RETROACTIVE DELTAS FOR ALL PRIOR ACTIVE BUYERS IN THIS WAVE
  FOR v_prev_order IN
    SELECT o.*, p.wallet_balance as cur_balance
    FROM public.orders o
    JOIN public.profiles p ON p.id = o.buyer_id
    WHERE o.wave_id = p_wave_id
      AND o.id != v_new_order_id
      AND o.status NOT IN ('cancelled', 'refunded')
  LOOP
    v_prev_bounty := v_prev_order.product_bounty;
    v_delta := v_bounty_amount - v_prev_bounty;

    IF v_delta > 0 THEN
      UPDATE public.orders
      SET
        product_bounty = v_bounty_amount,
        syndicate_tier_unlocked = v_current_tier.tier_number,
        updated_at = now()
      WHERE id = v_prev_order.id;

      UPDATE public.profiles
      SET
        pending_escrow_bounty = pending_escrow_bounty + v_delta,
        updated_at = now()
      WHERE id = v_prev_order.buyer_id;

      INSERT INTO public.bounty_audit_logs (
        order_id, wave_id, previous_bounty, new_bounty, delta_applied, tier_number, reason
      )
      VALUES (
        v_prev_order.id, p_wave_id, v_prev_bounty, v_bounty_amount, v_delta,
        v_current_tier.tier_number, 'WAVE_TIER_UPGRADE'
      );

      INSERT INTO public.wallet_ledger (user_id, order_id, type, amount, balance_after, description)
      VALUES (
        v_prev_order.buyer_id, v_prev_order.id, 'DELTA_CREDIT', v_delta,
        v_prev_order.cur_balance,
        'Wave Milestone Upgrade: Tier ' || v_current_tier.tier_number || ' delta +₹' || v_delta
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_new_order_id,
    'unlocked_tier', v_current_tier.tier_number,
    'active_orders', v_new_active_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. PROCESS DISPUTE REFUND (atomic refund + tier clawback)
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_dispute_refund(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_wave RECORD;
  v_new_active_count INT;
  v_downgraded_tier RECORD;
  v_downgraded_bounty NUMERIC;
  v_active_order RECORD;
  v_clawback_delta NUMERIC;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'refunded' THEN
    RAISE EXCEPTION 'Order is already refunded';
  END IF;

  -- 1. Mark target order as refunded
  UPDATE public.orders
  SET status = 'refunded', updated_at = now()
  WHERE id = p_order_id;

  -- 2. Return payment to buyer's liquid balance and deduct held bounty
  UPDATE public.profiles
  SET
    wallet_balance = wallet_balance + v_order.total_price,
    pending_escrow_bounty = GREATEST(0, pending_escrow_bounty - v_order.product_bounty - CASE WHEN v_order.image_escrow_held THEN v_order.image_review_bounty ELSE 0 END),
    updated_at = now()
  WHERE id = v_order.buyer_id;

  INSERT INTO public.wallet_ledger (user_id, order_id, type, amount, balance_after, description)
  VALUES (
    v_order.buyer_id, v_order.id, 'DISPUTE_REFUND', v_order.total_price,
    (SELECT wallet_balance FROM public.profiles WHERE id = v_order.buyer_id),
    'Dispute refund credited for order #' || substr(v_order.id::text, 1, 8)
  );

  -- 3. If wave order, recalculate remaining count and check for tier downgrade
  IF v_order.wave_id IS NOT NULL THEN
    SELECT * INTO v_wave FROM public.syndicate_waves WHERE id = v_order.wave_id FOR UPDATE;

    SELECT COUNT(*) INTO v_new_active_count
    FROM public.orders
    WHERE wave_id = v_order.wave_id AND status NOT IN ('cancelled', 'refunded');

    SELECT * INTO v_downgraded_tier
    FROM public.wave_tiers
    WHERE wave_id = v_order.wave_id AND v_new_active_count >= threshold_units
    ORDER BY threshold_units DESC
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT * INTO v_downgraded_tier
      FROM public.wave_tiers
      WHERE wave_id = v_order.wave_id
      ORDER BY threshold_units ASC
      LIMIT 1;
    END IF;

    v_downgraded_bounty := ROUND((v_order.unit_price * (v_downgraded_tier.bounty_percent / 100)), 2);

    -- 4. Claw back tier difference from remaining active orders
    FOR v_active_order IN
      SELECT * FROM public.orders
      WHERE wave_id = v_order.wave_id AND status NOT IN ('cancelled', 'refunded')
    LOOP
      v_clawback_delta := v_active_order.product_bounty - v_downgraded_bounty;

      IF v_clawback_delta > 0 THEN
        UPDATE public.orders
        SET
          product_bounty = v_downgraded_bounty,
          syndicate_tier_unlocked = v_downgraded_tier.tier_number,
          updated_at = now()
        WHERE id = v_active_order.id;

        UPDATE public.profiles
        SET
          pending_escrow_bounty = GREATEST(0, pending_escrow_bounty - v_clawback_delta),
          updated_at = now()
        WHERE id = v_active_order.buyer_id;

        INSERT INTO public.wallet_ledger (user_id, order_id, type, amount, balance_after, description)
        VALUES (
          v_active_order.buyer_id, v_active_order.id, 'SYNDICATE_TIER_DOWNGRADE',
          -v_clawback_delta,
          (SELECT wallet_balance FROM public.profiles WHERE id = v_active_order.buyer_id),
          'Tier downgraded to Tier ' || v_downgraded_tier.tier_number || ' after dispute refund. Escrow adjusted -₹' || v_clawback_delta
        );
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'refunded_order_id', p_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;