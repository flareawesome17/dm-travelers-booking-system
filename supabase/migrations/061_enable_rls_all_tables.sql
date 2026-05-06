-- ============================================================
-- Migration 061: Enable RLS on all unprotected public tables
-- ============================================================
-- CONTEXT:
--   All API routes use getSupabaseAdmin() with SERVICE_ROLE_KEY
--   which bypasses RLS entirely. Only ActivityHub.tsx uses the
--   anon key for Supabase Realtime on admin_messages.
--
-- STRATEGY:
--   1. Enable RLS on every unprotected table (41 tables).
--   2. Add a SELECT-only policy on admin_messages for anon so
--      Realtime postgres_changes still fires in ActivityHub.
--   3. Fix the overly-permissive expenses policy.
--   4. Revoke anon/authenticated EXECUTE on the security-definer
--      transfer_booking_room() function.
--   5. Set search_path on all mutable-path functions.
--
-- SAFETY:  Service role bypasses RLS → zero production impact
--          on server-side operations.
-- ============================================================

BEGIN;

-- ─── 1. Enable RLS on all 41 unprotected tables ────────────

-- Auth & RBAC
ALTER TABLE public.admin_users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_otps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions        ENABLE ROW LEVEL SECURITY;

-- Core hotel
ALTER TABLE public.rooms                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_types              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_extras          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_extensions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings                ENABLE ROW LEVEL SECURITY;

-- Restaurant
ALTER TABLE public.restaurant_menu         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_ingredients   ENABLE ROW LEVEL SECURITY;

-- Ledger / Accounting
ALTER TABLE public.daily_ledgers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_ledger_close_otps ENABLE ROW LEVEL SECURITY;

-- Receivables
ALTER TABLE public.receivables             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_payments     ENABLE ROW LEVEL SECURITY;

-- Shifts & Inventory
ALTER TABLE public.shifts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements     ENABLE ROW LEVEL SECURITY;

-- Audit
ALTER TABLE public.audit_log               ENABLE ROW LEVEL SECURITY;

-- Treasury & Cash
ALTER TABLE public.treasury_withdrawals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_destinations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_bank_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_deposit_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_ledger_entries     ENABLE ROW LEVEL SECURITY;

-- Other
ALTER TABLE public.discounts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_booking_payment_sessions ENABLE ROW LEVEL SECURITY;


-- ─── 2. Realtime policy for ActivityHub ────────────────────
-- ActivityHub.tsx subscribes to postgres_changes on admin_messages
-- using the anon key. We allow SELECT-only so realtime events
-- still fire. All mutations go through API routes (service role).

CREATE POLICY "anon_select_admin_messages"
  ON public.admin_messages
  FOR SELECT
  TO anon
  USING (true);


-- ─── 3. Fix the overly-permissive expenses policy ──────────
-- The existing policy grants ALL to public (all roles) with
-- USING(true). Replace it with a properly scoped no-op since
-- all access goes through service role API routes anyway.

DROP POLICY IF EXISTS "Enable all for service role" ON public.expenses;


-- ─── 4. Revoke anon/authenticated EXECUTE on security-definer RPC ──
-- transfer_booking_room is SECURITY DEFINER and currently callable
-- by anonymous users via /rest/v1/rpc/transfer_booking_room.

REVOKE EXECUTE ON FUNCTION public.transfer_booking_room(
  p_booking_id uuid,
  p_target_room_id uuid,
  p_admin_id uuid,
  p_reason text,
  p_reprice boolean,
  p_new_total_amount numeric,
  p_new_discount_amount numeric,
  p_new_balance_due numeric
) FROM PUBLIC, anon, authenticated;


-- ─── 5. Fix mutable search_path on functions ───────────────

ALTER FUNCTION public.approve_cash_deposit_request(
  p_request_id uuid, p_admin_id uuid, p_approval_note text
) SET search_path = public;

ALTER FUNCTION public.reverse_cash_deposit_request(
  p_request_id uuid, p_admin_id uuid, p_reason text
) SET search_path = public;

ALTER FUNCTION public.compute_gcash_service_charge(
  p_amount numeric
) SET search_path = public;

ALTER FUNCTION public.record_cash_deposit_request(
  p_amount numeric, p_deposit_reference text,
  p_deposited_at timestamp with time zone, p_bank_account_id uuid,
  p_bank_account_label text, p_bank_name text, p_account_name text,
  p_account_number_masked text, p_branch_label text, p_proof_bucket text,
  p_proof_path text, p_proof_filename text, p_proof_content_type text,
  p_proof_size_bytes integer, p_note text, p_admin_id uuid
) SET search_path = public;

ALTER FUNCTION public.record_gcash_transaction(
  p_entry_type text, p_amount numeric, p_transaction_reference text,
  p_customer_name text, p_recipient_number text,
  p_effective_at timestamp with time zone, p_note text, p_admin_id uuid
) SET search_path = public;

ALTER FUNCTION public.compute_available_gcash_balance()
  SET search_path = public;

ALTER FUNCTION public.compute_available_cash_balance()
  SET search_path = public;

ALTER FUNCTION public.transfer_booking_room(
  p_booking_id uuid, p_target_room_id uuid, p_admin_id uuid,
  p_reason text, p_reprice boolean, p_new_total_amount numeric,
  p_new_discount_amount numeric, p_new_balance_due numeric
) SET search_path = public;

COMMIT;
