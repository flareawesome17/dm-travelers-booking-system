INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 2, p.id
FROM public.permissions p
WHERE p.name IN (
  'ledger.read',
  'ledger.close',
  'ledger.transactions.create',
  'payments.create',
  'payments.read',
  'expenses.create',
  'expenses.read',
  'reports.export'
)
ON CONFLICT DO NOTHING;
