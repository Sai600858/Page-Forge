import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getHistory,
  deleteHistoryEntry,
  clearHistory,
} from '../controllers/history.controller.js';

const router = express.Router();

// All history routes require authentication
router.use(authMiddleware);

router.get('/',       getHistory);
router.delete('/',    clearHistory);
router.delete('/:id', deleteHistoryEntry);

export default router;
