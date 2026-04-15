-- Add 'Cheque' to the payments.method CHECK constraint
-- This aligns the database with the validation schema which already allows Cheque payments.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check 
  CHECK (method = ANY (ARRAY['Stripe'::text, 'PayPal'::text, 'GCash'::text, 'Cash'::text, 'Card'::text, 'QRPh'::text, 'Cheque'::text]));
