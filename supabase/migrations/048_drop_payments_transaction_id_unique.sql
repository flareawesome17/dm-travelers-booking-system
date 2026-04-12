ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_transaction_id_key;

CREATE INDEX IF NOT EXISTS idx_payments_transaction_id
  ON public.payments(transaction_id);
