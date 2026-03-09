const ROLE_PERMISSIONS: Record<number, string[]> = {
  1: [
    'bookings.create', 'bookings.read', 'bookings.update', 'bookings.delete',
    'rooms.create', 'rooms.read', 'rooms.update', 'rooms.delete',
    'restaurant.create', 'restaurant.read', 'restaurant.update', 'restaurant.delete',
    'housekeeping.read', 'housekeeping.update',
    'reviews.read', 'reviews.approve', 'reviews.delete',
    'users.manage', 'settings.manage', 'reports.read',
  ],
  2: [
    'bookings.create', 'bookings.read', 'bookings.update',
    'rooms.create', 'rooms.read', 'rooms.update',
    'restaurant.create', 'restaurant.read', 'restaurant.update',
    'housekeeping.read', 'housekeeping.update',
    'reviews.read', 'reviews.approve', 'reports.read',
  ],
  3: [
    'bookings.create', 'bookings.read', 'bookings.update',
    'rooms.read', 'housekeeping.read',
  ],
  4: ['housekeeping.read', 'housekeeping.update', 'rooms.read'],
};

export function hasPermission(roleId: number, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[roleId];
  return perms?.includes(permission) ?? false;
}
