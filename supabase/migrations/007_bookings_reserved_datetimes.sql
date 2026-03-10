-- 007_bookings_reserved_datetimes.sql
-- Add reserved check-in/checkout datetimes for precise early/late fee calculations.

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS reserved_checkin_datetime TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reserved_checkout_datetime TIMESTAMPTZ;

-- Backfill existing rows using the existing date-only fields and the standard 24h times.
-- For 24h bookings, reserved check-in = check_in_date at 14:00, reserved checkout = check_out_date at 12:00.
-- For other rate plans, we still set these defaults so the logic has a baseline.
UPDATE public.bookings
SET reserved_checkin_datetime = COALESCE(
      reserved_checkin_datetime,
      (check_in_date::timestamptz + INTERVAL '14 hours')
    ),
    reserved_checkout_datetime = COALESCE(
      reserved_checkout_datetime,
      (check_out_date::timestamptz + INTERVAL '12 hours')
    )
WHERE check_in_date IS NOT NULL
  AND check_out_date IS NOT NULL;

