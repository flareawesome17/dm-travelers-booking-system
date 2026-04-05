-- 029_inventory_uom_conversion.sql
-- Allow for arbitrary precision on quantities for Unit of Measurement (UOM) conversion
-- when converting between stocking unit (e.g. Bottle) and recipe unit (e.g. ml).

ALTER TABLE public.inventory_items 
  ALTER COLUMN current_stock TYPE NUMERIC(15,4),
  ALTER COLUMN min_stock_alert TYPE NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS recipe_unit TEXT,
  ADD COLUMN IF NOT EXISTS yield_per_unit NUMERIC(15,4) DEFAULT 1;

ALTER TABLE public.inventory_movements
  ALTER COLUMN quantity TYPE NUMERIC(15,4),
  ALTER COLUMN previous_stock TYPE NUMERIC(15,4),
  ALTER COLUMN new_stock TYPE NUMERIC(15,4);

ALTER TABLE public.menu_item_ingredients
  ALTER COLUMN quantity_required TYPE NUMERIC(15,4);
