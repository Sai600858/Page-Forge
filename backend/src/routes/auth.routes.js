import express from 'express';
import { register, login, logout, refresh, getMe } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login',    login);
router.post('/logout',   logout);
router.post('/refresh',  refresh);
router.get('/me',        authMiddleware, getMe);

export default router;
