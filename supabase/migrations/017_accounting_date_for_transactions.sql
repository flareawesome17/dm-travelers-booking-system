ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS accounting_date date NOT NULL DEFAULT CURRENT_DATE;

UPDATE public.payments
SET accounting_date = COALESCE(
  accounting_date,
  (transaction_time AT TIME ZONE 'Asia/Manila')::date
);

CREATE INDEX IF NOT EXISTS payments_accounting_date_idx ON public.payments (accounting_date);

ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS accounting_date date NOT NULL DEFAULT CURRENT_DATE;

UPDATE public.restaurant_orders
SET accounting_date = COALESCE(
  accounting_date,
  (created_at AT TIME ZONE 'Asia/Manila')::date
);

CREATE INDEX IF NOT EXISTS restaurant_orders_accounting_date_idx ON public.restaurant_orders (accounting_date);
