-- 022_enterprise_features.sql
-- D&M Travelers Inn – Enterprise Feature Expansion
-- All changes are ADDITIVE – no existing columns, tables, or constraints removed.
--
-- Features covered:
--   F1  Extend Booking           (booking_extensions table, bookings.extensions_total)
--   F2  LGU Rate System          (rooms.lgu_rate_* columns)
--   F3  Special Booking          (bookings.is_special_booking, special_booking_label)
--   F4  Collectibles / Receivables (receivables + receivable_payments tables)
--   F5  Restaurant LGU Pricing   (restaurant_menu.lgu_markup_percentage, restaurant_orders.is_lgu_order)
--   F6  Booking Extras           (booking_extras table, bookings.extras_total)
--   Shared: audit_log table, extras default pricing in settings, payments.type extension

-- ========================================================================
-- F2 – LGU Rate System  (extend rooms)
-- ========================================================================
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS lgu_rate_enabled    BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lgu_rate_24h_price  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS lgu_rate_12h_price  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS lgu_rate_5h_price   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS lgu_rate_3h_price   NUMERIC(12,2);

COMMENT ON COLUMN public.rooms.lgu_rate_enabled   IS 'When true, LGU guests use lgu_rate_*_price instead of standard rate_*_price.';
COMMENT ON COLUMN public.rooms.lgu_rate_24h_price IS 'LGU-specific 24-hour rate override.';
COMMENT ON COLUMN public.rooms.lgu_rate_12h_price IS 'LGU-specific 12-hour rate override.';
COMMENT ON COLUMN public.rooms.lgu_rate_5h_price  IS 'LGU-specific 5-hour rate override.';
COMMENT ON COLUMN public.rooms.lgu_rate_3h_price  IS 'LGU-specific 3-hour rate override.';


-- ========================================================================
-- F3 – Special Booking System  (extend bookings)
-- ========================================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_special_booking    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_booking_label TEXT;

COMMENT ON COLUMN public.bookings.is_special_booking    IS 'When true, booking allows delayed payment (like LGU).';
COMMENT ON COLUMN public.bookings.special_booking_label IS 'Reason / name for the special booking designation.';


-- ========================================================================
-- F6 – Booking Extras
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.booking_extras (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID          NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  extra_type  TEXT          NOT NULL CHECK (extra_type IN (
                              'Extra Bed', 'Extra Pillow', 'Extra Blanket',
                              'Extra Towel', 'Extra Person')),
  quantity    INT           NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  created_at  TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_extras_booking ON public.booking_extras(booking_id);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS extras_total NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.bookings.extras_total IS 'Cached sum of booking_extras.total_price for this booking.';


-- ========================================================================
-- F1 – Booking Extensions
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.booking_extensions (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id            UUID          NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  duration_type         TEXT          NOT NULL CHECK (duration_type IN ('hours', 'days')),
  duration_value        INT           NOT NULL CHECK (duration_value > 0),
  additional_cost       NUMERIC(12,2) NOT NULL CHECK (additional_cost >= 0),
  new_checkout_date     TIMESTAMPTZ   NOT NULL,
  approved_by_admin_id  UUID          REFERENCES public.admin_users(id),
  created_at            TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_extensions_booking ON public.booking_extensions(booking_id);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS extensions_total NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.bookings.extensions_total IS 'Cached sum of booking_extensions.additional_cost for this booking.';


-- ========================================================================
-- F4 – Receivables & Payment History
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.receivables (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID          NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  type        TEXT          NOT NULL CHECK (type IN ('LGU', 'SPECIAL')),
  amount_due  NUMERIC(12,2) NOT NULL CHECK (amount_due >= 0),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status      TEXT          NOT NULL DEFAULT 'Outstanding'
                            CHECK (status IN ('Outstanding', 'Partial', 'Settled')),
  notes       TEXT,
  created_at  TIMESTAMPTZ   DEFAULT now(),
  updated_at  TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receivables_booking ON public.receivables(booking_id);
CREATE INDEX IF NOT EXISTS idx_receivables_type    ON public.receivables(type);
CREATE INDEX IF NOT EXISTS idx_receivables_status  ON public.receivables(status);

CREATE TABLE IF NOT EXISTS public.receivable_payments (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  receivable_id         UUID          NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method                TEXT          NOT NULL CHECK (method IN ('Cash', 'GCash', 'Card', 'Bank Transfer')),
  recorded_by_admin_id  UUID          REFERENCES public.admin_users(id),
  notes                 TEXT,
  accounting_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
  created_at            TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receivable_payments_receivable ON public.receivable_payments(receivable_id);


-- ========================================================================
-- F5 – Restaurant LGU Pricing
-- ========================================================================
ALTER TABLE public.restaurant_menu
  ADD COLUMN IF NOT EXISTS lgu_markup_percentage NUMERIC(5,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.restaurant_menu.lgu_markup_percentage IS 'Percentage markup for LGU orders. E.g., 10 means price × 1.10.';

ALTER TABLE public.restaurant_orders
  ADD COLUMN IF NOT EXISTS is_lgu_order BOOLEAN NOT NULL DEFAULT false;


-- ========================================================================
-- Shared – Audit Log
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                    UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type           TEXT      NOT NULL,
  entity_id             UUID      NOT NULL,
  action                TEXT      NOT NULL,
  changes               JSONB     DEFAULT '{}',
  performed_by_admin_id UUID      REFERENCES public.admin_users(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity  ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);


-- ========================================================================
-- Extend payments.type to support new payment categories
-- ========================================================================
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_type_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_type_check
  CHECK (type IN ('Deposit', 'Balance', 'Restaurant', 'Extension', 'Extra', 'Receivable'));


-- ========================================================================
-- Seed default extras pricing into settings
-- ========================================================================
INSERT INTO public.settings (key, value, description) VALUES
  ('extra_bed_price',     '500',  'Default price per extra bed'),
  ('extra_pillow_price',  '100',  'Default price per extra pillow'),
  ('extra_blanket_price', '100',  'Default price per extra blanket'),
  ('extra_towel_price',   '50',   'Default price per extra towel'),
  ('extra_person_price',  '300',  'Default price per extra person')
ON CONFLICT (key) DO NOTHING;
