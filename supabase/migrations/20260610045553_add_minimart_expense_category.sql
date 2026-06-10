BEGIN;

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_category_check
  CHECK (
    category IN (
      'Utilities',
      'Supplies',
      'Maintenance',
      'Salaries',
      'Food & Beverage',
      'Minimart',
      'Taxes',
      'Other'
    )
  );

COMMIT;
