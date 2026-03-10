-- 010_restaurant_orders.sql
-- Restaurant orders linked to bookings and bookings.restaurant_charges_total

-- Table to store restaurant orders (dine-in, room service, walk-in)
CREATE TABLE IF NOT EXISTS public.restaurant_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid REFERENCES public.bookings(id),
  room_id uuid REFERENCES public.rooms(id),
  order_source text NOT NULL CHECK (order_source IN ('Restaurant', 'Room Service', 'Walk-In')),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Preparing', 'Served', 'Charged to Room', 'Paid', 'Cancelled')),
  subtotal numeric(12,2) NOT NULL,
  service_charge numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_booking ON public.restaurant_orders(booking_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_room ON public.restaurant_orders(room_id);

-- Order line items snapshotting menu data at time of order
CREATE TABLE IF NOT EXISTS public.restaurant_order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.restaurant_menu(id),
  name text NOT NULL,
  category text,
  unit_price numeric(12,2) NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  line_total numeric(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_restaurant_order_items_order ON public.restaurant_order_items(order_id);

-- Track aggregated restaurant charges per booking for breakdowns
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS restaurant_charges_total numeric(12,2) NOT NULL DEFAULT 0;

-- Extend payments.type to support restaurant-specific payments
ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_type_check;

ALTER TABLE public.payments
ADD CONSTRAINT payments_type_check
CHECK (type IN ('Deposit', 'Balance', 'Restaurant'));

