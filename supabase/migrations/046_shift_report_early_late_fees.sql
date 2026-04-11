-- 046_shift_report_early_late_fees.sql
-- Add early_checkin_amount and late_checkout_amount columns to shift_cash_report_rows and shift_cash_report_turnovers

ALTER TABLE public.shift_cash_report_rows
ADD COLUMN early_checkin_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN late_checkout_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.shift_cash_report_turnovers
ADD COLUMN early_checkin_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN late_checkout_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
