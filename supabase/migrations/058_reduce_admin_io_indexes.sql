-- Reduce repeated admin-dashboard and activity-hub read I/O.
-- These indexes target the polling paths that run while the admin app is open.

CREATE INDEX IF NOT EXISTS idx_public_booking_payment_sessions_created_at
  ON public.public_booking_payment_sessions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_created_at_desc
  ON public.bookings (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_check_in_date_status
  ON public.bookings (check_in_date, status);

CREATE INDEX IF NOT EXISTS idx_bookings_check_out_date_status
  ON public.bookings (check_out_date, status);

CREATE INDEX IF NOT EXISTS idx_bookings_checked_in_reserved_checkout
  ON public.bookings (reserved_checkout_datetime)
  WHERE status = 'Checked-In' AND reserved_checkout_datetime IS NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.admin_messages') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_admin_messages_broadcast_created
      ON public.admin_messages (created_at DESC)
      WHERE recipient_id IS NULL;

    CREATE INDEX IF NOT EXISTS idx_admin_messages_sender_created
      ON public.admin_messages (sender_id, created_at DESC)
      WHERE recipient_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_admin_messages_recipient_created
      ON public.admin_messages (recipient_id, created_at DESC)
      WHERE recipient_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_users_active_last_seen
  ON public.admin_users (last_seen_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_created_at_desc
  ON public.restaurant_orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_paid_accounting_date
  ON public.restaurant_orders (accounting_date, created_at DESC)
  WHERE status = 'Paid';

CREATE INDEX IF NOT EXISTS idx_payments_success_accounting_date
  ON public.payments (accounting_date)
  WHERE status = 'Success';

CREATE INDEX IF NOT EXISTS idx_receivable_payments_accounting_date
  ON public.receivable_payments (accounting_date);

CREATE INDEX IF NOT EXISTS idx_inventory_items_active_name
  ON public.inventory_items (name)
  WHERE is_active = true;
