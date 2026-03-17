-- Add display name to admin users

ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS name text;

CREATE INDEX IF NOT EXISTS admin_users_name_idx ON public.admin_users(name);

