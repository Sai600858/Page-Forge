import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import pdfRoutes     from './routes/pdf.routes.js';
import convertRoutes from './routes/convert.routes.js';
import secureRoutes  from './routes/secure.routes.js';
import authRoutes    from './routes/auth.routes.js';
import historyRoutes from './routes/history.routes.js';
import aiRoutes      from './routes/ai.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`), false);
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition', 'content-disposition', 'Content-Type', 'content-type'],
}));

// ─── Middlewares ──────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Page Forge API is healthy.', version: 'v2' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/pdf',     pdfRoutes);
app.use('/api/convert', convertRoutes);
app.use('/api/secure',  secureRoutes);
app.use('/api/ai',      aiRoutes);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled Global Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected error occurred on the server.',
  });
});

export default app;
