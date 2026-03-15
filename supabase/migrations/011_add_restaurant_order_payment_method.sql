-- 011_add_restaurant_order_payment_method.sql
-- Add payment method to restaurant orders for tracking Dine-in/Walk-in payments

ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('Cash', 'GCash', 'Card', 'Charged to Room'));

-- Update existing orders to have a default payment method if they are Paid or Charged to Room
UPDATE public.restaurant_orders
SET payment_method = 'Charged to Room'
WHERE status = 'Charged to Room' AND payment_method IS NULL;

UPDATE public.restaurant_orders
SET payment_method = 'Cash'
WHERE status = 'Paid' AND payment_method IS NULL;
