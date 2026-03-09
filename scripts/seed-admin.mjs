#!/usr/bin/env node
/**
 * One-time seed: create first admin user.
 * Usage: node scripts/seed-admin.mjs
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env or .env.local.
 * Prompts for email and password if not set via ADMIN_EMAIL / ADMIN_PASSWORD.
 */
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

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

function loadEnv() {
  const root = join(__dirname, '..');
  loadEnvFile(join(root, '.env'));
  loadEnvFile(join(root, '.env.local'));
}

loadEnv();

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  const missing = [];
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL or VITE_SUPABASE_URL');
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  console.error('Missing in .env or .env.local:', missing.join(', '));
  console.error('Get them from Supabase: Project Settings → API (URL + service_role key).');
  process.exit(1);
}

async function main() {
  let email = process.env.ADMIN_EMAIL?.trim();
  let password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log('Create first admin user (leave blank to use env vars if set).\n');
    if (!email) email = (await ask(rl, 'Admin email: '))?.trim() || process.env.ADMIN_EMAIL?.trim();
    if (!password) {
      password = await ask(rl, 'Admin password: ');
      if (!password?.trim()) password = process.env.ADMIN_PASSWORD;
    }
    rl.close();
  }

  if (!email || !password) {
    console.error('Email and password are required. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env or enter them when prompted.');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('admin_users')
    .insert({ email, password_hash, role_id: 1 })
    .select('id, email, role_id')
    .single();

  if (error) {
    if (error.code === '23505') {
      console.log('Admin user already exists with this email.');
      return;
    }
    console.error(error);
    process.exit(1);
  }
  console.log('Admin user created:', data.email, 'role_id:', data.role_id);
}

main();
