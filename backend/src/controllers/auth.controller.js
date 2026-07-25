import bcrypt from 'bcryptjs';
import { db } from '../config/db.js';
import {
  generateTokens,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from '../config/jwt.js';

// ─── Register ─────────────────────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: { email, password: hashedPassword, name },
      select: { id: true, email: true, name: true, created_at: true }
    });

    const tokens = generateTokens(user);
    setAuthCookies(res, tokens);

    return res.status(201).json({
      message: 'Account created successfully.',
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await db.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const tokens = generateTokens(user);
    setAuthCookies(res, tokens);

    return res.json({
      message: 'Logged in successfully.',
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logout = (req, res) => {
  clearAuthCookies(res);
  return res.json({ message: 'Logged out successfully.' });
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
export const refresh = async (req, res) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token.' });
    }

    const decoded = verifyRefreshToken(token);

    const user = await db.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, avatar: true }
    });

    if (!user) return res.status(401).json({ error: 'User not found.' });

    const tokens = generateTokens(user);
    setAuthCookies(res, tokens);

    return res.json({ message: 'Token refreshed.' });
  } catch (err) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
};

// ─── Get Current User ─────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, avatar: true, created_at: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user.' });
  }
};
