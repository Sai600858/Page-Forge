import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';

// Helper to convert hex color (#RRGGBB) to pdf-lib rgb object
const hexToRgbColor = (hex) => {
  if (!hex) return rgb(0, 0, 0); // Default to black
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  return rgb(
    isNaN(r) ? 0 : r,
    isNaN(g) ? 0 : g,
    isNaN(b) ? 0 : b
  );
};

export const editPDF = async (filePath, elements) => {
  if (!elements || !Array.isArray(elements)) {
    throw new Error('Elements must be an array');
  }

  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Load standard Helvetica font
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

  const fontMap = {
    'helvetica': helveticaFont,
    'helvetica-bold': helveticaBoldFont,
    'times-roman': timesFont,
    'courier': courierFont
  };

  for (const el of elements) {
    const pageIndex = el.page - 1;
    if (pageIndex < 0 || pageIndex >= pdfDoc.getPageCount()) {
      continue; // Skip out of range pages
    }

    const page = pdfDoc.getPage(pageIndex);
    const pageHeight = page.getHeight();
    const color = hexToRgbColor(el.color);

    switch (el.type) {
      case 'text': {
        const selectedFont = fontMap[el.fontFamily?.toLowerCase()] || helveticaFont;
        const fontSize = el.fontSize || 12;
        
        // Map top-left y-coord to bottom-left PDF coord
        // We subtract the fontSize to make it top-left aligned rather than baseline aligned
        const xPdf = el.x;
        const yPdf = pageHeight - el.y - fontSize;

        page.drawText(el.text || '', {
          x: xPdf,
          y: yPdf,
          size: fontSize,
          font: selectedFont,
          color: color
        });
        break;
      }
      
      case 'image':
      case 'signature': {
        if (!el.imageBuffer) break;

        let img;
        const dataUrl = el.imageBuffer;
        
        try {
          if (dataUrl.startsWith('data:image/png;base64,')) {
            const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
            img = await pdfDoc.embedPng(bytes);
          } else if (dataUrl.startsWith('data:image/jpeg;base64,') || dataUrl.startsWith('data:image/jpg;base64,')) {
            const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
            img = await pdfDoc.embedJpg(bytes);
          } else {
            // Assume raw base64 png if no prefix
            const bytes = Buffer.from(dataUrl, 'base64');
            img = await pdfDoc.embedPng(bytes);
          }
        } catch (err) {
          console.error('Failed to embed image:', err);
          break;
        }

        const width = el.width || img.width;
        const height = el.height || img.height;

        // Map top-left web y to bottom-left PDF y
        const xPdf = el.x;
        const yPdf = pageHeight - el.y - height;

        page.drawImage(img, {
          x: xPdf,
          y: yPdf,
          width: width,
          height: height
        });
        break;
      }

      case 'shape': {
        const thickness = el.thickness || 2;
        const fill = el.fill || false;
        
        if (el.shapeType === 'rectangle') {
          const width = el.width || 50;
          const height = el.height || 50;
          const xPdf = el.x;
          const yPdf = pageHeight - el.y - height;

          page.drawRectangle({
            x: xPdf,
            y: yPdf,
            width: width,
            height: height,
            borderWidth: thickness,
            borderColor: color,
            color: fill ? color : undefined
          });
        } else if (el.shapeType === 'circle') {
          const radius = el.radius || 25;
          // Web circle center (x, y) maps to PDF (x, pageHeight - y)
          const xPdf = el.x;
          const yPdf = pageHeight - el.y;

          page.drawCircle({
            x: xPdf,
            y: yPdf,
            radius: radius,
            borderWidth: thickness,
            borderColor: color,
            color: fill ? color : undefined
          });
        } else if (el.shapeType === 'line') {
          const x1Pdf = el.x1 || el.x;
          const y1Pdf = pageHeight - (el.y1 || el.y);
          const x2Pdf = el.x2 || (el.x + 50);
          const y2Pdf = pageHeight - (el.y2 || (el.y + 50));

          page.drawLine({
            start: { x: x1Pdf, y: y1Pdf },
            end: { x: x2Pdf, y: y2Pdf },
            thickness: thickness,
            color: color
          });
        }
        break;
      }

      default:
        console.warn(`Unknown element type: ${el.type}`);
    }
  }

  const outputBytes = await pdfDoc.save();
  return outputBytes;
};
