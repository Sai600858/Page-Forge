import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import { PassThrough } from 'stream';

// Helper to parse page ranges: "1-2, 4, 6-8" => [[1, 2], [4, 4], [6, 8]]
export const parseRanges = (rangeStr, totalPages) => {
  if (!rangeStr || !rangeStr.trim()) {
    throw new Error('Split ranges must not be empty');
  }

  const parts = rangeStr.split(',');
  const ranges = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end) || start < 1 || end < start || start > totalPages || end > totalPages) {
        throw new Error(`Invalid range: ${trimmed}. Page count is ${totalPages}`);
      }
      ranges.push({ start, end });
    } else {
      const page = parseInt(trimmed, 10);
      if (isNaN(page) || page < 1 || page > totalPages) {
        throw new Error(`Invalid page number: ${trimmed}. Page count is ${totalPages}`);
      }
      ranges.push({ start: page, end: page });
    }
  }

  if (ranges.length === 0) {
    throw new Error('No valid ranges found');
  }

  return ranges;
};

export const splitPDF = async (filePath, rangeStr) => {
  const pdfBytes = fs.readFileSync(filePath);
  const sourcePdf = await PDFDocument.load(pdfBytes);
  const totalPages = sourcePdf.getPageCount();

  const ranges = parseRanges(rangeStr, totalPages);

  // If there's only one range, return it as a single PDF buffer
  if (ranges.length === 1) {
    const range = ranges[0];
    const newPdf = await PDFDocument.create();
    
    const pageIndices = [];
    for (let i = range.start - 1; i <= range.end - 1; i++) {
      pageIndices.push(i);
    }

    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    
    const buffer = await newPdf.save();
    return {
      data: buffer,
      isZip: false,
      filename: `split_${range.start}_to_${range.end}.pdf`,
      mimeType: 'application/pdf'
    };
  }

  // If there are multiple ranges, package them in a ZIP
  const archive = archiver('zip', { zlib: { level: 9 } });
  const outputStream = new PassThrough();
  const buffers = [];

  outputStream.on('data', (chunk) => buffers.push(chunk));
  
  const zipPromise = new Promise((resolve, reject) => {
    outputStream.on('end', () => resolve(Buffer.concat(buffers)));
    outputStream.on('error', (err) => reject(err));
    archive.on('error', (err) => reject(err));
  });

  archive.pipe(outputStream);

  for (let idx = 0; idx < ranges.length; idx++) {
    const range = ranges[idx];
    const newPdf = await PDFDocument.create();
    
    const pageIndices = [];
    for (let i = range.start - 1; i <= range.end - 1; i++) {
      pageIndices.push(i);
    }

    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    
    const pdfBuffer = await newPdf.save();
    archive.append(Buffer.from(pdfBuffer), { name: `part_${idx + 1}_pages_${range.start}-${range.end}.pdf` });
  }

  await archive.finalize();
  const zipBuffer = await zipPromise;

  return {
    data: zipBuffer,
    isZip: true,
    filename: 'split_pdfs.zip',
    mimeType: 'application/zip'
  };
};
