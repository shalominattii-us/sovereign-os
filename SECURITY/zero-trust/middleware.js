/**
 * AEGENTIS CORPORATION - Zero Trust Security Middleware
 * Every request must be verified. No implicit trust. Never trust, always verify.
 */

const crypto = require('crypto');

const SOVEREIGN_JWT_SECRET = process.env.SOVEREIGN_JWT_SECRET || 'aegentix-genesis';

/**
 * Decode a JWT token without verifying (for inspection only).
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch (_) {
    return null;
  }
}

/**
 * Verify HMAC-SHA256 JWT signature.
 */
function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const signingInput = `${parts[0]}.${parts[1]}`;
    const expectedSig = crypto
      .createHmac('sha256', SOVEREIGN_JWT_SECRET)
      .update(signingInput)
      .digest('base64url');
    if (expectedSig !== parts[2]) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

/**
 * Express middleware: enforce zero-trust on all requests.
 */
function zeroTrust(req, res, next) {
  // Allow health checks without auth
  if (req.path === '/health' || req.path === '/') return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Bearer token required' });
  }

  const token = authHeader.slice(7);
  const payload = verifyJWT(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }

  req.sovereign = payload;
  next();
}

/**
 * Rate limiter: per-IP request tracking.
 */
const rateLimitStore = new Map();
function rateLimit(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const entry = rateLimitStore.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count++;
    rateLimitStore.set(ip, entry);
    if (entry.count > maxRequests) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }
    next();
  };
}

module.exports = { zeroTrust, rateLimit, verifyJWT, decodeJWT };
