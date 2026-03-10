#!/usr/bin/env node
/**
 * API server — all backend/API calls use this (port 5471).
 * Run: npm run api
 * Frontend (port 4242) must set VITE_API_URL=http://localhost:5471
 */
import { createServer } from 'http';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key) process.env[key] = value;
    }
  } catch (_) {}
}

const root = join(__dirname, '..');
loadEnvFile(join(root, '.env'));
loadEnvFile(join(root, '.env.local'));

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const PORT = Number(process.env.API_PORT) || 5471;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Simple in-memory login rate limit
const loginLimit = new Map();
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

function checkLoginRateLimit(ip) {
  const now = Date.now();
  let entry = loginLimit.get(ip);
  if (!entry) {
    loginLimit.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { allowed: true };
  }
  if (now > entry.resetAt) {
    entry = { count: 1, resetAt: now + LOGIN_WINDOW_MS };
    loginLimit.set(ip, entry);
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > LOGIN_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

async function signToken(payload) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

async function getAdminFromRequest(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    if (!payload || typeof payload.sub !== 'string') return null;
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role_id: payload.role_id,
    };
  } catch {
    return null;
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

function getCorsHeaders(req) {
  const origin = req.headers.origin;
  const allowOrigin =
    origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))
      ? origin
      : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function send(res, req, status, data, headers = {}) {
  const cors = getCorsHeaders(req);
  res.writeHead(status, { 'Content-Type': 'application/json', ...cors, ...headers });
  res.end(JSON.stringify(data));
}

async function handleAdminLogin(req, res) {
  if (req.method !== 'POST') {
    send(res, req, 405, { error: 'Method not allowed' });
    return;
  }

  const ip = getClientIp(req);
  const limit = checkLoginRateLimit(ip);
  if (!limit.allowed) {
    const h = limit.retryAfter ? { 'Retry-After': String(limit.retryAfter) } : {};
    send(res, req, 429, { error: 'Too many login attempts' }, h);
    return;
  }

  const body = await parseBody(req);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    send(res, req, 400, { error: 'Invalid email or password' });
    return;
  }

  const { data: user, error: fetchError } = await supabase
    .from('admin_users')
    .select('id, email, password_hash, role_id, is_active')
    .eq('email', email)
    .single();

  if (fetchError || !user || !user.is_active) {
    send(res, req, 401, { error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    send(res, req, 401, { error: 'Invalid credentials' });
    return;
  }

  const token = await signToken({
    sub: user.id,
    email: user.email,
    role_id: user.role_id,
  });

  send(res, req, 200, {
    token,
    user: { id: user.id, email: user.email, role_id: user.role_id },
  });
}

async function handleGetRooms(req, res) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    send(res, req, 401, { error: 'Unauthorized' });
    return;
  }

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('room_number');

  if (error) {
    send(res, req, 500, { error: error.message || 'Failed to fetch rooms' });
    return;
  }

  send(res, req, 200, data || []);
}

