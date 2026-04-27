-- 056_booking_external_reference.sql
-- Store the OTA confirmation/reference number (e.g. Booking.com confirmation ID).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

COMMENT ON COLUMN public.bookings.external_reference
  IS 'External confirmation/reference number from OTAs like Booking.com.';
