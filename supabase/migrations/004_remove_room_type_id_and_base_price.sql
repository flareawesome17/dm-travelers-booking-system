-- 004_remove_room_type_id_and_base_price.sql
-- D&M Travelers Inn – Remove legacy room_type_id and base_price_per_night
-- We now rely solely on explicit hour-based rate columns and rate_plans JSON.

ALTER TABLE public.rooms
DROP COLUMN IF EXISTS room_type_id,
DROP COLUMN IF EXISTS base_price_per_night;

