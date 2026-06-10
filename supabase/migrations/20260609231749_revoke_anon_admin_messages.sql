BEGIN;

-- Admin messages are read through authenticated API routes. The previous
-- anon SELECT policy exposed all internal broadcasts and direct messages.
DROP POLICY IF EXISTS "anon_select_admin_messages"
  ON public.admin_messages;

COMMIT;
