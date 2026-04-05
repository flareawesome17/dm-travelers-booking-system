-- Add discount_id to bookings to track which global discount was applied
ALTER TABLE public.bookings
ADD COLUMN discount_id uuid REFERENCES public.discounts(id);

COMMENT ON COLUMN public.bookings.discount_id IS 'Reference to the global discount applied to this booking (if any).';
