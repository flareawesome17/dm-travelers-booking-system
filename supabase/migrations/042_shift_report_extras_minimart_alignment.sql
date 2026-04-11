ALTER TABLE public.booking_extras
  ADD COLUMN IF NOT EXISTS custom_label TEXT;

COMMENT ON COLUMN public.booking_extras.custom_label IS 'Optional staff-provided label for custom booking charges such as damages or missing items.';

ALTER TABLE public.booking_extras
  DROP CONSTRAINT IF EXISTS booking_extras_extra_type_check;

ALTER TABLE public.booking_extras
  ADD CONSTRAINT booking_extras_extra_type_check
  CHECK (
    extra_type IN (
      'Extra Bed',
      'Extra Person',
      'Extra Pillow',
      'Extra Blanket',
      'Extra Towel',
      'Extra Towel - Bath',
      'Extra Towel - Hand',
      'Custom Charge'
    )
  );

ALTER TABLE public.booking_extras
  DROP CONSTRAINT IF EXISTS booking_extras_custom_label_check;

ALTER TABLE public.booking_extras
  ADD CONSTRAINT booking_extras_custom_label_check
  CHECK (
    extra_type <> 'Custom Charge'
    OR NULLIF(BTRIM(COALESCE(custom_label, '')), '') IS NOT NULL
  );

ALTER TABLE public.restaurant_menu
  ADD COLUMN IF NOT EXISTS is_minimart BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.restaurant_menu.is_minimart IS 'Marks menu items that should be reported under shift cash report minimart totals instead of food.';

ALTER TABLE public.restaurant_order_items
  ADD COLUMN IF NOT EXISTS is_minimart BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.restaurant_order_items.is_minimart IS 'Snapshot of restaurant_menu.is_minimart captured when the order line was created.';

UPDATE public.restaurant_order_items
SET is_minimart = FALSE
WHERE is_minimart IS NULL;
