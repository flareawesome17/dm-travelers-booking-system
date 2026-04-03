-- Public booking payment sessions for PayMongo QRPh flow
CREATE TABLE IF NOT EXISTS public.public_booking_payment_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'PayMongo' CHECK (provider IN ('PayMongo')),
  payment_intent_id TEXT NOT NULL UNIQUE,
  payment_method_id TEXT,
  payment_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (
    status IN (
      'awaiting_payment_method',
      'awaiting_next_action',
      'processing',
      'succeeded',
      'failed',
      'expired',
      'cancelled'
    )
  ),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  qr_image_url TEXT,
  qr_expires_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_message TEXT,
  paid_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_booking_payment_sessions_booking
  ON public.public_booking_payment_sessions (booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_booking_payment_sessions_status
  ON public.public_booking_payment_sessions (status, qr_expires_at);

-- Allow QRPh entries in payment records
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_method_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_method_check
  CHECK (method IN ('Stripe', 'PayPal', 'GCash', 'Cash', 'Card', 'QRPh'));
