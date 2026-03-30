-- 023_inventory_and_shifts.sql
-- D&M Travelers Inn – Inventory & Shift Management Schema
-- Features 7 & 8

-- ========================================================================
-- F7 – Inventory System
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT          NOT NULL,
  category        TEXT          NOT NULL DEFAULT 'ingredient',
  unit            TEXT          NOT NULL DEFAULT 'pcs',
  current_stock   NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_stock_alert NUMERIC(12,2) NOT NULL DEFAULT 5,
  cost_per_unit   NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   DEFAULT now(),
  updated_at      TIMESTAMPTZ   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id         UUID          NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  type            TEXT          NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')),
  quantity        NUMERIC(12,2) NOT NULL,
  previous_stock  NUMERIC(12,2) NOT NULL,
  new_stock       NUMERIC(12,2) NOT NULL,
  source          TEXT,
  notes           TEXT,
  performed_by    UUID          REFERENCES public.admin_users(id),
  created_at      TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(item_id);

CREATE TABLE IF NOT EXISTS public.menu_item_ingredients (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id      UUID          NOT NULL REFERENCES public.restaurant_menu(id) ON DELETE CASCADE,
  inventory_item_id UUID          NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity_required NUMERIC(12,2) NOT NULL CHECK (quantity_required > 0),
  created_at        TIMESTAMPTZ   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_ingredients_menu ON public.menu_item_ingredients(menu_item_id);


-- ========================================================================
-- F8 – Shift Management System
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.shifts (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  start_time  TIME        NOT NULL,
  end_time    TIME        NOT NULL,
  sort_order  INT         NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shift_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id      UUID        NOT NULL REFERENCES public.shifts(id),
  date          DATE        NOT NULL,
  opened_by     UUID        REFERENCES public.admin_users(id),
  status        TEXT        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  closed_by     UUID        REFERENCES public.admin_users(id),
  closed_at     TIMESTAMPTZ,
  close_notes   TEXT,
  total_income  NUMERIC(12,2) DEFAULT 0,
  total_expense NUMERIC(12,2) DEFAULT 0,
  net_total     NUMERIC(12,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_logs_shift_date ON public.shift_logs(shift_id, date);

CREATE TABLE IF NOT EXISTS public.shift_transactions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_log_id  UUID        NOT NULL REFERENCES public.shift_logs(id) ON DELETE CASCADE,
  source        TEXT        NOT NULL CHECK (source IN ('booking', 'restaurant', 'expense', 'manual')),
  reference_id  TEXT,
  description   TEXT        NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  type          TEXT        NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  category      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_transactions_log ON public.shift_transactions(shift_log_id);

-- ========================================================================
-- Insert New Permissions and Assign to Roles
-- ========================================================================
INSERT INTO public.permissions (name)
VALUES
  ('inventory.read'),
  ('inventory.manage'),
  ('shifts.read'),
  ('shifts.close')
ON CONFLICT (name) DO NOTHING;

-- Assign these permissions to Roles (Assuming: 1=Admin, 2=Manager)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 1, p.id
FROM public.permissions p
WHERE p.name IN ('inventory.read', 'inventory.manage', 'shifts.read', 'shifts.close')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 2, p.id
FROM public.permissions p
WHERE p.name IN ('inventory.read', 'inventory.manage', 'shifts.read', 'shifts.close')
ON CONFLICT DO NOTHING;

-- Also add to all admins via admin_user_permissions so existing testers have it
INSERT INTO public.admin_user_permissions (admin_id, permission_id)
SELECT a.id, p.id
FROM public.admin_users a
CROSS JOIN public.permissions p
WHERE p.name IN ('inventory.read', 'inventory.manage', 'shifts.read', 'shifts.close')
ON CONFLICT DO NOTHING;


-- ========================================================================
-- Seed Default Shifts
-- ========================================================================
INSERT INTO public.shifts (name, start_time, end_time, sort_order)
VALUES
  ('Morning', '06:00:00', '14:00:00', 1),
  ('Afternoon', '14:00:00', '22:00:00', 2),
  ('Night', '22:00:00', '06:00:00', 3)
ON CONFLICT DO NOTHING;
