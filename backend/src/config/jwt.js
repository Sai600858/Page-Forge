import jwt from 'jsonwebtoken';

const JWT_SECRET         = process.env.JWT_SECRET || 'pageforge_jwt_secret_dev';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'pageforge_refresh_secret_dev';
const ACCESS_EXPIRES     = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXPIRES    = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export const generateTokens = (user) => {
  const payload = { id: user.id, email: user.email, name: user.name };

  const accessToken  = jwt.sign(payload, JWT_SECRET,         { expiresIn: ACCESS_EXPIRES });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

  return { accessToken, refreshToken };
};

export const verifyAccessToken  = (token) => jwt.verify(token, JWT_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, JWT_REFRESH_SECRET);

// Attach both tokens as secure HTTP-only cookies
export const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge:   15 * 60 * 1000,          // 15 minutes
    path:     '/',
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
    path:     '/',
  });
};

export const clearAuthCookies = (res) => {
  res.clearCookie('access_token',  { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
};
