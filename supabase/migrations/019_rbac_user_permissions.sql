CREATE TABLE IF NOT EXISTS public.admin_user_permissions (
  admin_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  permission_id int NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, permission_id)
);

CREATE INDEX IF NOT EXISTS admin_user_permissions_admin_id_idx ON public.admin_user_permissions(admin_id);

DO $$
DECLARE
  perm_seq text;
  roles_seq text;
BEGIN
  perm_seq := pg_get_serial_sequence('public.permissions', 'id');
  IF perm_seq IS NOT NULL THEN
    EXECUTE format(
      'SELECT setval(%L, COALESCE((SELECT MAX(id) FROM public.permissions), 1), true)',
      perm_seq
    );
  END IF;

  roles_seq := pg_get_serial_sequence('public.roles', 'id');
  IF roles_seq IS NOT NULL THEN
    EXECUTE format(
      'SELECT setval(%L, COALESCE((SELECT MAX(id) FROM public.roles), 1), true)',
      roles_seq
    );
  END IF;
END $$;

INSERT INTO public.permissions (name)
VALUES
  ('ledger.read'),
  ('ledger.close'),
  ('ledger.transactions.create'),   
  ('ledger.transactions.delete'),
  ('payments.create'),
  ('payments.read'),
  ('expenses.create'),
  ('expenses.read'),
  ('reports.export'),
  ('roles.manage')
ON CONFLICT (name) DO NOTHING;
