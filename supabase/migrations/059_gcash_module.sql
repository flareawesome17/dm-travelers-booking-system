-- 059_gcash_module.sql
-- Hotel GCash wallet tracking for customer cash-in and load transactions.

INSERT INTO public.permissions (name) VALUES
  ('gcash.read'),
  ('gcash.transact'),
  ('gcash.adjust')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 1, p.id
FROM public.permissions p
WHERE p.name IN (
  'gcash.read',
  'gcash.transact',
  'gcash.adjust'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager can administer GCash, while front-desk Staff can view and post customer cash-in/load transactions.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role_map.role_id, p.id
FROM (
  VALUES
    (2, 'gcash.read'),
    (2, 'gcash.transact'),
    (2, 'gcash.adjust'),
    (3, 'gcash.read'),
    (3, 'gcash.transact')
) AS role_map(role_id, permission_name)
JOIN public.permissions p ON p.name = role_map.permission_name
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.gcash_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('cash_in', 'load', 'opening_adjustment')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  service_charge NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_charge >= 0),
  currency TEXT NOT NULL DEFAULT 'PHP',
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  transaction_reference TEXT,
  customer_name TEXT,
  recipient_number TEXT,
  description TEXT NOT NULL,
  note TEXT,
  performed_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gcash_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gcash_ledger_entries_effective
  ON public.gcash_ledger_entries (effective_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gcash_ledger_entries_type
  ON public.gcash_ledger_entries (entry_type, effective_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gcash_ledger_opening_adjustment
  ON public.gcash_ledger_entries (entry_type)
  WHERE entry_type = 'opening_adjustment';

CREATE OR REPLACE FUNCTION public.compute_gcash_service_charge(p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (CEIL(GREATEST(COALESCE(p_amount, 0), 0) / 1000.0) * 20)::NUMERIC(12,2);
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

CREATE OR REPLACE FUNCTION public.record_gcash_transaction(
  p_entry_type TEXT,
  p_amount NUMERIC,
  p_transaction_reference TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_recipient_number TEXT DEFAULT NULL,
  p_effective_at TIMESTAMPTZ DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  available_before NUMERIC(12,2);
  charge_amount NUMERIC(12,2);
  ledger_entry_id UUID;
  now_ts TIMESTAMPTZ := now();
BEGIN
  IF p_entry_type NOT IN ('cash_in', 'load') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'invalid_type',
      'error_message', 'Only GCash cash-in and load transactions are supported.'
    );
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'invalid_amount',
      'error_message', 'GCash transaction amount must be greater than zero.'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.gcash_ledger_entries'));

  available_before := public.compute_available_gcash_balance();
  charge_amount := public.compute_gcash_service_charge(p_amount);

  IF available_before < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'insufficient_gcash',
      'error_message', 'GCash transaction exceeds available balance. Available: ' || to_char(available_before, 'FM9999999990.00') || '.'
    );
  END IF;

  INSERT INTO public.gcash_ledger_entries (
    direction,
    entry_type,
    amount,
    service_charge,
    currency,
    effective_at,
    transaction_reference,
    customer_name,
    recipient_number,
    description,
    note,
    performed_by_admin_id,
    meta,
    created_at
  )
  VALUES (
    'debit',
    p_entry_type,
    ROUND(p_amount, 2),
    charge_amount,
    'PHP',
    COALESCE(p_effective_at, now_ts),
    NULLIF(TRIM(COALESCE(p_transaction_reference, '')), ''),
    NULLIF(TRIM(COALESCE(p_customer_name, '')), ''),
    NULLIF(TRIM(COALESCE(p_recipient_number, '')), ''),
    CASE
      WHEN p_entry_type = 'cash_in' THEN 'GCash cash-in'
      ELSE 'GCash load'
    END,
    p_note,
    p_admin_id,
    jsonb_build_object(
      'service_charge_rule', 'PHP 20 per 1-1000 amount tier',
      'total_collected_from_customer', ROUND(p_amount + charge_amount, 2)
    ),
    now_ts
  )
  RETURNING id INTO ledger_entry_id;

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_entry_id', ledger_entry_id,
    'service_charge', charge_amount,
    'total_collected_from_customer', ROUND(p_amount + charge_amount, 2),
    'available_gcash_after', ROUND(available_before - p_amount, 2)
  );
END;
$$;

COMMENT ON TABLE public.gcash_ledger_entries IS 'Immutable ledger for hotel GCash wallet adjustments and customer cash-in/load outflows.';
COMMENT ON COLUMN public.gcash_ledger_entries.amount IS 'Principal amount credited to or deducted from the hotel GCash wallet.';
COMMENT ON COLUMN public.gcash_ledger_entries.service_charge IS 'Customer service fee earned on cash-in/load transactions. This is tracked separately from wallet balance.';
