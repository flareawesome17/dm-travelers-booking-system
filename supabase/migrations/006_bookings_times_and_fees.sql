-- 006_bookings_times_and_fees.sql
-- D&M Travelers Inn – Booking actual times and early/late fee tracking
-- Standard 24h: check-in 14:00, checkout 12:00. Early = before 14:00, Late = after 12:00.

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS actual_check_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS actual_check_out_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS early_checkin_fee_applied NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_checkout_fee_applied NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.bookings.actual_check_in_at IS 'When guest actually checked in (for early check-in fee).';
COMMENT ON COLUMN public.bookings.actual_check_out_at IS 'When guest actually checked out (for late checkout fee).';
COMMENT ON COLUMN public.bookings.early_checkin_fee_applied IS 'Early check-in fee added to total (24h rate: before 14:00).';
COMMENT ON COLUMN public.bookings.late_checkout_fee_applied IS 'Late checkout fee added to total (24h: after 12:00).';
