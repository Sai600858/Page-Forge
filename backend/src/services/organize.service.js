import { PDFDocument, PageSizes, degrees } from 'pdf-lib';
import fs from 'fs';

export const organizePDF = async (filePath, operations) => {
  if (!operations || !Array.isArray(operations)) {
    throw new Error('Operations must be an array');
  }

  const pdfBytes = fs.readFileSync(filePath);
  const sourcePdf = await PDFDocument.load(pdfBytes);
  const totalPages = sourcePdf.getPageCount();

  // Create initial page state array (1-indexed for matching operations)
  let pagesState = Array.from({ length: totalPages }, (_, i) => {
    const page = sourcePdf.getPage(i);
    return {
      type: 'source',
      originalIndex: i,
      rotation: page.getRotation().angle || 0,
      width: page.getWidth(),
      height: page.getHeight()
    };
  });

  // Apply operations in sequence
  for (const op of operations) {
    switch (op.type) {
      case 'delete': {
        // op.pages is an array of 1-based page numbers (relative to current state)
        const deleteIndices = op.pages.map(p => p - 1);
        pagesState = pagesState.filter((_, idx) => !deleteIndices.includes(idx));
        break;
      }
      case 'rotate': {
        // op.page is 1-based, op.angle is in degrees (e.g. 90, 180, 270)
        const idx = op.page - 1;
        if (pagesState[idx]) {
          pagesState[idx].rotation = (pagesState[idx].rotation + op.angle) % 360;
        }
        break;
      }
      case 'blank': {
        // op.page is 1-based reference, op.position is 'before' or 'after'
        const refIdx = op.page - 1;
        const insertIdx = op.position === 'after' ? refIdx + 1 : refIdx;
        
        // Default size is A4, or match the size of reference page if available
        let width = PageSizes.A4[0];
        let height = PageSizes.A4[1];
        if (pagesState[refIdx]) {
          width = pagesState[refIdx].width;
          height = pagesState[refIdx].height;
        }

        const newBlankPage = {
          type: 'blank',
          rotation: 0,
          width,
          height
        };
        
        pagesState.splice(insertIdx, 0, newBlankPage);
        break;
      }
      case 'reorder': {
        // op.order is an array of 1-based page numbers representing the new layout
        if (!Array.isArray(op.order) || op.order.length !== pagesState.length) {
          throw new Error('Reorder order array length must match the current page count');
        }
        pagesState = op.order.map(pos => pagesState[pos - 1]);
        break;
      }
      default:
        throw new Error(`Unsupported operation type: ${op.type}`);
    }
  }

  // Create the final PDF document
  const finalPdf = await PDFDocument.create();

  // Process the final pagesState mapping
  for (const pageInfo of pagesState) {
    if (pageInfo.type === 'source') {
      const [copiedPage] = await finalPdf.copyPages(sourcePdf, [pageInfo.originalIndex]);
      copiedPage.setRotation(degrees(pageInfo.rotation));
      finalPdf.addPage(copiedPage);
    } else if (pageInfo.type === 'blank') {
      const blankPage = finalPdf.addPage([pageInfo.width, pageInfo.height]);
      blankPage.setRotation(degrees(pageInfo.rotation));
    }
  }

  const outputBytes = await finalPdf.save();
  return outputBytes;
};
