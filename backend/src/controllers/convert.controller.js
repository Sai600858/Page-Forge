import fs from 'fs';
import path from 'path';
import { wordToPdf, pdfToWord } from '../services/convert.service.js';
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
 * Controller: handleWordToPdf
 * Description: Converts an uploaded Microsoft Word docx file to PDF format.
 * Request: req.file (.docx file)
 * Response: 200 OK with PDF file attachment stream
 */
export const handleWordToPdf = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a Word (.docx) file to convert.' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext !== '.docx') {
    safeUnlink(req.file.path);
    return res.status(400).json({ error: 'Only .docx files are supported for Word to PDF conversion.' });
  }

  try {
    const pdfBytes = await wordToPdf(req.file.path);

    const baseName = path.basename(req.file.originalname, '.docx');
    const outputFilename = `${baseName}_converted.pdf`;

    // Background S3 upload of output PDF
    const s3Key = `outputs/converted-${Date.now()}-${outputFilename}`;
    uploadBufferToS3(Buffer.from(pdfBytes), s3Key, 'application/pdf');

    // Log history if logged in
    if (req.user) {
      const isS3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME;
      await addHistoryEntry(req.user.id, {
        filename: outputFilename,
        operation: 'convert',
        fileUrl: isS3 ? s3Key : null,
        metadata: { from: 'docx', to: 'pdf' }
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Word to PDF handler error:', err);
    res.status(500).json({ error: err.message || 'Failed to convert Word to PDF.' });
  } finally {
    safeUnlink(req.file.path);
  }
};

/**
 * Controller: handlePdfToWord
 * Description: Converts an uploaded PDF file to Microsoft Word (.docx) format by extracting text.
 * Request: req.file (.pdf file)
 * Response: 200 OK with Word docx file attachment stream
 */
export const handlePdfToWord = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a PDF file to convert.' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    safeUnlink(req.file.path);
    return res.status(400).json({ error: 'Only PDF files are supported for PDF to Word conversion.' });
  }

  try {
    const docxBuffer = await pdfToWord(req.file.path);

    const baseName = path.basename(req.file.originalname, '.pdf');
    const outputFilename = `${baseName}_converted.docx`;

    // Background S3 upload of output Word file
    const s3Key = `outputs/converted-${Date.now()}-${outputFilename}`;
    uploadBufferToS3(Buffer.from(docxBuffer), s3Key, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    // Log history if logged in
    if (req.user) {
      const isS3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME;
      await addHistoryEntry(req.user.id, {
        filename: outputFilename,
        operation: 'convert',
        fileUrl: isS3 ? s3Key : null,
        metadata: { from: 'pdf', to: 'docx' }
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
    res.send(Buffer.from(docxBuffer));
  } catch (err) {
    console.error('PDF to Word handler error:', err);
    res.status(500).json({ error: err.message || 'Failed to convert PDF to Word.' });
  } finally {
    safeUnlink(req.file.path);
  }
};
