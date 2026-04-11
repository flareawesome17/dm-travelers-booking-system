-- Persist reservation schedule reference details on shift cash report rows

ALTER TABLE public.shift_cash_report_rows
ADD COLUMN IF NOT EXISTS scheduled_check_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scheduled_check_out_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS remaining_balance_due NUMERIC(12,2) NOT NULL DEFAULT 0;
