-- Add bookings.calendar permission
-- This allow granular control over the occupancy calendar view

INSERT INTO permissions (name) VALUES ('bookings.calendar')
ON CONFLICT (name) DO NOTHING;

-- Grant bookings.calendar to Super Admin (role_id=1)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE name = 'bookings.calendar'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant bookings.calendar to Manager (role_id=2)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE name = 'bookings.calendar'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant bookings.calendar to Staff (role_id=3) by default
-- Since staff typically need to see availability for walk-ins
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name = 'bookings.calendar'
ON CONFLICT (role_id, permission_id) DO NOTHING;
