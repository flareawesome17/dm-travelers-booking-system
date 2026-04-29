 -- Add 'Cheque' to the receivable_payments.method CHECK constraint.
-- This aligns the database with the validation schema which already allows Cheque payments.
ALTER TABLE public.receivable_payments DROP CONSTRAINT IF EXISTS receivable_payments_method_check;

-- The original constraint was an inline CHECK, drop it via the auto-generated name pattern.
-- Postgres names inline CHECK constraints as "<table>_<column>_check".
DO $$
BEGIN
  ALTER TABLE public.receivable_payments DROP CONSTRAINT IF EXISTS receivable_payments_method_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.receivable_payments ADD CONSTRAINT receivable_payments_method_check
  CHECK (method = ANY (ARRAY['Cash'::text, 'GCash'::text, 'Card'::text, 'Bank Transfer'::text, 'Cheque'::text]));
