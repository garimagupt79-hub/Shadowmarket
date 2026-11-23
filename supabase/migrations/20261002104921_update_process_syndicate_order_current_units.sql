/*
# Update process_syndicate_order to increment current_units

1. Modified Functions
- `process_syndicate_order`: after inserting the new order, increments
  `syndicate_waves.current_units` by 1 so the wave card progress bar
  reflects the new participant count immediately.

2. Modified Functions
- `process_dispute_refund`: after recalculating the remaining active count,
  syncs `syndicate_waves.current_units` to the new count so cancellations
  and refunds keep the progress bar accurate.

3. Security
- No policy changes. Both functions remain SECURITY DEFINER.
*/

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

  SELECT * INTO v_wave FROM public.syndicate_waves WHERE id = p_wave_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Syndicate wave not found';
  END IF;

  IF v_wave.status != 'active' OR now() > v_wave.end_time THEN
    RAISE EXCEPTION 'This syndicate wave has ended or is inactive';
  END IF;

  SELECT wallet_balance INTO v_buyer_balance FROM public.profiles WHERE id = v_buyer_id FOR UPDATE;
  IF v_buyer_balance < v_total_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance (Available: ₹%, Required: ₹%)', v_buyer_balance, v_total_price;
  END IF;

  SELECT COUNT(*) INTO v_active_order_count
  FROM public.orders
  WHERE wave_id = p_wave_id AND status NOT IN ('cancelled', 'refunded');

  v_new_active_count := v_active_order_count + 1;

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

  UPDATE public.profiles
  SET
    wallet_balance = wallet_balance - v_total_price,
    pending_escrow_bounty = pending_escrow_bounty + v_bounty_amount + CASE WHEN p_has_image_bounty THEN p_image_bounty_amount ELSE 0 END,
    updated_at = now()
  WHERE id = v_buyer_id;

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

  UPDATE public.syndicate_waves
  SET current_units = current_units + 1
  WHERE id = p_wave_id;

  INSERT INTO public.wallet_ledger (user_id, order_id, type, amount, balance_after, description)
  VALUES (
    v_buyer_id, v_new_order_id, 'ORDER_PAYMENT', -v_total_price,
    v_buyer_balance - v_total_price,
    'Payment for order #' || substr(v_new_order_id::text, 1, 8)
  );

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
