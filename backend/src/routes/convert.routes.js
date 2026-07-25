/**
 * @file convert.routes.js
 * @description Express Router configuration for file format conversions: DOCX to PDF or PDF to DOCX.
 */

import express from 'express';
import upload from '../middleware/upload.middleware.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { handleWordToPdf, handlePdfToWord } from '../controllers/convert.controller.js';

const router = express.Router();

/**
 * Route: POST /api/convert/word-to-pdf
 * Description: Converts a Word document (.docx) to a PDF file using Microsoft Word COM automation.
 * Payload: Multipart form-data containing a '.docx' file under the 'file' field.
 */
router.post('/word-to-pdf', optionalAuth, upload.single('file'), handleWordToPdf);

/**
 * Route: POST /api/convert/pdf-to-word
 * Description: Extracts texts from a PDF file and packages it into a standard MS Word document (.docx).
 * Payload: Multipart form-data containing a '.pdf' file under the 'file' field.
 */
router.post('/pdf-to-word', optionalAuth, upload.single('file'), handlePdfToWord);

export default router;
