-- 009_restaurant_categories.sql
-- Introduce flexible restaurant menu categories and migrate existing data

-- Drop old time-based CHECK constraint if it exists
ALTER TABLE public.restaurant_menu
DROP CONSTRAINT IF EXISTS restaurant_menu_category_check;

-- Categories master table for restaurant menu
CREATE TABLE IF NOT EXISTS public.restaurant_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Seed default food-type based categories
INSERT INTO public.restaurant_categories (name, sort_order) VALUES
  ('Main Course', 1),
  ('Appetizers', 2),
  ('Snacks', 3),
  ('Sweets / Desserts', 4),
  ('Drinks / Beverages', 5),
  ('Add-ons', 6)
ON CONFLICT (name) DO NOTHING;

-- Map existing time-based categories in restaurant_menu to new categories
UPDATE public.restaurant_menu
SET category = CASE
  WHEN category IN ('Breakfast', 'Lunch', 'Dinner') THEN 'Main Course'
  WHEN category = 'Dessert' THEN 'Sweets / Desserts'
  WHEN category = 'Drinks' THEN 'Drinks / Beverages'
  ELSE category
END;

-- Ensure every distinct category in restaurant_menu has a corresponding row
INSERT INTO public.restaurant_categories (name, sort_order)
SELECT DISTINCT category, 999
FROM public.restaurant_menu
WHERE category IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.restaurant_categories c WHERE c.name = public.restaurant_menu.category
  );