async function handleCreateRoom(req, res) {
  if (req.method !== 'POST') {
    send(res, req, 405, { error: 'Method not allowed' });
    return;
  }

  const admin = await getAdminFromRequest(req);
  if (!admin) {
    send(res, req, 401, { error: 'Unauthorized' });
    return;
  }

  const body = await parseBody(req);
  const room_number = typeof body.room_number === 'string' ? body.room_number.trim() : '';
  const room_type = typeof body.room_type === 'string' ? body.room_type.trim() : '';
  const rate_plans = Array.isArray(body.rate_plans) ? body.rate_plans : [];

  if (!room_number || !room_type) {
    send(res, req, 400, { error: 'Invalid room payload' });
    return;
  }

  const capacity =
    typeof body.capacity === 'number' && Number.isInteger(body.capacity) && body.capacity > 0
      ? body.capacity
      : 2;
  const floor =
    typeof body.floor === 'number' && Number.isInteger(body.floor)
      ? body.floor
      : null;
  const amenities = Array.isArray(body.amenities)
    ? body.amenities.filter((a) => typeof a === 'string')
    : [];
  const image_urls = Array.isArray(body.image_urls)
    ? body.image_urls.filter((u) => typeof u === 'string')
    : [];

  // Derive explicit hour-based rate columns from rate_plans JSON payload.
  const findPlan = (kind) =>
    Array.isArray(rate_plans) ? rate_plans.find((p) => p && typeof p === 'object' && p.kind === kind) : undefined;

  const plan24 = findPlan('24h');
  const plan12 = findPlan('12h');
  const plan5 = findPlan('5h');
  const plan3 = findPlan('3h');

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      room_number,
      room_type,
      floor,
      capacity,
      status: 'Available',
      amenities,
      image_urls,
      rate_plans,
      // 24h rate
      rate_24h_enabled: plan24 ? (typeof plan24.enabled === 'boolean' ? plan24.enabled : true) : false,
      rate_24h_price: plan24 && plan24.base_price != null ? Number(plan24.base_price) : null,
      rate_24h_early_checkin_fee:
        plan24 && plan24.early_checkin_fee != null ? Number(plan24.early_checkin_fee) : null,
      rate_24h_late_checkout_fee:
        plan24 && plan24.late_checkout_fee != null ? Number(plan24.late_checkout_fee) : null,
      // 12h rate
      rate_12h_enabled: plan12 ? (typeof plan12.enabled === 'boolean' ? plan12.enabled : true) : false,
      rate_12h_price: plan12 && plan12.base_price != null ? Number(plan12.base_price) : null,
      rate_12h_late_checkout_fee:
        plan12 && plan12.late_checkout_fee != null ? Number(plan12.late_checkout_fee) : null,
      // 5h rate
      rate_5h_enabled: plan5 ? (typeof plan5.enabled === 'boolean' ? plan5.enabled : true) : false,
      rate_5h_price: plan5 && plan5.base_price != null ? Number(plan5.base_price) : null,
      rate_5h_late_checkout_fee:
        plan5 && plan5.late_checkout_fee != null ? Number(plan5.late_checkout_fee) : null,
      // 3h rate
      rate_3h_enabled: plan3 ? (typeof plan3.enabled === 'boolean' ? plan3.enabled : true) : false,
      rate_3h_price: plan3 && plan3.base_price != null ? Number(plan3.base_price) : null,
      rate_3h_late_checkout_fee:
        plan3 && plan3.late_checkout_fee != null ? Number(plan3.late_checkout_fee) : null,
    })
    .select()
    .single();

  if (error) {
    send(res, req, 500, { error: error.message || 'Failed to create room' });
    return;
  }

  send(res, req, 201, data);
}

async function handleUpdateRoom(req, res, id) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    send(res, req, 401, { error: 'Unauthorized' });
    return;
  }

  const body = await parseBody(req);
  const update = {};

  if (typeof body.room_number === 'string') update.room_number = body.room_number.trim();
  if (typeof body.room_type === 'string') update.room_type = body.room_type.trim();
  if (typeof body.floor === 'number') update.floor = body.floor;
  if (typeof body.capacity === 'number') update.capacity = body.capacity;
  if (Array.isArray(body.amenities))
    update.amenities = body.amenities.filter((a) => typeof a === 'string');
  if (Array.isArray(body.image_urls))
    update.image_urls = body.image_urls.filter((u) => typeof u === 'string');
  if (Array.isArray(body.rate_plans)) {
    update.rate_plans = body.rate_plans;

    const findPlan = (kind) =>
      body.rate_plans.find((p) => p && typeof p === 'object' && p.kind === kind);

    const plan24 = findPlan('24h');
    const plan12 = findPlan('12h');
    const plan5 = findPlan('5h');
    const plan3 = findPlan('3h');

    // 24h rate
    update.rate_24h_enabled = plan24 ? (typeof plan24.enabled === 'boolean' ? plan24.enabled : true) : false;
    update.rate_24h_price = plan24 && plan24.base_price != null ? Number(plan24.base_price) : null;
    update.rate_24h_early_checkin_fee =
      plan24 && plan24.early_checkin_fee != null ? Number(plan24.early_checkin_fee) : null;
    update.rate_24h_late_checkout_fee =
      plan24 && plan24.late_checkout_fee != null ? Number(plan24.late_checkout_fee) : null;

    // 12h rate
    update.rate_12h_enabled = plan12 ? (typeof plan12.enabled === 'boolean' ? plan12.enabled : false) : false;
    update.rate_12h_price = plan12 && plan12.base_price != null ? Number(plan12.base_price) : null;
    update.rate_12h_late_checkout_fee =
      plan12 && plan12.late_checkout_fee != null ? Number(plan12.late_checkout_fee) : null;

    // 5h rate
    update.rate_5h_enabled = plan5 ? (typeof plan5.enabled === 'boolean' ? plan5.enabled : false) : false;
    update.rate_5h_price = plan5 && plan5.base_price != null ? Number(plan5.base_price) : null;
    update.rate_5h_late_checkout_fee =
      plan5 && plan5.late_checkout_fee != null ? Number(plan5.late_checkout_fee) : null;

    // 3h rate
    update.rate_3h_enabled = plan3 ? (typeof plan3.enabled === 'boolean' ? plan3.enabled : false) : false;
    update.rate_3h_price = plan3 && plan3.base_price != null ? Number(plan3.base_price) : null;
    update.rate_3h_late_checkout_fee =
      plan3 && plan3.late_checkout_fee != null ? Number(plan3.late_checkout_fee) : null;
  }

  if (Object.keys(update).length === 0) {
    send(res, req, 400, { error: 'No valid fields to update' });
    return;
  }

  const { data, error } = await supabase
    .from('rooms')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    send(res, req, 500, { error: error.message || 'Failed to update room' });
    return;
  }

  send(res, req, 200, data);
}

