import express from 'express';
import upload from '../middleware/upload.middleware.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  summarizePdf,
  uploadAndEmbedPdf,
  chatWithPdf,
  getSessions,
  getSessionById,
  deleteSession
} from '../controllers/ai.controller.js';

const router = express.Router();

// Summarize routes
router.post('/summarize', authMiddleware, upload.single('file'), summarizePdf);

// RAG Chat routes
router.post('/chat/upload', authMiddleware, upload.single('file'), uploadAndEmbedPdf);
router.post('/chat/message', authMiddleware, chatWithPdf);
router.get('/chat/sessions', authMiddleware, getSessions);
router.get('/chat/sessions/:id', authMiddleware, getSessionById);
router.delete('/chat/sessions/:id', authMiddleware, deleteSession);

export default router;
