/**
 * @file pdf.routes.js
 * @description Express Router configuration for PDF file operations: merging, splitting, reordering/organizing, and overlaying edit elements.
 */

import express from 'express';
import upload from '../middleware/upload.middleware.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import { 
  handleMerge, 
  handleSplit, 
  handleOrganize, 
  handleEdit 
} from '../controllers/pdf.controller.js';

const router = express.Router();

/**
 * Route: POST /api/pdf/merge
 * Description: Merges two or more PDF documents into a single document.
 * Payload: Multipart form-data containing array of files under field name 'files'.
 */
router.post('/merge', optionalAuth, upload.array('files'), handleMerge);

/**
 * Route: POST /api/pdf/split
 * Description: Splits a PDF document into multiple chunks based on page range rules.
 * Payload: Multipart form-data with 'file' and 'splitPages' range rules.
 */
router.post('/split', optionalAuth, upload.single('file'), handleSplit);

/**
 * Route: POST /api/pdf/organize
 * Description: Visually reorganizes page indexes (reorder, rotate, delete, insert blanks).
 * Payload: Multipart form-data with 'file' and JSON-encoded operations string.
 */
router.post('/organize', optionalAuth, upload.single('file'), handleOrganize);

/**
 * Route: POST /api/pdf/edit
 * Description: Overlays graphics, images, signatures, or styled texts on canvas coordinates.
 * Payload: Multipart form-data with 'file' and JSON-encoded elements overlay metadata.
 */
router.post('/edit', optionalAuth, upload.single('file'), handleEdit);

export default router;
