-- Add cheque_number column to bookings and receivable_payments
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cheque_number TEXT;
ALTER TABLE receivable_payments ADD COLUMN IF NOT EXISTS cheque_number TEXT;
