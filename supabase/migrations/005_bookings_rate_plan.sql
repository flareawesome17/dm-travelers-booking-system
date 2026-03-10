-- 005_bookings_rate_plan.sql
-- D&M Travelers Inn – Add rate plan support to bookings
-- Stores which rate (24h, 12h, 5h, 3h) was used for pricing and audit.

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS rate_plan_kind TEXT CHECK (rate_plan_kind IN ('24h', '12h', '5h', '3h'));

COMMENT ON COLUMN public.bookings.rate_plan_kind IS 'Rate plan used: 24h, 12h, 5h, or 3h. Used with room rate columns for pricing.';
