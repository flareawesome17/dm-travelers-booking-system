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

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    const cors = getCorsHeaders(req);
    res.writeHead(204, { ...cors, 'Content-Length': '0' });
    res.end();
    return;
  }

  const url = req.url || '/';
  if (url === '/api/admin/login') {
    await handleAdminLogin(req, res);
    return;
  }

  send(res, req, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Server (API) → http://localhost:${PORT}`);
  console.log(`Frontend should use VITE_API_URL=http://localhost:${PORT}`);
});
