-- D&M Travelers Inn - Initial Schema
-- Run this in Supabase SQL Editor or via Supabase CLI

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Roles (RBAC)
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

-- Permissions
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- Role-Permission junction
CREATE TABLE role_permissions (
  role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Admin users
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id INT NOT NULL REFERENCES roles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Room types (e.g. Standard Double)
CREATE TABLE room_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

-- Rooms
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_number TEXT UNIQUE NOT NULL,
  room_type TEXT NOT NULL,
  room_type_id INT REFERENCES room_types(id),
  floor INT,
  capacity INT NOT NULL DEFAULT 2,
  base_price_per_night NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Dirty', 'In Cleaning', 'Maintenance')),
  is_active BOOLEAN DEFAULT true,
  maintenance_flag BOOLEAN DEFAULT false,
  last_checkout_date TIMESTAMPTZ,
  amenities TEXT[] DEFAULT '{}',
  image_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rooms_room_type ON rooms(room_type);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_last_checkout ON rooms(last_checkout_date);

-- Guests (no-account booking)
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_number TEXT UNIQUE NOT NULL,
  guest_id UUID REFERENCES guests(id),
  room_id UUID REFERENCES rooms(id),
  room_type_requested TEXT NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  num_adults INT DEFAULT 1,
  num_children INT DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  deposit_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending Payment' CHECK (status IN ('Pending Verification', 'Pending Payment', 'Confirmed', 'Checked-In', 'Checked-Out', 'Cancelled', 'No Show')),
  verification_code TEXT UNIQUE,
  verification_code_expires_at TIMESTAMPTZ,
  guest_qr_code TEXT UNIQUE,
  special_requests TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookings_reference ON bookings(reference_number);
CREATE INDEX idx_bookings_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_room ON bookings(room_id);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  transaction_id TEXT UNIQUE NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('Stripe', 'PayPal', 'GCash', 'Cash', 'Card')),
  amount NUMERIC(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Deposit', 'Balance')),
  status TEXT NOT NULL CHECK (status IN ('Success', 'Failed', 'Refunded', 'Pending')),
  transaction_time TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_booking ON payments(booking_id);

-- Reviews (guest_name stored for display; booking_id optional)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID UNIQUE REFERENCES bookings(id),
  guest_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reviews_approved ON reviews(is_approved);

-- Restaurant menu
CREATE TABLE restaurant_menu (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  category TEXT CHECK (category IN ('Breakfast', 'Lunch', 'Dinner', 'Drinks')),
  is_available BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Housekeeping tasks
CREATE TABLE housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  assigned_to_admin_id UUID REFERENCES admin_users(id),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Cleaning', 'Clean', 'Maintenance')),
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_housekeeping_room ON housekeeping_tasks(room_id);

-- Settings (key-value)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT
);

-- Seed default roles and permissions
INSERT INTO roles (id, name, description) VALUES
  (1, 'Super Admin', 'Full system access'),
  (2, 'Manager', 'Operations and reports'),
  (3, 'Staff', 'Front desk and bookings'),
  (4, 'Housekeeping', 'Room status updates');

INSERT INTO permissions (id, name) VALUES
  (1, 'bookings.create'), (2, 'bookings.read'), (3, 'bookings.update'), (4, 'bookings.delete'),
  (5, 'rooms.create'), (6, 'rooms.read'), (7, 'rooms.update'), (8, 'rooms.delete'),
  (9, 'restaurant.create'), (10, 'restaurant.read'), (11, 'restaurant.update'), (12, 'restaurant.delete'),
  (13, 'housekeeping.read'), (14, 'housekeeping.update'),
  (15, 'reviews.read'), (16, 'reviews.approve'), (17, 'reviews.delete'),
  (18, 'users.manage'), (19, 'settings.manage'), (20, 'reports.read');

-- Super Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- Manager: most except user management
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE id NOT IN (18);

-- Staff: bookings and rooms read/update
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name IN ('bookings.create','bookings.read','bookings.update','rooms.read','housekeeping.read');

-- Housekeeping: housekeeping only
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions WHERE name IN ('housekeeping.read','housekeeping.update','rooms.read');

-- Default settings
INSERT INTO settings (key, value, description) VALUES
  ('hotel_name', 'D&M Travelers Inn', 'Hotel display name'),
  ('cancellation_policy', 'Free cancellation up to 24 hours before check-in.', 'Cancellation policy text'),
  ('deposit_percent', '30', 'Required deposit percentage'),
  ('currency', 'PHP', 'Currency code');

-- Room types seed
INSERT INTO room_types (id, name, description) VALUES
  (1, 'Standard Double', 'Comfortable double bed room'),
  (2, 'Deluxe', 'Spacious room with extra amenities'),
  (3, 'Family Room', 'Ideal for families');
