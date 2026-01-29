/**
 * Rate limiting middleware
 * Protects endpoints from abuse using a sliding window algorithm
 *
 * Note: In production with multiple workers, use Cloudflare KV or Durable Objects
 * for distributed rate limiting. This in-memory implementation works for single instances.
 */

import { createMiddleware } from 'hono/factory';
import { RateLimitError } from '../errors';
import { AUTH } from '../constants';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
// In production, replace with KV or Durable Objects
const rateLimitStore = new Map<string, RateLimitEntry>();

// Track last cleanup time
let lastCleanup = 0;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Cleanup old entries (called during request handling)
function cleanupStoreIfNeeded(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (c: { req: { header: (name: string) => string | undefined } }) => string;
  skip?: (c: { req: { path: string } }) => boolean;
}

/**
 * Creates a rate limiting middleware
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyGenerator = (c) => c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
    skip,
  } = options;

  return createMiddleware(async (c, next) => {
    // Allow skipping for certain requests
    if (skip?.(c)) {
      return next();
    }

    // Cleanup old entries periodically during request handling
    cleanupStoreIfNeeded();

    const key = keyGenerator(c);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new window
      entry = {
        count: 1,
        resetAt: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    } else {
      // Increment count in current window
      entry.count++;
    }

    // Set rate limit headers
    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      c.header('Retry-After', String(resetSeconds));
      throw new RateLimitError(resetSeconds);
    }

    return next();
  });
}

/**
 * Pre-configured rate limiter for auth endpoints
 * More restrictive to prevent brute force attacks
 */
export const authRateLimiter = rateLimit({
  windowMs: AUTH.RATE_LIMIT.AUTH_WINDOW_MS,
  max: AUTH.RATE_LIMIT.AUTH_MAX_REQUESTS,
  keyGenerator: (c) => {
    // Include IP for stricter limiting
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    return `auth:${ip}`;
  },
});

/**
 * Pre-configured rate limiter for general API endpoints
 */
export const generalRateLimiter = rateLimit({
  windowMs: AUTH.RATE_LIMIT.GENERAL_WINDOW_MS,
  max: AUTH.RATE_LIMIT.GENERAL_MAX_REQUESTS,
});
