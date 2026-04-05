-- Migration: Add discount fields to bookings
-- Description: Adds columns to store discount value, type (fixed/percent), and calculated amount.

ALTER TABLE bookings 
ADD COLUMN discount_value NUMERIC DEFAULT 0,
ADD COLUMN discount_type TEXT CHECK (discount_type IN ('fixed', 'percent')) DEFAULT 'fixed',
ADD COLUMN discount_amount NUMERIC DEFAULT 0;

COMMENT ON COLUMN bookings.discount_value IS 'The raw input value for the discount (e.g., 10 for 10%, 100 for ₱100).';
COMMENT ON COLUMN bookings.discount_type IS 'The type of discount: fixed amount or percentage.';
COMMENT ON COLUMN bookings.discount_amount IS 'The calculated absolute discount amount in pesos subtracted from the total.';
