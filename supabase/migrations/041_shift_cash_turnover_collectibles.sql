ALTER TABLE public.shift_cash_report_turnovers
ADD COLUMN IF NOT EXISTS collectible_amount NUMERIC(12,2);

UPDATE public.shift_cash_report_turnovers
SET collectible_amount = COALESCE(collectible_amount, total_amount)
WHERE collectible_amount IS NULL;

ALTER TABLE public.shift_cash_report_turnovers
ALTER COLUMN collectible_amount SET DEFAULT 0;
