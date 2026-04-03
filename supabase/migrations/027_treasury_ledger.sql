CREATE TABLE IF NOT EXISTS public.treasury_withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL DEFAULT 'PayMongo' CHECK (provider IN ('PayMongo')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (
    status IN ('pending_review', 'approved', 'processing', 'succeeded', 'failed', 'cancelled')
  ),
  destination_label TEXT NOT NULL,
  destination_account_masked TEXT,
  request_note TEXT,
  failure_message TEXT,
  external_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  requested_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  approved_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treasury_withdrawals_status
  ON public.treasury_withdrawals (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_treasury_withdrawals_requested_by
  ON public.treasury_withdrawals (requested_by_admin_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.treasury_ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  entry_type TEXT NOT NULL CHECK (
    entry_type IN ('hotel_paymongo_inflow', 'hotel_paymongo_refund', 'withdrawal_completed', 'manual_adjustment')
  ),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',
  provider TEXT,
  source_app TEXT NOT NULL DEFAULT 'hotel',
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  payment_row_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  withdrawal_id UUID REFERENCES public.treasury_withdrawals(id) ON DELETE SET NULL,
  external_payment_id TEXT,
  payment_intent_id TEXT,
  description TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treasury_ledger_entries_created
  ON public.treasury_ledger_entries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_treasury_ledger_entries_entry_type
  ON public.treasury_ledger_entries (entry_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_treasury_ledger_entries_booking
  ON public.treasury_ledger_entries (booking_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_treasury_paymongo_inflow_external_payment
  ON public.treasury_ledger_entries (external_payment_id)
  WHERE entry_type = 'hotel_paymongo_inflow' AND external_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_treasury_withdrawal_completion
  ON public.treasury_ledger_entries (withdrawal_id)
  WHERE entry_type = 'withdrawal_completed' AND withdrawal_id IS NOT NULL;

INSERT INTO public.permissions (name)
VALUES
  ('treasury.read'),
  ('treasury.withdraw'),
  ('treasury.approve')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role_id, permission_id
FROM (
  SELECT 2 AS role_id, p.id AS permission_id
  FROM public.permissions p
  WHERE p.name IN ('treasury.read', 'treasury.withdraw', 'treasury.approve')
) seeded
WHERE NOT EXISTS (
  SELECT 1
  FROM public.role_permissions rp
  WHERE rp.role_id = seeded.role_id
    AND rp.permission_id = seeded.permission_id
);

COMMENT ON TABLE public.treasury_withdrawals IS 'Hotel-only withdrawal requests and approvals used to reconcile a shared PayMongo wallet safely.';
COMMENT ON TABLE public.treasury_ledger_entries IS 'Hotel-only treasury ledger entries. This segregates hotel funds from other applications sharing the same PayMongo wallet.';
