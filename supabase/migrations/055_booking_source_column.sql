-- 055_booking_source_column.sql
-- Track where each booking originates: Walk-in, Booking.com, Online, Phone, Other.
-- Booking.com bookings skip the system reference number (their own confirmation ID is used).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_source TEXT NOT NULL DEFAULT 'Walk-in'
  CHECK (booking_source IN ('Walk-in', 'Booking.com', 'Online', 'Phone', 'Other'));

COMMENT ON COLUMN public.bookings.booking_source
  IS 'Origin of the booking: Walk-in (default), Booking.com, Online (website), Phone, or Other.';
