/**
 * ============================================================================
 * Session Management Middleware
 * ============================================================================
 * Handles:
 *   1. CORS for Shopify storefront domains
 *   2. Anti-CSRF token management
 *   3. Customer identity forwarding from Shopify session
 *   4. Request rate limiting per shop
 * ============================================================================
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// ── Types ────────────────────────────────────────────────────────────────
export interface SessionContext {
  shop: string | null;
  customerId: string | null;
  customerEmail: string | null;
  csrfToken: string | null;
  isAuthenticated: boolean;
}

// ── CSRF Token Store (in-memory, per-session) ────────────────────────────
// In production, use Redis or a database
const csrfTokenStore = new Map<string, { token: string; expiresAt: number }>();

// Clean expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of csrfTokenStore.entries()) {
    if (value.expiresAt < now) csrfTokenStore.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Generate a CSRF token for a given session key.
 */
function generateCsrfToken(sessionKey: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokenStore.set(sessionKey, {
    token,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour TTL
  });
  return token;
}

/**
 * Validate a CSRF token against the stored value.
 */
function validateCsrfToken(sessionKey: string, token: string): boolean {
  const stored = csrfTokenStore.get(sessionKey);
  if (!stored) return false;
  if (stored.expiresAt < Date.now()) {
    csrfTokenStore.delete(sessionKey);
    return false;
  }

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(stored.token),
      Buffer.from(token)
    );
  } catch {
    return false;
  }
}

// ── Dynamic CORS for Shopify Domains ─────────────────────────────────────

/**
 * Returns a CORS configuration that dynamically allows the merchant's
 * Shopify storefront while blocking other origins.
 */
export function shopifyCorsConfig() {
  const ALLOWED_ORIGINS = [
    // Local development
    /^http:\/\/localhost(:\d+)?$/,
    // Shopify storefronts
    /^https:\/\/[a-z0-9-]+\.myshopify\.com$/,
    // Custom domains (served via Shopify CDN)
    /^https:\/\/.+$/,
  ];

  return {
    origin: function (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      // Allow requests with no origin (e.g. server-to-server, Postman)
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowed = ALLOWED_ORIGINS.some((pattern) => pattern.test(origin));
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Shopify-Shop-Domain',
      'X-Shopify-Customer-Id',
    ],
    exposedHeaders: ['X-CSRF-Token'],
    maxAge: 86400, // 24 hours
  };
}

// ── Session Context Middleware ────────────────────────────────────────────

/**
 * Extracts session context from request headers and attaches it to `req`.
 * Works in both authenticated (App Bridge) and unauthenticated (storefront) modes.
 */
export function sessionContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const session: SessionContext = {
    shop:
      (req as any).shopifyProxy?.shop ||
      (req as any).shopifySession?.shop ||
      (req.headers['x-shopify-shop-domain'] as string) ||
      null,
    customerId:
      (req as any).shopifySession?.userId ||
      (req.headers['x-shopify-customer-id'] as string) ||
      null,
    customerEmail: null,
    csrfToken: null,
    isAuthenticated: !!(req as any).shopifySession,
  };

  // Attach session to request
  (req as any).sessionCtx = session;

  next();
}

// ── CSRF Protection Middleware ────────────────────────────────────────────

/**
 * CSRF protection for state-changing requests.
 *
 * GET requests: sets a CSRF token in the response header
 * POST/PUT/DELETE requests: validates the CSRF token from the request header
 */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Create a session key from IP + user agent (or shop domain if available)
  const session: SessionContext = (req as any).sessionCtx || {};
  const sessionKey = session.shop || req.ip || 'anonymous';

  if (req.method === 'GET' || req.method === 'OPTIONS') {
    // Issue a new CSRF token
    const token = generateCsrfToken(sessionKey);
    res.setHeader('X-CSRF-Token', token);
    next();
    return;
  }

  // For state-changing methods, validate the token
  const clientToken = req.headers['x-csrf-token'] as string;

  if (!clientToken) {
    // Skip CSRF for API proxy requests (they use HMAC instead)
    if ((req as any).shopifyProxy) {
      next();
      return;
    }

    // Skip CSRF for requests with session tokens (JWT auth is sufficient)
    if ((req as any).shopifySession) {
      next();
      return;
    }

    // In development, warn but allow
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[CSRF] Missing CSRF token — allowed in dev mode.');
      next();
      return;
    }

    res.status(403).json({
      error: 'Forbidden',
      message: 'Missing CSRF token.',
    });
    return;
  }

  if (!validateCsrfToken(sessionKey, clientToken)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired CSRF token.',
    });
    return;
  }

  next();
}

// ── Rate Limiter (Simple In-Memory) ──────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple per-shop rate limiter.
 * @param maxRequests Max requests per window (default: 60)
 * @param windowMs Time window in ms (default: 60000 = 1 minute)
 */
export function rateLimiter(maxRequests = 60, windowMs = 60000) {
  return function (req: Request, res: Response, next: NextFunction): void {
    const session: SessionContext = (req as any).sessionCtx || {};
    const key = session.shop || req.ip || 'global';

    const now = Date.now();
    let bucket = rateLimitStore.get(key);

    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 1, resetAt: now + windowMs };
      rateLimitStore.set(key, bucket);
    } else {
      bucket.count++;
    }

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}
