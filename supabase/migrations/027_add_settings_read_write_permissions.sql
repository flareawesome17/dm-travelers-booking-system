-- Add settings.read and settings.write permissions
-- The APIs use these, but only settings.manage was seeded in the initial schema

INSERT INTO permissions (name) VALUES ('settings.read')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name) VALUES ('settings.write')
ON CONFLICT (name) DO NOTHING;

-- Grant settings.read and settings.write to Super Admin (role_id=1)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE name IN ('settings.read', 'settings.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant settings.read and settings.write to Manager (role_id=2)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE name IN ('settings.read', 'settings.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;