async function handleDeleteRoom(req, res, id) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    send(res, req, 401, { error: 'Unauthorized' });
    return;
  }

  // Prevent deleting rooms that have any bookings to preserve history integrity
  const { data: bookingRef, error: bookingError } = await supabase
    .from('bookings')
    .select('id')
    .eq('room_id', id)
    .limit(1)
    .maybeSingle();

  if (bookingError) {
    send(res, req, 500, { error: bookingError.message || 'Failed to check room bookings' });
    return;
  }

  if (bookingRef) {
    send(res, req, 400, {
      error: 'Cannot delete this room because it has existing bookings. Archive or change status instead.',
    });
    return;
  }

  const { error } = await supabase.from('rooms').delete().eq('id', id);

  if (error) {
    send(res, req, 500, { error: error.message || 'Failed to delete room' });
    return;
  }

  send(res, req, 200, { success: true });
}

async function handleGetBookings(req, res) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    send(res, req, 401, { error: 'Unauthorized' });
    return;
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('*, guests(*), rooms(room_number)')
    .order('created_at', { ascending: false });

  if (error) {
    send(res, req, 500, { error: error.message || 'Failed to fetch bookings' });
    return;
  }

  send(res, req, 200, data || []);
}

function generateReferenceNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DM-${ts}-${rnd}`;
}

async function handleCreateBooking(req, res) {
  if (req.method !== 'POST') {
    send(res, req, 405, { error: 'Method not allowed' });
    return;
  }

  const admin = await getAdminFromRequest(req);
  if (!admin) {
    send(res, req, 401, { error: 'Unauthorized' });
    return;
  }

  const body = await parseBody(req);
  const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const phone_number = typeof body.phone_number === 'string' ? body.phone_number.trim() : null;
  const room_id = typeof body.room_id === 'string' ? body.room_id.trim() : '';
  const check_in_date = typeof body.check_in_date === 'string' ? body.check_in_date.trim() : '';
  const check_out_date = typeof body.check_out_date === 'string' ? body.check_out_date.trim() : '';
  const rate_plan_kind = typeof body.rate_plan_kind === 'string' ? body.rate_plan_kind.trim() : '24h';
  const num_adults = typeof body.num_adults === 'number' ? body.num_adults : 1;
  const num_children = typeof body.num_children === 'number' ? body.num_children : 0;
  const special_requests = typeof body.special_requests === 'string' ? body.special_requests.trim() : null;
  const deposit_paid = Number(body.deposit_paid);
  const assignRoom = body.assign_room !== false;

  if (!full_name || !email || !room_id || !check_in_date || !check_out_date) {
    send(res, req, 400, { error: 'Missing required fields: full_name, email, room_id, check_in_date, check_out_date' });
    return;
  }

  const validRates = ['24h', '12h', '5h', '3h'];
  if (!validRates.includes(rate_plan_kind)) {
    send(res, req, 400, { error: 'Invalid rate_plan_kind. Must be 24h, 12h, 5h, or 3h' });
    return;
  }

  const checkIn = new Date(check_in_date);
  const checkOut = new Date(check_out_date);
  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    send(res, req, 400, { error: 'Invalid dates. Check-out must be after check-in.' });
    return;
  }

  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', room_id)
    .single();

  if (roomErr || !room) {
    send(res, req, 400, { error: 'Room not found' });
    return;
  }

  const hoursDiff = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000));

  let unitPrice = 0;
  let blocks = 1;
  const rateEnabled = room[`rate_${rate_plan_kind}_enabled`];
  const ratePrice = room[`rate_${rate_plan_kind}_price`];

  if (!rateEnabled || ratePrice == null || Number(ratePrice) <= 0) {
    send(res, req, 400, {
      error: `Room does not have ${rate_plan_kind} rate enabled or price is not set.`,
    });
    return;
  }

  unitPrice = Number(ratePrice);
  if (rate_plan_kind === '24h') {
    blocks = Math.max(1, nights);
  } else if (rate_plan_kind === '12h') {
    blocks = Math.max(1, Math.ceil(hoursDiff / 12));
  } else if (rate_plan_kind === '5h') {
    blocks = Math.max(1, Math.ceil(hoursDiff / 5));
  } else if (rate_plan_kind === '3h') {
    blocks = Math.max(1, Math.ceil(hoursDiff / 3));
  }

  const total_amount = unitPrice * blocks;
  const deposit = Number.isFinite(deposit_paid) && deposit_paid >= 0 ? deposit_paid : 0;
  const balance_due = Math.max(0, total_amount - deposit);

  const { data: guest, error: guestErr } = await supabase
    .from('guests')
    .insert({ full_name, email, phone_number: phone_number || null })
    .select('id')
    .single();

  if (guestErr || !guest) {
    send(res, req, 500, { error: guestErr?.message || 'Failed to create guest' });
    return;
  }

  let ref = generateReferenceNumber();
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('reference_number', ref)
      .maybeSingle();
    if (!existing) break;
    ref = generateReferenceNumber();
  }

  const insertPayload = {
    reference_number: ref,
    guest_id: guest.id,
    room_id: assignRoom ? room_id : null,
    room_type_requested: room.room_type || '',
    check_in_date,
    check_out_date,
    num_adults: Math.max(1, num_adults),
    num_children: Math.max(0, num_children),
    total_amount,
    deposit_paid: deposit,
    balance_due,
    status: 'Confirmed',
    special_requests,
    rate_plan_kind,
  };

  const { data: booking, error: bookErr } = await supabase
    .from('bookings')
    .insert(insertPayload)
    .select('*, guests(*), rooms(room_number, room_type)')
    .single();

  if (bookErr) {
    send(res, req, 500, { error: bookErr.message || 'Failed to create booking' });
    return;
  }

  send(res, req, 201, booking);
}

async function handleGetHousekeepingRooms(req, res) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    send(res, req, 401, { error: 'Unauthorized' });
    return;
  }

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .in('status', ['Dirty', 'In Cleaning', 'Maintenance', 'Clean'])
    .order('status')
    .order('room_number');

  if (error) {
    send(res, req, 500, { error: error.message || 'Failed to fetch housekeeping rooms' });
    return;
  }

  send(res, req, 200, data || []);
}

async function handleGetMenu(_req, res) {
  const { data, error } = await supabase
    .from('restaurant_menu')
    .select('*')
    .eq('is_available', true)
    .order('category')
    .order('name');

  if (error) {
    send(res, _req, 500, { error: error.message || 'Failed to fetch menu' });
    return;
  }

  send(res, _req, 200, data || []);
}

async function handleGetRevenue(req, res) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    send(res, req, 401, { error: 'Unauthorized' });
    return;
  }

  const fullUrl = new URL(req.url || '/api/reports/revenue', 'http://localhost');
  const searchParams = fullUrl.searchParams;
  const start = searchParams.get('start') || new Date().toISOString().slice(0, 7) + '-01';
  const end = searchParams.get('end') || new Date().toISOString().slice(0, 10);
  const format = searchParams.get('format');

  const { data: payments, error } = await supabase
    .from('payments')
    .select('amount, method, type, transaction_time, booking_id')
    .eq('status', 'Success')
    .gte('transaction_time', start)
    .lte('transaction_time', `${end}T23:59:59.999Z`);

  if (error) {
    send(res, req, 500, { error: error.message || 'Failed to fetch revenue' });
    return;
  }

  const byMethod = {};
  let total = 0;
  for (const p of payments || []) {
    const amt = Number(p.amount);
    if (!Number.isFinite(amt)) continue;
    total += amt;
    const method = p.method || 'unknown';
    byMethod[method] = (byMethod[method] || 0) + amt;
  }

  const summary = { total, by_method: byMethod, start, end };

  if (format === 'csv') {
    const header = 'Date,Method,Type,Amount\n';
    const rows = (payments || [])
      .map(
        (p) =>
          `${String(p.transaction_time).slice(0, 10)},${p.method || ''},${p.type || ''},${p.amount ?? ''}`,
      )
      .join('\n');
    const csv = header + rows;
    const cors = getCorsHeaders(req);
    res.writeHead(200, {
      ...cors,
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="revenue-${start}-${end}.csv"`,
    });
    res.end(csv);
    return;
  }

  send(res, req, 200, summary);
}

