ALTER TABLE public.treasury_withdrawals
  ADD COLUMN IF NOT EXISTS paymongo_wallet_id TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_wallet_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_reference_number TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_status TEXT CHECK (paymongo_status IN ('pending', 'succeeded', 'failed')),
  ADD COLUMN IF NOT EXISTS paymongo_provider_error_code TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_provider_error TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_treasury_withdrawals_paymongo_wallet_transaction
  ON public.treasury_withdrawals (paymongo_wallet_transaction_id)
  WHERE paymongo_wallet_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_treasury_withdrawals_paymongo_status
  ON public.treasury_withdrawals (paymongo_status, last_synced_at DESC);

COMMENT ON COLUMN public.treasury_withdrawals.paymongo_wallet_transaction_id IS 'Wallet transaction ID returned by PayMongo transfer submission.';
COMMENT ON COLUMN public.treasury_withdrawals.paymongo_transfer_id IS 'Provider-side transfer identifier from PayMongo callback/retrieval payload.';
COMMENT ON COLUMN public.treasury_withdrawals.paymongo_reference_number IS 'Bank or EFT reference returned by PayMongo for the treasury transfer.';
