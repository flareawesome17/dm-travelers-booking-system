-- Add payment_expires_at column to bookings table
-- Used by the cron cleanup to determine when Pending Payment bookings should be auto-cancelled

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_payment_expires ON bookings(payment_expires_at)
WHERE status = 'Pending Payment';
