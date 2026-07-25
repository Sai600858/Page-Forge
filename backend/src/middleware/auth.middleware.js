import { verifyAccessToken } from '../config/jwt.js';

/**
 * authMiddleware — verifies JWT from cookie or Authorization header.
 * Attaches decoded user payload to req.user.
 * Returns 401 if missing or invalid.
 */
export const authMiddleware = (req, res, next) => {
  try {
    // 1. Try HTTP-only cookie first
    let token = req.cookies?.access_token;

    // 2. Fallback: Authorization: Bearer <token>
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
};

/**
 * optionalAuth — same as authMiddleware but never blocks the request.
 * If valid token found, attaches req.user. Otherwise req.user = null.
 */
export const optionalAuth = (req, res, next) => {
  try {
    let token = req.cookies?.access_token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) token = authHeader.substring(7);
    }
    if (token) {
      req.user = verifyAccessToken(token);
    }
  } catch (_) {
    req.user = null;
  }
  next();
};
