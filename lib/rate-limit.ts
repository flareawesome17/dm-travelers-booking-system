// In-memory rate limit (use Redis in production for multi-instance)
const store = new Map<string, { count: number; resetAt: number }>();

const BOOKING_LIMIT = 5;
const BOOKING_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 min

function getKey(prefix: string, ip: string) {
  return `${prefix}:${ip}`;
}

function slidingWindow(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

export function checkBookingRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  return slidingWindow(getKey('booking', ip), BOOKING_LIMIT, BOOKING_WINDOW_MS);
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  return slidingWindow(getKey('login', ip), LOGIN_LIMIT, LOGIN_WINDOW_MS);
}
