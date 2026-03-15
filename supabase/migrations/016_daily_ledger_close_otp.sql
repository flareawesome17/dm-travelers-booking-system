CREATE TABLE IF NOT EXISTS public.daily_ledger_close_otps (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id uuid NOT NULL REFERENCES public.daily_ledgers(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ledger_id, admin_id)
);

CREATE INDEX IF NOT EXISTS daily_ledger_close_otps_ledger_id_idx ON public.daily_ledger_close_otps(ledger_id);
CREATE INDEX IF NOT EXISTS daily_ledger_close_otps_expires_at_idx ON public.daily_ledger_close_otps(expires_at);
