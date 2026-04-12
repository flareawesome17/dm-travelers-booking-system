CREATE OR REPLACE FUNCTION public.transfer_booking_room(
  p_booking_id UUID,
  p_target_room_id UUID,
  p_admin_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_reprice BOOLEAN DEFAULT FALSE,
  p_new_total_amount NUMERIC DEFAULT NULL,
  p_new_discount_amount NUMERIC DEFAULT NULL,
  p_new_balance_due NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_old_room public.rooms%ROWTYPE;
  v_target_room public.rooms%ROWTYPE;
  v_booking_start TIMESTAMPTZ;
  v_booking_end TIMESTAMPTZ;
  v_rate_supported BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'booking_not_found',
      'error_message', 'Booking not found.'
    );
  END IF;

  IF v_booking.status IN ('Checked-Out', 'Cancelled', 'No Show') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'invalid_booking_state',
      'error_message', 'Only active bookings can be transferred.'
    );
  END IF;

  IF v_booking.room_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'room_missing',
      'error_message', 'Booking has no assigned room.'
    );
  END IF;

  IF v_booking.room_id = p_target_room_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'same_room',
      'error_message', 'Booking is already assigned to that room.'
    );
  END IF;

  PERFORM 1
  FROM public.rooms
  WHERE id IN (v_booking.room_id, p_target_room_id)
  ORDER BY id
  FOR UPDATE;

  SELECT *
  INTO v_old_room
  FROM public.rooms
  WHERE id = v_booking.room_id;

  SELECT *
  INTO v_target_room
  FROM public.rooms
  WHERE id = p_target_room_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'target_room_not_found',
      'error_message', 'Target room was not found.'
    );
  END IF;

  IF COALESCE(v_target_room.is_active, TRUE) = FALSE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'target_room_inactive',
      'error_message', 'Target room is inactive.'
    );
  END IF;

  IF COALESCE(v_target_room.status, '') <> 'Available' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'target_room_unavailable',
      'error_message', 'Target room must be Available before transfer.'
    );
  END IF;

  v_rate_supported := CASE COALESCE(v_booking.rate_plan_kind, '24h')
    WHEN '12h' THEN
      (COALESCE(v_target_room.rate_12h_enabled, FALSE) AND v_target_room.rate_12h_price IS NOT NULL)
      OR (COALESCE(v_booking.is_lgu_booking, FALSE) AND COALESCE(v_target_room.lgu_rate_enabled, FALSE) AND v_target_room.lgu_rate_12h_price IS NOT NULL)
    WHEN '5h' THEN
      (COALESCE(v_target_room.rate_5h_enabled, FALSE) AND v_target_room.rate_5h_price IS NOT NULL)
      OR (COALESCE(v_booking.is_lgu_booking, FALSE) AND COALESCE(v_target_room.lgu_rate_enabled, FALSE) AND v_target_room.lgu_rate_5h_price IS NOT NULL)
    WHEN '3h' THEN
      (COALESCE(v_target_room.rate_3h_enabled, FALSE) AND v_target_room.rate_3h_price IS NOT NULL)
      OR (COALESCE(v_booking.is_lgu_booking, FALSE) AND COALESCE(v_target_room.lgu_rate_enabled, FALSE) AND v_target_room.lgu_rate_3h_price IS NOT NULL)
    ELSE
      (COALESCE(v_target_room.rate_24h_enabled, FALSE) AND v_target_room.rate_24h_price IS NOT NULL)
      OR (COALESCE(v_booking.is_lgu_booking, FALSE) AND COALESCE(v_target_room.lgu_rate_enabled, FALSE) AND v_target_room.lgu_rate_24h_price IS NOT NULL)
  END;

  IF NOT v_rate_supported THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'unsupported_rate_plan',
      'error_message', 'Target room does not support this booking''s current rate plan.'
    );
  END IF;

  v_booking_start := COALESCE(
    v_booking.reserved_checkin_datetime,
    v_booking.actual_check_in_at,
    v_booking.check_in_date::TIMESTAMPTZ
  );

  v_booking_end := COALESCE(
    v_booking.reserved_checkout_datetime,
    CASE COALESCE(v_booking.rate_plan_kind, '24h')
      WHEN '12h' THEN COALESCE(v_booking.actual_check_in_at, v_booking.check_in_date::TIMESTAMPTZ) + INTERVAL '12 hour'
      WHEN '5h' THEN COALESCE(v_booking.actual_check_in_at, v_booking.check_in_date::TIMESTAMPTZ) + INTERVAL '5 hour'
      WHEN '3h' THEN COALESCE(v_booking.actual_check_in_at, v_booking.check_in_date::TIMESTAMPTZ) + INTERVAL '3 hour'
      ELSE COALESCE(v_booking.check_out_date::TIMESTAMPTZ, v_booking.check_in_date::TIMESTAMPTZ + INTERVAL '1 day')
    END
  );

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.room_id = p_target_room_id
      AND b.id <> p_booking_id
      AND COALESCE(b.status, '') NOT IN ('Cancelled', 'No Show', 'Checked-Out')
      AND tstzrange(
        COALESCE(
          b.reserved_checkin_datetime,
          b.actual_check_in_at,
          b.check_in_date::TIMESTAMPTZ
        ),
        COALESCE(
          b.reserved_checkout_datetime,
          CASE COALESCE(b.rate_plan_kind, '24h')
            WHEN '12h' THEN COALESCE(b.actual_check_in_at, b.check_in_date::TIMESTAMPTZ) + INTERVAL '12 hour'
            WHEN '5h' THEN COALESCE(b.actual_check_in_at, b.check_in_date::TIMESTAMPTZ) + INTERVAL '5 hour'
            WHEN '3h' THEN COALESCE(b.actual_check_in_at, b.check_in_date::TIMESTAMPTZ) + INTERVAL '3 hour'
            ELSE COALESCE(b.check_out_date::TIMESTAMPTZ, b.check_in_date::TIMESTAMPTZ + INTERVAL '1 day')
          END
        ),
        '[)'
      ) && tstzrange(v_booking_start, v_booking_end, '[)')
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'target_room_conflict',
      'error_message', 'Target room already has a conflicting booking for this stay window.'
    );
  END IF;

  IF v_booking.status = 'Checked-In' THEN
    IF COALESCE(v_old_room.status, '') <> 'Occupied' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'invalid_old_room_status',
        'error_message', 'Checked-in transfers require the current room to be Occupied.'
      );
    END IF;

    UPDATE public.rooms
    SET status = 'Available',
        updated_at = NOW()
    WHERE id = v_old_room.id;

    UPDATE public.rooms
    SET status = 'Occupied',
        updated_at = NOW()
    WHERE id = v_target_room.id;
  END IF;

  IF p_reprice AND (p_new_total_amount IS NULL OR p_new_discount_amount IS NULL OR p_new_balance_due IS NULL) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'missing_reprice_values',
      'error_message', 'Transfer repricing values were not provided.'
    );
  END IF;

  UPDATE public.bookings
  SET room_id = p_target_room_id,
      total_amount = CASE WHEN p_reprice THEN p_new_total_amount ELSE total_amount END,
      discount_amount = CASE WHEN p_reprice THEN p_new_discount_amount ELSE discount_amount END,
      balance_due = CASE WHEN p_reprice THEN p_new_balance_due ELSE balance_due END,
      updated_at = NOW()
  WHERE id = p_booking_id;

  UPDATE public.restaurant_orders
  SET room_id = p_target_room_id
  WHERE booking_id = p_booking_id
    AND room_id = v_old_room.id;

  INSERT INTO public.audit_log (
    entity_type,
    entity_id,
    action,
    changes,
    performed_by_admin_id
  ) VALUES (
    'booking',
    p_booking_id,
    'transfer_room',
    jsonb_build_object(
      'old_room_id', v_old_room.id,
      'old_room_number', v_old_room.room_number,
      'new_room_id', v_target_room.id,
      'new_room_number', v_target_room.room_number,
      'booking_status', v_booking.status,
      'repriced', p_reprice,
      'reason', NULLIF(BTRIM(COALESCE(p_reason, '')), ''),
      'old_total_amount', v_booking.total_amount,
      'new_total_amount', CASE WHEN p_reprice THEN p_new_total_amount ELSE v_booking.total_amount END,
      'old_balance_due', v_booking.balance_due,
      'new_balance_due', CASE WHEN p_reprice THEN p_new_balance_due ELSE v_booking.balance_due END
    ),
    p_admin_id
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'booking_id', p_booking_id,
    'old_room_id', v_old_room.id,
    'old_room_number', v_old_room.room_number,
    'new_room_id', v_target_room.id,
    'new_room_number', v_target_room.room_number,
    'booking_status', v_booking.status,
    'repriced', p_reprice,
    'new_total_amount', CASE WHEN p_reprice THEN p_new_total_amount ELSE v_booking.total_amount END,
    'new_balance_due', CASE WHEN p_reprice THEN p_new_balance_due ELSE v_booking.balance_due END
  );
END;
$$;
