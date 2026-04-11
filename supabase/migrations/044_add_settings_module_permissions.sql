-- Add settings permissions per tab
INSERT INTO permissions (name) VALUES 
('settings.general'), 
('settings.operations'), 
('settings.financial'), 
('settings.social'), 
('settings.extras')
ON CONFLICT (name) DO NOTHING;

-- Grant to Super Admin (role_id=1)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE name IN ('settings.general', 'settings.operations', 'settings.financial', 'settings.social', 'settings.extras')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant to Manager (role_id=2)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE name IN ('settings.general', 'settings.operations', 'settings.financial', 'settings.social', 'settings.extras')
ON CONFLICT (role_id, permission_id) DO NOTHING;
