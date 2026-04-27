-- 054_extras_per_day_charging.sql
-- Add per-day charging for Extra Bed.
-- total_price = quantity × unit_price × days.
-- One-time extras (pillows, towels, blankets, custom charges) keep days = 1.

ALTER TABLE public.booking_extras
  ADD COLUMN IF NOT EXISTS days INT NOT NULL DEFAULT 1 CHECK (days > 0);

COMMENT ON COLUMN public.booking_extras.days
  IS 'Number of nights the extra applies. Extra Bed is charged per night (qty × price × days). Other extras use days = 1 (one-time).';
