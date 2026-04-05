-- Add discount columns to restaurant_orders to track which global discount was applied
ALTER TABLE public.restaurant_orders
ADD COLUMN discount_id uuid REFERENCES public.discounts(id),
ADD COLUMN discount_amount numeric DEFAULT 0,
ADD COLUMN discount_type text CHECK (discount_type IN ('percent', 'fixed')),
ADD COLUMN discount_value numeric DEFAULT 0;

COMMENT ON COLUMN public.restaurant_orders.discount_id IS 'Reference to the global discount applied to this restaurant order (if any).';
COMMENT ON COLUMN public.restaurant_orders.discount_amount IS 'The calculated absolute discount amount in pesos subtracted from the total.';
