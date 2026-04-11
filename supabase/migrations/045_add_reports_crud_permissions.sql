-- 045_add_reports_crud_permissions.sql
-- Add granular CRUD permissions for Reports module and map them to Super Admin.

INSERT INTO permissions (name) VALUES
  ('reports.shift_cash.read'),
  ('reports.shift_cash.create'),
  ('reports.shift_cash.update'),
  ('reports.shift_cash.delete'),
  ('reports.shift_cash.export'),
  ('reports.analytics.read'),
  ('reports.analytics.create'),
  ('reports.analytics.update'),
  ('reports.analytics.delete'),
  ('reports.analytics.export')
ON CONFLICT (name) DO NOTHING;

-- Grant to Super Admin (role ID 1) only, as requested by the user
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE name IN (
  'reports.shift_cash.read',
  'reports.shift_cash.create',
  'reports.shift_cash.update',
  'reports.shift_cash.delete',
  'reports.shift_cash.export',
  'reports.analytics.read',
  'reports.analytics.create',
  'reports.analytics.update',
  'reports.analytics.delete',
  'reports.analytics.export'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
