-- Add admin heartbeat timestamp for online/offline presence.

ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS admin_users_last_seen_at_idx
ON public.admin_users(last_seen_at DESC);
