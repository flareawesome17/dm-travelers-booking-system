CREATE TABLE IF NOT EXISTS public.admin_login_otps (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_login_otps_admin_id_idx ON public.admin_login_otps(admin_id);
CREATE INDEX IF NOT EXISTS admin_login_otps_expires_at_idx ON public.admin_login_otps(expires_at);
