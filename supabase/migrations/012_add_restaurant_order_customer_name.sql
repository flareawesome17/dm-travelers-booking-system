-- 012_add_restaurant_order_customer_name.sql
-- Add customer name to restaurant orders for tracking Dine-in/Walk-in guests

ALTER TABLE public.restaurant_orders
ADD COLUMN IF NOT EXISTS customer_name text;

COMMENT ON COLUMN public.restaurant_orders.customer_name IS 'Name of the customer for dine-in or walk-in orders (not linked to a booking).';
