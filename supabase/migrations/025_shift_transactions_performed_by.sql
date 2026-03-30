ALTER TABLE public.shift_transactions
ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES public.admin_users(id);

CREATE INDEX IF NOT EXISTS idx_shift_transactions_performed_by
ON public.shift_transactions(performed_by);
