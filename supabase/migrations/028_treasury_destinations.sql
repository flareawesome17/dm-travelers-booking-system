CREATE TABLE IF NOT EXISTS public.treasury_destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('instapay', 'pesonet')),
  institution_name TEXT NOT NULL,
  institution_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_number_masked TEXT NOT NULL,
  account_number_encrypted TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treasury_destinations_active
  ON public.treasury_destinations (is_active, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_treasury_destinations_label
  ON public.treasury_destinations (label);

ALTER TABLE public.treasury_withdrawals
  ADD COLUMN IF NOT EXISTS destination_id UUID REFERENCES public.treasury_destinations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS destination_provider TEXT,
  ADD COLUMN IF NOT EXISTS destination_institution_name TEXT,
  ADD COLUMN IF NOT EXISTS destination_institution_code TEXT,
  ADD COLUMN IF NOT EXISTS destination_account_name TEXT;

CREATE INDEX IF NOT EXISTS idx_treasury_withdrawals_destination_id
  ON public.treasury_withdrawals (destination_id, requested_at DESC);

COMMENT ON TABLE public.treasury_destinations IS 'Saved payout destinations for Treasury withdrawals. Account numbers are stored encrypted at rest.';
