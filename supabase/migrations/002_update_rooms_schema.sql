-- 002_update_rooms_schema.sql
-- D&M Travelers Inn – Rooms schema updates for admin/rooms CRUD
-- Run this in Supabase SQL editor or via Supabase CLI.

-- 1) Add flexible rate_plans column used by admin/rooms UI
--    Stores all configured rate types and their pricing/fees per room.
--    Example JSON:
--    [
--      {
--        "kind": "24h",
--        "enabled": true,
--        "base_price": 1000,
--        "early_checkin_fee": 150,
--        "late_checkout_fee": 150,
--        "checkin_time": "14:00",
--        "checkout_time": "12:00"
--      },
--      {
--        "kind": "12h",
--        "enabled": true,
--        "base_price": 800,
--        "late_checkout_fee": 100,
--        "duration_hours": 12
--      },
--      {
--        "kind": "5h",
--        "enabled": true,
--        "base_price": 600,
--        "late_checkout_fee": 100,
--        "duration_hours": 5
--      },
--      {
--        "kind": "3h",
--        "enabled": true,
--        "base_price": 350,
--        "late_checkout_fee": 100.05,
--        "duration_hours": 3
--      }
--    ]
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS rate_plans jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2) Ensure amenities and image_urls are always arrays (admin UI expects arrays)
ALTER TABLE public.rooms
  ALTER COLUMN amenities SET DEFAULT '{}'::text[],
  ALTER COLUMN image_urls SET DEFAULT '{}'::text[];

-- 3) Ensure is_active flag exists and defaults to true (used for soft delete / disabling rooms)
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 4) Keep base_price_per_night non-null for analytics and public pricing
ALTER TABLE public.rooms
  ALTER COLUMN base_price_per_night SET NOT NULL;

