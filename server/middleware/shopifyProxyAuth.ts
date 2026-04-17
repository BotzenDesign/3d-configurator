/**
 * ============================================================================
 * Shopify App Proxy — HMAC Signature Verification Middleware
 * ============================================================================
 * When Shopify routes requests through an App Proxy (e.g. /apps/configurator/*),
 * it appends an HMAC signature query parameter. This middleware verifies that
 * the request genuinely originates from Shopify and hasn't been tampered with.
 *
 * Usage in Express:
 *   import { verifyShopifyProxy } from './middleware/shopifyProxyAuth';
 *   app.use('/apps/configurator', verifyShopifyProxy, proxyRouter);
 *
 * Required env var:
 *   SHOPIFY_API_SECRET — your app's shared secret from the Shopify Partner Dashboard
 * ============================================================================
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';

/**
 * Verify Shopify App Proxy HMAC signature.
 *
 * Shopify sends these query params on proxy requests:
 *   - shop, path_prefix, timestamp, signature
 * The `signature` is an HMAC-SHA256 hex digest of the remaining params.
 */
export function verifyShopifyProxy(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!SHOPIFY_API_SECRET) {
    console.warn(
      '[ShopifyProxy] SHOPIFY_API_SECRET is not set. Skipping HMAC verification in dev mode.'
    );
    next();
    return;
  }

  const query = { ...req.query } as Record<string, string>;
  const signature = query.signature;

  if (!signature) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Shopify proxy signature.',
    });
    return;
  }

  // Remove `signature` before computing the HMAC
  delete query.signature;

  // Sort remaining keys alphabetically and build the message
  const message = Object.keys(query)
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('');

  const computedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  if (
    !crypto.timingSafeEqual(
      Buffer.from(computedHmac, 'hex'),
      Buffer.from(signature, 'hex')
    )
  ) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid Shopify proxy signature.',
    });
    return;
  }

  // Attach verified shop info to request for downstream handlers
  (req as any).shopifyProxy = {
    shop: query.shop || '',
    pathPrefix: query.path_prefix || '',
    timestamp: query.timestamp || '',
  };

  next();
}

/**
 * Verify Shopify session token (JWT) from Authorization header.
 *
 * Session tokens are issued by Shopify App Bridge and sent as:
 *   Authorization: Bearer <session-token>
 *
 * The JWT payload contains:
 *   - iss: https://{shop}.myshopify.com/admin
 *   - dest: https://{shop}.myshopify.com
 *   - aud: Your app's API key
 *   - sub: The user ID
 *   - exp: Expiry timestamp
 */
export function verifySessionToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Allow unauthenticated requests in storefront context
    // (not all endpoints require auth — e.g. file validation)
    (req as any).shopifySession = null;
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    // Decode JWT without full verification for storefront context
    // For admin API calls, use shopify-app-express session verification instead
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed JWT');
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    // Basic expiry check
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Session token has expired.',
      });
      return;
    }

    // Attach session info to request
    (req as any).shopifySession = {
      shop: payload.dest
        ? new URL(payload.dest).hostname
        : '',
      userId: payload.sub || '',
      issuer: payload.iss || '',
      expiresAt: payload.exp || 0,
    };

    next();
  } catch (err: any) {
    console.error('[SessionToken] Verification failed:', err.message);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid session token.',
    });
  }
}
