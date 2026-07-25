import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

export const mergePDFs = async (filePaths) => {
  if (!filePaths || filePaths.length === 0) {
    throw new Error('No files provided for merging');
  }

  const mergedPdf = await PDFDocument.create();

  for (const filePath of filePaths) {
    const pdfBytes = fs.readFileSync(filePath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedPdfBytes = await mergedPdf.save();
  return mergedPdfBytes;
};
