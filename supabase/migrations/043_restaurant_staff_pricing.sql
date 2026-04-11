ALTER TABLE public.restaurant_menu
  ADD COLUMN IF NOT EXISTS staff_price NUMERIC(12,2);

COMMENT ON COLUMN public.restaurant_menu.staff_price IS 'Optional discounted price used when restaurant orders are flagged for staff pricing.';

ALTER TABLE public.restaurant_orders
  ADD COLUMN IF NOT EXISTS is_staff_order BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.restaurant_orders.is_staff_order IS 'True when the restaurant order used the configured menu staff pricing instead of the standard or LGU rate.';
