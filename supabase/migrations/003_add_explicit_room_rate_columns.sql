-- 003_add_explicit_room_rate_columns.sql
-- D&M Travelers Inn – Add explicit hour-based rate columns to rooms
-- This keeps the flexible JSONB rate_plans column, but also stores
-- 24h / 12h / 5h / 3h prices and fees in dedicated columns for
-- easier querying, reporting, and alignment with the admin Add Room form.

ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS rate_24h_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS rate_24h_price numeric(12,2),
ADD COLUMN IF NOT EXISTS rate_24h_early_checkin_fee numeric(12,2),
ADD COLUMN IF NOT EXISTS rate_24h_late_checkout_fee numeric(12,2),
ADD COLUMN IF NOT EXISTS rate_12h_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS rate_12h_price numeric(12,2),
ADD COLUMN IF NOT EXISTS rate_12h_late_checkout_fee numeric(12,2),
ADD COLUMN IF NOT EXISTS rate_5h_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS rate_5h_price numeric(12,2),
ADD COLUMN IF NOT EXISTS rate_5h_late_checkout_fee numeric(12,2),
ADD COLUMN IF NOT EXISTS rate_3h_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS rate_3h_price numeric(12,2),
ADD COLUMN IF NOT EXISTS rate_3h_late_checkout_fee numeric(12,2);

-- Optional backfill: derive new columns from existing rate_plans JSONB where possible.
-- This is safe to run even if some rows have empty or partial rate_plans.
UPDATE public.rooms r
SET
  rate_24h_enabled = COALESCE(
    (
      SELECT (p->>'enabled')::boolean
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "24h")') AS p
      LIMIT 1
    ),
    rate_24h_enabled
  ),
  rate_24h_price = COALESCE(
    (
      SELECT (p->>'base_price')::numeric
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "24h")') AS p
      LIMIT 1
    ),
    rate_24h_price
  ),
  rate_24h_early_checkin_fee = COALESCE(
    (
      SELECT (p->>'early_checkin_fee')::numeric
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "24h")') AS p
      LIMIT 1
    ),
    rate_24h_early_checkin_fee
  ),
  rate_24h_late_checkout_fee = COALESCE(
    (
      SELECT (p->>'late_checkout_fee')::numeric
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "24h")') AS p
      LIMIT 1
    ),
    rate_24h_late_checkout_fee
  ),
  rate_12h_enabled = COALESCE(
    (
      SELECT (p->>'enabled')::boolean
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "12h")') AS p
      LIMIT 1
    ),
    rate_12h_enabled
  ),
  rate_12h_price = COALESCE(
    (
      SELECT (p->>'base_price')::numeric
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "12h")') AS p
      LIMIT 1
    ),
    rate_12h_price
  ),
  rate_12h_late_checkout_fee = COALESCE(
    (
      SELECT (p->>'late_checkout_fee')::numeric
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "12h")') AS p
      LIMIT 1
    ),
    rate_12h_late_checkout_fee
  ),
  rate_5h_enabled = COALESCE(
    (
      SELECT (p->>'enabled')::boolean
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "5h")') AS p
      LIMIT 1
    ),
    rate_5h_enabled
  ),
  rate_5h_price = COALESCE(
    (
      SELECT (p->>'base_price')::numeric
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "5h")') AS p
      LIMIT 1
    ),
    rate_5h_price
  ),
  rate_5h_late_checkout_fee = COALESCE(
    (
      SELECT (p->>'late_checkout_fee')::numeric
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "5h")') AS p
      LIMIT 1
    ),
    rate_5h_late_checkout_fee
  ),
  rate_3h_enabled = COALESCE(
    (
      SELECT (p->>'enabled')::boolean
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "3h")') AS p
      LIMIT 1
    ),
    rate_3h_enabled
  ),
  rate_3h_price = COALESCE(
    (
      SELECT (p->>'base_price')::numeric
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "3h")') AS p
      LIMIT 1
    ),
    rate_3h_price
  ),
  rate_3h_late_checkout_fee = COALESCE(
    (
      SELECT (p->>'late_checkout_fee')::numeric
      FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "3h")') AS p
      LIMIT 1
    ),
    rate_3h_late_checkout_fee
  );

-- Ensure base_price_per_night mirrors the main 24h rate when available,
-- so analytics and the existing UI "Price/night" stay consistent.
UPDATE public.rooms r
SET base_price_per_night = COALESCE(
  (
    SELECT (p->>'base_price')::numeric
    FROM jsonb_path_query(r.rate_plans, '$[*] ? (@.kind == "24h")') AS p
    LIMIT 1
  ),
  base_price_per_night
);

