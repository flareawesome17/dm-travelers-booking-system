ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

COMMENT ON COLUMN public.restaurant_orders.payment_reference IS 'Reference number recorded for non-cash restaurant payments such as GCash or card.';
