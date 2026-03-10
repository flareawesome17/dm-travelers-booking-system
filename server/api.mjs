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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    .eq('is_active', true)
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
  const base_price_per_night = Number(body.base_price_per_night);
  const rate_plans = Array.isArray(body.rate_plans) ? body.rate_plans : [];

  if (!room_number || !room_type || !Number.isFinite(base_price_per_night) || base_price_per_night <= 0) {
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

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      room_number,
      room_type,
      floor,
      capacity,
      base_price_per_night,
      status: 'Available',
      amenities,
      image_urls,
      rate_plans,
    })
    .select()
    .single();

  if (error) {
    send(res, req, 500, { error: error.message || 'Failed to create room' });
    return;
  }

  send(res, req, 201, data);
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

  if (url === '/api/rooms' && req.method === 'GET') {
    await handleGetRooms(req, res);
    return;
  }

  if (url === '/api/rooms' && req.method === 'POST') {
    await handleCreateRoom(req, res);
    return;
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
