/**
 * @file pdf.controller.js
 * @description Controllers mapping Express route requests to PDF processing actions: merging, splitting, reordering, and overlay edits.
 */

import fs from 'fs';
import { mergePDFs } from '../services/merge.service.js';
import { splitPDF } from '../services/split.service.js';
import { organizePDF } from '../services/organize.service.js';
import { editPDF } from '../services/edit.service.js';
import { uploadFileToS3, uploadBufferToS3 } from '../services/s3.service.js';
import { addHistoryEntry } from './history.controller.js';

/**
 * Safely unlinks a temporary file from the disk.
 * @param {string} filePath - Absolute path to the file.
 */
const safeUnlink = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Failed to delete temporary file ${filePath}:`, err);
    });
  }
};

/**
 * Controller: handleMerge
 * Description: Merges multiple uploaded PDF files.
 * Request: req.files (array of uploaded files)
 * Response: 200 OK with merged PDF binary stream
 */
export const handleMerge = async (req, res) => {
  const filePaths = req.files?.map(file => file.path) || [];
  
  if (filePaths.length < 2) {
    filePaths.forEach(safeUnlink);
    return res.status(400).json({ error: 'Please upload at least 2 PDF files to merge.' });
  }

  try {
    const mergedBytes = await mergePDFs(filePaths);
    
    const firstFilename = req.files[0]?.originalname || 'document.pdf';
    const baseName = firstFilename.substring(0, firstFilename.lastIndexOf('.')) || firstFilename;
    const outputFilename = `${baseName}_merged.pdf`;

    // Background S3 upload of output file
    const s3Key = `outputs/merged-${Date.now()}-${outputFilename}`;
    uploadBufferToS3(Buffer.from(mergedBytes), s3Key, 'application/pdf');

    // Log history if logged in
    if (req.user) {
      const isS3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME;
      await addHistoryEntry(req.user.id, {
        filename: outputFilename,
        operation: 'merge',
        fileUrl: isS3 ? s3Key : null,
        metadata: { filesCount: filePaths.length }
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
    res.send(Buffer.from(mergedBytes));
  } catch (err) {
    console.error('Merge handler error:', err);
    res.status(500).json({ error: err.message || 'Failed to merge PDFs' });
  } finally {
    filePaths.forEach(safeUnlink);
  }
};

/**
 * Controller: handleSplit
 * Description: Splits a single uploaded PDF file.
 * Request: req.file (PDF file), req.body.splitPages (string range, e.g. "1-2, 4")
 * Response: 200 OK with split PDF or ZIP stream containing splits
 */
export const handleSplit = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a PDF file to split.' });
  }

  const { splitPages } = req.body;
  if (!splitPages) {
    safeUnlink(req.file.path);
    return res.status(400).json({ error: 'Split page ranges (splitPages) are required.' });
  }

  try {
    const result = await splitPDF(req.file.path, splitPages);

    const originalName = req.file.originalname;
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const ext = result.filename.endsWith('.zip') ? '.zip' : '.pdf';
    const outputFilename = `${baseName}_split${ext}`;

    // Background S3 upload of output file
    const s3Key = `outputs/split-${Date.now()}-${outputFilename}`;
    uploadBufferToS3(Buffer.from(result.data), s3Key, result.mimeType);

    // Log history if logged in
    if (req.user) {
      const isS3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME;
      await addHistoryEntry(req.user.id, {
        filename: outputFilename,
        operation: 'split',
        fileUrl: isS3 ? s3Key : null,
        metadata: { splitPages }
      });
    }

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
    res.send(Buffer.from(result.data));
  } catch (err) {
    console.error('Split handler error:', err);
    res.status(500).json({ error: err.message || 'Failed to split PDF' });
  } finally {
    safeUnlink(req.file.path);
  }
};

/**
 * Controller: handleOrganize
 * Description: Reorganizes page layouts (deletions, rotations, blank insertions, reordering).
 * Request: req.file (PDF file), req.body.operations (JSON array of operations)
 * Response: 200 OK with reorganized PDF stream
 */
export const handleOrganize = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a PDF file to organize.' });
  }

  let operations;
  try {
    operations = typeof req.body.operations === 'string' 
      ? JSON.parse(req.body.operations) 
      : req.body.operations;
  } catch (err) {
    safeUnlink(req.file.path);
    return res.status(400).json({ error: 'Invalid operations format. Must be JSON.' });
  }

  if (!operations || !Array.isArray(operations)) {
    safeUnlink(req.file.path);
    return res.status(400).json({ error: 'Operations array is required.' });
  }

  try {
    const organizedBytes = await organizePDF(req.file.path, operations);

    const originalName = req.file.originalname;
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const outputFilename = `${baseName}_organized.pdf`;

    // Background S3 upload of output file
    const s3Key = `outputs/organized-${Date.now()}-${outputFilename}`;
    uploadBufferToS3(Buffer.from(organizedBytes), s3Key, 'application/pdf');

    // Log history if logged in
    if (req.user) {
      const isS3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME;
      await addHistoryEntry(req.user.id, {
        filename: outputFilename,
        operation: 'organize',
        fileUrl: isS3 ? s3Key : null,
        metadata: { operationsCount: operations.length }
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
    res.send(Buffer.from(organizedBytes));
  } catch (err) {
    console.error('Organize handler error:', err);
    res.status(500).json({ error: err.message || 'Failed to organize PDF' });
  } finally {
    safeUnlink(req.file.path);
  }
};

/**
 * Controller: handleEdit
 * Description: Places layout overlays (texts, images, shapes, signatures) onto the PDF.
 * Request: req.file (PDF file), req.body.elements (JSON array of overlay element data)
 * Response: 200 OK with modified PDF stream
 */
export const handleEdit = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a PDF file to edit.' });
  }

  let elements;
  try {
    elements = typeof req.body.elements === 'string' 
      ? JSON.parse(req.body.elements) 
      : req.body.elements;
  } catch (err) {
    safeUnlink(req.file.path);
    return res.status(400).json({ error: 'Invalid elements format. Must be JSON.' });
  }

  if (!elements || !Array.isArray(elements)) {
    safeUnlink(req.file.path);
    return res.status(400).json({ error: 'Elements array is required.' });
  }

  try {
    const editedBytes = await editPDF(req.file.path, elements);

    const originalName = req.file.originalname;
    const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const outputFilename = `${baseName}_edited.pdf`;

    // Background S3 upload of output file
    const s3Key = `outputs/edited-${Date.now()}-${outputFilename}`;
    uploadBufferToS3(Buffer.from(editedBytes), s3Key, 'application/pdf');

    // Log history if logged in
    if (req.user) {
      const isS3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME;
      await addHistoryEntry(req.user.id, {
        filename: outputFilename,
        operation: 'edit',
        fileUrl: isS3 ? s3Key : null,
        metadata: { elementsCount: elements.length }
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
    res.send(Buffer.from(editedBytes));
  } catch (err) {
    console.error('Edit handler error:', err);
    res.status(500).json({ error: err.message || 'Failed to edit PDF' });
  } finally {
    safeUnlink(req.file.path);
  }
};
