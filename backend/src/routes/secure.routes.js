/**
 * @file secure.routes.js
 * @description Express Router configuration for PDF security actions: encrypting with user passwords, or decrypting password-protected documents.
 */

import express from 'express';
import upload from '../middleware/upload.middleware.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { handleProtect, handleUnlock } from '../controllers/secure.controller.js';

const router = express.Router();

/**
 * Route: POST /api/secure/protect
 * Description: Encrypts a PDF file with a owner/user password.
 * Payload: Multipart form-data with 'file' and 'password' body parameters.
 */
router.post('/protect', optionalAuth, upload.single('file'), handleProtect);

/**
 * Route: POST /api/secure/unlock
 * Description: Decrypts/removes password protection from a PDF file.
 * Payload: Multipart form-data with 'file' and the current known 'password'.
 */
router.post('/unlock', optionalAuth, upload.single('file'), handleUnlock);

export default router;
