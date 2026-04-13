-- 050_cash_module.sql
-- Hotel-wide cash deposit ledger with maker-checker approval

INSERT INTO public.permissions (name) VALUES
  ('cash.read'),
  ('cash.deposit.request'),
  ('cash.deposit.approve'),
  ('cash.deposit.reverse'),
  ('cash.bank_account.manage'),
  ('cash.adjust')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 1, p.id
FROM public.permissions p
WHERE p.name IN (
  'cash.read',
  'cash.deposit.request',
  'cash.deposit.approve',
  'cash.deposit.reverse',
  'cash.bank_account.manage',
  'cash.adjust'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.cash_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number_encrypted TEXT NOT NULL,
  account_number_masked TEXT NOT NULL,
  branch_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  updated_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_bank_accounts_label
  ON public.cash_bank_accounts (label);

CREATE INDEX IF NOT EXISTS idx_cash_bank_accounts_active
  ON public.cash_bank_accounts (is_active, label);

CREATE TABLE IF NOT EXISTS public.cash_deposit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  deposit_reference TEXT NOT NULL,
  deposited_at TIMESTAMPTZ NOT NULL,
  bank_account_id UUID REFERENCES public.cash_bank_accounts(id) ON DELETE RESTRICT,
  bank_account_label TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number_masked TEXT NOT NULL,
  branch_label TEXT,
  proof_bucket TEXT NOT NULL DEFAULT 'cash-deposit-proofs',
  proof_path TEXT NOT NULL,
  proof_filename TEXT,
  proof_content_type TEXT,
  proof_size_bytes INT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'cancelled', 'reversed')),
  approval_note TEXT,
  rejection_note TEXT,
  cancellation_note TEXT,
  reversal_reason TEXT,
  linked_reversal_entry_id UUID,
  requested_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  approved_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  rejected_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  cancelled_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  reversed_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_deposit_requests_status
  ON public.cash_deposit_requests (status, deposited_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_deposit_requests_requested_by
  ON public.cash_deposit_requests (requested_by_admin_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.cash_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('bank_deposit', 'deposit_reversal', 'opening_adjustment')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deposit_request_id UUID REFERENCES public.cash_deposit_requests(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  note TEXT,
  performed_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_entries_effective
  ON public.cash_ledger_entries (effective_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_entries_type
  ON public.cash_ledger_entries (entry_type, effective_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_ledger_bank_deposit_request
  ON public.cash_ledger_entries (deposit_request_id)
  WHERE entry_type = 'bank_deposit' AND deposit_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_ledger_deposit_reversal_request
  ON public.cash_ledger_entries (deposit_request_id)
  WHERE entry_type = 'deposit_reversal' AND deposit_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_ledger_opening_adjustment
  ON public.cash_ledger_entries (entry_type)
  WHERE entry_type = 'opening_adjustment';

ALTER TABLE public.cash_deposit_requests
  DROP CONSTRAINT IF EXISTS cash_deposit_requests_linked_reversal_entry_id_fkey;

ALTER TABLE public.cash_deposit_requests
  ADD CONSTRAINT cash_deposit_requests_linked_reversal_entry_id_fkey
  FOREIGN KEY (linked_reversal_entry_id)
  REFERENCES public.cash_ledger_entries(id)
  ON DELETE SET NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cash-deposit-proofs',
  'cash-deposit-proofs',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

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

CREATE OR REPLACE FUNCTION public.approve_cash_deposit_request(
  p_request_id UUID,
  p_admin_id UUID,
  p_approval_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  request_row public.cash_deposit_requests%ROWTYPE;
  available_before NUMERIC(12,2);
  ledger_entry_id UUID;
  now_ts TIMESTAMPTZ := now();
BEGIN
  SELECT *
  INTO request_row
  FROM public.cash_deposit_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'not_found',
      'error_message', 'Deposit request not found.'
    );
  END IF;

  IF request_row.status <> 'pending_review' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'invalid_status',
      'error_message', 'Only pending deposit requests can be approved.'
    );
  END IF;

  IF p_admin_id IS NOT NULL AND request_row.requested_by_admin_id = p_admin_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'approval_conflict',
      'error_message', 'A different authorized admin must approve this deposit.'
    );
  END IF;

  available_before := public.compute_available_cash_balance();

  IF available_before < request_row.amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'insufficient_cash',
      'error_message', 'Approved deposit exceeds available cash. Available: ' || to_char(available_before, 'FM9999999990.00') || '.'
    );
  END IF;

  INSERT INTO public.cash_ledger_entries (
    direction,
    entry_type,
    amount,
    currency,
    effective_at,
    deposit_request_id,
    description,
    note,
    performed_by_admin_id,
    meta,
    created_at
  )
  VALUES (
    'debit',
    'bank_deposit',
    request_row.amount,
    'PHP',
    request_row.deposited_at,
    request_row.id,
    format('Bank deposit to %s', request_row.bank_account_label),
    COALESCE(p_approval_note, request_row.note),
    p_admin_id,
    jsonb_build_object(
      'deposit_reference', request_row.deposit_reference,
      'bank_account_label', request_row.bank_account_label,
      'bank_name', request_row.bank_name,
      'account_name', request_row.account_name,
      'account_number_masked', request_row.account_number_masked,
      'branch_label', request_row.branch_label
    ),
    now_ts
  )
  RETURNING id INTO ledger_entry_id;

  UPDATE public.cash_deposit_requests
  SET status = 'approved',
      approved_by_admin_id = p_admin_id,
      approved_at = now_ts,
      approval_note = p_approval_note,
      updated_at = now_ts
  WHERE id = request_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_entry_id', ledger_entry_id,
    'available_cash_after', ROUND(available_before - request_row.amount, 2)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_cash_deposit_request(
  p_request_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  request_row public.cash_deposit_requests%ROWTYPE;
  ledger_entry_id UUID;
  now_ts TIMESTAMPTZ := now();
BEGIN
  SELECT *
  INTO request_row
  FROM public.cash_deposit_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'not_found',
      'error_message', 'Deposit request not found.'
    );
  END IF;

  IF request_row.status <> 'approved' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'invalid_status',
      'error_message', 'Only approved deposits can be reversed.'
    );
  END IF;

  IF request_row.linked_reversal_entry_id IS NOT NULL OR request_row.reversed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'already_reversed',
      'error_message', 'This deposit has already been reversed.'
    );
  END IF;

  INSERT INTO public.cash_ledger_entries (
    direction,
    entry_type,
    amount,
    currency,
    effective_at,
    deposit_request_id,
    description,
    note,
    performed_by_admin_id,
    meta,
    created_at
  )
  VALUES (
    'credit',
    'deposit_reversal',
    request_row.amount,
    'PHP',
    now_ts,
    request_row.id,
    format('Reversal for bank deposit %s', request_row.deposit_reference),
    p_reason,
    p_admin_id,
    jsonb_build_object(
      'deposit_reference', request_row.deposit_reference,
      'bank_account_label', request_row.bank_account_label
    ),
    now_ts
  )
  RETURNING id INTO ledger_entry_id;

  UPDATE public.cash_deposit_requests
  SET status = 'reversed',
      reversed_by_admin_id = p_admin_id,
      reversed_at = now_ts,
      reversal_reason = p_reason,
      linked_reversal_entry_id = ledger_entry_id,
      updated_at = now_ts
  WHERE id = request_row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'ledger_entry_id', ledger_entry_id,
    'available_cash_after', public.compute_available_cash_balance()
  );
END;
$$;

COMMENT ON TABLE public.cash_bank_accounts IS 'Saved hotel-owned bank accounts used for physical cash deposit tracking.';
COMMENT ON TABLE public.cash_deposit_requests IS 'Maker-checker deposit requests for physical cash deposited to a bank.';
COMMENT ON TABLE public.cash_ledger_entries IS 'Immutable official cash ledger entries affecting available physical cash.';
