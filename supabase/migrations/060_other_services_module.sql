-- 060_other_services_module.sql
-- Paid hotel service recording for parking, laundry, massage, and future ancillary services.

INSERT INTO public.permissions (name) VALUES
  ('other_services.read'),
  ('other_services.create'),
  ('other_services.manage')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role_map.role_id, p.id
FROM (
  VALUES
    (1, 'other_services.read'),
    (1, 'other_services.create'),
    (1, 'other_services.manage'),
    (2, 'other_services.read'),
    (2, 'other_services.create'),
    (2, 'other_services.manage'),
    (3, 'other_services.read'),
    (3, 'other_services.create')
) AS role_map(role_id, permission_name)
JOIN public.permissions p ON p.name = role_map.permission_name
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.other_service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rate_amount NUMERIC(12,2) NOT NULL CHECK (rate_amount >= 0),
  unit_label TEXT NOT NULL,
  unit_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.other_service_types ENABLE ROW LEVEL SECURITY;

INSERT INTO public.other_service_types (code, name, rate_amount, unit_label, unit_description, is_active, sort_order)
VALUES
  ('parking', 'Parking Fee', 10, 'day', 'PHP 10 per day', true, 10),
  ('laundry', 'Laundry Charge', 250, 'load', 'PHP 250 per load up to 5 kilos', true, 20),
  ('massage', 'Massage Charge', 100, 'hour', 'PHP 100 per hour', true, 30)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    rate_amount = EXCLUDED.rate_amount,
    unit_label = EXCLUDED.unit_label,
    unit_description = EXCLUDED.unit_description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

CREATE TABLE IF NOT EXISTS public.other_service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id UUID REFERENCES public.other_service_types(id) ON DELETE RESTRICT,
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  unit_label TEXT NOT NULL,
  unit_rate NUMERIC(12,2) NOT NULL CHECK (unit_rate >= 0),
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'GCash', 'Card', 'QRPh', 'Cheque')),
  payment_reference TEXT,
  customer_name TEXT,
  room_number TEXT,
  note TEXT,
  accounting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.other_service_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_other_service_records_accounting_date
  ON public.other_service_records (accounting_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_other_service_records_method
  ON public.other_service_records (payment_method, accounting_date DESC);

CREATE INDEX IF NOT EXISTS idx_other_service_records_service
  ON public.other_service_records (service_code, accounting_date DESC);

ALTER TABLE public.shift_transactions
  DROP CONSTRAINT IF EXISTS shift_transactions_source_check;

ALTER TABLE public.shift_transactions
  ADD CONSTRAINT shift_transactions_source_check
  CHECK (source IN ('booking', 'restaurant', 'expense', 'manual', 'other_service'));

CREATE OR REPLACE FUNCTION public.compute_available_cash_balance()
RETURNS NUMERIC
LANGUAGE sql
AS $$
  WITH payment_cash AS (
    SELECT COALESCE(SUM(amount), 0)::NUMERIC(12,2) AS total
    FROM public.payments
    WHERE status = 'Success'
      AND method = 'Cash'
  ),
  restaurant_cash AS (
    SELECT COALESCE(SUM(total_amount), 0)::NUMERIC(12,2) AS total
    FROM public.restaurant_orders
    WHERE status = 'Paid'
      AND payment_method = 'Cash'
  ),
  other_services_cash AS (
    SELECT COALESCE(SUM(total_amount), 0)::NUMERIC(12,2) AS total
    FROM public.other_service_records
    WHERE payment_method = 'Cash'
  ),
  expense_cash AS (
    SELECT COALESCE(SUM(amount), 0)::NUMERIC(12,2) AS total
    FROM public.expenses
    WHERE payment_method = 'Cash'
  ),
  ledger_effect AS (
    SELECT COALESCE(
      SUM(
        CASE
          WHEN direction = 'credit' THEN amount
          ELSE -amount
        END
      ),
      0
    )::NUMERIC(12,2) AS total
    FROM public.cash_ledger_entries
  )
  SELECT ROUND(
    (
      SELECT total FROM payment_cash
    ) +
    (
      SELECT total FROM restaurant_cash
    ) +
    (
      SELECT total FROM other_services_cash
    ) -
    (
      SELECT total FROM expense_cash
    ) +
    (
      SELECT total FROM ledger_effect
    ),
    2
  );
$$;

CREATE OR REPLACE FUNCTION public.compute_available_gcash_balance()
RETURNS NUMERIC
LANGUAGE sql
AS $$
  WITH booking_gcash AS (
    SELECT COALESCE(SUM(amount), 0)::NUMERIC(12,2) AS total
    FROM public.payments
    WHERE status = 'Success'
      AND method = 'GCash'
  ),
  restaurant_gcash AS (
    SELECT COALESCE(SUM(total_amount), 0)::NUMERIC(12,2) AS total
    FROM public.restaurant_orders
    WHERE status = 'Paid'
      AND payment_method = 'GCash'
  ),
  receivable_gcash AS (
    SELECT COALESCE(SUM(amount), 0)::NUMERIC(12,2) AS total
    FROM public.receivable_payments
    WHERE method = 'GCash'
      AND (notes IS NULL OR notes NOT ILIKE 'Synced from booking payment%')
  ),
  other_services_gcash AS (
    SELECT COALESCE(SUM(total_amount), 0)::NUMERIC(12,2) AS total
    FROM public.other_service_records
    WHERE payment_method = 'GCash'
  ),
  expense_gcash AS (
    SELECT COALESCE(SUM(amount), 0)::NUMERIC(12,2) AS total
    FROM public.expenses
    WHERE payment_method = 'GCash'
  ),
  ledger_effect AS (
    SELECT COALESCE(
      SUM(
        CASE
          WHEN direction = 'credit' THEN amount
          ELSE -amount
        END
      ),
      0
    )::NUMERIC(12,2) AS total
    FROM public.gcash_ledger_entries
  )
  SELECT ROUND(
    (
      SELECT total FROM booking_gcash
    ) +
    (
      SELECT total FROM restaurant_gcash
    ) +
    (
      SELECT total FROM receivable_gcash
    ) +
    (
      SELECT total FROM other_services_gcash
    ) -
    (
      SELECT total FROM expense_gcash
    ) +
    (
      SELECT total FROM ledger_effect
    ),
    2
  );
$$;

COMMENT ON TABLE public.other_service_types IS 'Configured hotel ancillary services and fixed rates.';
COMMENT ON TABLE public.other_service_records IS 'Recorded paid ancillary services such as parking, laundry, and massage.';
COMMENT ON COLUMN public.other_service_types.unit_description IS 'Human-readable rate note, such as laundry load weight allowance.';
