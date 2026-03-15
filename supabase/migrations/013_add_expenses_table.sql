-- 013_add_expenses_table.sql
-- Add expenses table for basic accounting and reporting

CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL DEFAULT CURRENT_DATE,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL DEFAULT 0,
    category text NOT NULL CHECK (category IN ('Utilities', 'Supplies', 'Maintenance', 'Salaries', 'Food & Beverage', 'Taxes', 'Other')),
    payment_method text CHECK (payment_method IN ('Cash', 'GCash', 'Card', 'Bank Transfer')),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index for date-based reporting
CREATE INDEX IF NOT EXISTS expenses_date_idx ON public.expenses (date);

-- Add sample expenses if needed
-- INSERT INTO public.expenses (date, description, amount, category, payment_method) 
-- VALUES (CURRENT_DATE, 'Electricity Bill March', 4500.00, 'Utilities', 'GCash');