async function handleGetAdminUsers(req, res) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    send(res, req, 401, { error: 'Unauthorized' });
    return;
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, role_id, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    send(res, req, 500, { error: error.message || 'Failed to fetch admin users' });
    return;
  }

  send(res, req, 200, data || []);
}

async function handleGetSettings(req, res) {
  const { data, error } = await supabase.from('settings').select('key, value, description');
  if (error) {
    send(res, req, 500, { error: error.message || 'Failed to fetch settings' });
    return;
  }
  const map = {};
  for (const row of data || []) {
    map[row.key] = row.value;
  }
  send(res, req, 200, map);
}

async function handleUploadRoomImages(req, res) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    send(res, req, 401, { error: 'Unauthorized' });
    return;
  }

  const body = await parseBody(req);
  const files = Array.isArray(body?.files) ? body.files : [];

  if (!files.length) {
    send(res, req, 400, { error: 'No files provided' });
    return;
  }

  const urls = [];

  for (const file of files) {
    if (!file || typeof file.name !== 'string' || typeof file.data !== 'string') continue;
    const type = typeof file.type === 'string' && file.type ? file.type : 'image/jpeg';

    try {
      let base64 = file.data;
      const idx = base64.indexOf('base64,');
      if (idx !== -1) {
        base64 = base64.slice(idx + 'base64,'.length);
      }
      const buffer = Buffer.from(base64, 'base64');
      const path = `rooms/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;

      const { error } = await supabase.storage.from('room-images').upload(path, buffer, {
        contentType: type,
      });

      if (error) {
        console.error('Failed to upload image', error.message);
        continue;
      }

      const { data: publicData } = supabase.storage.from('room-images').getPublicUrl(path);
      if (publicData?.publicUrl) {
        urls.push(publicData.publicUrl);
      }
    } catch (e) {
      console.error('Error processing image upload', e);
    }
  }

  if (!urls.length) {
    send(res, req, 500, { error: 'Failed to upload images' });
    return;
  }

  send(res, req, 200, { urls });
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    const cors = getCorsHeaders(req);
    res.writeHead(204, { ...cors, 'Content-Length': '0' });
    res.end();
    return;
  }

  const url = req.url ? req.url.split('?')[0] : '/';
  if (url === '/api/admin/login') {
    await handleAdminLogin(req, res);
    return;
  }

  if (url === '/api/bookings' && req.method === 'GET') {
    await handleGetBookings(req, res);
    return;
  }

  if (url === '/api/bookings' && req.method === 'POST') {
    await handleCreateBooking(req, res);
    return;
  }

  if (url === '/api/rooms' && req.method === 'GET') {
    await handleGetRooms(req, res);
    return;
  }

  if (url === '/api/rooms' && req.method === 'POST') {
    await handleCreateRoom(req, res);
    return;
  }

  if (url.startsWith('/api/rooms/') && req.method === 'PATCH') {
    const parts = url.split('/');
    const id = parts[3];
    if (id) {
      await handleUpdateRoom(req, res, id);
      return;
    }
  }

  if (url.startsWith('/api/rooms/') && req.method === 'DELETE') {
    const parts = url.split('/');
    const id = parts[3];
    if (id) {
      await handleDeleteRoom(req, res, id);
      return;
    }
  }

  if (url === '/api/housekeeping/rooms' && req.method === 'GET') {
    await handleGetHousekeepingRooms(req, res);
    return;
  }

  if (url === '/api/menu' && req.method === 'GET') {
    await handleGetMenu(req, res);
    return;
  }

  if (url === '/api/reports/revenue' && req.method === 'GET') {
    await handleGetRevenue(req, res);
    return;
  }

  if (url === '/api/admin/users' && req.method === 'GET') {
    await handleGetAdminUsers(req, res);
    return;
  }

  if (url === '/api/settings' && req.method === 'GET') {
    await handleGetSettings(req, res);
    return;
  }

  if (url === '/api/rooms/upload-image' && req.method === 'POST') {
    await handleUploadRoomImages(req, res);
    return;
  }

  send(res, req, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Server (API) → http://localhost:${PORT}`);
  console.log(`Frontend should use VITE_API_URL=http://localhost:${PORT}`);
});
